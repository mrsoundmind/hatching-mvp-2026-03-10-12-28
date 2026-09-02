// Spreadsheet round-trip for the document editor. A spreadsheet is not prose, so we bridge it through
// Markdown TABLES (one per sheet), which the LLM can read and edit ("add a Total column", "add a row for
// Q4"), then write back to a real .xlsx (via exceljs) or .csv. v1 handles tabular data (headers + rows);
// formulas, charts, merged cells, and formatting are NOT preserved (the same regenerate tradeoff as PDF).
import ExcelJS from 'exceljs';

const MAX_ROWS_PER_SHEET = Number(process.env.DOC_XLSX_MAX_ROWS ?? 300);

function cellText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    const o = v as any;
    if (typeof o.text === 'string') return o.text;              // rich text
    if (typeof o.result !== 'undefined') return String(o.result); // formula result
    if (o.richText) return o.richText.map((r: any) => r.text).join('');
    if (o.hyperlink) return String(o.text ?? o.hyperlink);
    return String(o.formula ?? '');
  }
  return String(v);
}
// A cell can't contain a raw | in a markdown table; soften it so the table stays parseable.
const esc = (s: string) => s.replace(/\r?\n/g, ' ').replace(/\|/g, '/').trim();

// ---------- read side ----------
export async function xlsxToMarkdown(buffer: Buffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const parts: string[] = [];
  wb.eachSheet((sheet) => {
    const rows: string[][] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > MAX_ROWS_PER_SHEET + 1) return;
      const vals = (row.values as unknown[]).slice(1); // exceljs values are 1-indexed
      rows.push(vals.map(cellText));
    });
    if (!rows.length) return;
    const width = Math.max(...rows.map((r) => r.length), 1);
    const norm = rows.map((r) => { const c = r.slice(0, width); while (c.length < width) c.push(''); return c; });
    const header = norm[0];
    const body = norm.slice(1);
    parts.push(`## ${sheet.name}\n`);
    parts.push(`| ${header.map(esc).join(' | ')} |`);
    parts.push(`| ${header.map(() => '---').join(' | ')} |`);
    for (const r of body) parts.push(`| ${r.map(esc).join(' | ')} |`);
    parts.push('');
  });
  return parts.join('\n');
}

export function csvToMarkdown(text: string): string {
  const rows = parseCsv(text);
  if (!rows.length) return '';
  const width = Math.max(...rows.map((r) => r.length), 1);
  const norm = rows.map((r) => { const c = r.slice(0, width); while (c.length < width) c.push(''); return c; });
  const out = [`| ${norm[0].map(esc).join(' | ')} |`, `| ${norm[0].map(() => '---').join(' | ')} |`];
  for (const r of norm.slice(1)) out.push(`| ${r.map(esc).join(' | ')} |`);
  return out.join('\n');
}

// ---------- write side ----------
interface Sheet { name: string; headers: string[]; rows: string[][] }

// Parse "## Sheet" sections each containing a markdown table into structured sheets.
function parseMarkdownTables(md: string): Sheet[] {
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n');
  const sheets: Sheet[] = [];
  let name = 'Sheet1';
  let table: string[][] = [];
  const flush = () => {
    if (table.length) {
      const headers = table[0] || [];
      const rows = table.slice(1).filter((r) => !/^-{3,}$/.test((r[0] || '').trim())); // drop the |---| separator
      sheets.push({ name, headers, rows });
    }
    table = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) { flush(); name = h[1].trim() || `Sheet${sheets.length + 1}`; continue; }
    if (line.startsWith('|')) {
      if (/^\|[\s:|-]+\|?$/.test(line)) continue; // separator row
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      table.push(cells);
    }
  }
  flush();
  return sheets.filter((s) => s.headers.length);
}

export async function markdownToXlsx(md: string): Promise<Buffer> {
  const sheets = parseMarkdownTables(md);
  const wb = new ExcelJS.Workbook();
  const src = sheets.length ? sheets : [{ name: 'Sheet1', headers: ['(empty)'], rows: [] }];
  const used = new Set<string>();
  for (const s of src) {
    let nm = (s.name || 'Sheet1').slice(0, 31).replace(/[\\/?*[\]:]/g, ' ').trim() || 'Sheet1';
    while (used.has(nm.toLowerCase())) nm = `${nm.slice(0, 28)}_${used.size + 1}`;
    used.add(nm.toLowerCase());
    const ws = wb.addWorksheet(nm);
    ws.addRow(s.headers);
    ws.getRow(1).font = { bold: true };
    for (const r of s.rows) ws.addRow(r);
    ws.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: false }, (c) => { max = Math.max(max, cellText(c.value).length + 2); });
      col.width = Math.min(max, 60);
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

export function markdownToCsv(md: string): string {
  const sheets = parseMarkdownTables(md);
  const first = sheets[0];
  if (!first) return '';
  const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [first.headers, ...first.rows].map((r) => r.map(q).join(',')).join('\n');
}

// minimal RFC-4180-ish CSV parser (handles quotes + embedded commas/newlines)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = '', inQ = false;
  const t = (text || '').replace(/\r\n/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inQ) {
      if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
