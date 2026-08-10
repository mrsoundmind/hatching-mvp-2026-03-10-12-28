# Roadmap — Business-in-a-Box Starter Packs

> **Milestone-scoped GSD roadmap (additive).** 2026-08-07. Phases are milestone-relative (BIAB Phase 0/1/2), not in the global `NN-` scheme, to avoid colliding with the in-progress v2.1 / v2.1-ux phase directories. Promote to top-level `ROADMAP.md` + real phase dirs when v2.1 closes and this becomes active.
>
> Strategy: **prove ONE flagship pack end-to-end (Phase 1), then scale (Phase 2).** Phase 0 lays the server-safe foundations first.

## Phase overview

| # | Phase | Goal | Requirements | Success criteria |
|---|-------|------|--------------|------------------|
| **BIAB-0** | Foundations & Missing Links | One clean, server-safe base every pack builds on | PACK-01, PACK-02, PROC-01, PROC-02, PROC-06, DOC-02, DOC-03, INTAKE-02, OPS-01 | 5 |
| **BIAB-1** | Flagship Pack, End-to-End | One pack that fully delivers the 4-layer promise, verified with a real founder | PACK-03, PACK-04, TEAM-01, TEAM-03, PLAY-01, PLAY-02, PLAY-04, DOC-01, DOC-04, PROC-03, PROC-04, PROC-05, PROC-07, INTAKE-01, INTAKE-03, INTAKE-06, UX-01, UX-02, UX-03, UX-04 | 5 |
| **BIAB-2** | Scale + Double Catalog + Content-Ops | Clone the proven template to all packs; double the catalog; run playbook content-ops | PACK-05, TEAM-02, PLAY-03, INTAKE-04, INTAKE-05, OPS-02, OPS-03, OPS-04 | 4 |

**37 requirements, all mapped to exactly one phase (100% coverage).**

---

## BIAB-0 · Foundations & Missing Links
**Goal:** fix the plumbing everything else depends on. Mostly server-side (safe, no UI). Do before the flagship.
**Requirements:** PACK-01, PACK-02, PROC-01, PROC-02, PROC-06, DOC-02, DOC-03, INTAKE-02, OPS-01

**Work:**
- One source of truth for pack + role data; make both modals + project creation read it; fix the wrong-character-name bug (PACK-01, PACK-02).
- Prefilled task seeding on pack creation + the lifecycle/stage model with gates (PROC-01, PROC-02).
- Task↔deliverable link — *server data + logic already done (commit 69d4e54); its UI is BIAB-1/UX-03* (PROC-06).
- New deliverable types + stage organization: business plan, financial model, legal/compliance checklist, brand guide, SOP; prereqs→build→launch→grow (DOC-02, DOC-03).
- Prefilled project-direction scaffold from the pack (INTAKE-02).
- Cost model: cheap smart-template scaffolds, generation on demand, cost guard in the loop (OPS-01).

**Success criteria:**
1. Creating a project from any pack seeds a staged, agent-assigned task list (not zero tasks).
2. Pack/role data has one source; agents introduce themselves with the correct character name.
3. A task and its document link both ways (proven live, 69d4e54).
4. The new stage-organized deliverable types exist.
5. A new project's direction is prefilled from the pack.

## BIAB-1 · Flagship Pack, End-to-End
**Goal:** build all four layers for ONE pack (flagship — decision D-1) and run a real founder through it. De-risks the whole vision on a small surface.
**Requirements:** PACK-03, PACK-04, TEAM-01, TEAM-03, PLAY-01, PLAY-02, PLAY-04, DOC-01, DOC-04, PROC-03, PROC-04, PROC-05, PROC-07, INTAKE-01, INTAKE-03, INTAKE-06, UX-01, UX-02, UX-03, UX-04

**Work:**
- Team cast + per-role briefs for the flagship (TEAM-01, TEAM-03); the 4-layer model realized (PACK-03); editable presets (PACK-04).
- Playbook gathered + embedded for this ONE field — sourced frameworks/benchmarks/do's-don'ts/exemplars, cite-or-admit, honest on thin spots (PLAY-01, PLAY-02, PLAY-04). **Biggest single effort.**
- Pre-scaffolded staged documents incl. the legal/tax "verify locally" framing (DOC-01, DOC-04).
- Process: journey view + proactive guidance + agents EXECUTE tasks via autonomy + resumption (PROC-03/04/05/07).
- Intake + prefilled personalization + the day-one "Success Plan" + onboarding integration (INTAKE-01/03/06).
- UX (all **mockup-first, no code until approved**): deeper pack picker, "start here/first 3 moves," visible task↔doc link, on-demand playbook/sources view (UX-01..04).
- **Verify live** with a real founder scenario.

**Success criteria:**
1. Clicking the flagship → short intake → personalized direction + staged tasks + pre-scaffolded docs appear.
2. Agents answer grounded in the flagship's sourced playbook (cite-or-admit on gaps).
3. "Go ahead" makes the team execute preset tasks via autonomy; a Success Plan is produced day one.
4. The founder sees a journey + "first 3 moves," can open a task's document and edit presets.
5. A real founder run-through completes end to end (verified live).

## BIAB-2 · Scale + Double Catalog + Content-Ops
**Goal:** clone the proven flagship template to every pack, double the catalog, and stand up playbook content-ops.
**Requirements:** PACK-05, TEAM-02, PLAY-03, INTAKE-04, INTAKE-05, OPS-02, OPS-03, OPS-04

**Work:**
- Recast the existing 34 packs to the 4-layer model; surface the 4 new roles + the other unused roles where they belong (TEAM-02).
- Double the catalog with new categories (Local & Services, Fintech, Professional Services, Sales/GTM, Health, Hardware, Mobile/Gaming, Nonprofit/Events, Engineering & Data).
- Playbook content-ops: quality-review gate per playbook + refresh cadence + honest effort/cost sizing; curate top packs, generate/mark the tail (PLAY-03).
- Jurisdiction/currency awareness + fuzzy-idea pack recommendation (INTAKE-04, INTAKE-05).
- Analytics + feedback loop; apply the tier decision; success-rate honesty; pack versioning policy (OPS-02, OPS-03, OPS-04, PACK-05).

**Success criteria:**
1. All 34 existing packs recast; new roles appear where they belong.
2. Catalog roughly doubled; playbooks curated for top packs, generated + marked for the tail.
3. Content-ops running (quality gate + refresh); benchmarks stay honest and sourced.
4. Intake is jurisdiction-aware; Maya recommends a pack from a fuzzy idea; analytics + tier decision live.

---

## Traceability (REQ → phase)

| REQ | Phase | | REQ | Phase | | REQ | Phase |
|-----|-------|-|-----|-------|-|-----|-------|
| PACK-01 | BIAB-0 | | PLAY-01 | BIAB-1 | | INTAKE-01 | BIAB-1 |
| PACK-02 | BIAB-0 | | PLAY-02 | BIAB-1 | | INTAKE-02 | BIAB-0 |
| PACK-03 | BIAB-1 | | PLAY-03 | BIAB-2 | | INTAKE-03 | BIAB-1 |
| PACK-04 | BIAB-1 | | PLAY-04 | BIAB-1 | | INTAKE-04 | BIAB-2 |
| PACK-05 | BIAB-2 | | DOC-01 | BIAB-1 | | INTAKE-05 | BIAB-2 |
| TEAM-01 | BIAB-1 | | DOC-02 | BIAB-0 | | INTAKE-06 | BIAB-1 |
| TEAM-02 | BIAB-2 | | DOC-03 | BIAB-0 | | UX-01 | BIAB-1 |
| TEAM-03 | BIAB-1 | | DOC-04 | BIAB-1 | | UX-02 | BIAB-1 |
| PROC-01 | BIAB-0 | | PROC-04 | BIAB-1 | | UX-03 | BIAB-1 |
| PROC-02 | BIAB-0 | | PROC-05 | BIAB-1 | | UX-04 | BIAB-1 |
| PROC-03 | BIAB-1 | | PROC-06 | BIAB-0 | | OPS-01 | BIAB-0 |
| PROC-07 | BIAB-1 | | OPS-02 | BIAB-2 | | OPS-03 | BIAB-2 |
| OPS-04 | BIAB-2 | | | | | | |

## Blocking decisions
- **D-1 (flagship pack)** blocks BIAB-1 planning.
- **D-2 (tier/monetization, OPS-03)** feeds BIAB-2.

## Next step
`/gsd-discuss-phase` or `/gsd-plan-phase` for **BIAB-0** once D-1 is chosen — but note this is a scoped/additive milestone; promote to top-level GSD tracking when v2.1 closes.
