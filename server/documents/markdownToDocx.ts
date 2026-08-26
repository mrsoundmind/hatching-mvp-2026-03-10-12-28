// markdownToDocx — convert a Markdown string into a real .docx buffer using the `docx` package.
// v1 covers the structure agents actually produce: # headings (1-4), - / * bullets, **bold**, and
// paragraphs. Numbered lines keep their "1." prefix as plain text (docx numbering config is heavier;
// out of scope for v1). This is the "write back to Word" half of the document round-trip editor.
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];

// Split a line into runs, turning **bold** into bold runs.
function inlineRuns(text: string): TextRun[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p.length > 0);
  if (parts.length === 0) return [new TextRun('')];
  return parts.map((p) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/);
    return m ? new TextRun({ text: m[1], bold: true }) : new TextRun(p);
  });
}

export async function markdownToDocx(md: string): Promise<Buffer> {
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n');
  const children: Paragraph[] = [];

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) {
      children.push(new Paragraph({ children: [] })); // blank line = spacing
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      children.push(new Paragraph({ heading: HEADINGS[m[1].length - 1], children: inlineRuns(m[2]) }));
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      children.push(new Paragraph({ bullet: { level: 0 }, children: inlineRuns(m[1]) }));
    } else {
      // paragraphs and numbered lines (number kept inline)
      children.push(new Paragraph({ children: inlineRuns(line) }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBuffer(doc);
}
