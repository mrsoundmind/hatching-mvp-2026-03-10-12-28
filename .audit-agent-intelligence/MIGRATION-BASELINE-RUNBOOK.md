# Migration-Safety Baseline Runbook (Tier 0.4 / DATA-1)

**Who runs this:** someone with a working `npm`, a clean `package.json`, and a **staging** Supabase project.
**Do NOT run against prod until Phase C**, and only after a fresh prod backup (Tier 0.5).
Pinned to this repo: `drizzle-kit ^0.30.4`, `drizzle-orm ^0.39.1`, `out: "./migrations"`, node-postgres driver.

## The problem (why this is needed)
Prod schema was built with `drizzle-kit push`. `migrations/` (0000-0003) covers only **7 of 21 tables**;
the other 14 (plus recent columns like `deliverable_versions.reader_test` and the new `messages`
composite index) were pushed with no migration file. There is **no `drizzle.__drizzle_migrations` table
live** (push never creates one). Consequences: a rename/removal in `schema.ts` can silently `DROP COLUMN`
on the next push, and source cannot rebuild the database. Goal: switch to versioned `migrate` with a
correct baseline so every future change is a reviewed, ordered SQL file that can't silently drop data.

## The one hard part
Prod already contains all 21 tables. A naive `migrate` would see an empty tracking table and try to
`CREATE` tables that already exist → error. So we generate a full baseline, **rehearse on empty staging**,
then on prod **mark the baseline as already-applied without running its CREATEs**.

---

## Phase A — Regenerate a clean full baseline (local)
1. Confirm `schema.ts` matches prod. It should (we've been pushing it), but verify: `pg_dump --schema-only`
   of prod vs a `drizzle-kit push` into a scratch DB from `schema.ts`, and diff. Resolve any drift first.
2. Archive the stale migrations so history is kept but out of the way:
   ```bash
   git mv migrations migrations-legacy   # or: mv migrations migrations-legacy
   mkdir -p migrations
   ```
3. Generate the baseline from the full current schema:
   ```bash
   npx drizzle-kit generate --name baseline
   ```
4. **Verify it captured everything:** `grep -c "CREATE TABLE" migrations/0000_baseline.sql` → expect **21**.
   Also confirm the new column + index are present (`reader_test`, `messages_conversation_created_idx`).
5. Add a migrate script to `package.json` (when it's clean/uncontended):
   ```json
   "db:migrate": "drizzle-kit migrate"
   ```

## Phase B — Rehearse on a FRESH EMPTY staging DB (never prod)
6. Point `DATABASE_URL` at an empty staging Supabase project.
7. Apply: `npm run db:migrate` → creates all 21 tables and creates `drizzle.__drizzle_migrations`.
8. Boot the app against staging (`STORAGE_MODE=db npm run dev`) and smoke-test login + a chat turn.
9. **Capture the baseline tracking row** (you'll copy it to prod in Phase C) and confirm the table shape:
   ```sql
   \d drizzle.__drizzle_migrations
   SELECT id, hash, created_at FROM drizzle.__drizzle_migrations;
   ```
   Note the exact `hash` and `created_at` (drizzle-kit 0.30: columns `id serial, hash text, created_at bigint`;
   `hash` is a content hash of `0000_baseline.sql`, so it is identical for the same file on prod).
10. Prove expand-contract works: add a nullable column in `schema.ts` → `npx drizzle-kit generate --name test_col`
    → `npm run db:migrate` → confirm ONLY the 2nd migration ran. Then revert that throwaway change.

## Phase C — Baseline PROD (one-time, delicate; back up prod first via Tier 0.5)
Prod already has all 21 tables, so we mark the baseline applied WITHOUT running it:
11. Take a fresh prod backup / PITR restore point first (Tier 0.5).
12. On prod, seed the tracking table with the SAME row staging produced (hash matches because the SQL file
    is identical):
    ```sql
    CREATE SCHEMA IF NOT EXISTS drizzle;
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES ('<hash-from-staging-step-9>', <created_at-from-staging-step-9>);
    ```
    **Verify the table DDL against what you saw on staging in step 9** before inserting — drizzle-kit's
    tracking shape is version-sensitive; match it exactly.
13. Dry-run: `npm run db:migrate` on prod → it must report **no migrations to apply** (baseline seen as
    applied). If it tries to CREATE anything, STOP, the hash/row didn't match; fix before proceeding.

## Phase D — Wire the deploy + freeze push
14. Fly runs migrations before serving new code:
    ```toml
    [deploy]
      release_command = "npm run db:migrate"
    ```
15. **Freeze `db:push` for prod.** Keep `push` only for local scratch DBs. Never push prod again.
16. Going forward, every schema change: edit `schema.ts` → `drizzle-kit generate` → **review the SQL** →
    commit the migration file → deploy runs it. **Expand-contract only:** add columns nullable, backfill in
    a follow-up, drop in a later migration. Never rename+drop in one step (that's the silent-data-loss path).

## Guardrails / gotchas
- **Backup before Phase C** (Tier 0.5). A baseline mistake on prod is exactly the data-loss this fixes.
- **schema.ts must equal prod** before baselining (Phase A step 1). If they've drifted, the baseline is wrong.
- **Verify the `__drizzle_migrations` shape** on staging (step 9) before hand-seeding prod (step 12) — do not
  trust the DDL in this doc blindly; drizzle-kit 0.30.x is the reference, confirm it.
- Staging DB must start **empty** for Phase B (the whole point is proving the baseline builds from zero).
- Keep `migrations-legacy/` in git for provenance; it's not used by `migrate` anymore.

*Audit-only runbook. No code or DB changed by writing this. Execution is a staging-first, backup-gated pass.*
