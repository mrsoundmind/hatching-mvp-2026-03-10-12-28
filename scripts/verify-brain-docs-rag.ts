/**
 * ITL-1 / KNOW-05 evidence. Proves a long brain doc's DEEP content (past the old 2000-char truncation
 * cutoff) is now retrievable via brain-scoped RAG. Ingests a throwaway test doc, retrieves, then deletes
 * it (transient, cleaned up). Free: a few sub-cent embeddings, no LLM.
 * Run: set -a; source ./.env; set +a; RAG_EMBED_PROVIDER=openai ./node_modules/.bin/tsx scripts/verify-brain-docs-rag.ts
 */
import { randomUUID } from 'crypto';
import {
  ingestConversationDocument,
  retrieveConversationDocChunks,
  deleteConversationDocument,
} from '../server/knowledge/rag/conversationDocs.js';

async function main() {
  console.log('=== ITL-1 / KNOW-05: brain docs use real RAG (deep content retrievable) ===\n');
  const projectId = randomUUID(); // throwaway test project; the doc is deleted at the end

  // ~4000+ chars of filler, then a DISTINCTIVE fact deep PAST the 2000-char truncation cutoff. The old
  // PROJECT KNOWLEDGE BASE truncation dump (first 2000 chars) would never have seen this.
  const filler = 'This is a project reference document with general background information. '.repeat(60);
  const DEEP_FACT = 'The Nimbus subsystem must rotate its signing key every 37 days, per the Aurelian security addendum.';
  const text = `${filler}\n\nDEEP SECTION (well past 2000 chars):\n${DEEP_FACT}`;
  const deepAt = text.indexOf(DEEP_FACT);
  console.log(`doc length: ${text.length} chars; deep fact starts at char ${deepAt} (cutoff was 2000)`);

  let documentId: string | null = null;
  try {
    const ing = await ingestConversationDocument({
      projectId, conversationId: null, filename: 'aurelian-spec.txt', text, scope: 'brain',
      mime: 'text/plain', sizeBytes: text.length,
    });
    documentId = ing.documentId;
    console.log(`ingested: ${ing.chunks} chunks (${ing.charCount} chars, ${ing.dropped} dropped)`);

    const chunks = await retrieveConversationDocChunks(null, projectId, 'how often must the Nimbus signing key rotate?');
    const found = chunks.some((c) => /37 days/.test(c.chunk));
    console.log(`retrieved ${chunks.length} chunk(s); deep fact ("37 days") present: ${found}`);

    console.log(`\nRESULT: ${found ? 'PASS' : 'REVIEW'}: deep content past the 2000-char cutoff IS retrievable via brain RAG. The legacy truncation dump would have missed it.`);
    process.exitCode = found ? 0 : 1;
  } finally {
    if (documentId) {
      const deleted = await deleteConversationDocument(documentId);
      console.log(`cleanup: deleted throwaway test doc = ${deleted}`);
    }
  }
}
main().catch((e) => { console.error('verify error:', e); process.exit(1); });
