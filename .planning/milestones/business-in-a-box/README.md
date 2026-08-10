# Milestone: Business-in-a-Box Starter Packs

**Status:** planned (GSD-tracked, milestone-scoped). Not started. Nothing merged. 2026-08-07.

## What this is
Turn every starter pack from "3 generic agents + a welcome line" into a complete **guided operating system** for that business type (Team + Playbook + Documents + Process), so a founder clicks a pack and is not staring at a blank page. Full rationale in the audit + build-plan artifacts:
- Build plan: https://claude.ai/code/artifact/9b96f6f4-be0b-4840-b17d-10ed705b2c99
- Audit: https://claude.ai/code/artifact/4fdf4d9d-cce2-4e57-a897-6a29cb3280c9

## Files
- `REQUIREMENTS.md` — 37 REQ-IDs across 8 categories (PACK/TEAM/PLAY/DOC/PROC/INTAKE/UX/OPS) + operating rules + open decisions + out-of-scope.
- `ROADMAP.md` — BIAB Phase 0 (Foundations) → 1 (Flagship, end-to-end) → 2 (Scale), every REQ mapped once, success criteria, traceability.

## Why this is milestone-scoped (additive), not standard GSD
The standard `gsd-new-milestone` was invoked and approved, but its mechanics are **unsafe here right now**:
1. `gsd-sdk` is not installed on this machine (its `gsd-sdk query …` steps can't run).
2. Its `phases.clear` step would DELETE all 25 `.planning/phases/` directories, including a parallel session's **uncommitted, untracked** `v2.1-ux-05-left-sidebar/` work, and reset `STATE.md` off the in-progress v2.1.

So per parallel-work-safety, this milestone's Requirements + Roadmap were authored **additively** here, touching nothing else. **Promote to top-level** `REQUIREMENTS.md` / `ROADMAP.md` + real `NN-` phase dirs when v2.1 closes, the sibling work is committed, and a clean milestone transition (or `gsd-sdk`) is available.

## Sequencing
This is a **post-launch** milestone. It must not delay shipping the already-built, proven work (34-role RAG, audit remediation, chat attachments). Prove ONE flagship pack end-to-end first, then scale.

## Open decisions (needed before BIAB-1 planning)
- **D-1 — Flagship pack:** SaaS Startup vs Restaurant Launch vs another closer to the target user.
- **D-2 — Tier/monetization:** deep packs Pro-only, or available to everyone?

## Progress against the milestone (already done, on branch)
- **PROC-06** (task ↔ deliverable link): server data + logic DONE, commit `69d4e54` (stored in existing metadata JSONB, no migration; HTTP 11/11 live). Clickable UI (UX-03) remains, mockup-first.
