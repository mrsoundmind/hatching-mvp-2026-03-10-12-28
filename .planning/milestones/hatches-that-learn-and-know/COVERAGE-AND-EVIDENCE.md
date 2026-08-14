# Coverage & Evidence: does this solve everything, and how will we know

> Milestone: Hatches That Actually Learn & Know. 2026-08-13. Two jobs: (1) prove every problem found across all the audits maps to a requirement that closes it (nothing dropped), and (2) define the evidence protocol so no fix is ever called done without runtime proof of fixed / working / how. Additive, milestone-scoped. No em/en dashes, no fabricated proof.

## The evidence protocol (non-negotiable, applies to every requirement)

A requirement is not "done" until it has an **evidence entry** answering three questions, each with a concrete, re-runnable proof, not a claim:

1. **Is it fixed?** The code change exists and typechecks. Proof: the diff + `tsc` clean.
2. **Is it working?** The behavior is demonstrated on a live, restarted server with real providers where the claim needs it (per OPS-01 / `feedback_verify_in_runtime`). Proof: a named command, test script, eval run, or real-browser Playwright run with its output, plus a before/after where the change alters behavior.
3. **How does it work?** A short mechanism explanation (what path the data takes, what flips the outcome), so the fix is understood, not just observed. Proof: the one-paragraph "how" + the file:line of the mechanism.

Every evidence entry is appended to **`EVIDENCE-LEDGER.md`** (created when execution starts) as: `REQ-ID | change (commit/diff) | fixed-proof | working-proof (command + output) | how-it-works | matrix-cell-now`. The matrix (`ITL-2-QUALITY-MATRIX.md`) is the standing evidence surface: a fix is only real when its matrix cell flips from MISSING or RAW to LIVE, and, for quality fixes, when the benchmark trendline moves in the A/B (MEAS-06). "It got smarter" is proven by the A/B delta on the frozen benchmark, never asserted.

Rule: **a green checkmark in this milestone always points at a re-runnable proof.** If it cannot be demonstrated live, it is not done, it is "code-shipped, runtime-pending," and it says so.

---

## Coverage map: every problem found, and what closes it

Legend for Evidence type: `LIVE` (runtime demo/test/eval), `A/B` (benchmark counterfactual delta), `BROWSER` (real Playwright), `CODE+TSC` (diff + typecheck, when there is no runtime surface), `DOC` (decision/runbook).

### A. The 14 fixes already applied this cycle (status: shipped on-branch, most need the runtime-evidence stamp)

| Problem found | Closed by | Evidence required to call it truly done |
|---|---|---|
| Reaction cross-tenant write (IDOR) | messages.ts ownership fix | LIVE: `test-*` + attempt a cross-tenant reaction, denied |
| WS accepts any Origin | chat.ts Origin allowlist | LIVE: WS handshake from disallowed Origin rejected 403 |
| Privacy policy wrong (Neon/US) | PrivacyContent.tsx | BROWSER: legal page shows Supabase/Singapore + all 4 subprocessors |
| Autonomy empty output (120-token) | taskExecutionPipeline maxTokens=2000 | **LIVE, still pending:** free-tier gate blocked the end-to-end run; needs a Pro-tier autonomous task producing full output |
| Autonomy $0 cost (caps blind) | recordEstimatedUsage in pipeline | LIVE: run an autonomy task, confirm `usage_daily_summary.estimatedCostCents` rises |
| Project purge FK failure + ordering | storage.ts purge reorder | LIVE: purge a project that ran autonomy + has deliverables, succeeds |
| No AI-output disclaimers | deliverableTypes + generator | LIVE: generate a financial-model, disclaimer present in content/PDF/copy |
| WS stale connections | chat.ts heartbeat | LIVE: kill a client mid-connection, server terminates it in <=30s |
| DocumentCard not self-documenting | DocumentCard.tsx | BROWSER: done (0 console errors, hover renders) |
| Tabs not keyboard-navigable | SidebarTabBar.tsx | BROWSER: done (Arrow/Home/End move focus+selection) |
| No-op Retry button | MessageBubble.tsx | BROWSER: failure state shows honest text, no dead button |
| No reduced-motion support | index.css | BROWSER: with reduced-motion, animations collapse |

These are folded here so the milestone owns their evidence too: the user asked for proof on everything, and four of them (autonomy output, autonomy cost, purge, disclaimers) were code-verified but not yet runtime-proven.

### B. Intelligence-layer gaps (the deep audit, artifact b00e317e)

| Problem found (code-verified) | Closed by | Evidence that proves fixed + working + how |
|---|---|---|
| No live web search; providers have no tool-use | WEB-01/02/03 (ITL-4, committed build per D-3) | LIVE: an agent searches + reads a real web page and incorporates it into the current answer, cost + injection guarded, with an honest fallback; no half-wired web code remains |
| Agents cannot learn new things from the internet over time (dead AKL; corpus frozen at Aug-2026) | WEB-04 (ITL-4) | LIVE: agents fetch + extract new web info, dedupe + injection-check it, and it lands in the corpus; a later query retrieves the new chunk; growth measured (new-chunks/week + hit-rate). The "keeps improving itself from the internet" proof |
| RAG may be silently empty in prod | KNOW-01 (ITL-0) | LIVE: prod `role_knowledge` count > 0 + boot/health asserts it and alerts on empty |
| Retrieval fails open silently (no signal) | KNOW-02 (ITL-0) | LIVE: force an empty retrieval, a `retrieval_miss` signal is recorded; matrix RAG "fired" flips to LIVE |
| Knowledge is stale, no recency | KNOW-03 (ITL-0) | LIVE: two chunks differing only by date, newer ranks higher with the weight on |
| No repeatable re-ingest | KNOW-04 (ITL-0) | DOC + LIVE: follow the runbook, re-ingest one role, coverage test passes |
| Cite-or-admit unenforced | GRND-01 (ITL-0) | LIVE: a fabricated citation not in retrieved sources is stripped before the user sees it |
| Unsupported outward claims uncaught | GRND-02 (ITL-0) | LIVE: an outward-facing stat on an ungrounded turn is flagged |
| Brain docs truncation-dumped | KNOW-05, KNOW-06 (ITL-1) | LIVE: a question about deep content in a long brain doc is answered correctly |
| Memory recall is a lost signal | MEAS-09 (ITL-2) | LIVE: a turn with injected memory emits `memory_recalled`; matrix Memory "recall" flips to LIVE |
| Agents do not get smarter (no growth loop) | LEARN-01..05 (ITL-3) | **A/B:** an agent that got a revise/reject does the next comparable task measurably better on the benchmark, provider-controlled. This is the literal "is it getting smart" proof |
| Personality adaptation is content-blind | LEARN-02 (ITL-3) | LIVE: a thumbs-down carrying content changes substance, not just tone dials |
| trainingSystem is dead code | LEARN-03 (ITL-3) | LIVE or CODE: either it persists + its UI is mounted and receives a signal, or it is removed |
| No live quality measurement | MEAS-01..08 (ITL-2) | LIVE: the matrix/operator surface shows a real quality trend from data |
| Headline evals are structural proxies | MEAS-04 (ITL-2) | LIVE: genuine evals run dated; proxies relabeled as coverage |
| Positioning claims web search / self-improve | POS-01 (ITL-5) | BROWSER: no public/in-product copy implies a capability the code lacks |
| No grounding signal to the user | POS-02 (ITL-2 KNOW-02 + ITL-5) | BROWSER: UI can honestly show grounded vs general answer |
| Stale "30 agents" vs 34-35 | POS-03 (ITL-5) | BROWSER: count matches reality from one source |

### C. Measurement/matrix gaps (from the two grounding inventories)

| Problem found | Closed by | Evidence |
|---|---|---|
| No coverage view (what is measured vs not) | MEAS-08: the Quality & Health Matrix (ITL-2) | LIVE: the matrix renders every surface x band with a real status and drills into any drop |
| Error/empty rate never aggregated | MEAS-09 (ITL-2) | LIVE: an error-rate metric exists and moves when errors are injected |
| Per-provider quality only for chat | MEAS-09 (ITL-2) | LIVE: writer provider/model recorded on deliverables + tasks; quality segmentable by model everywhere |
| Cost-per-quality never crossed | MEAS-08 band E (ITL-2) | LIVE: a cost-per-quality figure computed from real usage + judge scores |
| Verdict-mix / rubric / reader-test not aggregated | MEAS-01 (ITL-2) | LIVE: benchmark reads rubric + reader-test and breaks peer review down by verdict |

### D. Explicitly out of scope here (tracked elsewhere, not dropped)

| Item | Where it lives |
|---|---|
| Supabase PITR, Sentry install, migration baseline | `project_prelaunch_hardening_remaining` (needs user/dashboard/npm) |
| Free-tier autonomy gate policy (billing gates) | Business decision (documented in the re-audit log); code fix ready once policy is set |
| Product analytics for acquisition/activation funnels | Growth/marketing track (the matrix names it as the Outcome band's dependency) |

---

## The completeness guarantee

Every problem found across the product audit, the deep intelligence audit, and the two measurement-grounding passes appears in section A, B, C, or D. Sections A to C each map to a requirement in a phase of this milestone; section D is explicitly parked with its home named. **There is no found problem without a home.** When the milestone executes, the coverage map is the checklist and the Evidence Ledger is the proof, and the matrix is the standing, drillable "it works, and here is how" surface. "Getting smarter" specifically is proven by the ITL-3 A/B delta on the frozen benchmark (MEAS-06), the one form of evidence that cannot be faked by assertion.
