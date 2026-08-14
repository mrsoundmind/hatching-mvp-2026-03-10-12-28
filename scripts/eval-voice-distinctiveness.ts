// v2.2 Phase E behavioral eval: prove the role personalities are actually DISTINCT (a blind judge can
// tell them apart from their replies) and that voice work did not dull competence (a subtle-error
// trap is still caught in-character). Live, uses the FREE Groq tier. Informational (not a hard gate),
// since voice is subjective and Groq is weaker than the production DeepSeek chain. Gated on GROQ_API_KEY.
import { ROLE_DEFINITIONS } from '../shared/roleRegistry.js';
import { generateWithPreferredProvider } from '../server/llm/providerResolver.js';

const RULES = 'Reply in 2-3 sentences, in your own voice and in the first person. No lists, no headers, no preamble.';

// Provider is env-configurable (default 'groq' preserves original behavior). Set EVAL_PROVIDER=ollama-test
// to run fully on the FREE local Ollama (no Groq quota, no cost). Any registry id is accepted.
const EVAL_PROVIDER = (process.env.EVAL_PROVIDER || 'groq') as any;

async function gen(system: string, user: string): Promise<string> {
  const c = await generateWithPreferredProvider(
    { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.6, maxTokens: 220 },
    EVAL_PROVIDER,
  );
  return (c.content || '').trim();
}

async function main() {
  if (EVAL_PROVIDER === 'groq' && !process.env.GROQ_API_KEY) { console.log('SKIP: no GROQ_API_KEY'); process.exit(0); }

  // v2.2 T4: broadened from 5 to 10 diverse roles spanning product, engineering, design, marketing,
  // data, QA, ops and creative. More options makes the blind attribution strictly harder — a stronger
  // standing guard that distinctiveness holds across the roster, not just a handful.
  const picks = [
    'Product Manager', 'Backend Developer', 'Product Designer', 'Growth Marketer', 'Copywriter',
    'Data Scientist', 'QA Lead', 'DevOps Engineer', 'Creative Director', 'Operations Manager',
  ];
  const roles = picks.map(r => (ROLE_DEFINITIONS as any[]).find(d => d.role === r)).filter(Boolean) as any[];
  const question = "We're thinking about adding a dark mode to the app. What's your quick take?";

  // One reply per role to the same question.
  const replies: { role: string; text: string }[] = [];
  for (const r of roles) replies.push({ role: r.role, text: await gen(`${r.voicePrompt}\n\n${RULES}`, question) });
  console.log('--- replies to the same question ---');
  replies.forEach((x, i) => console.log(`[${i}] (${x.role}) ${x.text.replace(/\s+/g, ' ').slice(0, 120)}...`));

  // Blind attribution: a judge matches each anonymized reply to a role from the list.
  const anon = replies.map((x, i) => `REPLY ${i}: "${x.text}"`).join('\n\n');
  const roleList = roles.map(r => r.role).join(', ');
  const judged = await gen(
    'You are a precise classifier. Respond with JSON only.',
    `${replies.length} anonymized replies to the same question, each from a different professional. Possible roles: ${roleList}. For each REPLY number, name the single most likely role. JSON only like {"0":"Role","1":"Role"}.\n\n${anon}`,
  );
  let correct = 0;
  try {
    const map = JSON.parse(judged.slice(judged.indexOf('{'), judged.lastIndexOf('}') + 1));
    replies.forEach((x, i) => {
      const guess = String(map[String(i)] || '').toLowerCase();
      if (guess === x.role.toLowerCase() || guess.includes(x.role.toLowerCase().split(' ')[0])) correct++;
    });
  } catch { console.log('  (judge JSON parse failed:', judged.slice(0, 100), ')'); }
  const rate = correct / replies.length;
  console.log(`\nBlind attribution: ${correct}/${replies.length} roles correctly identified from voice alone (${Math.round(rate * 100)}%)`);

  // Competence-held: the Backend Developer must still catch the IDOR/enumeration trap, in-character.
  const dev = (ROLE_DEFINITIONS as any[]).find(d => d.role === 'Backend Developer');
  const trap = 'Quick one: we expose auto-increment integer primary keys in our public API URLs, like /api/users/1041. That is standard REST, totally fine, right?';
  const devReply = await gen(`${dev.voicePrompt}\n\n${RULES}`, trap);
  const caught = /enumerat|sequential|guess|scrap|idor|uuid|expose|harvest/i.test(devReply);
  console.log(`\nCompetence (IDOR trap → Backend Developer): ${caught ? 'CAUGHT' : 'MISSED'}`);
  console.log(`  "${devReply.replace(/\s+/g, ' ').slice(0, 160)}..."`);

  console.log(`\n${rate >= 0.6 && caught ? 'GOOD' : 'REVIEW'}: distinctiveness ${Math.round(rate * 100)}% (target >=60% on weak Groq), competence ${caught ? 'held' : 'check on DeepSeek'}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
