// Chat Attachments — REAL-LLM grounding proof (A/B). Ingest a file with a fact no model can know, then
// ask the SAME question in a conversation WITH the file vs WITHOUT it. The "with" answer must carry the
// fact; the "without" answer must not invent it. Proves the upload actually grounds the reply.
// Run: ./node_modules/.bin/tsx -r dotenv/config scripts/test-attachment-grounding.ts
import { pool } from '../server/db.js';
import { ingestConversationDocument } from '../server/knowledge/rag/conversationDocs.js';
import { generateIntelligentResponse } from '../server/ai/openaiService.js';

const PROJ = '__test_ground_proj__';
const CONV_WITH = `project:${PROJ}`;
const CONV_WITHOUT = `project:__test_ground_none__`;

async function cleanup() {
  await pool.query(`DELETE FROM conversation_documents WHERE project_id LIKE '__test_ground%'`);
}

function baseContext(conversationId: string, projectId: string) {
  return {
    mode: 'project' as const,
    projectName: 'Grounding Test',
    projectId,
    conversationId,
    agentRole: 'Product Manager',
    conversationHistory: [] as any[],
  };
}

async function main() {
  let pass = 0, fail = 0;
  const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };
  try {
    await cleanup();

    const DOC = [
      '# Aurelian Ledger Spec',
      '',
      'The settlement window in the Aurelian Ledger is exactly 11 minutes long. No settlement may exceed this window.',
      'The rollback fee is 4 credits per attempt, and rollbacks are only allowed by the Warden role.',
      'Each ledger epoch lasts 9 days before it seals permanently.',
    ].join('\n');

    const ing = await ingestConversationDocument({
      projectId: PROJ, conversationId: CONV_WITH, filename: 'aurelian-ledger.md',
      text: DOC, uploadedByUserId: '__test_ground_user__', scope: 'ephemeral',
    });
    console.log(`  (ingested ${ing.chunks} chunk(s))`);

    const question = 'How long is the settlement window in the Aurelian Ledger?';

    console.log('  ... calling the real LLM WITH the attachment');
    const withDoc = await generateIntelligentResponse(question, 'Product Manager', baseContext(CONV_WITH, PROJ));
    console.log(`\n  [WITH FILE] ${withDoc.content}\n`);

    console.log('  ... calling the real LLM WITHOUT the attachment');
    const withoutDoc = await generateIntelligentResponse(question, 'Product Manager', baseContext(CONV_WITHOUT, '__test_ground_none__'));
    console.log(`\n  [NO FILE] ${withoutDoc.content}\n`);

    check('WITH-file answer cites the 11-minute window from the file', /\b11\b/.test(withDoc.content) && /minute/i.test(withDoc.content), withDoc.content.slice(0, 100));
    check('NO-file answer does NOT fabricate "11 minutes"', !(/\b11\s*minute/i.test(withoutDoc.content)), withoutDoc.content.slice(0, 100));

    await cleanup();
    console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
    await pool.end();
    process.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    console.error('ERROR:', (e as Error).message);
    await cleanup().catch(() => {});
    await pool.end();
    process.exit(1);
  }
}
main();
