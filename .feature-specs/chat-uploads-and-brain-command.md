# Build Spec — Chat Attachments ("upload & ask") + Command-the-Brain-from-Chat

**Status:** design spec (not built). Grounded in the current code. **Branch:** `feat/v2.2-intelligence-fixes`.
**Author:** Claude Code (audit/spec). Nothing modified.

> **The one-line insight:** you are much closer than "we don't have it." Ingestion, RAG retrieval, and
> brain-command plumbing already exist. This is mostly **UX + wiring + safety**, not a from-scratch build —
> with **one architectural correction** (route uploaded docs through your existing RAG, don't prompt-dump them).

---

## 1. What already exists (so you don't rebuild it)

| Capability | Status | Where |
|---|---|---|
| File ingestion (PDF/DOCX/TXT/MD → text) | ✅ Built | `server/routes/projects.ts:363` (multer, 10 MB) + `server/lib/extractDocumentText.ts` |
| Uploaded text stored per project | ✅ Built | `projects.brain.documents[]` JSONB (`shared/schema.ts:62`, each `{title,content,type}`) |
| Docs reach the agent prompt | ⚠️ Built but **dumped** | `openaiService.ts:283` maps `brainDocuments[]` **whole** into the prompt (no retrieval) |
| **RAG pipeline (embed + pgvector search + render)** | ✅ **Built, production-grade, but unused for uploads** | `server/knowledge/rag/{embeddings,ingest,retriever,store}.ts` — `retrieveForRole`, `retrieveAcrossRoles`, `vectorCandidates` (`embedding <=> $1::vector` cosine), `retrieveKnowledge`, `renderRetrievedKnowledgeBlock` |
| User can command an action from chat | ✅ Built | `chat.ts:954` `parseImperativeIntent` + `handleImperativeIntent` (Phase 36.5) |
| Brain update from chat | ⚠️ Built but **unsafe** | `actionParser.ts:47` `BRAIN_UPDATE` + `chat.ts` `deriveProjectBrainPatch` — audit `INJ-1`/`AUT-3`/`BUG-4` |
| Chat-message attachments | ❌ **Does not exist** | no file field on `messages`; no upload UI in the composer |
| Images / vision (multimodal) | ❌ **Does not exist** | text models only; no image handling in `openaiService`/providers |

**Takeaway:** "upload a document and ask about it" *technically works today* (upload in the sidebar Brain tab,
then ask). What's missing is (a) doing it **from the chat composer**, (b) an **ephemeral/just-this-question**
mode, (c) **retrieval instead of dumping**, and (d) **images**. Only (d) is a genuinely new subsystem.

---

## 2. The architectural correction — RAG, not prompt-dump  ⬅ this is what you're missing

**Today:** every uploaded doc's full text is stuffed into every prompt (`openaiService.ts:283`). Consequences:
- **It doesn't scale.** Upload 3 docs, or one 200-page PDF (truncated to 50k chars), and you overflow the
  context window and get worse answers — the opposite of "ask everything." This compounds `BUG-1` (the memory
  dump) and the cost caps (`DOS-1`): every doc inflates the token cost of **every** turn.
- **You already own the fix.** Your `server/knowledge/rag/` pipeline embeds text and does pgvector cosine
  search — it's what powers role knowledge. Uploaded docs should go through the *same* path: **embed on
  upload, retrieve only the relevant chunks per question.**

**So the real design is:** upload → chunk → embed (reuse `embeddings.ts`) → store vectors (a new
`project_documents`/`doc_chunks` table mirroring `role_knowledge`) → at query time, embed the user's question
and retrieve top-K chunks (reuse `store.ts` `vectorCandidates`) → inject only those via
`renderRetrievedKnowledgeBlock`. Prompt-dumping stays only as a fallback for tiny docs.

This is the single highest-leverage decision in this spec. Build attachments on top of RAG from day one; do
not ship the prompt-dump version and retrofit later.

---

## 3. Feature A — Attach & ask in chat (documents)

### UX
- A **"+" / paperclip** in the chat composer (`ChatInput.tsx`) → opens the existing upload (reuse
  `DocumentUploadZone` logic), or drag-drop onto the composer.
- Two modes, explicit to the user:
  - **Ephemeral ("just this question"):** attached to the turn, embedded + retrievable for the conversation,
    **not** added to permanent brain. *This is the mode users actually expect from ChatGPT/Claude.*
  - **Save to brain ("remember this permanently"):** the current behaviour.
- The message bubble shows an **attachment chip** (filename, type, size); clicking re-opens/downloads.

### Data model
- New nullable `messages.attachments` JSONB: `Array<{ id, filename, mime, sizeBytes, docId }>` (`shared/schema.ts`).
- New table `project_documents` (or reuse a generalized `doc_chunks`): `{ id, projectId, conversationId?
  (null = permanent brain), filename, mime, uploadedByUserId, createdAt }` + a `doc_chunks` child
  `{ id, documentId, chunkIndex, content, embedding vector(768) }` — mirror `role_knowledge`'s shape so the
  existing retriever works unchanged.
- Ephemeral = `conversationId` set + a TTL/cleanup; permanent = `conversationId` null + appears in the Brain tab.

### Server flow
1. `POST /api/conversations/:id/attachments` (new) — multer (reuse the hardened config), extract text,
   **chunk** (e.g. ~800-token windows), **embed** (`embeddings.ts`), store chunks. Returns `docId`.
   Gate with the **cost guard** (embeddings cost money) + a per-user upload rate limit.
2. On a chat turn, if the conversation has attachments, embed the user question, retrieve top-K chunks across
   that conversation's docs (+ optionally permanent brain), inject via `renderRetrievedKnowledgeBlock` into the
   prompt (new field alongside `brainDocuments` in `openaiService` context).
3. Multi-agent: retrieved chunks are shared context for the turn (pass into `handleMultiAgentResponse`).

### Effort
- **M-L** for the ephemeral + RAG-backed document version (reusing ingestion + RAG). The chunking + the new
  tables + the composer UX are the bulk; retrieval is mostly wiring existing functions.

---

## 4. Feature B — Command the brain from chat (harden, don't rebuild)

You already have this (`parseImperativeIntent` + `BRAIN_UPDATE`). The work is making it **explicit, reliable,
and safe** — which **also closes three audit findings**, so it's double-value:

- **Explicit command surface:** one clear intent — "remember that …" / "update the brain: …" / "note for the
  team: …" — parsed by `imperativeIntentParser`, with the agent **confirming what it captured** ("Saved to the
  brain: X. Undo?").
- **Safety (closes `INJ-1`/`AUT-3`/`BUG-4`):**
  - Zod-revalidate the parsed `{field, value}` at execution; **allow-list `brain.field`** to the known keys.
  - Bind consent to the **specific** proposed change (not any affirmative token); show a diff/confirmation.
  - **Version the brain** (append-only history or keep-prior) so an update is undoable and concurrent writes
    don't last-write-wins clobber. Use `jsonb_set`/atomic update, not read-modify-write.
- **Distinguish user-commanded from agent-organic:** a user "remember X" is intentional (high trust); an
  agent-emitted `BRAIN_UPDATE` from organic detection stays proposal-only (accept/dismiss).

### Effort
- **M.** Mostly hardening existing code + a versioning table + a confirmation UX. No new subsystem.

---

## 5. Feature C — Images / vision (v-next, park it)

Genuinely new: needs a **multimodal model** (Gemini is vision-capable; DeepSeek/Groq text models are not),
image handling in the message path, and provider routing that only sends to a vision model when an image is
present. **Recommendation: post-launch.** Don't let it block the document version, which serves 80% of
"upload & ask" without it.

---

## 6. "Am I missing something?" — the honest gap list

Things not in your ask that you'll hit if you build naively:

1. **Retrieval (RAG), not dumping** — *the big one* (§2). Reuse your pipeline or "ask everything about a big
   doc" fails and every turn's cost balloons.
2. **Cost** — embeddings cost on upload; retrieved chunks cost per turn. Gate uploads behind the **cost guard**
   + upload rate limit; ephemeral + RAG both bound it. Ties directly to `DOS-1`/`BUG-3`.
3. **Security is now a prerequisite, not optional** — putting uploads in chat makes these **must-fix-first**:
   - `ACCT-3` — uploaded content is **unscanned** and fed to the LLM (malware/CSAM/**indirect prompt
     injection**: a malicious doc can carry "ignore your instructions…" that enters the prompt).
   - `INJ-2` — zip-bomb / extension-only validation (10 MB DOCX inflates to GBs).
   - Treat retrieved doc text as **untrusted data** in the prompt (delimit it, never as instructions).
4. **Ephemeral vs permanent** — decide it explicitly and show the user which they're doing; the current
   "everything is permanent brain" model surprises people.
5. **GDPR / erasure** — uploaded files are user data (often *others'* PII pasted in). This feeds `COMP-1`
   (no delete mechanism) and the China-transfer (`COMP-4`, `DATA-7`) — every attachment goes to DeepSeek by
   default. You'll want a delete path and to be honest about where content goes.
6. **File types users will expect that you don't support** — **spreadsheets/CSV** (data questions!),
   **images/screenshots**, maybe URLs ("read this link"). Docs-only covers a lot but not "everything."
7. **Big-doc handling** — chunking strategy + "which chunks did I use" transparency (a Sources chip — you
   already built `SourceChips.tsx` for RAG; reuse it so the user sees what the answer was grounded in).
8. **Multi-agent scoping** — does an attachment go to all responding agents or the addressed one? Default: all
   for the turn.
9. **Persistence/display** — show attachments in message history, survive reload, allow re-download.
10. **DoS** — per-user concurrent-upload + daily-upload caps (the audit already flags unbounded upload cost).

---

## 7. Recommended build order

1. **Prereq (safety):** harden the upload path — scan/normalize extracted text, zip-bomb guard, untrusted-data
   framing (`ACCT-3`, `INJ-2`). *Blocking for any chat-upload.* — **S-M**
2. **RAG-back uploaded docs:** chunk + embed on upload, retrieve per question, reuse `renderRetrievedKnowledgeBlock`
   + `SourceChips`. Ship this even for the *existing* brain docs — it fixes the dump problem now. — **M**
3. **Feature A (docs in chat):** composer "+", ephemeral vs save-to-brain, `messages.attachments`, the new
   endpoint. — **M-L**
4. **Feature B (command the brain):** harden + explicit command + versioning (closes `INJ-1`/`AUT-3`/`BUG-4`). — **M**
5. **v-next:** images/vision (Feature C), spreadsheets/CSV, URL-fetch (with SSRF guards). — **L+**

**But note the sequencing against launch:** you have open Tier-0 data-loss items (PITR + migration) and ~80
audit findings. This is a **feature**, not a launch blocker. For a beta, the existing "upload to brain, then
ask" already works — I'd ship step 2 (RAG-back the docs, big quality+cost win, low risk) and defer the
chat-composer attachments to right after launch, unless "upload & ask in chat" is your headline demo moment.

*Grounded in the live code. Nothing built or modified. Effort: S=<½d · M=1-2d · L=3-5d.*
