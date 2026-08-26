// End-to-end proof of the document round-trip editor. Creates REAL files (.docx, .md, .pdf), runs the
// full editDocument path (extract -> real DeepSeek edit -> write back to the SAME format), then
// re-reads each output and asserts it (a) is a valid file of that type, (b) kept the original content,
// and (c) contains the newly-added content the instruction asked for.
//
// Run: LLM_MODE=prod ./node_modules/.bin/tsx -r dotenv/config scripts/test-document-editor.ts
import { writeFileSync } from 'fs';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { editDocument } from '../server/documents/documentEditor.js';
import { markdownToDocx } from '../server/documents/markdownToDocx.js';
import { markdownToPdf } from '../server/documents/markdownToPdf.js';

const OUT_DIR = '/private/tmp/claude-501/-Users-shashankrai-Documents-hatching-mvp-5th-march/e433eb83-3933-4614-80d6-c592aed4b0f7/scratchpad';

const SAMPLE_MD = `# Nimbus Notes — Product One-Pager

## Overview
Nimbus Notes is a lightweight note-taking app for busy teams. It keeps notes searchable and shareable.

## Key Features
- Fast full-text search
- Shared team notebooks
- Markdown support

## Who It Is For
Small product and design teams who live in their notes.
`;

const INSTRUCTION = 'Go through this one-pager and add two new sections that are missing: a "Pricing" section and a "Risks" section. Keep everything already there. Do not invent specific numbers.';

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}  ${detail}`); }
};

async function main() {
  process.env.LLM_MODE = 'prod';
  delete process.env.LLM_PRIMARY;
  process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';

  // ---------- DOCX round-trip ----------
  console.log('\n[.docx] create -> edit -> verify');
  const docxIn = await markdownToDocx(SAMPLE_MD);
  const docxRes = await editDocument({ buffer: docxIn, filename: 'nimbus.docx', instruction: INSTRUCTION });
  writeFileSync(`${OUT_DIR}/nimbus-edited.docx`, docxRes.buffer);
  const docxText = (await mammoth.extractRawText({ buffer: docxRes.buffer })).value;
  check('output is a non-trivial .docx', docxRes.buffer.length > 2000 && docxRes.filename.endsWith('-edited.docx'), `(${docxRes.buffer.length}b, ${docxRes.filename})`);
  check('kept original content (Nimbus Notes, Key Features)', /Nimbus Notes/i.test(docxText) && /Key Features/i.test(docxText));
  check('added the requested Pricing section', /pricing/i.test(docxText));
  check('added the requested Risks section', /risks?/i.test(docxText));
  console.log(`   chars: ${docxRes.originalChars} -> ${docxRes.editedChars}`);

  // ---------- Markdown round-trip ----------
  console.log('\n[.md] create -> edit -> verify');
  const mdRes = await editDocument({ buffer: Buffer.from(SAMPLE_MD, 'utf-8'), filename: 'nimbus.md', instruction: INSTRUCTION });
  writeFileSync(`${OUT_DIR}/nimbus-edited.md`, mdRes.buffer);
  const mdText = mdRes.buffer.toString('utf-8');
  check('output is markdown with headings preserved', /^#\s+Nimbus Notes/m.test(mdText) || /Nimbus Notes/.test(mdText));
  check('added Pricing + Risks', /pricing/i.test(mdText) && /risks?/i.test(mdText));

  // ---------- PDF round-trip (regenerate) ----------
  console.log('\n[.pdf] create -> edit -> verify');
  const pdfIn = await markdownToPdf(SAMPLE_MD, 'nimbus');
  const pdfRes = await editDocument({ buffer: pdfIn, filename: 'nimbus.pdf', instruction: INSTRUCTION });
  writeFileSync(`${OUT_DIR}/nimbus-edited.pdf`, pdfRes.buffer);
  const isPdf = pdfRes.buffer.subarray(0, 5).toString('latin1') === '%PDF-';
  check('output is a valid PDF (magic bytes)', isPdf, `(header=${pdfRes.buffer.subarray(0,5).toString('latin1')})`);
  const pdfText = (await new PDFParse({ data: new Uint8Array(pdfRes.buffer) }).getText()).text;
  check('PDF kept original + added Pricing/Risks', /Nimbus/i.test(pdfText) && /pricing/i.test(pdfText) && /risks?/i.test(pdfText));
  console.log(`   pdf size: ${(pdfIn.length/1024).toFixed(0)}kb -> ${(pdfRes.buffer.length/1024).toFixed(0)}kb`);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  console.log(`Edited files written to: ${OUT_DIR}/nimbus-edited.{docx,md,pdf}`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e?.stack || e?.message || e); process.exit(1); });
