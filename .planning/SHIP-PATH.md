# Ship Path — from the unshipped branch to live

**Written 2026-08-07.** Target: merge `feat/v2.2-intelligence-fixes` → `reconcile-codex` (origin's default branch), then `fly deploy` to `hatchin-mvp` (Fly, region `bom`/Mumbai, Docker build, `/health` check, scale-to-zero). No CI/CD; deploy is a manual `fly deploy`. Interactive checklist artifact published this session.

## Real state (verified 2026-08-07)
- Branch is **299 commits ahead of origin, never pushed** (no upstream). 242 ahead of local `main`.
- Working tree **dirty**: sibling sessions hold uncommitted edits (CenterPanel.tsx, home.tsx, LeftSidebar.tsx, App.tsx, package.json, package-lock.json, .gitignore) + 60 untracked + stray deletes (`.playwright-mcp/`, `test-results/`).
- **Local npm is broken.** The Fly Docker build (`npm ci → npm run build → node dist/index.js`) is the real build test and needs package.json/lock in sync or `npm ci` fails.
- Tables already live on Supabase (`role_knowledge`, `conversation_documents`, `conversation_doc_chunks`), so **no schema migration needed for this deploy**.
- Tier-0 runtime protections DONE (cost brakes, spend alarm, health check, error tracker). See `.audit-agent-intelligence/TIER0-REMAINING.md`.

## Do first (today)
1. **Supabase PITR backups ON** + one restore drill (Dashboard → Database → Backups; Pro ~$25/mo ~₹2,150). The only irreversible-data-loss gap left, a 2-min toggle. **[YOU]**
2. **Rotate the OpenAI key** (pasted in chat → burned). Set the new one as a Fly secret in Phase C. **[YOU]**

## Phases
- **A. Clear the runway** (the long pole): every session commits/stashes so the tree is clean **[YOU — blocks everything]**; then I reconcile package.json+lock and move the stray deletes into `.gitignore` **[ME]**.
- **B. Prove it's green** (clean tree): `tsc --noEmit`; gates safety/integrity/dto/tone/voice; fix local npm + a real `npm run build`. **[ME, npm fix YOU]**
- **C. Secrets on Fly**: `fly secrets list`. New: `OPENAI_API_KEY` (rotated), `RAG_EMBED_PROVIDER=openai`, `RAG_MIN_SCORE=0.40`. Existing: DATABASE_URL, SESSION_SECRET, DEEPSEEK/GEMINI/GROQ, GOOGLE_CLIENT_ID/SECRET + redirect, STRIPE (if on).
- **D. DB ready**: tables exist (done). Confirm the deploy runs **no destructive `db:push`** on boot/release (Dockerfile doesn't; verify boot). **[ME]**
- **E. Merge**: push the branch (first time) → PR into `reconcile-codex` → skim → merge. **[ME, needs your go to push]**
- **F. Deploy**: `fly deploy` (Docker, Mumbai). Smoke: `/health`=200, Google login, real chat reply, role-knowledge grounding, watch logs + spend alarm ~10 min. *Pre-public option: deploy the branch first to smoke live, then merge.*
- **G. After first good deploy** (not blocking): Sentry (`npm i @sentry/node` + `fly secrets set SENTRY_DSN`, auto-forwards); migration-safety baseline on staging (Tier 0.4, gate for the NEXT schema change).

## Critical path (one line)
PITR on → **sessions commit (tree clean)** → green + lock in sync → secrets set → push + PR + merge to reconcile-codex → `fly deploy` → smoke.

The long pole is A (getting every session to commit); nothing downstream can start while the tree is mid-edit.
