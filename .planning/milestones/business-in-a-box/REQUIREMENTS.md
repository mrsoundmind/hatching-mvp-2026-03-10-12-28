# Requirements — Business-in-a-Box Starter Packs

> **Milestone-scoped GSD requirements (additive).** Written 2026-08-07. This milestone is DISTINCT from the in-progress v2.1; it lives here (not in top-level `REQUIREMENTS.md`) so it does not disturb v2.1 or a parallel session's work. Promote to top-level when v2.1 closes and this becomes the active milestone.
>
> **Source of truth:** master build plan (artifact `9b96f6f4`) + audit (artifact `4fdf4d9d`), both from the 2026-08-07 read-only audit of `shared/templates.ts`, `StarterPacksModal.tsx`, `server/storage.ts` (`initializeStarterPackProject`), `shared/deliverableTypes.ts`.

## Goal

Turn every starter pack from "3 generic agents + one welcome line" into a complete **guided operating system** for that business type: the right team, the field's real (sourced) expertise, pre-scaffolded documents, and a prefilled, guided process, so a founder clicks a pack and is not staring at a blank page.

## Operating rules (durable constraints, apply to every requirement)

- **UI is mockup-first, always.** Any UI addition/change gets a visual mockup/clickable prototype first; ZERO UI code until the user approves the visual. Server-side proceeds normally. (memory `feedback_ui_change_protocol`, reaffirmed 2026-08-07)
- **Every number/example is real and sourced** (cite-or-admit). No invented stats or fake case studies.
- **Legal & tax = "typical, verify locally, consult a professional,"** never authoritative advice. Ira (Legal) owns the framing.
- **Presets are editable starting points**, not a cage.
- **One source of truth** for pack/role data.
- **Prove one flagship pack end-to-end, then scale.**
- **Don't hand-gather all ~68 playbooks**: curate flagship + top ~8-10, generate/augment the long tail (clearly marked), upgrade over time.
- **Sequence after launch** (34-role RAG, audit fixes, attachments ship first); do not let this delay shipping.
- **Nothing merged/deployed in this milestone; all on-branch.**

---

## v1 Requirements (this milestone)

### PACK — Pack model & foundations
- [ ] **PACK-01**: All pack + role data reads from ONE source of truth (collapse the 3 drifting copies: `shared/templates.ts`, `StarterPacksModal`'s own copy, `allHatchTemplates`).
- [ ] **PACK-02**: Agents created by a pack introduce themselves with the CORRECT character name (fix the wrong-name bug where e.g. UI Designer "Arlo" is described as "Taylor").
- [ ] **PACK-03**: Every pack conforms to the 4-layer model (Team, Playbook, Documents, Process).
- [ ] **PACK-04**: A founder can edit a pack's presets (add/remove/reorder/skip tasks, docs, teammates) — presets are a starting point, not fixed.
- [ ] **PACK-05**: Pack versioning policy defined — improving a pack does not silently break projects already created from an older version.

### TEAM — Team layer
- [ ] **TEAM-01**: Each pack is cast with the right specialists for that business (fix miscast packs; e.g. SaaS gets a designer + growth, investor-deck gets Finance).
- [ ] **TEAM-02**: The 4 new roles (Finance/Juhi, Legal/Ira, Sales/Dana, Customer Success/Tess) and the other 12 currently-unused roles appear in the packs where they belong.
- [ ] **TEAM-03**: Each teammate in a pack carries a per-role focus brief for THAT business (not a generic role description).

### PLAY — Playbook layer (embedded field expertise)
- [ ] **PLAY-01**: A pack preloads its field's expertise (frameworks, success factors, benchmarks, do's/don'ts, exemplars), retrievable + citable by the agents, via the existing per-role RAG engine scoped to the project type.
- [ ] **PLAY-02**: Every benchmark, statistic, and exemplar in a playbook is real and sourced; agents cite-or-admit and never fabricate.
- [ ] **PLAY-03**: Playbook content-ops exist: a quality-review gate per playbook, a refresh cadence for stale benchmarks/exemplars, and honest per-field effort/cost sizing.
- [ ] **PLAY-04**: Thin-knowledge fields are handled honestly (some fields lack authoritative sources; the pack says so rather than faking depth).

### DOC — Documents layer
- [ ] **DOC-01**: A pack provides pre-scaffolded documents (right sections + playbook-sourced starter content), not blank templates.
- [ ] **DOC-02**: New deliverable types exist where needed: business plan, financial model, legal/compliance checklist, brand guide, SOP.
- [ ] **DOC-03**: Documents are organized by lifecycle stage (prerequisites → build → launch → grow), including a real prerequisites stage.
- [ ] **DOC-04**: Legal/tax/compliance documents are framed as "typical, verify locally, consult a professional," owned by Ira; never presented as authoritative advice.

### PROC — Process layer
- [ ] **PROC-01**: Selecting a pack immediately populates a staged, ordered, agent-assigned task list (today it seeds zero tasks).
- [ ] **PROC-02**: A lifecycle/stage model (prereqs → build → launch → grow) with ordering + gates governs the tasks and documents.
- [ ] **PROC-03**: The founder can see a journey/progress view (where they are, what's done, what's next).
- [ ] **PROC-04**: The team proactively guides the founder stage to stage (not a static checklist).
- [ ] **PROC-05**: The team can actually EXECUTE the preset tasks via the existing autonomy/handoff engine when the founder says "go ahead" (not just list them).
- [ ] **PROC-06**: A task links to the document it produces and back (task ↔ deliverable). *[server data + logic DONE, commit 69d4e54; clickable UI remains]*
- [ ] **PROC-07**: The journey remembers where the founder left off and re-engages them on return (ties to the existing idle-autonomy trigger).

### INTAKE — Intake & personalization
- [ ] **INTAKE-01**: On pack selection, Maya runs a short intake (what/who/where-country/stage); answers personalize the direction, documents, and tasks.
- [ ] **INTAKE-02**: The pack prefills the project direction (what/who/why) scaffold from intake.
- [ ] **INTAKE-03**: The team produces a personal "Success Plan" (a bespoke roadmap synthesizing playbook + intake) as the day-one deliverable.
- [ ] **INTAKE-04**: Prerequisites/currency/market context are jurisdiction-aware (intake asks the country; scaffolds stay generic + "verify locally"; money in the founder's currency).
- [ ] **INTAKE-05**: Maya can recommend the right pack from a founder's fuzzy idea.
- [ ] **INTAKE-06**: Pack intake integrates with the existing onboarding/tour (no duplication or collision).

### UX — Experience (all mockup-first)
- [ ] **UX-01**: The pack picker shows real depth (team, what you get, a preview of the staged journey) before selection.
- [ ] **UX-02**: On click, the founder is not overwhelmed: progressive disclosure with a clear "start here / your first 3 moves."
- [ ] **UX-03**: The task↔document link is visible/clickable ("View document" on a task; back-link on the deliverable).
- [ ] **UX-04**: The founder can view the playbook / sources on demand (not forced into the conversation).

### OPS — Cross-cutting
- [ ] **OPS-01**: Cost model: documents arrive as cheap smart templates; full AI generation only when a founder engages an agent; existing cost guard stays in the loop.
- [ ] **OPS-02**: Analytics + feedback loop: measure which packs/tasks/docs get used and completed and which playbooks get cited, to improve packs over time.
- [ ] **OPS-03**: Tier/monetization decision applied (are deep packs a Pro feature or available to all?).
- [ ] **OPS-04**: Success-rate honesty: show sourced FIELD benchmarks; never imply Hatchin guarantees the founder's success.

---

## Open decisions (resolve before Phase 1 planning)

- **D-1 — Flagship pack:** which pack to prove first (SaaS Startup vs Restaurant Launch vs another closer to the target user). Blocks Phase 1.
- **D-2 — Tier/monetization (OPS-03):** deep packs Pro-only, or available to everyone? Affects scope + cost.

## Future requirements (deferred beyond this milestone)

- Multi-language playbooks/UI (beyond currency + jurisdiction framing).
- Cross-project learning / portfolio-level insight.
- Community-contributed or marketplace packs.
- Outcome-weighted playbook ranking (which sources led to accepted work) — hooks now, ranking later.

## Out of scope (explicit exclusions)

- **Authoritative legal/tax/financial advice** — deliberately excluded for liability; we frame prerequisites, never advise. (DOC-04, OPS-04)
- **Auto-generating all ~68 full playbooks up front** — excluded on cost/quality grounds; curate + generate-tail instead. (PLAY-03)
- **Merging/deploying in this milestone** — excluded; ships behind the separate launch/ship gate.
- **Replacing the existing deliverable/RAG/autonomy engines** — excluded; this milestone REUSES them.

## Traceability

Filled by the roadmap (see `ROADMAP.md`). Each REQ maps to exactly one phase.
