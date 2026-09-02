// documentEditor — "edit my document and give it back in the same format."
//
// Round-trip: an uploaded file -> extract its content to Markdown (the lingua franca) -> an agent
// applies the user's instruction ("go through it and add relevant info") -> write the edited content
// BACK to the original format (.docx via the `docx` package, .pdf regenerated via Chromium, .md/.txt
// directly). Reuses the same LLM chain as the rest of Hatchin (DeepSeek primary). Excel (.xlsx) is a
// separate follow-on (needs a spreadsheet library, not yet installed).
//
// The edit step is deliberately conservative: preserve existing content + structure, add/improve
// relevantly, never invent facts or fabricate citations — same honesty bar as the agents' chat replies.
import path from 'path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { generateChatWithRuntimeFallback } from '../llm/providerResolver.js';
import { markdownToDocx } from './markdownToDocx.js';
import { markdownToPdf } from './markdownToPdf.js';
import { xlsxToMarkdown, markdownToXlsx, csvToMarkdown, markdownToCsv } from './spreadsheet.js';

export const SUPPORTED_EXTS = ['.docx', '.pdf', '.md', '.txt', '.xlsx', '.csv'] as const;
export type SupportedExt = (typeof SUPPORTED_EXTS)[number];

export interface EditDocumentInput {
  buffer: Buffer;
  filename: string;      // original filename (extension decides format)
  instruction: string;   // what the user wants done ("add a section on X", "tighten the intro", ...)
  agentRole?: string;    // optional role voice for the edit
}
export interface EditDocumentResult {
  buffer: Buffer;
  filename: string;      // <base>-edited.<ext>
  mime: string;
  ext: SupportedExt;
  originalChars: number;
  editedChars: number;
  addedSections: string[]; // headings present in the edit but not the original
  keptSections: number;    // original headings still present
  summary: string;         // one honest sentence for the chat reply
}

// Section titles from markdown headings, for a deterministic (free) change summary.
function headings(md: string): string[] {
  return (md.match(/^#{1,4}\s+.+$/gm) || []).map((h) => h.replace(/^#{1,4}\s+/, '').trim());
}
function buildSummary(filename: string, addedSections: string[], keptSections: number): string {
  if (addedSections.length && keptSections) {
    return `Added ${addedSections.length === 1 ? 'a new section' : `${addedSections.length} new sections`} (${addedSections.join(', ')}) and kept your ${keptSections} existing section${keptSections === 1 ? '' : 's'}.`;
  }
  if (addedSections.length) return `Added ${addedSections.length} new section${addedSections.length === 1 ? '' : 's'}: ${addedSections.join(', ')}.`;
  return `Applied your requested changes throughout the document.`;
}

const MIME: Record<SupportedExt, string> = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
};

export function isSupportedDocument(filename: string): boolean {
  return (SUPPORTED_EXTS as readonly string[]).includes(path.extname(filename).toLowerCase());
}

async function extractToMarkdown(buffer: Buffer, ext: string): Promise<string> {
  switch (ext) {
    case '.md':
    case '.txt':
      return buffer.toString('utf-8');
    case '.docx': {
      // convertToMarkdown exists at runtime but is missing from mammoth's TS types.
      const r = await (mammoth as any).convertToMarkdown({ buffer });
      return (r?.value as string) ?? '';
    }
    case '.pdf': {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const r = await parser.getText();
      return r.text;
    }
    case '.xlsx':
      return await xlsxToMarkdown(buffer);
    case '.csv':
      return csvToMarkdown(buffer.toString('utf-8'));
    default:
      throw new Error(`Unsupported document type: ${ext}`);
  }
}

async function agentEdit(currentMarkdown: string, instruction: string, agentRole?: string): Promise<string> {
  const who = agentRole ? `a professional ${agentRole}` : 'a meticulous professional editor';
  const system =
    `You are ${who} editing a document for its owner. Below is the CURRENT document in Markdown. ` +
    `Apply the user's instruction faithfully. Rules: PRESERVE the existing content and structure ` +
    `unless the instruction explicitly says to change or remove it; ADD or improve information ` +
    `relevantly and accurately where asked; NEVER invent facts, numbers, or citations; keep the ` +
    `author's tone. Return the COMPLETE updated document in clean Markdown (use #/##/### for headings, ` +
    `**bold**, and - for bullets). Output ONLY the document itself, with no preamble, no commentary, ` +
    `and no code fences.`;
  const user = `Instruction: ${instruction}\n\n--- CURRENT DOCUMENT ---\n${currentMarkdown}\n--- END DOCUMENT ---\n\nReturn the full updated document in Markdown now:`;
  const res = await generateChatWithRuntimeFallback({
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    maxTokens: 8000,
    temperature: 0.4,
  });
  let out = (res.content || '').trim();
  // Strip an accidental leading/trailing ``` fence if the model added one.
  out = out.replace(/^```(?:markdown|md)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  return out;
}

function markdownToPlainText(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')      // headings -> text
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold -> text
    .replace(/^\s*[-*]\s+/gm, '• ');   // bullets -> a real bullet char
}

export async function editDocument(input: EditDocumentInput): Promise<EditDocumentResult> {
  const ext = path.extname(input.filename).toLowerCase() as SupportedExt;
  if (!(SUPPORTED_EXTS as readonly string[]).includes(ext)) {
    throw new Error(`Unsupported document type: ${ext}. Supported: ${SUPPORTED_EXTS.join(', ')}`);
  }
  const currentMarkdown = await extractToMarkdown(input.buffer, ext);
  if (!currentMarkdown.trim()) throw new Error('Could not read any content from the document.');

  const editedMarkdown = await agentEdit(currentMarkdown, input.instruction, input.agentRole);
  if (!editedMarkdown.trim()) throw new Error('The edit produced no content; original left unchanged.');

  const base = path.basename(input.filename, ext);
  let outBuffer: Buffer;
  switch (ext) {
    case '.md':
      outBuffer = Buffer.from(editedMarkdown, 'utf-8');
      break;
    case '.txt':
      outBuffer = Buffer.from(markdownToPlainText(editedMarkdown), 'utf-8');
      break;
    case '.docx':
      outBuffer = await markdownToDocx(editedMarkdown);
      break;
    case '.pdf':
      outBuffer = await markdownToPdf(editedMarkdown, base);
      break;
    case '.xlsx':
      outBuffer = await markdownToXlsx(editedMarkdown);
      break;
    case '.csv':
      outBuffer = Buffer.from(markdownToCsv(editedMarkdown), 'utf-8');
      break;
  }

  const origH = headings(currentMarkdown);
  const newH = headings(editedMarkdown);
  const addedSections = newH.filter((h) => !origH.includes(h));
  const keptSections = origH.filter((h) => newH.includes(h)).length;

  return {
    buffer: outBuffer!,
    filename: `${base}-edited${ext}`,
    mime: MIME[ext],
    ext,
    originalChars: currentMarkdown.length,
    editedChars: editedMarkdown.length,
    addedSections,
    keptSections,
    summary: buildSummary(base, addedSections, keptSections),
  };
}
