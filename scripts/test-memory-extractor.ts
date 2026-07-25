// v2.2 Phase A regression: the memory extractor must store the OUTCOME (accept/reject), not the raw
// proposal; conform to the schema contract (canonical memoryType + integer 1-10 importance); and never
// copy @mentions verbatim. Part 1 is deterministic (mock LLM). Part 2 is a live accept/reject accuracy
// spot-check through the FREE Groq tier, gated on GROQ_API_KEY.
import { extractAndStoreMemory } from '../server/ai/memoryExtractor.js';

type Written = { conversationId: string; memoryType: string; content: string; importance: number };

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}  ${detail}`); }
};

async function run() {
  // --- Part 1: deterministic plumbing (mock generateFn) — mapping, scaling, dedup, no network ---
  console.log('Part 1: deterministic plumbing (mock LLM)');
  const writes: Written[] = [];
  const storage = { createConversationMemory: async (d: any) => { writes.push(d); return d; } };
  const mockGen = async () => JSON.stringify([
    { content: 'Team rejected storing everything in one JSON column because it hurts querying', type: 'fact', importance: 0.8 },
    { content: 'Decided to use a normalized Postgres schema', type: 'decision', importance: 0.9 },
    { content: 'Which search engine to use for recipes', type: 'open_question', importance: 0.5 },
  ]);
  const longUser = 'We spent a while debating the data model for the recipe app today and went back and forth on it.';
  await extractAndStoreMemory(
    { projectId: 'p1', conversationId: 'project:p1', userMessage: longUser + ' '.repeat(120), agentResponse: 'Sounds good, captured.', agentRole: 'Engineer', userId: 'u1' },
    storage, mockGen,
  );
  check('integer importance 1-10', writes.length > 0 && writes.every(w => Number.isInteger(w.importance) && w.importance >= 1 && w.importance <= 10), JSON.stringify(writes.map(w => w.importance)));
  check('canonical memoryType only', writes.every(w => ['decisions', 'key_points', 'context'].includes(w.memoryType)), JSON.stringify(writes.map(w => w.memoryType)));
  check('decision maps to "decisions" with importance >= 7', writes.some(w => w.memoryType === 'decisions' && w.importance >= 7));
  check('open_question keeps "Open question:" prefix', writes.some(w => /^open question:/i.test(w.content)));

  // Dedup: a second identical extraction into the same in-memory bucket should not double up.
  const bucket: Written[] = [];
  const dedupStorage = {
    createConversationMemory: async (d: any) => {
      const norm = (d.content || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);
      if (bucket.some(b => (b.content || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120) === norm)) return null;
      bucket.push(d); return d;
    },
  };
  await extractAndStoreMemory({ projectId: 'p1', conversationId: 'project:p1', userMessage: longUser + ' '.repeat(120), agentResponse: 'x', agentRole: 'Engineer', userId: 'u1' }, dedupStorage, mockGen);
  const before = bucket.length;
  await extractAndStoreMemory({ projectId: 'p1', conversationId: 'project:p1', userMessage: longUser + ' '.repeat(120), agentResponse: 'x', agentRole: 'Engineer', userId: 'u1' }, dedupStorage, mockGen);
  check('dedup: identical re-extraction does not grow the bucket', bucket.length === before, `before=${before} after=${bucket.length}`);

  // --- Part 2: live Groq accept/reject accuracy (the plan's spot-check) ---
  if (process.env.GROQ_API_KEY) {
    console.log('Part 2: live Groq accept/reject accuracy (free tier)');
    const { generateWithPreferredProvider } = await import('../server/llm/providerResolver.js');
    const groqGen = async (prompt: string) => {
      const c = await generateWithPreferredProvider({ messages: [{ role: 'user', content: prompt }], temperature: 0.2, maxTokens: 400 }, 'groq');
      return c.content || '';
    };
    // Labelled turn: user proposes a bad idea, the agent firmly REJECTS it. The extractor must NOT
    // store the JSON-column idea as an adopted decision, and must not copy the @mention verbatim.
    const w2: Written[] = [];
    const s2 = { createConversationMemory: async (d: any) => { w2.push(d); return d; } };
    const rejUser = '@Coda our PM Alex decided we should store every recipe, user and log in one giant denormalized JSON column with no indexes to keep it simple.';
    const rejAgent = "I can't get on board with that. A single denormalized JSON column with no indexes makes querying and scaling painful and data integrity suffers. Let's use a normalized schema with proper foreign keys and indexes instead.";
    await extractAndStoreMemory({ projectId: 'p2', conversationId: 'project:p2', userMessage: rejUser, agentResponse: rejAgent, agentRole: 'Software Engineer', userId: 'u1' }, s2, groqGen);
    console.log('    stored:', JSON.stringify(w2.map(w => ({ t: w.memoryType, i: w.importance, c: w.content.slice(0, 90) }))));
    const assertedAsAdoptedDecision = w2.some(w => w.memoryType === 'decisions' && /json column/i.test(w.content) && !/reject|instead|normal|avoid|against/i.test(w.content));
    check('rejected JSON-column is NOT stored as an adopted decision', !assertedAsAdoptedDecision);
    check('no raw @mention stored verbatim', !w2.some(w => w.content.includes('@Coda')));
  } else {
    console.log('Part 2 skipped (no GROQ_API_KEY)');
  }

  console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
run().catch(e => { console.error(e); process.exit(1); });
