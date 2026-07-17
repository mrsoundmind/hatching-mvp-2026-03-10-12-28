# Hatchin Audit — Coverage Map vs HATCHIN-COMPLETE-INVENTORY.md

Cross-reference of the complete inventory against what the live audit has actually exercised.
Three buckets: **✅ TESTED-WORKING**, **🔴 TESTED-BROKEN/ISSUE** (visible outcome), **⬜ NOT TESTED**.
Date: 2026-07-17. Server on real DeepSeek (Wave 1-3) then Groq/test (Wave 4).

Legend: 🔴 = confirmed bug with visible symptom · 🟠 = partial/polish · ✅ = works · ⬜ = not yet exercised

---

## PAGES (7)
| Page | Status | Notes |
|---|---|---|
| home.tsx (3-panel + mobile drawers) | ✅ | layout + mobile Sheet drawer tested |
| AccountPage.tsx (billing dashboard) | ✅ | Pro state, usage, Manage Subscription render |
| login.tsx | 🟠 | dev name-login tested; **NOT tested: Google OAuth UI, parallax, 4s carousel, sanitizeNextPath redirect safety** |
| LandingPage.tsx | 🟠🔴 | dead nav links confirmed 🔴; **NOT tested: 8 USP animated panels, carousel, swipe** |
| MayaChat.tsx (`/maya/:id` standalone) | ⬜ | **entire standalone route untested** (stream watchdog 20s, coachmark, doc upload) |
| onboarding.tsx (`/onboarding` 3-step) | ⬜ | **full walkthrough untested** (TypingText, ChatPreview, AgentHatch, BrainFill) |
| not-found.tsx (404) | ⬜ | **untested** |

## CORE COMPONENTS
| Component | Status | Notes |
|---|---|---|
| CenterPanel — streaming | ✅ | streaming lifecycle, stop button |
| CenterPanel — cursor pagination "Load earlier" | ⬜ | **untested** |
| CenterPanel — pause/resume autonomy | 🟠 | Pause button visible (stuck banner); resume not exercised |
| QuickStartModal / ProjectNameModal | ✅ | idea path + validation |
| StarterPacksModal (8 packs, project-creation path) | ⬜ | **starter-pack project creation untested** (only idea path tested) |
| AddHatchModal (30 roles / team packs) | ✅ | team pack create; tier-gate ⬜ (billing off) |
| TaskApprovalModal / TaskSuggestionModal | ✅ | select + create |
| WelcomeModal | ✅ | first-login |
| EggHatchingAnimation | ✅ | create animation |
| MessageBubble — user/agent/markdown/reactions | ✅ | render + reactions |
| MessageBubble — status (sending/sent/failed), streaming cursor | ⬜ | **untested** |
| MessageBubble — reply / copy buttons | 🟠 | buttons exist but no aria-labels; **not functionally exercised** |
| ProjectTree — Maya filter, hierarchy | ✅ | Maya hidden, tree renders |
| ProjectTree — context menu rename/delete, working animation | ⬜ | **UI rename/delete + working-ring animation untested** |
| LeftSidebar — search | ✅ | match filter |
| LeftSidebar — undo popup (delete → restore) | ⬜ | **UI undo popup untested** (restore endpoint works) |
| LeftSidebar — Ctrl+K focus search | ⬜ | **untested** |
| AutonomousApprovalCard (approve/reject) | 🔴 | **never renders — autonomy execution broken, no approval ever produced** |
| HandoffCard (in chat) | ⬜🔴 | **never rendered — no handoff occurs (autonomy broken)** |
| DeliberationCard | ⬜ | events fire server-side; **card render in chat untested** |
| UpgradeModal | ⬜ | **untested** (billing gates off, never triggers) |
| OnboardingManager (step machine) | ⬜ | **full flow untested** |
| ThemeProvider / theme toggle | ⬜ | **dark/light toggle untested** |
| ErrorFallbacks (App + Panel boundaries) | ⬜ | **untested — never forced an error** |
| ProgressTimeline | ⬜ | **untested** |

## SIDEBAR COMPONENTS (11)
| Component | Status | Notes |
|---|---|---|
| SidebarTabBar (3 tabs) | ✅ | tabs switch; **badge counts untested** |
| ActivityTab | 🔴 | **default "Tasks" filter hides all events → looks dead** |
| ActivityFeedItem | 🟠 | renders (filter=All); **expandable data untested**; copy is junk 🟠 |
| FeedFilters (category/agent/time) | 🟠 | category tested; **agent + time filters untested** |
| AutonomyStatsCard | ✅ | 0/0 (consistent) |
| TaskPipelineView (Kanban) | ✅ | Queued→Done reflects state |
| BrainDocsTab | ✅ | renders docs + deliverable + autonomy |
| DocumentUploadZone | 🟠🔴 | endpoint tested (400/413 ok); **corrupt-PDF silent-empty 🔴**; **drag-drop UI + uploading/error states untested** |
| DocumentCard (type badges, optimistic delete) | 🟠 | renders; **UI optimistic delete untested** (endpoint works) |
| AutonomySettingsPanel (toggle + dial) | ✅ | toggle + level persist; **inactivity select + flash-save animation untested** |
| WorkOutputSection (accordion) | 🟠 | entry visible; **accordion expand untested** |
| ApprovalsTab | 🔴 | **dead code — not wired into RightSidebar** |
| ApprovalItem (approve/reject/expiry) | ⬜ | **untested — no pending approvals ever (autonomy broken)** |
| HandoffChainTimeline | ⬜ | **untested — no handoffs** |
| ApprovalsEmptyState | ⬜ | **untested** |

## CHAT / TASKS / AUTONOMY BEHAVIORS
| Feature | Status | Notes |
|---|---|---|
| Chat streaming + tone guard + persistence | ✅ | works (single-agent) |
| Multi-agent reply save | 🔴 | **saves empty → blank bubbles** |
| Message vanish after task-approval | 🔴 | **disappears until reload** |
| @mention routing | ✅ | routes to agent |
| @mention autocomplete UI | 🔴 | **no picker on "@"** |
| /route command | ⬜ | **untested** |
| Conductor routing (Maya priority) | ✅ | conductor_decision fires |
| Task create — organic / imperative / lifecycle / UI | ✅ | all create; 🟠 "called X" vs "to X" inconsistency |
| Task create — no visible confirmation | 🔴 | **toast renders off-screen; chat path no popup** |
| Task delete — UI + NL | ✅ | UI hard-delete; NL handler works |
| Task status/priority/reassign via NL | ✅ | status_update verified |
| Destructive-intent safety gate | ✅🟠 | fires (ALWY-04 fixed); 🟠 leaks reason codes; 🟠 over-fires on task "delete" |
| Autonomous background execution | 🔴 | **starts, never completes (pg-boss queue never created)** |
| Handoffs / peer-review-on-execution / trust scoring | ⬜🔴 | **untested — gated behind broken background execution** |
| Return briefing | ⬜ | **untested** |
| Personality evolution (from reactions) | ⬜ | reactions persist; **evolution effect untested** |

## BRAIN
| Feature | Status | Notes |
|---|---|---|
| Doc upload/delete endpoints + validation | ✅ | 201/400/413/404 |
| **Knowledge adherence (agent uses uploaded docs)** | 🔴 | **NOT adhered — hallucinates + falsely claims to read doc** |
| Core direction editor autosave | ⬜ | **untested** |
| Set brain field via chat | ⬜ | **untested** (imperative brain-update) |
| Brain updated from chat event | ⬜ | **untested** |

## DELIVERABLES (v2.0)
| Feature | Status | Notes |
|---|---|---|
| Generate + markdown + PDF export + versions + artifact panel | ✅ | all work |
| Deliverable-via-chat detection | 🟠 | "@Alex write PRD" became a task, not deliverable |
| Iterate (section) | ⬜ | **untested** |
| Version restore (‹ ›) | ⬜ | **untested** (endpoint exists) |
| Auto-revert on worse score (Phase 36) | ⬜ | **untested** (force-judge-score dev endpoint available) |
| Rubric breakdown card | ⬜ | score chip seen; **breakdown untested** |
| Packages / PackageProgress | ⬜ | **untested** |
| Accept / Dismiss | ⬜ | deferred FBK-02 (no UI) |

## BILLING / SETTINGS / RESILIENCE
| Feature | Status | Notes |
|---|---|---|
| Billing status + account page | ✅ | Pro state |
| Checkout / portal | ✅(config) | graceful 503 (Stripe off — by design) |
| Tier enforcement (caps, upgrade_required) | ⬜ | BLOCKED-BY-CONFIG (billing gates off) |
| Provider-degraded banner | ✅ | shows + clears |
| WebSocket reconnect (exp backoff, rejoin) | ⬜ | **untested** |
| Error boundaries | ⬜ | **untested** |
| Keyboard shortcuts (Ctrl+K / Esc / Shift+Enter) | 🟠 | Enter tested; **others untested** |

## KNOWN BUGS FROM INVENTORY PART 6 — verification status
| Inventory bug | Audit status |
|---|---|
| Stale-closure toggleSection (HIGH) | ⬜ not verified (hard to observe) |
| Core Team (0) vs (1) count (MED) | 🟡 inconclusive (no Core Team in test config) |
| Hatch card shows role twice (LOW) | ✅ not repro in tree (names correct) |
| Right sidebar "all messed up" | ⬜ subjective, not audited |
| Approvals should merge into Activity | ✅ confirmed ApprovalsTab is dead code |
| Brain tab "messed up" | ⬜ renders OK functionally; visual audit not done |
| Too much filter noise in Activity | 🟠 related to bad default filter + junk copy |

---

## HEADLINE GAPS (biggest untested areas)
1. **Onboarding flow** (`/onboarding`, OnboardingManager, 3 steps) — entirely untested.
2. **Everything gated behind background execution** — approval cards, handoff cards, handoff timeline, peer-review-on-execution, trust scoring, return briefing, run tree with real runs. All unreachable because the pg-boss queue is never created.
3. **Deliverable iterate / version-restore / auto-revert / packages** — untested.
4. **UI-native flows** (vs API): drag-drop upload, undo popup, context-menu rename/delete, theme toggle, error boundaries, WS reconnect, cursor pagination, /route, reply/copy.
5. **Standalone MayaChat route**, **404 page**, **landing USP panels/carousel**.

## HEADLINE CONFIRMED BUGS (visible outcome)
Knowledge base ignored + false grounding · Multi-agent empty-save (blank bubbles) · Autonomous execution never completes (stuck "Team is working") · Activity feed looks dead (bad default filter) · No visible create confirmation (off-screen toast) · Messages vanish after task-approval · @mention autocomplete missing · Landing dead links · ApprovalsTab dead code · safety reason-code leak.
