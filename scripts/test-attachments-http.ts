// Chat Attachments HTTP test — drives the REAL running server (multer + ownership + cost-guard + ingest)
// over real HTTP. Boot a server on BASE first. Run:
//   BASE=http://localhost:5018 ./node_modules/.bin/tsx scripts/test-attachments-http.ts
const BASE = process.env.BASE || 'http://localhost:5018';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };

async function main() {
  // 1. Dev login → capture the session cookie.
  const login = await fetch(`${BASE}/api/auth/dev-login`, { redirect: 'manual' });
  const rawCookie = login.headers.get('set-cookie') || '';
  const cookie = rawCookie.split(';')[0];
  check('dev-login set a session cookie', !!cookie, rawCookie.slice(0, 40));

  const h = { cookie, 'content-type': 'application/json' };

  // 2. Create a throwaway project.
  const projRes = await fetch(`${BASE}/api/projects`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ name: '__attach_http_test__', emoji: '📎', description: 'attachment http test' }),
  });
  const proj = await projRes.json();
  check('created a project', projRes.status === 201 || projRes.status === 200, `status=${projRes.status}`);
  const projectId = proj.id;
  const conversationId = `project:${projectId}`;

  // 3. Upload a text file to the conversation as multipart/form-data.
  const docText = 'Aurelian Ledger Spec. The settlement window is exactly 11 minutes. The rollback fee is 4 credits per attempt.';
  const form = new FormData();
  form.append('document', new Blob([docText], { type: 'text/plain' }), 'aurelian.txt');
  form.append('scope', 'ephemeral');
  const upRes = await fetch(`${BASE}/api/conversations/${encodeURIComponent(conversationId)}/attachments`, {
    method: 'POST', headers: { cookie }, body: form,
  });
  const up = await upRes.json().catch(() => ({}));
  check('upload returned 201', upRes.status === 201, `status=${upRes.status} body=${JSON.stringify(up).slice(0, 120)}`);
  check('upload produced chunks', (up.chunks ?? 0) > 0, `chunks=${up.chunks}`);
  check('upload echoed the filename', up.filename === 'aurelian.txt');
  const docId = up.id;

  // 4. Reject a renamed binary posing as a PDF (magic-byte sniff over HTTP).
  const badForm = new FormData();
  badForm.append('document', new Blob([Uint8Array.from([0, 1, 2, 3, 4])], { type: 'application/pdf' }), 'fake.pdf');
  const badRes = await fetch(`${BASE}/api/conversations/${encodeURIComponent(conversationId)}/attachments`, {
    method: 'POST', headers: { cookie }, body: badForm,
  });
  check('renamed binary rejected with 400', badRes.status === 400, `status=${badRes.status}`);

  // 5. List attachments.
  const listRes = await fetch(`${BASE}/api/conversations/${encodeURIComponent(conversationId)}/attachments`, { headers: { cookie } });
  const list = await listRes.json();
  check('list returns the uploaded file', Array.isArray(list) && list.some((d: any) => d.id === docId), `list=${JSON.stringify(list).slice(0, 120)}`);

  // 6. Ownership: a stranger (no cookie) is refused.
  const noAuth = await fetch(`${BASE}/api/conversations/${encodeURIComponent(conversationId)}/attachments`, { headers: {} });
  check('unauthenticated list is refused (401/404)', noAuth.status === 401 || noAuth.status === 404, `status=${noAuth.status}`);

  // 7. Delete the attachment (erasure).
  const delRes = await fetch(`${BASE}/api/conversations/${encodeURIComponent(conversationId)}/attachments/${docId}`, {
    method: 'DELETE', headers: { cookie },
  });
  check('delete returns 204', delRes.status === 204, `status=${delRes.status}`);

  // 8. Cleanup: remove the throwaway project.
  const cleanup = await fetch(`${BASE}/api/projects/${projectId}`, { method: 'DELETE', headers: { cookie } });
  check('cleanup deleted the project', cleanup.status === 204 || cleanup.status === 200, `status=${cleanup.status}`);

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
