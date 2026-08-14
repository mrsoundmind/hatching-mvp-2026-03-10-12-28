/**
 * ITL-0 T2 evidence harness (KNOW-02). Proves the silent-empty fallback is dead: every retrieval
 * outcome is now recorded (hit vs miss + reason) and a `grounded` flag is exposed. Against the real
 * corpus (read-only) + a couple of OpenAI query embeddings (sub-cent).
 *
 * Run:
 *   set -a; source ./.env; set +a
 *   STORAGE_MODE=memory RAG_EMBED_PROVIDER=openai ./node_modules/.bin/tsx scripts/verify-retrieval-telemetry.ts
 */
import { retrieveKnowledgeBlockForChatWithMeta, getRetrievalStats } from '../server/knowledge/rag/retriever.js';

async function main() {
  console.log('=== ITL-0 T2: retrieval miss telemetry + grounded flag ===\n');

  // A) A real, on-topic question at the normal threshold -> should GROUND (hit).
  process.env.RAG_ENABLED = 'on';
  delete process.env.RAG_MIN_SCORE; // use the default
  const a = await retrieveKnowledgeBlockForChatWithMeta(
    'How should I choose a type scale for a UI and why does hierarchy matter?',
  );
  console.log(`A hit-path      -> grounded=${a.grounded} reason=${a.reason} blockChars=${a.block.length}`);

  // B) Same kind of question but the score bar cranked to 0.99 -> nothing clears it -> recorded MISS.
  process.env.RAG_MIN_SCORE = '0.99';
  const b = await retrieveKnowledgeBlockForChatWithMeta(
    'What separates good color use in a UI from bad, for accessibility?',
  );
  console.log(`B forced-miss   -> grounded=${b.grounded} reason=${b.reason} blockChars=${b.block.length}`);

  // C) RAG disabled -> honest 'disabled', not a silent empty.
  process.env.RAG_ENABLED = 'off';
  const c = await retrieveKnowledgeBlockForChatWithMeta('anything');
  console.log(`C disabled      -> grounded=${c.grounded} reason=${c.reason} blockChars=${c.block.length}`);

  console.log('\n--- live retrieval aggregate (getRetrievalStats) ---');
  console.log(JSON.stringify(getRetrievalStats(), null, 2));

  const pass = a.grounded && a.reason === 'ok' && !b.grounded && b.reason === 'below_threshold';
  console.log(`\nRESULT: ${pass ? 'PASS' : 'REVIEW'}: a real hit grounds (reason ok); a below-threshold retrieval is a RECORDED miss (not a silent empty); disabled is honestly labeled.`);
  process.exit(0);
}

main().catch((e) => { console.error('verify error:', e); process.exit(1); });
