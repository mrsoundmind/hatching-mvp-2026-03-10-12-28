// End-to-end test of the spreadsheet path (.xlsx + .csv) with a real DeepSeek edit.
// Creates a real .xlsx, edits it ("add a Design row + a Total column"), re-reads the output and asserts
// it's a valid Excel file that kept the original rows and gained the requested row/column.
// Run: LLM_MODE=prod ./node_modules/.bin/tsx -r dotenv/config scripts/test-spreadsheet-editor.ts
import ExcelJS from 'exceljs';
import { editDocument } from '../server/documents/documentEditor.js';
import { markdownToXlsx, xlsxToMarkdown } from '../server/documents/spreadsheet.js';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}  ${d}`)); };

const TABLE_MD = `## Budget
| Item | Q1 | Q2 |
| --- | --- | --- |
| Marketing | 1000 | 1200 |
| Engineering | 3000 | 3200 |
`;
const INSTRUCTION = 'Add a new row for "Design" with Q1 1500 and Q2 1600, and add a "Total" column equal to Q1 + Q2 for every row. Keep all existing rows and columns.';

async function main() {
  process.env.LLM_MODE = 'prod';
  delete process.env.LLM_PRIMARY;
  process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';

  // 1) build a real .xlsx (simulates an uploaded Excel file)
  const xlsxIn = await markdownToXlsx(TABLE_MD);
  check('built a valid .xlsx to start', xlsxIn.subarray(0, 4).toString('latin1') === 'PK\x03\x04'.slice(0, 4) || (xlsxIn[0] === 0x50 && xlsxIn[1] === 0x4b));

  // 2) edit it (real DeepSeek)
  console.log('[.xlsx] editing (real DeepSeek)...');
  const res = await editDocument({ buffer: xlsxIn, filename: 'Budget.xlsx', instruction: INSTRUCTION, agentRole: 'Finance Analyst' });
  check('output is Excel mime', res.mime.includes('spreadsheetml'));
  check('output filename is -edited.xlsx', res.filename === 'Budget-edited.xlsx', `(${res.filename})`);

  // 3) the edited file loads in exceljs and has the right shape
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(res.buffer as any);
  const md = await xlsxToMarkdown(res.buffer);
  check('edited .xlsx loads + is non-trivial', wb.worksheets.length >= 1 && res.buffer.length > 1000);
  check('kept original rows (Marketing, Engineering)', /Marketing/.test(md) && /Engineering/.test(md));
  check('added the Design row', /Design/i.test(md), `(md=${md.replace(/\s+/g,' ').slice(0,160)})`);
  check('added the Total column', /Total/i.test(md));
  console.log('  --- edited sheet ---\n' + md.split('\n').map((l) => '  ' + l).join('\n'));

  // 4) .csv round-trips too
  console.log('\n[.csv] editing (real DeepSeek)...');
  const csvIn = Buffer.from('Item,Q1,Q2\nMarketing,1000,1200\nEngineering,3000,3200\n', 'utf-8');
  const csvRes = await editDocument({ buffer: csvIn, filename: 'Budget.csv', instruction: 'Add a row for Design with Q1 1500 and Q2 1600. Keep the others.', agentRole: 'Finance Analyst' });
  const csvText = csvRes.buffer.toString('utf-8');
  check('csv output is text/csv', csvRes.mime === 'text/csv');
  check('csv kept originals + added Design', /Marketing/.test(csvText) && /Design/i.test(csvText), `(csv=${csvText.replace(/\n/g,' | ')})`);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e?.stack || e?.message || e); process.exit(1); });
