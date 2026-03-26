/**
 * extractDocumentText — Extract plain text from uploaded document buffers.
 *
 * Supports: PDF (.pdf), DOCX (.docx), plain text (.txt), Markdown (.md)
 * All output is truncated to MAX_CHARS characters.
 * Any error or unsupported extension returns an empty string.
 */
import path from 'path';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

export const MAX_CHARS = 50_000;

/**
 * Extract text content from a document buffer.
 *
 * @param buffer - Raw file contents as a Node.js Buffer
 * @param filename - Original filename (used to determine file type by extension)
 * @returns Extracted text, truncated to MAX_CHARS. Returns '' on error or unsupported type.
 */
export async function extractDocumentText(buffer: Buffer, filename: string): Promise<string> {
  const ext = path.extname(filename).toLowerCase();

  try {
    switch (ext) {
      case '.pdf': {
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        const result = await parser.getText();
        return result.text.slice(0, MAX_CHARS);
      }
      case '.docx': {
        const result = await mammoth.extractRawText({ buffer });
        return result.value.slice(0, MAX_CHARS);
      }
      case '.txt':
      case '.md': {
        return buffer.toString('utf-8').slice(0, MAX_CHARS);
      }
      default:
        return '';
    }
  } catch {
    return '';
  }
}
