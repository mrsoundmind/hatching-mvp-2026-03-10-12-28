// Upload hardening — magic-byte sniffing so a renamed binary (or a mislabeled file) can't slip past an
// extension-only filter (audit INJ-2). Content-type validation is by actual bytes, not the filename.
// Text-framing against prompt injection already exists at the prompt layer; this is the binary gate.
import path from 'path';

export type AllowedExt = '.pdf' | '.docx' | '.txt' | '.md';
export const ALLOWED_EXTS: AllowedExt[] = ['.pdf', '.docx', '.txt', '.md'];

/** Heuristic: does this buffer look like human-readable text (no NUL bytes, mostly printable)? */
export function looksLikeText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 4096);
  if (sample.length === 0) return false;
  let control = 0;
  for (const b of sample) {
    if (b === 0) return false; // a NUL byte means binary
    // allow tab(9), LF(10), CR(13); count other C0 control chars as suspicious
    if (b < 9 || (b > 13 && b < 32)) control++;
  }
  return control / sample.length < 0.02;
}

export interface SniffResult {
  ok: boolean;
  ext: string;
  reason?: string;
}

/**
 * Validate that the file's real bytes match its claimed extension.
 * PDF  -> "%PDF-" header. DOCX -> ZIP local-file header "PK\x03\x04". TXT/MD -> looks like text.
 */
export function sniffUpload(buffer: Buffer, filename: string): SniffResult {
  const ext = path.extname(filename || '').toLowerCase();
  if (!ALLOWED_EXTS.includes(ext as AllowedExt)) {
    return { ok: false, ext, reason: 'Only PDF, DOCX, TXT, and MD files are supported' };
  }
  if (!buffer || buffer.length === 0) return { ok: false, ext, reason: 'File is empty' };
  const head = buffer.subarray(0, 8);
  switch (ext) {
    case '.pdf':
      return head.subarray(0, 5).toString('latin1') === '%PDF-'
        ? { ok: true, ext }
        : { ok: false, ext, reason: 'File is not a valid PDF' };
    case '.docx':
      // DOCX is a ZIP container; every ZIP starts with the local-file-header signature "PK\x03\x04".
      return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04
        ? { ok: true, ext }
        : { ok: false, ext, reason: 'File is not a valid DOCX' };
    case '.txt':
    case '.md':
      return looksLikeText(buffer)
        ? { ok: true, ext }
        : { ok: false, ext, reason: 'File does not look like plain text' };
    default:
      return { ok: false, ext, reason: 'Unsupported file type' };
  }
}
