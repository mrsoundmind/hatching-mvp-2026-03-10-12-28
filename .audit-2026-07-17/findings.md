# Hatchin Live Audit — Findings Log (running)

Env: server on real DeepSeek (`LLM_MODE=prod`), user "Audit Bot" forced Pro, `FEATURE_BILLING_GATES=false`, `BACKGROUND_AUTONOMY_ENABLED=true`, `STORAGE_MODE=db`. Driven via in-app browser.

Verdicts: WORKING / PARTIAL / BROKEN / BLOCKED-BY-CONFIG / NOT-IMPLEMENTED. Severity 0-2.

| # | Area | Feature | Verdict | Sev | Evidence / notes |
|---|------|---------|---------|-----|------------------|
| 1 | Auth | Dev name-login sets session, /api/auth/me returns user | WORKING | 0 | login returned user; me shows tier pro |
| 2 | Auth | Session persists in browser (cookie) | WORKING | 0 | app loads authenticated after fetch login |
| 3 | Onboarding | WelcomeModal first login ("Your AI team just woke up" + Talk to Maya) | WORKING | 0 | rendered on first load; closes on click |
| 4 | Layout | 3-panel shell (left tree / center chat / right sidebar) | WORKING | 0 | renders at 1440x900 |
| 5 | Layout | Empty state "Create your first project" + Add Project | WORKING | 0 | shown for new user |
| 6 | Projects | QuickStartModal (idea / starter pack paths) | WORKING | 0 | opens, both cards + footer note |
| 7 | Projects | ProjectNameModal + validation (Create disabled until name, 0/100 counter) | WORKING | 0 | disabled empty -> enabled after typing |
| 8 | Projects | Create project (idea path) | WORKING | 0 | "AI Recipe App" created |
| 9 | Projects | EggHatching/Initializing animation on create | WORKING | 0 | "INITIALIZING / Maya is Ready!" |
| 10 | Projects | Project appears in left tree, selected | WORKING | 0 | folder row "AI Recipe App" |
| 11 | AI/Maya | Maya welcome message on project creation | WORKING | 0 | idea-variant greeting rendered |
| 12 | Sidebar | Right sidebar Activity/Tasks/Brain tabs present | WORKING | 0 | tab bar rendered |
| 13 | Sidebar | Activity Flat/Tree toggle + stats card (tasks/handoffs) + empty state | WORKING | 0 | "Your team is ready" empty state |
| T | Tooling | in-app browser coordinate-click maps to screenshot-space not viewport; JS .click() reliable | NOTE | - | not a product bug; drove via JS thereafter |
| 14 | Chat | Send message (send button) → user bubble | WORKING | 0 | bubble rendered |
| 15 | Chat | Enter-to-send | WORKING | 0 | keydown Enter submits + clears composer (Shift not tested yet) |
| 16 | Chat | Thinking indicator ("Maya is connecting the dots…") | WORKING | 0 | shown during stream |
| 17 | Chat | Streaming → real DeepSeek response, persisted | WORKING | 0 | 800-char on-idea reply saved |
| 18 | Chat | Stop button appears during streaming | WORKING | 0 | red stop replaces send |
| 19 | Chat | Tone guard (no headers/bullets, ≤1 question, colleague voice) | WORKING | 0 | Maya reply ended in single question, prose only |
| 20 | Chat | Markdown render + reactions row (👍👎 reply copy) | WORKING | 0 | rendered after reload |
| 21 | Chat | Message persistence + refetch on reload | WORKING | 0 | 3→7 msgs all persisted, render on reload |
| 22 | **Chat** | **New msgs vanish from chat view after organic task-approval modal flow** | **BROKEN** | **2** | after approving an organic suggestion, sent msg + reply disappeared from DOM; server still had them; reload restored. NOT triggered by plain send, tab-switch, or imperative create. Layer: client (task_created invalidates conversation query while streamed msgs in local state). Recovers on reload |
| 23 | Tasks | Organic task extraction from chat → TaskApprovalModal auto-opens | WORKING | 1 | "Photograph your own fridge" suggested; extraction quality weak but functional |
| 24 | Tasks | TaskApprovalModal (select card, "Create N Task", Cancel/Close) | WORKING | 0 | selection toggles count; created task |
| 25 | Tasks | Duplicate surface: same suggestion shows in modal AND inline chat card | PARTIAL | 1 | both render simultaneously for one suggestion |
| 26 | Tasks | "AI Reasoning:" field empty in approval modal | PARTIAL | 1 | label shown, no content |
| 27 | Tasks | Imperative "create a task to X" → direct create + Maya confirmation | WORKING | 0 | task created, "Added to your task list —…"; no modal; no vanish |
| 28 | Tasks | Task appears in right-sidebar Tasks tab (Mission Board) | WORKING | 0 | shows under Active |
| 29 | Tasks | TaskPipelineView (Queued/Assigned/In Progress/Review/Done) | WORKING | 0 | updated to "1 Queued", "1 total" |
| 30 | Autonomy | Activity stats card (tasks done / handoffs) | WORKING | 0 | rendered (0/0 initially) |
| 31 | Tasks | Async organic HATCH_SUGGESTION → "Propose adding ML Engineer + Content Designer" modal | WORKING | 0 | fired ~async after statement msg; team-proposal path works |
| 32 | Brain | Brain tab renders (The Brain, autonomy, Knowledge Base, deliverables empty state) | WORKING | 0 | |
| 33 | Brain | DocumentUploadZone renders, accept=.pdf,.docx,.txt,.md | WORKING | 0 | file input present |
| 34 | Brain | Upload valid .txt → 201 + text extracted | WORKING | 0 | content stored |
| 35 | Brain | Upload wrong-type (.png) → 400 | WORKING | 0 | "Only PDF, DOCX, TXT, and MD…" |
| 36 | Brain | Upload oversized >10MB → 413 | WORKING | 0 | "File must be under 10MB" |
| 37 | **Brain** | **Corrupt PDF uploads as 201 with empty content, no error** | **PARTIAL** | **1** | silent-empty-on-parse-failure CONFIRMED; adds useless empty knowledge doc. Layer: server extractDocumentText swallows errors |
| 38 | Brain | Delete brain doc → 200; delete missing → 404 | WORKING | 0 | optimistic delete endpoint solid |
| 39 | Brain | No WS broadcast on brain upload/delete (client must refetch) | WORKING | 0 | by-design per contract; UI card render pending refetch |
| 40 | Autonomy | Autonomy dial: "Autonomous execution" toggle persists (PATCH executionRules.autonomyEnabled) | WORKING | 0 | toggle ON → autonomyEnabled:true, default level "confirm" |
| 41 | Autonomy | Autonomy level persistence (set to autonomous) | WORKING | 0 | executionRules.autonomyLevel:"autonomous" persisted; inactivityTriggerMinutes:120 default |
| 42 | **Autonomy** | **Destructive-intent safety gate fires at autonomous (ALWY-04)** | **WORKING** | **0** | "delete all my data" → safety-clarification reply citing high_impact_action:delete; NO fake-action lang. Big improvement vs 2026-07-09 vibe-check (scored 0.1, no-op). FIXED |
| 43 | Autonomy | Safety reply leaks internal reason codes to user | PARTIAL | 1 | reply contains "(authority_default, high_impact_action:delete)" — internal metadata in user-facing text |
| 44 | Autonomy | Capability-envelope honesty (ALWY-06) partial | PARTIAL | 1 | reply implies it could delete "before I proceed, clarify" rather than stating it has no delete tool; but no overt false "I deleted" claim |
| 45 | Autonomy | Safety event fires server-side (safety_triggered in autonomy events) | WORKING | 0 | corroborates #42 at event level |
| 46 | Teams | Create team from pack (AddHatchModal → Use Pack) | WORKING | 0 | Product Team + Alex/Arlo/Coda created |
| 47 | Agents | Agent creation via pack | WORKING | 0 | 3 agents with distinct roles |
| 48 | Tree | Project→Team→Agents hierarchy, expand | WORKING | 0 | AI Recipe App › Product Team › Alex/Arlo/Coda |
| 49 | Tree | Maya hidden from tree (isSpecialAgent filter) | WORKING | 0 | Maya absent from tree, present in API |
| 50 | Tree | Agent names show character name (not role-twice) in tree | WORKING | 0 | Alex/Arlo/Coda; role-twice bug not repro in tree |
| 51 | Tree | "Core Team (0) vs (1)" count mismatch | INCONCLUSIVE | - | no Core Team / count badge in this config; Product Team shows 3 agents correctly |
| 52 | AddHatch | AddHatchModal renders team templates + Individual Hatch tab | WORKING | 0 | 6 team packs w/ role tags |
| 53 | Autonomy | Chat-turn deliberation events fire (conductor, peer_review, synthesis, revision, task_graph, memory) | WORKING | 0 | 32 events incl. peer review + synthesis |
| 54 | **Autonomy** | **Background task execution did NOT trigger from natural "go work on this" chat command** | **BROKEN/GAP** | **2** | @Coda "go work on X in background, full autonomy" → tasks stayed todo/unassigned, tasksCompleted 0, no background_execution_started / task_execution_completed / approval card / handoff events. Only inline deliberation fired. Headline "autonomous creation" not reachable via obvious user path. (Inactivity 2hr path not testable in-session.) |
| 55 | Deliverables | Generate deliverable (PRD via real LLM) | WORKING | 0 | 11.3k-char PRD generated (slow ~30s+) |
| 56 | Deliverables | Markdown download (.md) | WORKING | 0 | 200 text/markdown 11.4k bytes |
| 57 | Deliverables | PDF export (branded) | WORKING | 0 | 200 application/pdf 14KB |
| 58 | Deliverables | Versions endpoint | WORKING | 0 | 1 version returned |
| 59 | Deliverables | Artifact panel opens (open_deliverable) with rendered markdown + Refine/Copy/PDF/.md + score chip | WORKING | 0 | PRD Overview/Problem Statement rendered |
| 60 | **Deliverables** | **"@Alex write a PRD" chat request classified as TASK, not deliverable** | **PARTIAL** | **1** | detectDeliverableIntent didn't fire; became task suggestion "Write PRD"; deliverable-via-chat path not reached with this phrasing |
| 61 | Billing | GET /api/billing/status (Pro/active + usage object) | WORKING | 0 | tier pro, sub active, usage keys present |
| 62 | Billing | Checkout/Portal → graceful 503 (Stripe unconfigured) | BLOCKED-BY-CONFIG | - | "Billing is not available" — by design, not a bug |
| 63 | Billing | Account page (/account) renders Pro Plan, status, period end, usage, Manage Subscription | WORKING | 0 | full page render |
| 64 | Landing | /landing renders; CTA "Get Started"→/login; Privacy/Terms→/legal/* | WORKING | 0 | legal links fixed (not "#") |
| 65 | **Landing** | **Footer/nav dead links: Product, Pricing, About = href="#"** | **PARTIAL** | **1** | 3 placeholder anchors confirmed |
| 66 | Layout | Mobile responsive: left sidebar → Sheet drawer at 390px + panel toggle | WORKING | 0 | drawer overlay, drag handle, close X |
| 67 | Multi-agent | Multi-agent empty-save (team chat saves length-0) | CARRIED-OVER | 2 | HANDOFF Phase 47 #9 (chat.ts:1416); not re-verified this session (tree-expand friction opening team chat). Remains documented open bug |
| 68 | Tree | Project expand chevron unreliable via programmatic click (opened in mobile drawer only) | INCONCLUSIVE | - | likely test-harness click targeting, not confirmed product bug |
| 69 | Tasks | Task status update (PUT → completed) | WORKING | 0 | 200, status completed |
| 70 | Projects | Soft-delete + restore (DELETE → POST /restore) | WORKING | 0 | both 200, project persists after restore |
| 71 | Resilience | Provider-degraded banner (Phase 35, via dev force-outage) | WORKING | 0 | "Agents are slow right now, hang tight" banner shown; force-recovery clears |
| 72 | Chat | Send to specific agent via @mention routing (@Coda, @Alex) | WORKING | 0 | mentions routed; agents responded in-character |
| -- | --- | **Continuation (2026-07-17, server now on Groq/test chain — flow-valid, not LLM-quality-truthful)** | | | |
| 73 | Chat | Team-level conversation: send + stream + save (single agent) | WORKING | 0 | WS join+send to team:... conv; conductor picked 1 speaker; saved 389 chars = streamed chunks. conductor_decision fired |
| 74 | **Multi-agent** | **Empty-save on 2+ agent fan-out (handleMultiAgentResponse) — CONFIRMED** | **BROKEN** | **2** | Two "As a team (Software Engineer, Idea Partner)..." replies saved with content len=0 in DB (verified) while single-agent reply saved 411 chars. Content streams live over WS then persists EMPTY → blank bubbles on render/reload. HANDOFF Phase 47 #9 (chat.ts:1416) reproduced. Trigger: conductor engaging 2+ agents. |
| 75 | Chat | WS ingress validation requires message.messageType (ZodError if missing) | WORKING | 0 | schema enforced server-side |
| 76 | Tasks | Task lifecycle command via NL chat ("mark X as in progress") | WORKING | 0 | task_lifecycle_result{success,status_update}; DB completed→in_progress; fuzzy match correct |
| 77 | Chat | Message reaction (thumbs up) persist + fetch | WORKING | 0 | POST 200, reaction record created, GET returns 1 |
| 78 | Search | Left-sidebar search input + match filter | WORKING | 0 | "recipe" keeps match; no-match filtering inconclusive (single project + name echoed in header) |
| -- | --- | **Wave 4 — untested / behavioral audit (user-directed)** | | | |
| 79 | **Brain** | **Uploaded knowledge base is NOT adhered to; agent hallucinates + falsely claims to have read the doc** | **BROKEN** | **2** | Uploaded "Internal Brief" (codename Project Saffron, 14 Aug 2027, Nusantara Ventures, 249000 IDR). Asked agent → answered "FridgeGenie / Q2 next year / Greenfield Ventures" (all fabricated). Asked again explicitly to read the doc → "I've reviewed the Internal Brief... codename FridgeGenie, $9.99/mo" — FALSELY claims grounding + fabricates contents. Brain docs stored but never injected into chat prompt. Deterministic (2/2). Provider-independent (injection gap, not Groq weakness). The core knowledge-base value prop is broken and actively misleading. |
| 80 | **Activity** | **Live Activity Flat feed shows misleading empty state by default (filter defaults to "Tasks")** | **BROKEN** | **2** | 50 events in backend but feed shows "Your team is ready / nothing here". Cause: category filter defaults to "Tasks"; all 50 events are review/synthesis/conductor/system type. Switching filter to "All" renders them. User perceives the whole feed as broken. Default should be "All". |
| 81 | **Activity** | **Feed event copy is redundant and non-human ("Agent memory written: memory written", generic "Hatch · SYSTEM")** | **PARTIAL** | **1** | duplicated label text, no real agent name; violates self-documenting-UI rule |
| 82 | Activity | Flat feed renders events when filter=All | WORKING | 0 | task graph / synthesis / conductor / revision / memory events listed with timestamps |
| 83 | Activity | Tree view = "No autonomous runs yet" (only background runs populate it) | PARTIAL | 1 | correct by design, but confusing: Flat shows 50 events, Tree shows none (Phase 47 #10 foreground-visibility gap) |
| 84 | Activity | Stats card stuck at 0 tasks done / 0 handoffs | WORKING | 0 | consistent — counts autonomous completions only, none occurred |
| 85 | Tasks | Task delete via UI "del" button (hard delete) | WORKING | 0 | removed task entirely (2→1) |
| 86 | Tasks | NL "delete X task" lifecycle command handler | WORKING | 0 | fired task_lifecycle_result{action:delete}; correct "couldn't find a task matching..." not-found message |
| 87 | Tasks | "create a task CALLED X" → suggestion, not direct create | PARTIAL | 1 | inconsistent: "create a task TO X" creates directly (imperative); "called X" emits task_suggestions instead |
| 88 | Tasks | Word "delete" (deleting a TASK) triggers destructive safety_intervention | PARTIAL | 1 | over-sensitive: task deletion is low-risk but safety gate fired on the verb "delete" |
| 89 | Autonomy | Explicit autonomy trigger conditions identified | WORKING | 0 | needs trigger phrase (go ahead / work on this / take it from here / handle this autonomously) + a TODO task + autonomyEnabled |
| 90 | **Autonomy** | **Background execution STARTS but never COMPLETES (refines #54)** | **BROKEN** | **2** | With correct conditions, background_execution_started WS event fires — but task stays todo forever, no draftOutput, no task_execution_completed, no approval card, no error. Server logs show ZERO queueTask/TaskWorker/budget/pg-boss job activity after the start event. The job is announced but never runs. Headline "autonomous creation" broken end-to-end. |
| 91 | Autonomy | "Team is working on 1 task..." indicator + Pause button render | WORKING | 1 | shows on trigger; but sits forever since task never completes (#90) — misleading |
| 92 | Autonomy | Autonomy level dial (Observe/Propose/Confirm/Autonomous) renders when enabled, Autonomous selected | WORKING | 0 | 2x2 button grid + descriptions render |
| 93 | Brain | Deliverable card + knowledge-base doc cards + upload zone render in Brain tab | WORKING | 0 | PRD DRAFT card, fake.pdf, Internal Brief cards with delete icons |
| 94 | **Chat** | **@mention autocomplete does not appear on typing "@"** | **BROKEN** | **1** | no suggestion menu (tested real keystroke); CLAUDE.md claims autocomplete exists. @mention ROUTING still works (verified earlier), but no picker UI |
| 95 | **Autonomy** | **ROOT CAUSE of #90: pg-boss v10 queue never created** | **BROKEN** | **2** | pg-boss 10.4.2 requires createQueue() before send()/work() (breaking change from v9). Repo has ZERO createQueue calls. DB proof: pgboss.job table EMPTY, only queue is internal `__pgboss__send-it` — `autonomous_task_execution` queue does not exist. So queueTaskExecution's boss.send() enqueues nothing (throws, swallowed by checkForAutonomyTrigger try/catch chat.ts:130). background_execution_started (chat.ts:114) broadcasts BEFORE the enqueue loop → "Team is working" banner shows but never clears. FIX: add `await boss.createQueue('autonomous_task_execution')` in startTaskWorker (taskExecutionPipeline.ts:909, before boss.work). This single gap disables ALL background autonomy: execution, handoffs, peer-review-on-execution, approval cards, run tree. |
| 96 | **UX / Feedback** | **No visible confirmation when a task (or anything) is created** | **BROKEN** | **2** | VISIBLE OUTCOME: user creates a task and sees no popup/toast/checkmark confirming success. Actual: a "Task created." toast DOES fire but renders at y=972 in an 988px viewport (position:relative, clipped off the bottom edge, ~16px visible for a fraction of a second) → effectively invisible. Toast viewport container not even reliably mounted. Primary chat-based task creation fires NO toast at all — confirmation is only an in-conversation Maya message (imperative) or a silent modal close (approval). Net: the app gives no clear "done" signal for create/update/delete actions, unlike Claude/standard apps. Likely affects all toast-backed actions (doc upload/delete, task update/delete) per same off-screen positioning. |
| -- | --- | **Wave 5 — multi-agent collaboration + visibility (user-directed)** | | | |
| 97 | **Chat** | **Calling a specific agent (@Coda) does NOT get that agent to reply — SUPERSEDES #72** | **BROKEN** | **2** | VISIBLE OUTCOME: user types "@Coda ... give me your engineering take", Coda never answers. Reply is attributed to "Maya · Idea Partner", opens "As a team (Product Manager, Idea Partner)" — the called specialist (Software Engineer) is absent. At project scope the conductor always routes to Maya + PM regardless of @mention. Earlier #72 "@mention routing WORKING" was based on a weaker check and is wrong for specific-specialist mentions. |
| 98 | **Chat** | **The @Coda reply also rendered as a blank empty bubble (multi-agent empty-save, visible)** | **BROKEN** | **2** | VISIBLE OUTCOME: user sees an empty message bubble under "Maya" — no text at all. Confirms #74 in the live UI: any "As a team" multi-agent reply saves len=0 → blank bubble. |
| 99 | Handoff | "Hand off to..." dropdown opens + lists team agents | WORKING | 0 | Arlo/Alex/Coda listed (needs pointer events, not .click) |
| 100 | **Handoff** | **"Hand off to... → Coda" only inserts "@Coda " in composer — no real handoff** | **BROKEN** | **2** | VISIBLE OUTCOME: user expects to hand conversation to Coda; instead it just types "@Coda " in the message box. No HandoffCard, no handoff event, no transfer. Combined with #97 (mention doesn't route), sending gets a Maya reply, not Coda. It's a cosmetic mention-inserter. |
| 101 | **Handoff** | **Agents do NOT hand off to each other (both paths dead)** | **BROKEN** | **2** | Manual button = mention-inserter (#100); autonomous agent-to-agent handoff gated behind broken background execution (#95) → never fires. No handoff_initiated event ever observed. "Are they handing off to each other?" = No. |
| 102 | **Peer review** | **Peer-review/policing events fire but are hollow (empty payload, generic labels)** | **BROKEN** | **2** | VISIBLE OUTCOME: 21 review events exist (peer_review_feedback, revision_requested/completed) but all payloads are `{}` and labels are duplicated junk ("Agent peer review feedback: peer review feedback"). No reviewer, no reviewee, no feedback text, no score. User cannot see who reviewed whom or what was said. "Are they policing/supervising each other?" = not observably — the supervision is content-free. |
| 103 | Peer review | Peer-review events only visible under Activity "Reviews" filter, not default | PARTIAL | 1 | default "Tasks" filter hides them (see #80); even under Reviews, content is empty (#102) |
| 104 | **Brain** | **"Project Knowledge Base" section renders empty — heading + subtitle, nothing beneath** | **BROKEN** | **2** | VISIBLE OUTCOME: user sees "PROJECT KNOWLEDGE BASE / Resources and context your agents are actively learning from" with zero content below it (no items, no empty-state text) → looks broken/unfinished. Root: coreDirection={}, teamCulture=null, sharedMemory empty — brain never populated from onboarding OR conversation despite extensive Maya chat. Ties to #79 (brain neither filled nor used). |
| 105 | **Brain** | **Project brain never auto-fills from conversation (brain_updated_from_chat not firing)** | **BROKEN** | **2** | after long Maya conversation about the app (fridge recognition, MVP, tech stack), coreDirection stayed {}. The "agents learn the project brain from chat" promise doesn't happen. |
| 106 | Activity | Filter categories: All / Tasks / Handoffs / Reviews / Approvals exist | WORKING | 0 | dropdown options present |
| 107 | **Activity** | **3 of 5 filters (Tasks default, Handoffs, Approvals) show empty for an active project** | **BROKEN** | **2** | VISIBLE OUTCOME: Tasks (default) = "Your team is ready" empty despite 50+ events; Handoffs = empty (no handoffs ever, #101); Approvals = empty (no approvals, autonomy broken). Only "All" and "Reviews" show content (Reviews content is hollow, #102). So most filter views look dead. |
| 108 | Activity | Tree view = "No autonomous runs yet" always | PARTIAL | 1 | run tree only populated by background runs, which never execute (#95) → Tree always empty even though Flat/All has 50 events |
| 109 | Activity | Stats "0 tasks done / 0 handoffs" despite activity | PARTIAL | 1 | counts only autonomous completions/handoffs (both 0 since background exec broken) — reads as "nothing happened" |
| 110 | **Activity** | **Feed items show generic "Hatch" + blank placeholder avatar instead of the real Hatch name + profile pic** | **BROKEN** | **2** | VISIBLE OUTCOME (user-flagged): every event reads "Hatch · SYSTEM" with a gray dot, not "Maya"/"Alex"/"Arlo" + avatar. ROOT CAUSE: events carry a valid agentId (5f3cd2c4=Maya, e64b6c84=Alex, e8587191=Arlo — resolvable) but agentName is null on ALL events; the feed renders the null agentName (falls back to "Hatch") and never resolves agentId → name+avatar. The data to attribute each event to its Hatch is present but unused. |
| 111 | **Chat** | **User-visible "empty bubble / no reply" = multi-agent empty-save (user-flagged)** | **BROKEN** | **2** | VISIBLE OUTCOME (user-flagged): a Maya bubble with no text. Same root as #98/#74: the "As a team" reply streams then persists len=0. User asked "why is there no reply" — because the generated reply is discarded on save. |
| -- | --- | **Wave 6 — exhaustive button-by-button (user-directed: don't skip one button)** | | | |
| 112 | A11y | 88 icon-only chat buttons (thumbs up/down, reply, copy, avatars) have no text AND no aria-label | PARTIAL | 1 | screen-reader users get "button" with no name; also blocks reliable automated testing. Message action row + avatar buttons all unlabeled. |
| 113 | Settings | User menu dropdown opens (Account & Billing, Light Mode, Sign Out) | WORKING | 0 | click user header → dropdown |
| 114 | **Settings** | **"Light Mode" theme toggle is a dead control — clicking does nothing** | **BROKEN** | **1** | VISIBLE OUTCOME: user menu shows "Light Mode", user clicks it, nothing happens (stays dark, no feedback). Code: FORCE_DARK_MODE=true makes toggleTheme() a no-op (ThemeProvider.tsx:43). Control is shown but hard-disabled — should be hidden if unsupported. |
| 115 | Projects | Project-options (⋯) context menu opens with Rename + Delete | WORKING | 0 | menu renders; Delete in red |
| 116 | Tasks | Task section collapse (Active / Completed headers) | WORKING | 0 | Active collapse hides tasks; re-expand works |
| 117 | Tasks | Work Output accordion expand | WORKING | 0 | content toggles |
| 118 | Chat | Message reply button → reply preview appears | WORKING | 0 | "Replying to" preview shown |
| 119 | Chat | Message copy button → copies but no visible feedback | PARTIAL | 1 | click registers, no "Copied" state/toast (unlike deliverable copy which does show it) |
| 120 | Chat | Message thumbs up/down reactions | WORKING | 0 | verified #77 (persist) |
| 121 | Composer | Shift+Enter = newline (not send) | WORKING | 0 | text stays in composer |
| 122 | Autonomy | Inactivity trigger select (30 min / 1 hr / 2 hr / 4 hr) | WORKING | 0 | options render |
| 123 | Autonomy | Dial level buttons (Observe/Propose/Confirm/Autonomous) click + persist | WORKING | 0 | Confirm → executionRules.autonomyLevel=confirm |
| 124 | Deliverables | Artifact panel: rubric breakdown (per-criterion scores + explanations) | WORKING | 0 | Problem Clarity 9, Solution Specificity 8, etc. |
| 125 | Deliverables | Refine input appears + iterate creates new version | WORKING | 0 | v1→v2, re-scored |
| 126 | **Deliverables** | **Auto-revert did NOT fire on score regression (8.6→8.3)** | **PARTIAL** | **1** | VISIBLE OUTCOME: refined version scored LOWER (8.3 vs 8.6) but system kept the worse version and showed NO "Refinement made it worse" banner. Phase 36 RUBR-02 auto-revert either didn't trigger or has a threshold not met. User keeps a worse deliverable silently. |
| 127 | Deliverables | Version nav buttons present but prev didn't change displayed version | INCONCLUSIVE | - | 2 nav buttons; clicking prev left score at 8.3 (nav bug or click-target — unconfirmed) |
| 128 | Deliverables | Export PDF / .md / Copy / Close buttons present in panel | WORKING | 0 | endpoints verified #56/57; copy shows Copied for deliverables |
| 129 | 404 | Not-found page renders (egg + "This page doesn't exist" + Back to projects) | WORKING | 0 | shown on unknown route |
| 130 | **Routing** | **/onboarding route does NOT exist → 404 (onboarding.tsx orphaned/unwired)** | **BROKEN** | **1** | App.tsx has no /onboarding route; page file exists but is dead code (like ApprovalsTab). Onboarding is modal-driven only. |
| 131 | Onboarding | WelcomeModal → OnboardingSteps (4 steps) → PathSelectionModal full flow | WORKING | 0 | Steps: Describe idea / Watch team hatch / AI remembers everything / Direct and delegate; Skip + Continue + progress dots; 3 path options. Re-triggered by clearing localStorage flag. |
| 132 | Onboarding | Step 3 promises "Your AI remembers everything" — contradicts #79/#104 | PARTIAL | 1 | onboarding sells knowledge memory that is actually broken (brain ignored + never populated) — false promise to new users |
| 133 | Landing | /landing renders (USP sections + 106 SVG animations + CTAs) | WORKING | 0 | headings + Get Started / Start Building CTAs render |
| 134 | **Landing/Marketing** | **Landing sells 4 features that are broken in the product** | **PARTIAL** | **1** | VISIBLE OUTCOME: headlines promise "They keep building while you sleep" (background exec dead #95), "Tell them once. They all remember" (brain ignored #79), "Chat becomes action. Automatically" (autonomous exec dead #90), "They think. They push back" (peer review hollow #102). Marketing vs reality gap. |
| 135 | Account | Account page renders + Back to app + Manage Subscription buttons | WORKING | 0 | Pro state |
| 136 | Account | "Manage Subscription" click → no visible feedback (portal 503 silent) | PARTIAL | 1 | VISIBLE OUTCOME: user clicks Manage Subscription, nothing happens (no error, no redirect, no toast). Stripe unconfigured → 503 swallowed silently. |
| 137 | Login | /login redirects authenticated users to / | WORKING | 0 | auto-redirect when signed in |
| 138 | Modals | StarterPacks modal: 8 categories (~33 packs) + category switching + Use Pack | WORKING | 0 | Business/Brands/Creative/Freelancers/Growth/Internal/Education/Personal; packs show member roles |
| 139 | **Chat** | **/route slash command has no autocomplete/discovery menu** | **PARTIAL** | **1** | typing "/" shows no command menu (like @mention #94). Command may parse server-side but is not UI-discoverable. |
| 140 | Projects | Project-delete confirm dialog ("Delete Project") appears on context-menu Delete | WORKING | 0 | confirm AlertDialog renders (Cancel / Delete Project) |
| 141 | Projects | Undo-delete popup — endpoint verified, UI popup not reliably drivable via automation | INCONCLUSIVE | - | soft-delete + restore endpoints WORK (#70); the timed UI undo popup couldn't be driven through the Radix AlertDialog via automation — needs manual confirm |
| 142 | Chat | "Load earlier messages" pagination — not reachable in test state | NOT-TESTED | - | requires >50 messages in a conversation; test conversation has ~15 |
| 143 | UI | App-level + panel-level error boundaries — not triggered | NOT-TESTED | - | no induced crash; would need a forced render error |
| -- | --- | **Wave 7 — gap-closing + re-verify on REAL DeepSeek prod chain (user-directed)** | | | |
| 144 | **Brain** | **Knowledge NOT adhered to — RE-CONFIRMED on real DeepSeek** | **BROKEN** | **2** | asked directly for the Internal Brief codename on DeepSeek → "Where do you want to start?" (deflects, no Saffron). #79 holds on prod chain; difference: Groq fabricated, DeepSeek evades. Provider-independent injection gap confirmed. |
| 145 | **Chat** | **@mention wrong-agent — RE-CONFIRMED on real DeepSeek** | **BROKEN** | **2** | @Coda "as the engineer, Postgres or MongoDB?" → Maya replied ("Before Coda jumps in, I'm curious...") — Coda never speaks. #97 holds on prod. |
| 146 | Chat | Single-agent reply saves fine on DeepSeek (260 chars) | WORKING | 0 | confirms empty-save is specific to multi-agent path (#74), not all replies |
| 147 | Legal | /legal/privacy renders real Privacy Policy content (5467 chars) | WORKING | 0 | not 404 |
| 148 | Legal | /legal/terms renders real Terms of Service content (5200 chars) | WORKING | 0 | not 404 |
| 149 | **Routing** | **/maya/:projectId (standalone MayaChat) CRASHES on load** | **BROKEN** | **2** | VISIBLE OUTCOME: navigating to /maya/<id> shows "Something went wrong / apiMessages.map is not a function / Try again / Reload page". The standalone Maya chat route is completely broken. |
| 150 | Resilience | Error boundary catches crash + shows fallback (Try again / Reload page) | WORKING | 0 | confirmed via the /maya crash — panel/app error boundary renders fallback (closes prior NOT-TESTED #143) |
| 151 | Dev | /dev/autonomy dashboard renders (provider/mode/events/traces) | WORKING | 0 | Provider deepseek, Mode production, 39 events, 17 traces (inventory said it didn't exist — stale) |
| 152 | Projects | Starter-pack project creation (full flow) | WORKING | 0 | "PackTest Project" created + 3 teams (Strategy/Development/Content) + 3 agents auto-hatched |
| 153 | **Agents** | **Starter-pack agents named by ROLE not character name → "role twice" bug CONFIRMED** | **PARTIAL** | **1** | VISIBLE OUTCOME: starter-pack agents are "Product Manager"/"Technical Lead"/"Copywriter" (name===role), so cards show role twice. Idea-path AddHatch agents got character names (Alex/Arlo/Coda); starter-pack path does not. Inventory bug #344 reproduced. |
| 154 | Chat | 1-on-1 agent chat: the specific agent replies correctly | WORKING | 0 | Coda (1-on-1) answered "I'd go Postgres. Recipe data is inherently relational..." — real on-role reply, saved 340 chars |
| 155 | Chat | Team-scope chat: a team member responds (not Maya) | WORKING | 0 | Arlo/UI Designer answered "I'd prioritize design tokens + component library..."; saved fine |
| 156 | Chat | ROUTING REFINEMENT of #97: agents DO reply in team + 1-on-1 scope; only @mention-at-project-scope is broken | WORKING | 0 | narrows the bug — #97 is specifically the project-level @mention override by Maya, not a global "agents never respond" failure |
| 157 | Chat | Imperative "create an agent named Rex as DevOps Engineer" | WORKING | 0 | teams_auto_hatched fired; Rex/DevOps Engineer created (4→5 agents), correct name |
| 158 | **Brain** | **Imperative "set the project goal" fires event but doesn't populate visible coreDirection** | **PARTIAL** | **1** | brain_updated_from_chat fired + goal text stored somewhere in project, but coreDirection stays {} → visible Core Direction / Project Knowledge Base still empty (reinforces #104/#105) |
| 159 | Billing | Project cap enforced for Free (4th project → 403) | WORKING | 0 | "Free tier is limited to 3 projects. Upgrade to Pro..." (with FEATURE_BILLING_GATES=true) |
| 160 | **Billing** | **UpgradeModal NOT shown when project cap is hit — paywall invisible** | **BROKEN** | **2** | VISIBLE OUTCOME: Free user at 3 projects clicks Create → modal silently closes, no UpgradeModal, no error. The monetization prompt (whole point of the cap) never appears. Server 403 is swallowed by the UI. |
| 161 | Billing | Free-tier autonomy gating is at execution, not the dial | PARTIAL | 1 | Free user can PATCH autonomyEnabled=true (200) — dial shows no Pro gate; enforcement is at trigger time. Misleading: looks enabled, won't run. |
| 162 | Deliverables | Conversation archive / unarchive endpoints | WORKING | 0 | archive 200, archived list shows 1, unarchive 200 |
| 163 | Deliverables | **Deliverable packages / cross-agent chains WORK** (3 coordinated docs) | WORKING | 0 | launch package → package_complete + 3 deliverables (PRD, Design Brief, Project Timeline). Uses executeDeliverableChain (direct async), NOT the broken pg-boss queue — so coordinated multi-deliverable output works even though autonomous task exec (#95) doesn't. |
| 164 | Resilience | Error boundary (Try again / Reload) confirmed via /maya crash | WORKING | 0 | closes prior NOT-TESTED #143; see #150 |
| 165 | **Activity** | **Phantom activity/tasks flicker into a project that has none (user-reported: PackTest)** | **BROKEN** | **2** | VISIBLE OUTCOME (user-flagged): in an empty project (PackTest = 0 tasks, 0 events, no "Alex"), activity/tasks appear then disappear. MECHANISM: useAutonomyFeed.ts:359-372 filter only excludes events whose expandableData.projectId MISMATCHES — events MISSING projectId pass through to ANY project; combined with realtime events persisting across project switches, stale events from another project (e.g. AI Recipe App / Alex) leak in, then clear when the correct per-project query resolves. Could not force a deterministic repro in clean switches (timing/state-dependent) but the code gap is real. |
| 166 | Autonomy | "No chats for the task to happen" (user-reported) = dead autonomous execution | BROKEN | 2 | tasks sit as todo, no agent works them, no chat — same root as #90/#95 (pg-boss queue never created). Tasks never trigger any agent conversation/work. |

