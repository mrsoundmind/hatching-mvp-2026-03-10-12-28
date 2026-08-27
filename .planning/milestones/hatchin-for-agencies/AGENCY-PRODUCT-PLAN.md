# Hatchin for Agencies: Product Plan (GSD-style discovery)

*Created 2026-08-27. Translates the agency research (see `~/marketing-plans/hatchin/agency-growth-plan-v2.md`) into a sequenced product plan: each core agency pain to a concrete Hatchin build, grounded in what the codebase already has. Discovery/options plan (figure out what we CAN do), not a committed roadmap edit. Parallel-work-safe: this is a new scoped milestone dir; top-level STATE.md/ROADMAP.md are NOT touched (sibling-dirty).*

---

## The good news first (why this is mostly configuration, not a rebuild)

Grounded in the actual codebase today:

- **EXISTS and reusable:** 34 roles; Business-in-a-Box pack system (`shared/packBlueprints.ts` + Batch2); ~24 deliverable types with section schemas (`shared/deliverableTypes.ts`: prd, tech-spec, gtm-plan, business-plan, financial-model, brand-guide, sop, market-research, competitive-analysis, and more); LLM-as-judge peer review; per-role RAG; autonomy/working-loop; deliverable versions + frozen rubrics + reader-test.
- **GAPS for the agency wedge (what's genuinely missing):**
  1. No `proposal`, `sow`/`scope`, or `pitch-deck` deliverable types (the exact agency wedge documents).
  2. No agency pack blueprint (no "agency team" starter).
  3. **Model routing is GLOBAL only** (`LLM_PRIMARY` env in `server/llm/providerResolver.ts`); there is no per-project/per-request "route this client's confidential work to a safe model" path. This is the core engineering for data-safe mode.
  4. Peer review runs but is not surfaced as a client-facing "checked before it reaches the client" trust feature.
  5. No client / multi-client structure (agencies juggle many clients).
  6. No redaction / data-minimization pass.
  7. **The brain (RAG) stores facts, not an agency's voice, structure, or judgment.** Genuine per-agency adaptation needs a learned, editable "Agency DNA" layer, not just document retrieval. This is the make-or-break gap (see Phase F), because generic output that does not sound like the agency IS the AI slop 58% of them already distrust.

So the agency pivot is largely: add a few deliverable types, add an agency pack, add per-project safe-model routing, and surface peer review. The orchestration, packs, deliverables, and review engine already exist. That is the unfair advantage.

---

## Pain to build map (from the research)

| Agency pain (sourced in v2 plan) | What Hatchin builds | Exists? | Phase |
|---|---|---|---|
| Winning new business is the #1 pain, 4 yrs (proposals/pitches/SOWs, 60-120 hrs, $5k-75k each) | Agency pack + proposal / SOW / pitch deliverable types + peer review on them | Packs+deliverables+review EXIST; the types+pack are NEW | A |
| Thin margins + under-utilization + non-billable overhead | The proposal engine (biggest non-billable drain) + autonomy produces between sessions | Served by A + existing autonomy | A |
| Scope creep (10% scope to 30% cost) | SOW / scope / estimate deliverable types | NEW types | A |
| AI slop / trust gap (58% increased oversight) | Surface peer review + ship slop detection (Phase 46) + reader-test on client docs | Review EXISTS; surfacing+slop-detection NEW | C |
| Data safety (China-hosted model blocks the ICP) | Client-data-safe mode: per-project safe-model routing + redaction + contracts | Per-project routing NEW; safe providers already in stack | B |
| Non-technical operators | Agency pack seeds the team + staged workflow, no prompt engineering | Served by A | A |
| High-value deliverables un-served by AI | The proposal/SOW/strategy/audit types | NEW types | A |
| Agencies juggle many clients | Per-client workspace + per-client brain/RAG | NEW, heavier | D (foundation for E) |
| Leaving expansion revenue on the table with existing clients (chasing new logos while under-growing current accounts) | Account Growth Engine: load the client, generate upsell/next-project/retention plans | Deliverable engine + proposals + RAG + autonomy EXIST; the account entity + growth-plan type are NEW | E |
| Generic AI output that does not sound like the agency (you cannot standardize voice/criteria/design across agencies) | Agency DNA layer: learn from their wins, an editable DNA profile injected everywhere, review against their standards, win/loss learning | Brand-spec pattern + RAG + rubrics + memory EXIST; per-account DNA + win-example ingestion + per-agency rubric are NEW | F |

---

## Phase A: Agency Proposal Engine (the wedge, highest priority)

**Goal:** a small agency produces a client-ready, peer-reviewed proposal, pitch, or scope without hiring.

- **A1. Agency pack blueprint.** A new pack that seeds the agency team (account lead, strategist, copywriter, designer, PM, finance/estimator) plus a staged workflow: client brief to proposal draft to scope/estimate to peer review to export. Reuses `seedPackBlueprint`.
- **A2. New deliverable types + section schemas + frozen rubrics:** `proposal`, `sow` (scope/estimate), `pitch-deck` (outline), `case-study`. Reuses the deliverable generator + rubric scorer.
- **A3. Surface the peer-review moment** on these deliverables as the explicit "a second specialist checked this before it reaches your client" trust beat.

**Builds on:** packs, deliverable types, generator, peer review. Mostly configuration + focused extension. **Effort: M.** **Impact: highest (it is the wedge).**

---

## Phase B: Client-data-safe mode (the gate, high priority, gates the whole ICP)

**Goal:** an agency runs confidential client work without it ever going to a China-hosted model.

- **B1. Per-project "client-data mode" model routing.** A per-project (and per-request) flag that pins the provider order to a US/EU no-train provider (Gemini or OpenAI, already in the chain) and EXCLUDES DeepSeek. Today `providerResolver.ts` chooses provider GLOBALLY via `LLM_PRIMARY`; this adds a per-request override so a "safe" project never touches DeepSeek. Core engineering, but bounded (the provider-chain machinery exists; add a `safeMode` that constrains `buildProviderOrder`).
- **B2. Redaction / data-minimization pass (optional, real privacy win).** Strip or tokenize client-identifying info before inference. Lightweight, sellable.
- **B3. Contractual + disclosure layer (non-code, founder + legal):** DPA with a written no-training clause, published sub-processor list with locations, data-residency note (Supabase region), SOC 2 Type II later.
- **B4. Local / on-prem inference (premium, later).** A self-hosted model option (Ollama already installed locally) so the most sensitive agencies keep data fully local. Heavier; a later premium tier.

**NOT federated learning (decision 2026-08-27):** FL is a training-time technique needing edge compute; Hatchin's risk is inference-time data flow to a third-party API and Hatchin does not train its own model. The privacy is delivered by safe-provider routing (B1) + redaction (B2) + optional local inference (B4) + contracts (B3), not FL.

**Effort: M engineering (B1/B2) + non-code (B3) + L later (B4).** **Impact: high, unblocks the whole agency ICP.**

---

## Phase C: Trust made visible + anti-slop

**Goal:** the output is visibly, provably trustworthy (the anti-AI-slop story agencies are asking for).

- **C1.** Surface peer review + reader-test prominently on client-facing deliverables (reader-test exists for prose types; extend to the agency types).
- **C2.** Ship slop detection (the already-planned Phase 46), using the dual mechanical-regex + LLM-evaluator pattern validated by the autonovel research.

**Effort: M.** **Impact: medium-high (it is the differentiator made legible).**

---

## Phase D: Multi-client structure (now the foundation for Phase E)

**Goal:** agencies manage many clients cleanly. Reframed from "later/secondary": it is the substrate the Account Growth Engine (Phase E) is built on, so it now carries a revenue purpose, not just organization.

- Per-client workspace, per-client brain/RAG/knowledge, per-client deliverable history.

**Effort: L.** **Impact: was "later"; now a prerequisite for E, so it rises with E.**

---

## Phase E: Account Growth Engine (grow and retain existing clients)

**Goal:** an agency loads everything about an existing client (documents, past work delivered, responsibilities, contracts, relationship history), and Hatchin's team produces plans to grow income from that client and keep them longer. This is the OTHER half of agency revenue: Phase A wins NEW work, Phase E grows EXISTING accounts, which is usually higher-margin because there is no new-client acquisition cost.

- **E1. Per-client knowledge base.** Ingest all client docs, history, scope, and responsibilities into a per-client brain/RAG. REUSE: RAG, brain docs, the chat-attachments engine. NEW: the per-client "client" entity (this is the Phase D structure, now given a revenue purpose).
- **E2. Account intelligence.** The account lead + strategist read the whole relationship: what has been delivered, the client's goals, unmet needs, risk and renewal signals. REUSE: roles + reasoning + RAG over the client brain. NEW: an account-review / QBR analysis flow.
- **E3. Expansion plan generation.** Produce an account-growth plan: upsell and cross-sell opportunities, next-project proposals, a roadmap to grow the account. REUSE: the deliverable engine + the Phase A proposal engine (an expansion plan naturally feeds proposals). NEW: an `account-growth-plan` deliverable type.
- **E4. Retention loop.** Proactive account-health and renewal prep as a recurring routine. REUSE: the autonomy working-loop + memory + the scheduled-routines idea (borrow-catalog item 8.1). NEW: account-health signals + the recurring account routine.

**Depends on:** the per-client structure (E1 / Phase D). **Reuses:** Phase A (proposals) and the autonomy/memory/RAG engine heavily.
**Effort: M to L** (E1 is the structural lift; E2/E3/E4 reuse a lot).
**Impact: high.** Expansion revenue is higher-margin, and for agencies that ALREADY have clients this may be a FASTER first win than proposals: they can grow an existing account today instead of waiting for the next RFP. So E is not just "after A", it may be a parallel entry point for the many agencies whose immediate money is in their existing book.
**Measurement (research anchors, real + cited):** expansion revenue costs about HALF what new-customer revenue costs to win ($1.00 vs $2.00 CAC ratio, Benchmarkit 2025); about 74% of firms' revenue now comes from existing customers (ChurnZero 2025); yet 61% of agencies only pursue upsell/cross-sell "occasionally" with no formal process (Scaled State of Agency 2025). Client relationships now last about 7 years, double 2016 (ANA/4As 2025), and agency client LTV rose 18% when tenure rose 20% (Promethean). Mid-market agencies spend $5,000 to $15,000 to acquire one new client (Promethean), the cost avoided by growing an existing one. **[modeled]:** one expansion retainer won from an existing client (~$3,500/mo, ~₹3L/mo, ~$42k/yr) at roughly half the cost and effort of a new logo. The wedge is that agencies ADMIT they skip this motion, so Hatchin industrializes it. **Solve-confidence:** high that the opportunity is real and well-sourced; medium-high that Hatchin converts it (the plan is the tool; the win depends on output quality plus the agency's follow-through). The single best pitch anchor: "61% of agencies only chase upsell occasionally, even though expanding a client costs about half what winning a new one does."

---

## Phase F: Agency DNA / Adaptation (arguably the real product and the moat)

**The reframe:** Hatchin for agencies is not "an AI team that makes proposals." It is "an AI team that learns to work like YOUR agency." Any competitor can generate a proposal; almost none will BECOME a specific agency's way of working. The personalization is the product and the moat, and it compounds: more use to more "them" to switching cost earned honestly. A second frame from the research: agencies fear junior-pipeline collapse (two-thirds worry); Hatchin holding the agency's DNA, methodology, and winning patterns makes it the senior-in-a-box that does not quit, where the craft survives turnover.

**Why the brain alone is not enough:** RAG is strong at facts ("what did we say about X"), weak at voice, structure, judgment, and taste, which is what makes a proposal theirs. Retrieving an old chunk is not writing a new one in their distinctive style and standards. Brain alone produces competent but generic output, the exact AI slop 58% of agencies already distrust (AgencyAnalytics 2026). So Phase F is not polish, it is what makes Phase A actually land.

Four parts, woven through A, C, and E:
- **F1. Learn from their wins.** Onboarding ingests the agency's 3 to 5 best WON proposals; Hatchin reverse-engineers their winning formula (structure, voice, value framing, pricing style) so the first draft already sounds like them. Highest-success feature: it starts from proven work, and it is the "that sounds like us" demo moment with no testimonial needed. REUSE: attachments + RAG + LLM extraction. NEW: win-example ingestion + style extraction.
- **F2. Agency DNA profile (editable, injected everywhere).** A structured, editable representation of the agency's identity: mission, positioning, voice rules, proposal structure, do's and don'ts, design language, injected into every deliverable. This is the Wave 1A brand-spec (DESIGN.md) pattern generalized from one Hatchin house style to a PER-AGENCY style. REUSE: the brand-spec injection pattern (already built). NEW: per-account profile + an editor.
- **F3. Review against THEIR standards.** Peer review scores against the agency's own rubric (learned + editable), not a generic checklist. "Our AI team checks your proposal against YOUR bar." REUSE: the frozen-rubric system. NEW: per-agency rubric.
- **F4. Win/loss learning loop.** Feed back which proposals won or lost; Hatchin learns what wins for THIS agency and gets better over time. This is also the only quality signal agencies truly believe (did it win), so it closes the self-referential-quality gap. REUSE: memory + the deferred growth loop. NEW: outcome capture + per-agency learning.

**Honest caveat (visual design language):** text voice and structure adaptation are very achievable now. Matching an agency's actual VISUAL design (deck template, typography, layout) is a separate, harder problem that needs a template/export engine, not prompting. Scope it honestly: nail the thinking and voice first (the real value), treat pixel-perfect visual match as a later, partial layer (it connects to the export + DESIGN.md visual tokens).

**Effort: M** (F1/F2 reuse the brand-spec + attachments heavily; F3 reuses rubrics; F4 needs the growth loop). **Impact: highest of all**, it is what prevents the generic-slop failure mode and it is the moat.
**Measurement:** preventive + compounding, not a single percentage. The failure it prevents is real and sourced (58% of agencies increased oversight because AI output is not trustworthy or theirs, AgencyAnalytics 2026). The mechanism: start from their wins (F1) so the floor is "sounds like them from draft one," compounding with use (F4). Honest: "sounds exactly like you" is a direction, not a day-one guarantee; it gets closer with usage.

---

## Sequencing and how it fits the launch

1. **A + B are the launch pair.** A is the wedge (the reason agencies come); B is the gate (the reason they can safely stay). Ship both before pushing the agency motion.
2. **C reinforces** the trust story once A+B land.
3. **D + E are the second engine (grow existing accounts).** A wins new work; E grows and retains the clients an agency already has. For agencies with an existing book, E can be a *parallel* entry point (money today, not next-RFP), so it may not wait behind A as long as first assumed. D is E's prerequisite.
4. **Overlap with existing launch prerequisites:** B is the same data-safety work the marketing plan already flagged as a launch blocker, so it is not new scope, it is now correctly prioritized. The public demo should show Phase A (a proposal built and peer-reviewed). E is doubly gated on B, because growing an existing account means loading that client's confidential history, so the safe-model routing must be in place first.
5. **F (Agency DNA) is woven through A, C, and E, and is arguably the headline of the whole product.** It is what makes A land in the agency's voice and E credible; without it, A produces generic slop and the wedge fails. So although it touches everything, its first slice (learn-from-wins in F1 + DNA injection in F2) ships ALONGSIDE A, not after it. The positioning shifts from "an AI team that makes proposals" to "an AI team that learns to work like your agency."

---

## Open questions for the founder (before formalizing into GSD phases)

1. **Commit to this as a milestone?** If yes, the next GSD step is to formalize A/B/C/D as roadmap phases (that edits ROADMAP.md/STATE.md, which are currently sibling-dirty, so do it on a clean branch or with explicit go).
2. **Creative/marketing vs dev/IT agency deliverable set** for Phase A (the v2 plan's open ICP question). The deliverable types differ slightly (a dev agency SOW vs a creative pitch deck).
3. **How far to take B for launch:** minimum is B1 (safe routing) + B3 (DPA/disclosure); B2 redaction and B4 local inference can follow.
4. **Priority vs the borrow-catalog Wave 2** (brand spec shipped; routines/export/avatars pending). This agency work likely outranks Wave 2.
