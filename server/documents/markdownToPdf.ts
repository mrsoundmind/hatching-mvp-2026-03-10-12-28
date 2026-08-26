// markdownToPdf — render a Markdown string to a clean, well-typeset PDF via headless Chromium
// (playwright). This is the "regenerate a fresh PDF" approach (the same thing ChatGPT/Claude do —
// they scan the text and produce a new PDF, they do not surgically edit the original), and it
// replaces the basic pdfkit branding output. v1 markdown: # headings (1-4), - / * bullets, **bold**,
// paragraphs. Fail-safe is the caller's job (this throws if Chromium can't launch).
import { chromium } from 'playwright';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function inline(t: string): string {
  return esc(t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function mdToHtml(md: string): string {
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(m[1])}</li>`);
      continue;
    }
    closeList();
    if (!line.trim()) continue;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      const n = m[1].length;
      out.push(`<h${n}>${inline(m[2])}</h${n}>`);
    } else {
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}

export async function markdownToPdf(md: string, title = ''): Promise<Buffer> {
  const body = mdToHtml(md);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { margin: 2.2cm; }
  html { -webkit-print-color-adjust: exact; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #1c2024; line-height: 1.55; font-size: 11pt; }
  h1 { font-size: 21pt; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 12pt; }
  h2 { font-size: 15pt; font-weight: 700; margin: 20pt 0 7pt; padding-bottom: 3pt; border-bottom: 1px solid #e6e8eb; }
  h3 { font-size: 12.5pt; font-weight: 600; margin: 15pt 0 5pt; }
  h4 { font-size: 11.5pt; font-weight: 600; margin: 13pt 0 4pt; color: #3a4046; }
  p { margin: 0 0 9pt; }
  ul { margin: 0 0 9pt 18pt; padding: 0; }
  li { margin: 0 0 4pt; }
  strong { font-weight: 600; }
</style></head><body>${body}</body></html>`;

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
