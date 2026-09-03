// Full HTTP end-to-end test against a RUNNING local server (default :5091): dev-login -> create project
// -> upload a real .xlsx -> edit it in chat -> download the edited file. Proves the whole path through the
// actual Express routes + auth + message posting, with a genuine Excel binary. Local only; never deploys.
// Run: BASE=http://localhost:5091 ./node_modules/.bin/tsx -r dotenv/config scripts/test-doc-edit-http.ts
import ExcelJS from 'exceljs';
import { markdownToXlsx } from '../server/documents/spreadsheet.js';

const BASE = process.env.BASE || 'http://localhost:5091';
let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}  ${d}`)); };

async function main() {
  // 1) dev-login, capture the session cookie
  const login = await fetch(`${BASE}/api/auth/dev-login`, { redirect: 'manual' });
  const raw = login.headers.get('set-cookie') || '';
  const cookie = raw.split(/,(?=\s*[a-zA-Z0-9_.-]+=)/).map((c) => c.split(';')[0].trim()).join('; ');
  check('dev-login set a session cookie', !!cookie, `(status ${login.status})`);
  const H = { Cookie: cookie };

  // 2) create a project
  const proj: any = await (await fetch(`${BASE}/api/projects`, { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'HTTP Doc Test', emoji: '📊', description: 'excel edit test' }) })).json();
  const conversationId = `project:${proj.id}`;
  check('created a project', !!proj?.id);

  // 3) upload a REAL .xlsx
  const xlsx = await markdownToXlsx('## Budget\n| Item | Q1 | Q2 |\n| --- | --- | --- |\n| Ads | 1000 | 1100 |\n| Tools | 200 | 250 |\n');
  const form = new FormData();
  form.append('document', new File([xlsx], 'Budget.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  form.append('scope', 'ephemeral');
  const up: any = await (await fetch(`${BASE}/api/conversations/${encodeURIComponent(conversationId)}/attachments`, { method: 'POST', headers: H, body: form })).json();
  check('uploaded the .xlsx', !!up?.id, `(${JSON.stringify(up).slice(0, 120)})`);

  // 4) edit it in chat
  const edit: any = await (await fetch(`${BASE}/api/conversations/${encodeURIComponent(conversationId)}/attachments/${up.id}/edit`, {
    method: 'POST', headers: { ...H, 'content-type': 'application/json' },
    body: JSON.stringify({ instruction: 'Add a "Total" column that is Q1 + Q2 for each row, and a row for "Hosting" with Q1 90 and Q2 90. Keep everything else.' }),
  })).json();
  check('edit posted an agent reply into chat', !!edit?.message?.content, `(reply="${(edit?.message?.content||'').slice(0,70)}")`);
  check('reply carries the download card metadata', !!edit?.editedDocument?.downloadUrl);
  check('edited filename is Budget-edited.xlsx', edit?.editedDocument?.filename === 'Budget-edited.xlsx', `(${edit?.editedDocument?.filename})`);

  // 5) download the edited file + verify it's a valid, edited Excel workbook
  const dl = await fetch(`${BASE}${edit.editedDocument.downloadUrl}`, { headers: H });
  check('download returned 200', dl.status === 200, `(status ${dl.status})`);
  check('download content-type is Excel', (dl.headers.get('content-type') || '').includes('spreadsheetml'));
  const buf = Buffer.from(await dl.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  let text = '';
  wb.worksheets[0]?.eachRow((r) => { text += (r.values as unknown[]).slice(1).join(' ') + '\n'; });
  check('downloaded .xlsx opens + kept originals (Ads, Tools)', /Ads/.test(text) && /Tools/.test(text));
  check('added the Total column + Hosting row', /Total/i.test(text) && /Hosting/i.test(text), `(sheet=${text.replace(/\n/g,' | ').slice(0,180)})`);
  console.log('\n  --- downloaded, edited Excel ---\n' + text.split('\n').filter(Boolean).map((l) => '  ' + l).join('\n'));

  console.log(`\n=== ${pass} passed, ${fail} failed (server ${BASE}) ===`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e?.stack || e?.message || e); process.exit(1); });
