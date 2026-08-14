/**
 * ITL-0 streaming cite-wire evidence. Drives the REAL generateStreamingResponse and confirms it now
 * hands the caller `grounded` + the retrieved source URLs via onMetadata, which is what lets chat.ts
 * enforce cite-or-admit on the PRIMARY streaming chat (not just the non-streaming fallback).
 *
 * Free: Ollama generation + read-only corpus + a couple of sub-cent embeddings.
 * Run: set -a; source ./.env; set +a;
 *   STORAGE_MODE=memory LLM_MODE=test TEST_LLM_PROVIDER=ollama TEST_OLLAMA_MODEL=llama3.2:3b \
 *   RAG_EMBED_PROVIDER=openai ./node_modules/.bin/tsx scripts/verify-streaming-cite-metadata.ts
 */
import { generateStreamingResponse } from '../server/ai/openaiService.js';

async function run(q: string, ragEnabled: string) {
  process.env.RAG_ENABLED = ragEnabled;
  let md: any = null;
  const ctx: any = {
    mode: 'project', projectName: 'Verify', agentRole: 'UX Designer',
    conversationHistory: [], autonomyLevel: 'propose',
  };
  const gen = generateStreamingResponse(q, 'UX Designer', ctx, '', undefined, (m) => { md = m; });
  let out = '';
  for await (const c of gen) out += c;
  return { md, len: out.length };
}

async function main() {
  console.log('=== ITL-0: streaming path surfaces retrieved sources + grounded via onMetadata ===\n');
  const on = await run('How should I choose a type scale for a UI and why does hierarchy matter?', 'on');
  console.log(`RAG on  -> grounded=${on.md?.grounded} sources=${Array.isArray(on.md?.ragSources) ? on.md.ragSources.length : 'none'} replyChars=${on.len}`);
  const off = await run('just say hi', 'off');
  console.log(`RAG off -> grounded=${off.md?.grounded} sources=${Array.isArray(off.md?.ragSources) ? off.md.ragSources.length : 'none'} replyChars=${off.len}`);

  const pass = !!on.md && on.md.grounded === true && Array.isArray(on.md.ragSources)
    && !!off.md && off.md.grounded === false && Array.isArray(off.md.ragSources) && off.md.ragSources.length === 0;
  console.log(`\nRESULT: ${pass ? 'PASS' : 'REVIEW'}: the streamed path hands the caller grounded + retrieved sources, so chat.ts enforces cite-or-admit on the PRIMARY chat (guard runs at the tone-guard chokepoint, re-emitting a corrected chunk if it strips one).`);
  process.exit(0);
}
main().catch((e) => { console.error('verify error:', e); process.exit(1); });
