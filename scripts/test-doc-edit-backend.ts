// Backend round-trip test for the in-chat document editor (real Supabase + real DeepSeek), on a
// throwaway project id that is cleaned up. Exercises the NEW glue: raw_bytes stored on ingest ->
// getOriginalDocument -> editDocument (with the change summary) -> storeEditedDocument -> getEditedDocument.
// Run: LLM_MODE=prod ./node_modules/.bin/tsx -r dotenv/config scripts/test-doc-edit-backend.ts
import mammoth from 'mammoth';
import { pool } from '../server/db.js';
import { ingestConversationDocument } from '../server/knowledge/rag/conversationDocs.js';
import { getOriginalDocument, storeEditedDocument, getEditedDocument } from '../server/documents/documentStore.js';
import { editDocument } from '../server/documents/documentEditor.js';
import { markdownToDocx } from '../server/documents/markdownToDocx.js';

const PROJ = '__docedit_test__';
const CONV = 'conv:docedit-test';
let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}  ${d}`)); };

const INPUT = `# Onboarding Plan\n\n## Goal\nGet new users to their first win fast.\n\n## Steps\n- Welcome email\n- Product tour\n`;

async function main() {
  process.env.LLM_MODE = 'prod';
  delete process.env.LLM_PRIMARY;
  process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';
  await pool.query(`DELETE FROM conversation_documents WHERE project_id = $1`, [PROJ]);
  await pool.query(`DELETE FROM conversation_edited_documents WHERE project_id = $1`, [PROJ]);

  try {
    // 1) "upload" a docx, keeping raw bytes (as the real upload route now does)
    const docxBuf = await markdownToDocx(INPUT);
    const text = (await mammoth.extractRawText({ buffer: docxBuf })).value;
    const ing = await ingestConversationDocument({
      projectId: PROJ, conversationId: CONV, filename: 'Onboarding-Plan.docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: docxBuf.length, text, uploadedByUserId: 'u_test', scope: 'ephemeral', rawBytes: docxBuf,
    });
    check('ingest stored the document', !!ing.documentId);

    // 2) fetch the ORIGINAL bytes back (the edit path depends on this)
    const original = await getOriginalDocument(ing.documentId);
    check('original bytes retrievable', !!original && original.buffer.length === docxBuf.length, `(got ${original?.buffer.length} vs ${docxBuf.length})`);
    check('original metadata correct', original?.filename === 'Onboarding-Plan.docx' && original?.projectId === PROJ);

    // 3) edit it (real DeepSeek) + change summary
    const edited = await editDocument({ buffer: original!.buffer, filename: original!.filename, instruction: 'Add a "Success Metrics" section. Keep everything else.' });
    check('edit produced a valid docx', edited.mime.includes('wordprocessingml') && edited.buffer.length > 2000);
    check('change summary computed', /section/i.test(edited.summary), `(summary="${edited.summary}")`);
    check('added a Success Metrics section', edited.addedSections.some((s) => /success metrics/i.test(s)), `(added=${JSON.stringify(edited.addedSections)})`);

    // 4) store the edited output + fetch it back (what Download streams)
    const editedId = await storeEditedDocument({
      projectId: PROJ, conversationId: CONV, sourceDocumentId: ing.documentId,
      filename: edited.filename, mime: edited.mime, bytes: edited.buffer, createdByUserId: 'u_test',
    });
    const back = await getEditedDocument(editedId);
    check('edited file retrievable for download', !!back && back.buffer.length === edited.buffer.length);
    check('download bytes are a valid, edited Word file', !!back && /Onboarding Plan/i.test((await mammoth.extractRawText({ buffer: back!.buffer })).value) && /success metrics/i.test((await mammoth.extractRawText({ buffer: back!.buffer })).value));
    check('download scoped to the conversation', back?.conversationId === CONV);
  } finally {
    await pool.query(`DELETE FROM conversation_documents WHERE project_id = $1`, [PROJ]);
    await pool.query(`DELETE FROM conversation_edited_documents WHERE project_id = $1`, [PROJ]);
    console.log('  (cleaned up test rows)');
  }
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e?.stack || e?.message || e); process.exit(1); });
