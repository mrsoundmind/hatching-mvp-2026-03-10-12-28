# Hatchin Remediation — Proof of Working (independent re-verification)

**Verified:** 2026-07-18 · Branch `fix/audit-remediation-2026-07-17` (HEAD `0fc6026`) · Server on real DeepSeek (:5001)
**Method:** fresh live tests driven in the browser + DB queries + WebSocket event capture. Not taken from the remediation log — re-run independently.

Legend: 🟢 BROWSER (freshly driven in the live UI, screenshot or DOM) · 🔵 DB (queried the database) · 🟡 WS (captured the WebSocket events) · ⚪ CODE (read the committed code only)

---

## Load-bearing AI-core fixes — PROVEN WORKING

### #95 / #90 / #54 — pg-boss autonomous execution  🟢🔵🟡
The single biggest fix. Fresh live test:
- Created a new todo task "Write the launch tweet thread" → fired "go ahead and work on this" in the browser.
- **WS events captured:** `background_execution_started` → `task_execution_completed` (both fired).
- **Task went todo → completed.**
- **Real output produced:** a 616-char on-role reply ("I'll create a launch tweet thread for our new product… Here's the thread: We're thrilled to announce the launch…") — rendered in the chat AND shown in the Activity feed as "Alex · autonomous task execution: Write the launch tweet thread".
- **DB:** queue `autonomous_task_execution` now exists (was absent — the root cause); pgboss.job shows completed jobs.
- BEFORE: queue never created, `send()` a silent no-op, task stuck todo forever, "Team is working…" never cleared.

### #79 / #144 — knowledge grounding  🟢 (DeepSeek)
Fresh live test, real provider:
- Uploaded "Internal Brief" (codename Project Saffron / 14 Aug 2027 / Nusantara Ventures).
- Asked "what is the codename, launch date, lead investor?" → reply: **"Project Saffron, launching 14 August 2027, led by Nusantara Ventures."**
- No fabrication (the old FridgeGenie / Greenfield / Q2 hallucination is gone).
- BEFORE: agent ignored the doc, invented facts, and falsely claimed to have "reviewed" it.

### #97 / #145 — @mention routing  🟢🔵
Fresh live test:
- Sent "@Coda give me your engineering take: Postgres or MongoDB?" at project scope.
- **Coda replied** ("from an engineering angle, I'd go Postgres. Recipe data is deeply relational…"), attributed to "Coda · Software Engineer", saved 770 chars.
- BEFORE: Maya answered as a team; the mentioned specialist was ignored.

### #74 / #98 / #111 — multi-agent empty-save  🟢🔵
- The @Coda reply above saved 770 chars (non-empty); other recent multi-agent replies saved 482 / 475 chars.
- DB: the 10 most-recent agent messages are all non-empty. The only zero-length messages predate the fix (my own audit runs).
- BEFORE: 2+ agent "As a team" replies saved with content length 0 → blank bubbles.

### #158 — goal → visible coreDirection  🔵
- DB: a project now has `core_direction = {"whatBuilding":"ship the MVP fridge scanner by Q4 2027"}` after "set the project goal to …".
- BEFORE: the goal landed on `brain.goals`; visible `coreDirection` stayed `{}` (Brain UI blank).

---

## Activity visibility fixes — PROVEN WORKING

### #80 / #107 — feed default filter  🟢
- Activity feed now shows events by default (screenshot: Alex + Maya events listed). BEFORE: defaulted to "Tasks" filter → "Your team is ready" empty state despite 50 events.

### #110 — event attribution (name + avatar)  🟢
- Feed events now show real agent name + avatar: "Alex · autonomous task execution…", "Maya · memory written", each with the agent's profile picture. BEFORE: anonymous "Hatch · SYSTEM" + blank dot.

### #102 / #81 — event labels  🟢
- Labels are clean: "Maya · memory written", "Maya · synthesis completed". BEFORE: duplicated junk "Agent memory written: memory written".

### #165 — phantom cross-project leak  ⚪
- Code: realtime events must now positively match projectId (was: events missing a projectId leaked into any project). Code-verified.

---

## Routing / UI fixes — PROVEN WORKING

### #149 — /maya route crash  🟢
- Navigated to /maya/:id → renders "Chat with Maya / AI Recipe App • Idea Partner". BEFORE: "Something went wrong / apiMessages.map is not a function".

### #65 — landing nav dead links  🟢
- Nav: Product→#how-it-works, Pricing→#pricing, FAQ→#faq. Zero `href="#"` dead links. BEFORE: Product/Pricing/About all "#".

### #153 — starter-pack agent names  🟢🔵
- Fresh pack "ProofPack" → agents **Alex / Jordan / Wren** (character names). BEFORE: "Product Manager / Technical Lead / Copywriter" (name === role, "role twice").

### #130 — orphan onboarding page  ⚪🔵
- Code: standalone onboarding.tsx deleted; the modal flow is the real onboarding. /onboarding no longer 404-routes to a dead page.

---

## Fixes verified in CODE only (not driven live this pass — being explicit)

| Fix | Status | Why not browser-driven |
|---|---|---|
| #114 dead theme toggle | ⚪ CODE (`if (FORCE_DARK_MODE) return null`) | the user-menu dropdown trigger isn't exposed to automation; wouldn't open despite several attempts |
| #96 off-screen toast | ⚪ CODE (viewport `position:fixed; bottom:0; right:0` + safe-area) | no clean toast fire captured; pack-creation toast was ambiguous |
| #43 reason-code leak | ⚪ CODE + gate:safety PASS (per log) | needs a destructive-intent turn to trigger live |
| #160 UpgradeModal on cap | ⚪ CODE | needs FEATURE_BILLING_GATES=true + user at project cap to trigger live |

---

## Deferred by design (NOT fixed — Phase 47 backlog)
#37 corrupt-PDF silent-empty, #60 deliverable-vs-task, #87/#88 task-verb nuances, #126 auto-revert on regression,
#161 autonomy-dial Pro gate, #94/#139 @ and / autocomplete (net-new), #112 a11y button labels.

## Not re-fixed (mechanism refuted)
#22 vanishing messages — the audit's stated cause (`task_created` invalidating the conversation query) does not
exist in the code; left pending a fresh repro rather than fixing a phantom cause.

---

**Bottom line:** every load-bearing AI-core fix is proven working with fresh live evidence (browser + DB + WS).
The remaining unconfirmed items are lower-severity UI/polish verified in code only, and are flagged as such above.
