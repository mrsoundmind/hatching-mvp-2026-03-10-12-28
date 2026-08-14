# Re-ingest runbook (KNOW-04)

> A repeatable, documented procedure to refresh or expand the RAG corpus, so it stops being a one-off ingest that silently goes stale. All commands run from repo root. The corpus lives in `role_knowledge` (raw SQL table, outside Drizzle). No em/en dashes.

## The one rule: one vector space
Every chunk in `role_knowledge` must be embedded by the SAME provider + model, or cosine search compares vectors from different spaces and retrieval quality collapses. `RAG_EMBED_PROVIDER` (`.env`) picks the embedder (currently `openai` = text-embedding-3-small @ 768d). If you change it, you MUST re-embed the WHOLE corpus (see "Provider change" below), not just new rows.

## Preconditions
```
set -a; source ./.env; set +a          # DATABASE_URL + the embedding key
# confirm the table exists (idempotent):
./node_modules/.bin/tsx scripts/setup-role-knowledge-table.ts
```

## A. Refresh / re-ingest ONE role (or a batch file)
`ingest-role-knowledge.ts` ingests a corpus JSON with `replaceRoles: true`, so it replaces only the roles present in that file (the rest of the corpus is untouched, which is how the 2447-chunk UX course was preserved during prior ingests).
```
./node_modules/.bin/tsx scripts/ingest-role-knowledge.ts server/knowledge/rag/seed/<batch-file>.json
```

## B. Add a NEW role
Author a `batch-<role>-deep.json` seed (same shape as the existing `server/knowledge/rag/seed/batch-*.json`), then run step A on it. Register the role in `shared/roleRegistry.ts` + `shared/roleIntelligence.ts` first if it is a brand-new role, and confirm `ragRoleKey()` resolves it.

## C. Ingest EVERYTHING (fresh corpus or full rebuild)
```
./node_modules/.bin/tsx scripts/ingest-all-role-knowledge.ts
```

## D. Provider change (re-embed the whole corpus, the one-vector-space rule)
If `RAG_EMBED_PROVIDER` changes (for example ollama-local to openai, as happened on 2026-08-03), the existing vectors no longer match new query embeddings. Re-embed everything:
```
# set the new provider in .env, then rebuild the full corpus:
RAG_EMBED_PROVIDER=<new> ./node_modules/.bin/tsx scripts/ingest-all-role-knowledge.ts
```

## E. Verify after any ingest (always do this)
```
./node_modules/.bin/tsx scripts/test-rag-coverage.ts        # every role has corpus
./node_modules/.bin/tsx scripts/rag-corpus-health.ts        # counts + health
# and the ITL-0 health check (this milestone):
STORAGE_MODE=memory ./node_modules/.bin/tsx scripts/verify-knowledge-health.ts   # expect status ok + a real chunk count
```
A healthy result looks like the 2026-08-13 baseline: `status ok, 4429 chunks / 34 roles`.

## F. Production
The prod corpus is a SEPARATE database from dev. After ingesting to prod's `DATABASE_URL`, the ITL-0 boot assertion (KNOW-01) logs `[knowledge] RAG corpus health: ok (...)` on the next deploy; if it logs a warning, the corpus did not land. The founder's one-line check remains: `SELECT count(*) FROM role_knowledge;` against prod.

## Freshness note (ties to KNOW-03)
This corpus is curated static knowledge; a scheduled auto-refresh from the web is a separate capability (ITL-4 WEB-04). Until that ships, refresh on a human cadence when a field's canon moves, using step A on the affected role's batch file.
