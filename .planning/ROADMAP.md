# Roadmap: Hatchin

## Milestones

- ✅ **v1.0 Text-Perfect, Human-First** — Phases 1-5 (shipped 2026-03-19) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Autonomous Execution Loop** — Phases 6-9 (shipped 2026-03-23) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Billing + LLM Intelligence** — Phase 10 (shipped 2026-03-23) — [archive](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 Autonomy Visibility & Right Sidebar Revamp** — Phases 11-15 (shipped 2026-03-29)
- ✅ **v2.0 Hatches That Deliver** — Phases 16-21 (shipped 2026-03-30)
- ⚠️ **v3.0 Hatchin That Works** — Phases 22 + 28 shipped; Phases 23-27, 29-34 re-scoped into V3 (closed 2026-04-28) — [archive](milestones/v3.0-ROADMAP.md)
- 📋 **Next: v2.1 Hatches That Self-Improve** — see [ROADMAP-V3.md](ROADMAP-V3.md) for 12-milestone post-v2.0 plan

---

<details>
<summary>✅ v1.0 Text-Perfect, Human-First (Phases 1-5) — SHIPPED 2026-03-19</summary>

See archived roadmap: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

**Phases completed:**
- Phase 1: Hatch Conversation Quality
- Phase 2: User Journey Fixes
- Phase 3: Hatch Presence and Avatar System
- Phase 4: Data Reliability and Resilience
- Phase 5: Route Architecture Cleanup

</details>

<details>
<summary>✅ v1.1 Autonomous Execution Loop (Phases 6-9) — SHIPPED 2026-03-23</summary>

See archived roadmap: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

**Phases completed:**
- Phase 6: Background Execution Foundation (4 plans)
- Phase 7: Agent Handoffs and Approval UI (4 plans)
- Phase 8: Chat Summary and Tab Notifications (2 plans)
- Phase 9: Progressive Trust and Inactivity Trigger (2 plans)

**Key deliverables:** pg-boss background execution, agent handoff chain with cycle detection, three-tier safety gates, progressive trust scoring, Maya return briefing, tab notifications, inactivity auto-trigger.

</details>

<details>
<summary>✅ v1.2 Billing + LLM Intelligence (Phase 10) — SHIPPED 2026-03-23</summary>

See archived roadmap: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

**Key deliverables:** Stripe Free/Pro billing ($19/mo), smart LLM routing (Gemini Flash/Pro + Groq free tier), token tracking, usage capping, conversation compaction, reasoning cache, background task batching.

</details>

<details>
<summary>✅ v1.3 Autonomy Visibility & Right Sidebar Revamp (Phases 11-15) — SHIPPED 2026-03-29</summary>

**Key deliverables:** Tabbed right sidebar (Activity/Brain & Docs/Approvals), live autonomy event feed, handoff visualization, agent working-state avatar, approvals hub, task pipeline, project brain file upload, autonomy settings dial, work output viewer, premium polish across new components.

**Phases completed:**
- Phase 11: Sidebar Shell + Activity Feed
- Phase 12: Handoff Visualization
- Phase 13: Approvals Hub + Task Pipeline
- Phase 14: Brain Redesign + Autonomy Settings
- Phase 15: Polish

</details>

<details>
<summary>✅ v2.0 Hatches That Deliver (Phases 16-21) — SHIPPED 2026-03-30</summary>

**Key deliverables:** Split-panel artifact viewer, schema-enforced deliverable generation, cross-agent document chains (3 templates: launch / content-sprint / research), project packages, organic detection, professional PDF export, zero-friction onboarding (PackageSuggestionCard).

**Phases completed:**
- Phase 16: Database Foundation + Artifact Panel Shell
- Phase 17: Deliverable Generation + Schema Enforcement
- Phase 18: Cross-Agent Deliverable Chains
- Phase 19: Organic Detection + Iteration UX
- Phase 20: Project Packages + Background Production
- Phase 21: Zero-Friction Onboarding + PDF Export

</details>

<details>
<summary>⚠️ v3.0 Hatchin That Works (Phases 22, 28 shipped; rest re-scoped) — CLOSED PARTIAL 2026-04-28</summary>

See archived roadmap: [milestones/v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md)

**Shipped:**
- Phase 22: Atomic Budget Enforcement (BUDG-01..03 — ledger + reserve/release + daily reconciliation cron at `5 0 * * *` UTC)
- Phase 28: Maya Bug Fix + SDK Migration (BUG-01..06 — `@google/genai`, AbortSignal end-to-end, heap leak closed, stop button reset)
- Hotfix `quick-260427-ojf`: DB-CRASH-01 (Neon idle-in-transaction recovery + traceStore transaction-leak)

**Re-scoped to V3 milestones (68 of 77 requirements):**
- BUDG-04..08 + SCHED + CHAT + MGMT + VER (32 reqs) → v2.7 Pillar 5 + Pillar 3
- DISC + MVB + PHASE + BLPR + SKIP (20 reqs) → v2.1 Pillars 6, 7, 8, 10
- FBK + LLMUX (8 reqs) → v2.1 Pillar 1 + Phase 1 hotfix
- COST (4 reqs) → v2.1 Pillar 9
- FORM (4 reqs) → v2.3 Pillar 7
- PREF (5 reqs) → v3.0 (Mental Models in V3) Pillar 4
- LEGAL-01 partial (links shipped, pages 404) → v2.1 Phase 1
- AUTH-GATE-01: ✅ verified already shipped (audit confirmed `<AuthGuard>` redirects)

**Why partial close-out:** Apr 25–28 deep audit (18 repo evaluations + 15-item gap audit) produced ROADMAP-V3, which restructured the unfinished v3.0 work under a unified post-v2.0 plan. No work abandoned — re-scoped, not dropped.

</details>

---

## 📋 Next: v2.1 Hatches That Self-Improve

The next active milestone is **v2.1** per ROADMAP-V3. Setup in progress via `/gsd-new-milestone`.

**Theme:** Make autonomous work *trustworthy*. Refinements stop making things worse silently. Maya knows when she has enough context. Power users can skip discovery.

**Effort:** 5-7 weeks · **Hard dependency:** none (foundation milestone)

**See:** [ROADMAP-V3.md](ROADMAP-V3.md) for full 12-milestone plan covering v2.1 → v4.0.

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Hatch Conversation Quality | v1.0 | — | Complete | 2026-03-19 |
| 2. User Journey Fixes | v1.0 | — | Complete | 2026-03-19 |
| 3. Hatch Presence and Avatar System | v1.0 | — | Complete | 2026-03-19 |
| 4. Data Reliability and Resilience | v1.0 | — | Complete | 2026-03-19 |
| 5. Route Architecture Cleanup | v1.0 | — | Complete | 2026-03-19 |
| 6. Background Execution Foundation | v1.1 | — | Complete | 2026-03-23 |
| 7. Agent Handoffs and Approval UI | v1.1 | — | Complete | 2026-03-23 |
| 8. Chat Summary and Tab Notifications | v1.1 | — | Complete | 2026-03-23 |
| 9. Progressive Trust and Inactivity Trigger | v1.1 | — | Complete | 2026-03-23 |
| 10. Billing + LLM Intelligence | v1.2 | — | Complete | 2026-03-23 |
| 11. Sidebar Shell + Activity Feed | v1.3 | 3/3 | Complete | 2026-03-25 |
| 12. Handoff Visualization | v1.3 | 2/2 | Complete | 2026-03-25 |
| 13. Approvals Hub + Task Pipeline | v1.3 | 2/2 | Complete | 2026-03-26 |
| 14. Brain Redesign + Autonomy Settings | v1.3 | 2/2 | Complete | 2026-03-26 |
| 15. Polish | v1.3 | 6/6 | Complete | 2026-03-30 |
| 16. Database Foundation + Artifact Panel Shell | v2.0 | — | Complete | 2026-03-30 |
| 17. Deliverable Generation + Schema Enforcement | v2.0 | — | Complete | 2026-03-30 |
| 18. Cross-Agent Deliverable Chains | v2.0 | — | Complete | 2026-03-30 |
| 19. Organic Detection + Iteration UX | v2.0 | — | Complete | 2026-03-30 |
| 20. Project Packages + Background Production | v2.0 | — | Complete | 2026-03-30 |
| 21. Zero-Friction Onboarding + PDF Export | v2.0 | — | Complete | 2026-03-30 |
| 22. Atomic Budget Enforcement | v3.0 | 3/3 | Complete | 2026-04-26 |
| 23-27. Budget UX + Scheduling + Routines + Verification | v3.0 | — | Re-scoped to V3 v2.7 | 2026-04-28 |
| 28. Maya Bug Fix + SDK Migration | v3.0 | 5/5 | Complete | 2026-04-27 |
| 29-34. Discovery + Phase Machine + Blueprint + Skip + Feedback + Degradation + Prefs + Form + Cost | v3.0 | — | Re-scoped to V3 v2.1/v2.3/v3.0 | 2026-04-28 |

---

*Roadmap created: 2026-03-17*
*v1.0 shipped: 2026-03-19 · v1.1 shipped: 2026-03-23 · v1.2 shipped: 2026-03-23*
*v1.3 shipped: 2026-03-29 · v2.0 shipped: 2026-03-30*
*v3.0 closed partial: 2026-04-28 — re-scoped to ROADMAP-V3*
