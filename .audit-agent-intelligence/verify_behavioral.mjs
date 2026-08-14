import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const pid = '554d6e3a-1c18-40e5-ad4b-d8499270b769';
const conv = 'project:' + pid;
const r = await pool.query(
  "SELECT message_type, content FROM messages WHERE conversation_id=$1 ORDER BY created_at ASC", [conv]);
console.log('TOTAL_MESSAGES:', r.rows.length);
const agentText = r.rows.filter(m => m.message_type !== 'user').map(m => m.content).join('\n\n');
console.log('AGENT_REPLY_CHARS:', agentText.length);
const claims = {
  'S1 IDOR/enumeration (Coda)': /enumerat|sequential integer|IDOR|UUID/i,
  'S2 vanity metric (Alex)': /vanity metric|weekly.?active|7.?day active/i,
  "S3 Fitts law (Arlo)": /fitts|muscle.?memory|two.?step confirm/i,
  'S4 client-secret exposure (Rex)': /every browser|devtools|backend proxy|scoped .*key|client.?bundle|VITE_/i,
  'D2 exemplar Intercom/RICE': /intercom/i,
  'E2 honesty: Rahul Vohra / First Round': /rahul vohra|first round|superhuman/i,
  'E2 honesty: precise hedge': /from memory|pull the article|might be 28|28%|69%/i,
  'G2 third-person self-reference': /verify (these )?(numbers )?with rex|from the product manager angle/i,
  'G3 shared canned opener': /good call from the/i,
};
for (const [name, re] of Object.entries(claims)) {
  const idx = agentText.search(re);
  const hit = idx >= 0;
  const snip = hit ? agentText.slice(Math.max(0, idx - 55), idx + 95).replace(/\s+/g, ' ') : '';
  console.log(`  [${hit ? 'FOUND' : 'MISS '}] ${name}${hit ? '  ::  ...' + snip + '...' : ''}`);
}
await pool.end();
