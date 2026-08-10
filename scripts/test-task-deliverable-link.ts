// The "missing link" — live HTTP test that a task and its document connect both ways.
// Boot a server on BASE first. Run: BASE=http://localhost:5018 ./node_modules/.bin/tsx scripts/test-task-deliverable-link.ts
const BASE = process.env.BASE || 'http://localhost:5018';
let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };

async function main() {
  const login = await fetch(`${BASE}/api/auth/dev-login`, { redirect: 'manual' });
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  const H = { cookie, 'content-type': 'application/json' };
  check('dev-login', !!cookie);

  const mkProject = async (name: string) => {
    const r = await fetch(`${BASE}/api/projects`, { method: 'POST', headers: H, body: JSON.stringify({ name, emoji: '🔗' }) });
    return (await r.json()).id as string;
  };
  const p1 = await mkProject('__link_test_p1__');
  const p2 = await mkProject('__link_test_p2__');
  check('created two projects', !!p1 && !!p2);

  // Task in p1
  const taskRes = await fetch(`${BASE}/api/tasks`, { method: 'POST', headers: H, body: JSON.stringify({ projectId: p1, title: 'Draft the pricing page' }) });
  const task = await taskRes.json();
  check('created a task (todo)', taskRes.status < 300 && task.status === 'todo', `status=${taskRes.status}/${task.status}`);

  // Deliverable in p1, and one in p2 (for the cross-project guard)
  const mkDeliv = async (pid: string, title: string) => {
    const r = await fetch(`${BASE}/api/deliverables`, { method: 'POST', headers: H, body: JSON.stringify({ projectId: pid, title, type: 'custom', content: 'draft' }) });
    const j = await r.json();
    return { status: r.status, id: j?.deliverable?.id as string };
  };
  const d1 = await mkDeliv(p1, 'Pricing Page v1');
  const d2 = await mkDeliv(p2, 'Other project doc');
  check('created deliverable in p1', d1.status === 201 && !!d1.id, `status=${d1.status}`);

  // Cross-project guard: linking p1's task to p2's deliverable must 404
  const cross = await fetch(`${BASE}/api/tasks/${task.id}/link-deliverable`, { method: 'POST', headers: H, body: JSON.stringify({ deliverableId: d2.id }) });
  check('cross-project link is refused (404)', cross.status === 404, `status=${cross.status}`);

  // Link p1 task -> p1 deliverable
  const linkRes = await fetch(`${BASE}/api/tasks/${task.id}/link-deliverable`, { method: 'POST', headers: H, body: JSON.stringify({ deliverableId: d1.id }) });
  const linked = await linkRes.json();
  check('link returns 200', linkRes.status === 200, `status=${linkRes.status}`);
  check('task now points at the deliverable', linked?.metadata?.deliverableId === d1.id, JSON.stringify(linked?.metadata));
  check('linking a todo moved it to in_progress', linked?.status === 'in_progress', `status=${linked?.status}`);

  // Back-link on the deliverable
  const dGet = await (await fetch(`${BASE}/api/deliverables/${d1.id}`, { headers: { cookie } })).json();
  const deliv = dGet.deliverable || dGet;
  check('deliverable points back at the task', deliv?.metadata?.taskId === task.id, JSON.stringify(deliv?.metadata));

  // Unlink
  const unlink = await fetch(`${BASE}/api/tasks/${task.id}/link-deliverable`, { method: 'POST', headers: H, body: JSON.stringify({ deliverableId: null }) });
  const unlinked = await unlink.json();
  check('unlink clears the task pointer', !unlinked?.metadata?.deliverableId, JSON.stringify(unlinked?.metadata));
  const dGet2 = await (await fetch(`${BASE}/api/deliverables/${d1.id}`, { headers: { cookie } })).json();
  const deliv2 = dGet2.deliverable || dGet2;
  check('unlink clears the deliverable back-pointer', !deliv2?.metadata?.taskId, JSON.stringify(deliv2?.metadata));

  // Cleanup
  await fetch(`${BASE}/api/projects/${p1}`, { method: 'DELETE', headers: H });
  await fetch(`${BASE}/api/projects/${p2}`, { method: 'DELETE', headers: H });

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
