# Milestone Brief: Chat Attachments ("Upload & Ask") + Command-the-Brain-from-Chat

**Status:** ENGINE SHIPPED server-side (Phase 1 + Phase 2), composer UI (Phase 3) is the remaining gated piece. On branch, nothing merged.
**Branch:** `feat/v2.2-intelligence-fixes` (author: Claude Code, 2026-08-06).
**Origin:** a pasted build spec, cross-verified against live code and corrected here.

## SHIPPED 2026-08-06 (server engine, on-branch)

Phase 1 (hardening) + Phase 2 (RAG-backed uploads) are built and proven live against Supabase + the real OpenAI embedder. Nothing merged.

- **New raw-SQL tables** `conversation_documents` + `conversation_doc_chunks` (mirror `role_knowledge`, deliberately outside Drizzle so a `db:push` can't touch them — this sidesteps the Tier-0 migration-safety gate entirely). Created live by `scripts/setup-conversation-docs-tables.ts` (6/6). Two scopes share the tables: `conversation_id` set = ephemeral (this chat); NULL = permanent brain (project-wide).
- **`server/knowledge/rag/conversationDocs.ts`** — ingest (chunk via `chunkStructured` → embed via `embedDocument` → store) + retrieve (pgvector cosine, gated so a chat with no attachments adds zero latency) + injection-safe, cite-or-admit block rendering. Short-upload fallback: a small pasted note is kept as one chunk instead of dropped by the web-scrape noise floor. Injection-like chunks dropped on ingest (OWASP LLM01).
- **`server/lib/uploadSecurity.ts`** — magic-byte sniff (PDF `%PDF-`, DOCX `PK\x03\x04`, TXT/MD text heuristic) so a renamed binary can't pass the extension filter (INJ-2).
- **`server/routes/attachments.ts`** — `POST/GET/DELETE /api/conversations/:conversationId/attachments`, hardened multer (10MB, single file), ownership via the conversation's project, `enforceCostGuard` (embeddings spend), per-user daily cap.
- **Chat wiring** — `retrieveConversationDocsBlockForChat` injected into BOTH `openaiService` prompt paths alongside the role-knowledge matrix.
- **Verified live:** module `scripts/test-conversation-docs.ts` 19/19 (buried-fact retrieval, scope isolation, injection-drop, cascade delete); HTTP `scripts/test-attachments-http.ts` 10/10 on a real server (upload/list/delete, magic-byte reject, auth); real-LLM A/B `scripts/test-attachment-grounding.ts` 2/2 (Alex answers "11 minutes, per the Aurelian Ledger Spec file" WITH the file; refuses to invent it WITHOUT). `tsc` clean.

**Remaining: Phase 3 composer UI** (paperclip + attachment chip in `CenterPanel.tsx` + message bubble). Blocked by the UI-approval gate AND by that file carrying a sibling session's uncommitted edits. Design decision from §4 stands: reuse `SourceChips` for uploaded-doc answers (grounding chip is expected + trust-building for a file the user just uploaded, unlike ambient role knowledge). Phase 4 (harden brain-commands) and Phase 5 (images/CSV/URL) unchanged.

---

## 0. Read this first: sequencing (why this is NOT next)

This is a **feature**, and it is entangled with open launch blockers. Do not start it until these are true:

1. **Tier-0 closed.** This feature adds new tables (`project_documents`, `doc_chunks`). Schema changes go through `drizzle-kit push`, which is the exact **migration-safety Tier-0 risk** (a push can silently drop a column). So this work is blocked behind the migration-safety baseline runbook (`.audit-agent-intelligence/MIGRATION-BASELINE-RUNBOOK.md`) and Supabase PITR backups being on.
2. **Deep-knowledge work shipped.** The 34-role RAG system (commit `3864494`) should be merged and deployed first.
3. **Branch coordinated.** The branch carries multiple sessions' work and has never been pushed.

For a beta, "upload to the Brain tab, then ask" already works today. If "upload and ask in chat" is the headline demo, pull Phase 2 forward (still after Tier-0). Otherwise this is a clean post-launch milestone.

---

## 1. The one architectural decision: RAG the uploads, do not prompt-dump

Route uploaded documents through the **existing** `server/knowledge/rag/` pipeline (embed on upload, retrieve only the relevant chunks per question), instead of stuffing document text into every prompt. This is the highest-leverage call in the whole plan. Build on RAG from day one; do not ship the dump version and retrofit.

Why it matters (grounded in live code):
- Today, brain docs are injected by **relevance-blind truncation**, not retrieval. See [openaiService.ts:283-294](server/ai/openaiService.ts#L283): each doc is sliced to a `knowledgeBudget` / `MAX_DOC_CHARS`. So it does NOT overflow the context window (the original spec said "overflow"; the real failure is truncation): ask about page 180 of a PDF and only the first N chars made the budget, so the answer is blind to the rest.
- The RAG pipeline that fixes this already exists and is production-grade (shipped this session, commit `3864494`): `server/knowledge/rag/{embeddings,ingest,retriever,store}.ts`, `retrieveForRole`, `retrieveAcrossRoles`, `vectorCandidates` (pgvector cosine `embedding <=> $1::vector`), `renderRetrievedKnowledgeBlock`.
- **Consistency bonus:** as of 2026-08-03, role knowledge is RAG-retrieved but uploaded/brain docs are still truncation-dumped. Unifying uploads onto RAG also removes that inconsistency. This makes Phase 2 both a feature and a cleanup.

---

## 2. What already exists (reuse, do not rebuild)

| Capability | Status | Where |
|---|---|---|
| File ingestion (PDF/DOCX/TXT/MD to text) | Built | `server/routes/projects.ts` (multer, 10 MB) + `server/lib/extractDocumentText.ts` |
| Uploaded text stored per project | Built | `projects.brain.documents[]` JSONB (`shared/schema.ts`) |
| Docs reach the prompt (but truncation-dumped) | Built, needs RAG | `openaiService.ts:283` |
| RAG pipeline (embed + pgvector + render) | Built, production-grade | `server/knowledge/rag/*` |
| Untrusted-data framing for uploaded text | Built (partial ACCT-3) | `openaiService.ts:293` already wraps docs as "UNTRUSTED DATA, never instructions" |
| Command an action from chat | Built | `chat.ts:954` `parseImperativeIntent` + `handleImperativeIntent` (Phase 36.5) |
| Brain update from chat | Built, unsafe | `actionParser.ts:47` `BRAIN_UPDATE` + `deriveProjectBrainPatch` (audit INJ-1 / AUT-3 / BUG-4) |
| Source chips (grounding display) | Built | `client/src/components/chat/SourceChips.tsx` (now tracked in `3864494`) |
| Chat-message attachments | Does not exist | no `attachments` field on `messages` (only `metadata` jsonb); no composer upload UI |
| Images / vision (multimodal) | Does not exist | text models only; DeepSeek/Groq are text-only, Gemini is vision-capable |

**Verification corrections vs the source spec:** (a) the dump is budget-capped, so the failure is truncation not overflow; (b) the untrusted-data prompt framing already exists for brain docs, so the prompt-injection-via-text part of ACCT-3 is already done, what is genuinely missing is binary scanning + a zip-bomb guard; (c) the role-vs-brain RAG inconsistency is new as of this session.

---

## 3. Phased plan

Effort legend: S = under half a day, M = 1 to 2 days, L = 3 to 5 days.

### Phase 1 (prereq, safety) . S-M
Harden the upload path before any chat upload. Keep the existing untrusted-data framing. Add: binary/type scan and normalization of extracted text (ACCT-3, malware/CSAM), zip-bomb / decompression guard and true content-type validation not extension-only (INJ-2), per-user concurrent-upload and daily-upload caps (DoS). Blocking for everything below.

### Phase 2 (the big win) . M . NEEDS a new table (gated behind Tier-0 migration)
RAG-back uploaded documents. New `project_documents` + `doc_chunks` (child, `embedding vector(768)`) mirroring `role_knowledge` so the existing retriever works unchanged. On upload: chunk (about 800-token windows, reuse `ingest.ts` structure-aware chunking) and embed (`embeddings.ts`). At query time: embed the question, retrieve top-K chunks for the conversation's docs (plus optionally permanent brain), inject via `renderRetrievedKnowledgeBlock`. Ship this even for the existing brain docs, it fixes the truncation problem and the role-vs-brain inconsistency now. Keep prompt-dump only as a fallback for tiny docs. Gate embeddings behind the cost guard.

### Phase 3 (Feature A: docs in chat) . M-L
Composer "+" / paperclip (reuse `DocumentUploadZone` logic) or drag-drop onto the composer. Two explicit modes: **ephemeral** ("just this question", attached to the conversation, retrievable, NOT permanent brain) and **save to brain** (current behaviour). New nullable `messages.attachments` JSONB (`{id, filename, mime, sizeBytes, docId}[]`). New `POST /api/conversations/:id/attachments` (hardened multer, cost-guarded). Attachment chip in the message bubble (filename, type, size; click to re-download). Multi-agent: retrieved chunks are shared context for the turn (pass into `handleMultiAgentResponse`). **v1 simplification:** skip a true TTL cleanup job; ephemeral = attached-to-conversation + deletable (avoids an ops cron for v1). UI-change protocol applies (composer + bubble are `client/src`).

### Phase 4 (Feature B: command the brain, harden not rebuild) . M . closes INJ-1 / AUT-3 / BUG-4
Make the existing imperative path explicit, reliable, and safe. Explicit command surface ("remember that...", "update the brain: ...", "note for the team: ...") with the agent confirming what it captured ("Saved to the brain: X. Undo?"). Safety: Zod-revalidate the parsed `{field, value}` at execution and allow-list `brain.field` to known keys; bind consent to the specific proposed change (not any affirmative token), show a diff; version the brain (append-only history) so updates are undoable and concurrent writes do not last-write-wins clobber (atomic `jsonb_set`, not read-modify-write). Distinguish user-commanded (intentional, high trust) from agent-organic `BRAIN_UPDATE` (stays proposal-only).

### Phase 5 (v-next) . L+
Images / vision (route to Gemini only when an image is present; DeepSeek/Groq are text-only). **CSV / spreadsheets, elevate this to the first fast-follow**: for a founder audience "upload my metrics and ask" may beat PDFs, and structured data needs different handling than prose (consider a data-query path, not just embed-the-rows). URL fetch ("read this link") with SSRF guards.

---

## 4. Design decisions locked

- **Citation calculus flips for user uploads.** We deliberately do NOT show source chips for ambient role knowledge (it fights the colleague tone, decided 2026-08-03). But for a doc the user just uploaded and asked about, showing "grounded in your file X" is expected and builds trust, so **reuse `SourceChips` for uploaded-doc answers** even though it is suppressed for role knowledge.
- **Ephemeral vs permanent is an explicit user choice**, shown in the UI. The current "everything is permanent brain" model surprises people.
- **Retrieved doc text is untrusted data**: delimited, never obeyed as instructions (framing already exists, keep it).
- **Multi-agent default**: an attachment is shared with all responding agents for that turn.

---

## 5. Cross-cutting risks (from the gap list, verified)

1. **RAG not dumping** (Section 1). The one that makes "ask everything about a big doc" actually work.
2. **Cost**: embeddings on upload + retrieved chunks per turn. Gate uploads behind `server/billing/costGuard.ts` + upload rate limit. Ties to DOS-1 / BUG-3.
3. **Security is a prerequisite, not optional**: ACCT-3 (unscanned uploads, indirect prompt injection, text-framing already done so this is binary scanning), INJ-2 (zip-bomb / extension-only validation).
4. **Compliance / erasure**: uploaded files are user data, often others' PII. Needs a delete path (COMP-1) and honesty about where content goes (every attachment goes to DeepSeek by default: COMP-4 / DATA-7). Consider provider routing for sensitive uploads.
5. **File-type expectations**: spreadsheets/CSV, images, URLs. Docs-only covers a lot, not "everything".
6. **Persistence/display**: attachments survive reload, re-downloadable, shown in history.

---

## 6. Data model sketch

- `messages.attachments` (new, nullable JSONB): `Array<{ id, filename, mime, sizeBytes, docId }>`.
- `project_documents` (new): `{ id, projectId, conversationId? (null = permanent brain), filename, mime, uploadedByUserId, createdAt }`.
- `doc_chunks` (new, child): `{ id, documentId, chunkIndex, content, embedding vector(768) }` . mirror `role_knowledge` so the retriever is reused unchanged. Ephemeral = `conversationId` set; permanent = null (appears in the Brain tab).

Note: creating these tables is the step that intersects the Tier-0 migration-safety item. Do it through the baseline runbook, not a raw `db:push`, once that runbook is in force.

---

## 7. ROADMAP pointer (add when the branch is clean)

Drop this line into `.planning/ROADMAP.md` under a post-launch / future-milestones section (not added here to avoid clobbering a sibling session's uncommitted ROADMAP edits):

`- Chat Attachments ("Upload & Ask") + Command-the-Brain-from-Chat . post-launch . RAG-backed doc uploads in the composer + hardened brain commands . brief: .planning/milestones/chat-attachments-BRIEF.md . BLOCKED behind Tier-0 (migration-safety + PITR).`
