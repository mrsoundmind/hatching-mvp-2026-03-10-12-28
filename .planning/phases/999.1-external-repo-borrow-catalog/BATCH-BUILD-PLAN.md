# Batch Build Plan (from the External-Repo Borrow Catalog)

> Backlog Phase 999.1. This is the "batch build plan when promoted" the catalog promised. It sequences the genuinely buildable items from the 14-repo catalog into waves, with per-item effort, risk, and verification. NO product code is written yet. This doc is for review and approval; on approval we execute wave by wave.
>
> **How this was scoped (honest):** of 14 repos, most items are references (already covered), skips, or feed a FUTURE milestone. Only a handful are "build now" material. This plan builds those, and only those.

## Hard exclusions (not in this batch)
- **The "Hatchin can code" capability** and every repo that only informs it (grok-build, freqtrade, ADK human-in-the-loop, hermes-agent sandbox backends, hermes-paperclip-adapter delegate seam, LangGraph HIL). That is a separate MILESTONE whose hard part is a sandboxed code executor (a real security spike). It is not one-shot buildable and is out of scope here.
- **Skips from the catalog:** trademark brand packs (open-design 1.4), Next.js frontend, Python libraries (DSPy/GEPA, ColPali, TradingAgents, atropos, Hermes-Function-Calling), ColPali GPU infra, RL model training (atropos), no-license code (autonovel).
- **LangGraph migration** (7.2/7.7): "know it exists, do NOT migrate." Not in this batch.

## Standing constraints for every item in this batch
- **Feature-flag anything that changes agent behavior** (Hatchin pattern: multi-pass, judge, etc. all ship gated OFF). Default off, prove value, then decide.
- **Runtime-verify before "done"** (founder rule): restart the server, exercise the real path, capture proof. Code-complete is not done.
- **UI items go through the mockup-first + approval gate** (founder rule): show current state + a clickable mockup, get explicit approval, THEN edit `client/src`. Server-side items skip this gate.
- **Parallel-work-safety:** scoped commits, only in-scope files, do not stage top-level `STATE.md` / `ROADMAP.md` / `package.json` while sibling work is uncommitted.
- **Cost discipline:** items that add LLM or image-gen calls (bull/bear debate, AI avatars) must measure added cost and stay gated until justified.
- **Launch-first reality (Rule 6, the founder's own rule):** this whole batch is pre-launch polish that is supposed to wait behind the launch bottleneck (demo, analytics, activation). Building it now is a deliberate choice against that rule; noted so it is a conscious decision, not a drift.

---

## Wave 1: Safe server-side wins (no UI gate, build + runtime-verify first)

### 1A. DESIGN.md brand-system (catalog item 1.1) [BUILD]
- **What:** one canonical brand spec (color, type, spacing, voice) injected into deliverable generation so every generated deliverable is visually and tonally consistent. Doubles as the brand spec for marketing assets.
- **Where:** a new brand-spec module injected into `server/ai/deliverableGenerator.ts` (and reused by the marketing playbook). Server-side prompt injection, next to the role-knowledge and pack-playbook blocks.
- **Effort:** S. **Risk:** low (additive prompt context; fail-safe to current behavior if empty).
- **Feature flag:** `BRAND_SPEC_ENABLED` (default on is safe since it is additive, but ship behind a flag for a clean A/B).
- **Verify (runtime):** generate the same deliverable type before and after; confirm brand consistency improved and nothing regressed; tsc clean. Optional A/B via the existing benchmark harness.
- **Why first:** the single cleanest, lowest-risk, genuinely-drop-in idea in the whole catalog.

### 1B. Bull/bear structured debate (catalog item 6.1) [BUILD, gated]
- **What:** an "argue both sides before deciding" mode. Two agents deliberately take OPPOSING positions on a genuinely ambiguous decision, then a synthesizer resolves. Distinct from peer review (which checks work AFTER it is produced); this is pre-decision divergence.
- **Where:** `server/ai/conductor.ts` + deliberation traces; surfaced through the EXISTING `DeliberationCard.tsx` (reuse, so ideally no new UI). If any UI change is needed, it hits the mockup gate.
- **Effort:** M. **Risk:** medium (adds LLM calls per debated decision, so cost; and quality must be measured, not assumed).
- **Feature flag:** `DEBATE_MODE_ENABLED` (default OFF, like multi-pass). Only trigger on high-ambiguity / high-stakes decisions, not every turn.
- **Verify (runtime):** trigger on a real ambiguous decision (a positioning or strategy call); confirm the debate improves the decision vs single-pass; measure added cost per debate; confirm it does NOT fire on simple turns. A/B via benchmark on a set of judgment-heavy prompts.
- **Caveat:** if the A/B does not show a clear decision-quality lift, keep it gated off (same discipline as the v2.3 multi-pass finding).

**Wave 1 gate:** stop and review after 1A + 1B. Both are runtime-verified and gated. Decide go/no-go on Wave 2 based on results and remaining appetite.

---

## Wave 2: UI-gated features (mockup-first + approval on EACH)

### 2A. Scheduled recurring agent routines (catalog items 8.1 + 10.4) [BUILD, UI-gated]
- **What:** the one genuinely new user-facing feature the catalog surfaced. A user sets a recurring routine ("every Monday, Kai drafts the weekly growth update") and a Hatch runs it on a cadence. Pairs with the marketing-loops concept.
- **Where:** backend reuses the existing pg-boss / autonomy scheduler; new user-facing "Routines" UI (likely in the Tasks or Brain surface).
- **Effort:** M. **Risk:** medium (scheduling + autonomy cost; needs clear pause/limit controls).
- **Gate:** UI change, so mockup-first + approval before touching `client/src`.
- **Verify (runtime):** create a routine, confirm it fires on schedule, produces output, and can be paused; confirm cost caps apply.

### 2B. PPTX / MP4 export (catalog item 1.2) [BUILD, UI-gated]
- **What:** "export this plan as a deck / video," beyond the current branded-PDF-only export.
- **Where:** extend `server/ai/pdfExport.ts` into a multi-format exporter (PptxGenJS or MIT deck libs for PPTX; verify per file); an export-format control in the artifact/deliverable UI.
- **Effort:** M. **Risk:** low to medium (export libs + a small UI control).
- **Gate:** UI change, mockup-first + approval.
- **Verify (runtime):** export a real deliverable to PPTX (and MP4 if pursued); confirm branding + content fidelity.

### 2C. AI-generated agent avatars (catalog item 8.2) [OPTIONAL, lowest priority]
- **What:** distinct AI-generated portrait avatars for Hatches (also geometric/image options).
- **Where:** agent identity / `ProjectTree`.
- **Effort:** S. **Risk:** low, but adds image-generation COST.
- **Gate:** UI change, mockup-first + approval.
- **Verify (runtime):** generate avatars, confirm cost per avatar is acceptable and identities render.
- **Recommendation:** last, or drop. Pure polish with a recurring cost; only if there is clear appetite.

**Wave 2 note:** each sub-item is independent and separately gated. Do them one at a time, mockup then build then verify, not as a block.

---

## Wave 3: Route methods into ALREADY-PLANNED phases (do NOT build new here)

These are not new features; they are strong reference material to attach to phases that already exist on the roadmap. Logged so the reference is not lost; built when that phase is planned.

- **9.1 offline optimize-then-human-PR loop** to the DEFERRED growth loop. The disciplined shape of "Hatches that grow." Attach the method + the human-gate rule when the growth loop is built.
- **14.1 dual (mechanical + LLM) slop detection** to Phase 46 (AI Slop Detection). A worked reference; pairs with the tone guard + peer-review judge.
- **14.2 adversarial reader-panel revision** to Phase 39 (Reader Testing) + peer review. Caveat: v2.3 found multi-pass no-ops on long structured docs, so measure before applying broadly.
- **2.1 trajectory evaluation** to eval deepening (benchmark-suite / qualityMetrics). Score the agent's PATH, not just the final answer.

Action for Wave 3: none now beyond this cross-reference. When Phase 46 / Phase 39 / the growth loop are planned, pull these in.

---

## Suggested sequence and stopping points
1. **Wave 1A (DESIGN.md)** to first, smallest, safest, real value. Runtime-verify, review.
2. **Wave 1B (bull/bear debate)** to gated, measure cost + quality. Review; keep off if no clear lift.
3. **Stop. Decide** whether to proceed to Wave 2 given results, cost, and launch priorities.
4. **Wave 2A / 2B / 2C** to each mockup-first + approved + verified, one at a time.
5. **Wave 3** to reference only, folded in when those phases are planned.

## Formal GSD promotion (deferred, needs a clean branch)
Promoting this batch to a numbered integer phase (the true `/gsd-review-backlog` to `/gsd-plan-phase` flow) edits top-level `ROADMAP.md` + `STATE.md`, which currently carry a sibling session's uncommitted work. Defer that promotion until the branch is clean or the user green-lights touching those files. Until then this plan lives in the 999.1 phase dir and is executed directly on approval.

## What "done" looks like for the batch
Wave 1 shipped + runtime-verified + gated; Wave 2 items each mockup-approved + built + runtime-verified; Wave 3 references attached to their phases. No coding-milestone work. Every commit scoped. Constellation docs (CLAUDE.md footer, HANDOFF) updated per the always-update rule when real features ship; STATE/ROADMAP/REQUIREMENTS touched only when the branch is clean.
