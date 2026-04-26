# Phase 23: Budget UX Surfaces - Research

**Researched:** 2026-04-26
**Domain:** React component extension, WebSocket event routing, TanStack Query
**Confidence:** HIGH

<user_constraints>
## User Constraints

### Locked Decisions
- UsageBar from v1.2 is the surface to extend. NOTE: UsageBar does NOT exist as a standalone file — usage rows are inline inside `AccountPage.tsx`. The planner must CREATE `client/src/components/UsageBar.tsx` extracted from AccountPage and extended with an autonomy-runs row.
- UpgradeModal from v1.2 is the surface to extend — add new `reason` variant, do not create new modal.
- Quota framing only ("47 of 50 runs remaining today") — never raw dollar amounts in primary UI.
- Activity feed event type: `budget_blocked`. Phase 22 did NOT log this to `autonomy_events` — it emitted `task_requires_approval` WS event only. Phase 23 must call `logAutonomyEvent({ eventType: 'budget_blocked', ... })`.
- In-character Maya message must use the `generateReturnBriefing` infrastructure pattern: real `messages` DB row authored by Maya, broadcast via `new_message` WS event.

### Claude's Discretion
- Whether the soft-warn (80%) fires client-derived from polling `/api/autonomy/budget` OR server-pushed via `usage_warning` WS event.
- Whether autonomy run count is added to `/api/billing/status` or exposed as new `/api/autonomy/budget` endpoint.
- Whether `budget_blocked` feed item uses `system` category (grey) or a distinct amber accent.

### Deferred (OUT OF SCOPE)
- Per-agent budgets (PAB-01/02), budget projection, dollar amounts in primary UI, manual budget override.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUDG-04 | User sees autonomy budget consumption in UsageBar | New `UsageBar.tsx` component + `/api/autonomy/budget` endpoint reading `autonomy_daily_counters` |
| BUDG-05 | Soft warning at 80% consumption | `usage_warning` WS schema exists in `wsSchemas.ts:240`; OR client-derived via `useEffect` + `useRef` guard on polled data |
| BUDG-06 | In-character Maya message at hard stop (100%) | `generateReturnBriefing` pattern confirmed: `storage.createMessage` + `broadcastToConversation('new_message')` in pipeline |
| BUDG-07 | `budget_blocked` events in Activity feed | `logAutonomyEvent` write path; `useAutonomyFeed` + `readAutonomyEventsByProject` read path; new event type in `mapEventTypeToCategory` |
| BUDG-08 | Free-tier users see UpgradeModal | `getTierBudgets('free').maxBackgroundLlmCallsPerProjectPerDay === 0`; existing `upgrade_required` WS → `setShowUpgradeModal(true)` pattern in `CenterPanel.tsx:998` |
</phase_requirements>

---

## Summary

Phase 23 makes Phase 22's atomic budget enforcement visible to users across four surfaces: a UsageBar autonomy row, a soft-warn toast at 80%, an in-character Maya hard-stop message at 100%, and a `budget_blocked` event in the Activity feed. The backend work is narrow: one new endpoint, two new log/event calls in `taskExecutionPipeline.ts`, and a Maya message dispatch. The frontend work is the main body.

**Critical finding 1:** `UsageBar` does not exist as a standalone component. The v1.2 usage display is inline JSX inside `AccountPage.tsx` (the Usage card, lines 198–233). Phase 23 must extract this into `client/src/components/UsageBar.tsx` and add an autonomy-runs row.

**Critical finding 2:** Phase 22's `if (!reserved)` block emits `task_requires_approval` WS event (drives the AutonomousApprovalCard UI) but does NOT call `logAutonomyEvent`. The Activity feed reads from `autonomy_events` table — a `budget_blocked` event will never appear unless Phase 23 adds the `logAutonomyEvent` call. Keep the `task_requires_approval` broadcast; add `logAutonomyEvent` as an additional call.

**Critical finding 3:** `/api/billing/status` is user-scoped (no projectId). Autonomy budget is per-project. These are different scopes. A new endpoint `/api/autonomy/budget?projectId=<id>` is the clean solution.

**Critical finding 4:** `getTierBudgets('free').maxBackgroundLlmCallsPerProjectPerDay === 0`. The Free-tier path is: `limit = 0` → `reserveBudgetSlot` returns false immediately on first call → emit `upgrade_required` WS with `reason: "autonomy_budget_exhausted"` → UpgradeModal. The Pro-at-cap path is different: emit `task_requires_approval` + `budget_blocked` event + Maya message.

**Primary recommendation:** Source autonomy run count from new `/api/autonomy/budget` endpoint (Drizzle SELECT on `autonomy_daily_counters`). Soft-warn derived client-side (no extra WS machinery). Maya hard-stop via template string (no LLM call at exhausted budget).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3.1 | Component authoring | Project standard |
| TanStack React Query | 5.60.5 | `useQuery` for `/api/autonomy/budget` polling | Project standard for all server data |
| `@radix-ui/react-toast` | via Shadcn | Soft-warn toast (BUDG-05) | Already installed; `useToast` hook used in CenterPanel:61 |
| Framer Motion | 11.13.1 | Entry animation on budget feed item | Already in ActivityFeedItem.tsx |
| Tailwind CSS | 3.4.17 | Styling | Project standard |
| Lucide React | 0.453.0 | `Zap`, `AlertTriangle` icons for UsageBar | Project standard |

**No new packages needed.**

**Toast system confirmed:** Project uses Radix UI toast via `use-toast.ts`. `<Toaster />` is mounted at `App.tsx:123`. Do NOT use sonner — it is not installed.

---

## Architecture Patterns

### Recommended File Changes
```
client/src/components/
├── UsageBar.tsx                      # NEW — extracted + extended from AccountPage
└── chat/
    └── ChatHeader.tsx                # MODIFY — add autonomyBudget prop + UsageBar row
server/routes/
└── autonomy.ts                       # MODIFY — add GET /api/autonomy/budget
server/autonomy/execution/
└── taskExecutionPipeline.ts          # MODIFY — add logAutonomyEvent + Maya msg + upgrade_required
client/src/lib/
└── autonomyEvents.ts                 # MODIFY — add BUDGET_BLOCKED constant
client/src/hooks/
└── useAutonomyFeed.ts                # MODIFY — add budget_blocked to mapEventTypeToCategory + buildLabel
client/src/components/
└── UpgradeModal.tsx                  # MODIFY — add autonomy_budget_exhausted reason headline
```

### Pattern 1: UsageBar Component (NEW)

**Props contract:**
```typescript
// Created by reading AccountPage.tsx usage rows (lines 198-233)
interface AutonomyBudgetProps {
  used: number;       // reserved_count from autonomy_daily_counters
  limit: number;      // limit_count (50 for Pro, 0 for Free)
  tier: 'free' | 'pro';
}

interface UsageBarProps {
  autonomyBudget?: AutonomyBudgetProps;
  className?: string;
}
```

**Display logic:**
```typescript
// Guard: Free tier (limit=0) shows upgrade CTA, not "0 of 0 remaining"
if (autonomyBudget.limit === 0) {
  return <AutonomyUpgradeCTA />;
}
const remaining = autonomyBudget.limit - autonomyBudget.used;
const pct = Math.min(100, (autonomyBudget.used / autonomyBudget.limit) * 100);
const label = `${remaining} of ${autonomyBudget.limit} autonomy runs remaining today`;
// Bar color: amber at >= 80%, green otherwise
const barColor = pct >= 80 ? 'bg-amber-500' : 'bg-[var(--hatchin-green)]';
```

**Data source:** `useQuery` polling `/api/autonomy/budget?projectId=<id>` every 60 seconds. Owned by `CenterPanel.tsx` (which has `activeProject.id`). Passed down to `ChatHeader` via new prop.

### Pattern 2: Soft-Warn Toast at 80% (BUDG-05)

Client-derived approach — no server changes needed:
```typescript
// In a new useAutonomyBudget(projectId) hook, or in CenterPanel
const hasWarnedRef = useRef(false);

useEffect(() => {
  if (!data || data.limit === 0) return;
  const pct = (data.used / data.limit) * 100;
  if (pct >= 80 && pct < 100 && !hasWarnedRef.current) {
    hasWarnedRef.current = true;
    toast({
      title: "Autonomy budget at 80%",
      description: `${data.limit - data.used} of ${data.limit} runs remaining today.`,
      duration: 6000,
    });
  }
  if (data.used === 0) hasWarnedRef.current = false; // new day reset
}, [data, toast]);
```

`useToast()` from `@/hooks/use-toast` — same import as CenterPanel:61.

### Pattern 3: Maya Hard-Stop Message (BUDG-06)

Location: `taskExecutionPipeline.ts` in the `if (!reserved)` block, ONLY for Pro users (`tierLimit > 0`). Free users get the UpgradeModal instead.

**Template (no LLM call — budget is exhausted):**
```typescript
function buildBudgetExhaustedMessage(limit: number): string {
  return `The team has hit today's ${limit}-task limit for background work. `
    + `Everything is queued and will pick back up tomorrow. `
    + `If this is urgent, you can approve tasks manually from the Activity tab.`;
}
```

**Message storage — mirrors returnBriefing.ts:126-147:**
```typescript
// Find Maya
const agents = await deps.storage.getAgentsByProject(job.data.projectId);
const maya = agents.find(a => a.isSpecialAgent);

// Deduplication guard (in-memory, single node — acceptable for UX nicety)
const todayKey = `${job.data.projectId}:${today}`;
if (!budgetMessageSentToday.has(todayKey)) {
  budgetMessageSentToday.set(todayKey, today);
  const conversationId = `project:${job.data.projectId}`;
  const msg = await deps.storage.createMessage({
    conversationId,
    content: buildBudgetExhaustedMessage(tierLimit),
    messageType: 'agent',
    agentId: maya?.id ?? null,
    userId: null,
    metadata: { isBudgetMessage: true, dailyLimit: tierLimit } as any,
  });
  deps.broadcastToConversation(conversationId, {
    type: 'new_message', conversationId, message: msg,
  });
}
// Module-scope deduplication Map:
const budgetMessageSentToday = new Map<string, string>();
```

### Pattern 4: `budget_blocked` Activity Feed Event (BUDG-07)

**Server — add to `if (!reserved)` block in `taskExecutionPipeline.ts`:**
```typescript
// Source: logAutonomyEvent signature from eventLogger.ts:265
await logAutonomyEvent({
  eventType: 'budget_blocked',
  projectId: job.data.projectId,
  hatchId: job.data.agentId,
  payload: {
    taskId: job.data.taskId,
    taskTitle: task?.title ?? 'Unknown task',
    agentName: agent?.name ?? 'Unknown agent',
    dailyLimit: tierLimit,
    blockedAt: new Date().toISOString(),
  },
});
```

**Client — `autonomyEvents.ts` addition:**
```typescript
export const AUTONOMY_EVENTS = {
  // ... existing ...
  BUDGET_BLOCKED: 'autonomy:budget_blocked',  // NEW
} as const;
```

**Client — `useAutonomyFeed.ts` additions:**
```typescript
// In mapEventTypeToCategory:
case 'budget_blocked': return 'system';

// In buildLabel:
case 'budget_blocked':
  return `${name}'s task was paused — daily limit reached`;
```

The REST path (`GET /api/autonomy/events?projectId=X`) already returns all `autonomy_events` rows via `readAutonomyEventsByProject`. No route change needed — the new `budget_blocked` row appears automatically.

### Pattern 5: UpgradeModal Autonomy Framing (BUDG-08)

**`UpgradeModal.tsx` — add one entry to `REASON_HEADLINES`:**
```typescript
autonomy_budget_exhausted: {
  title: "Your Hatches are ready to run",
  description:
    "Background autonomy is a Pro feature. Upgrade to let your team execute tasks, "
    + "hand off work, and keep building while you focus on other things.",
},
```

**Server dispatch in `taskExecutionPipeline.ts` — only when `tierLimit === 0` (Free user):**
```typescript
if (tierLimit === 0) {
  // Free tier: upgrade prompt
  deps.broadcastToConversation(`project:${job.data.projectId}`, {
    type: 'upgrade_required',
    reason: 'autonomy_budget_exhausted',
    currentUsage: 0,
    limit: 0,
    upgradeUrl: '/api/billing/checkout',
  });
} else {
  // Pro tier at daily cap: Maya message + budget event
  // ... logAutonomyEvent + Maya msg ...
}
```

`upgrade_required` WS schema already uses `reason: z.string()` — no schema change needed.

### Pattern 6: `/api/autonomy/budget` Endpoint

**Location:** `server/routes/autonomy.ts` — append to `registerAutonomyRoutes`.

```typescript
// GET /api/autonomy/budget?projectId=<uuid>
app.get('/api/autonomy/budget', async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const projectIdParam = req.query.projectId as string | undefined;
  if (!projectIdParam) return res.status(400).json({ error: 'projectId required' });

  const project = await requireOwnedProject(projectIdParam, userId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const user = await storage.getUser(userId);
  const tier = (user?.tier ?? 'free') as 'free' | 'pro';
  const limit = getTierBudgets(tier).maxBackgroundLlmCallsPerProjectPerDay;
  const today = new Date().toISOString().slice(0, 10);

  // Drizzle SELECT — simple read, no raw SQL needed
  const rows = await db.select()
    .from(autonomyDailyCounters)
    .where(and(
      eq(autonomyDailyCounters.projectId, projectIdParam),
      eq(autonomyDailyCounters.date, today)
    ));

  const used = rows[0]?.reservedCount ?? 0;
  return res.json({ used, limit, tier, date: today });
});
```

**Import needed at top of autonomy.ts:**
```typescript
import { db } from '../db.js';
import { autonomyDailyCounters } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';
import { getTierBudgets } from '../autonomy/config/policies.js';
```

### Anti-Patterns to Avoid

- **`limit === 0` → division by zero:** Always guard: `pct = limit > 0 ? (used / limit) * 100 : 0`. Show upgrade CTA for free users instead of a bar.
- **Multiple Maya messages per exhaustion event:** Use in-memory `budgetMessageSentToday` Map as deduplication guard.
- **Removing `task_requires_approval` broadcast:** Keep it — it drives the AutonomousApprovalCard UI. `budget_blocked` is an ADDITIONAL event, not a replacement.
- **LLM call for Maya budget message:** Budget is exhausted. Use the template. Never call LLM at the budget-exhausted moment.
- **Importing sonner:** Not installed. Use `useToast` from `@/hooks/use-toast`.
- **Fetching autonomy budget inside ActivityFeedItem or ChatHeader:** Fetch in CenterPanel, pass down as props. Components do not own data fetching.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notification | Custom toast markup | `useToast()` + Radix `Toaster` | Already mounted in App.tsx:123 |
| Budget count | Separate counter | `autonomy_daily_counters.reserved_count` (Phase 22 ledger) | Ledger is the authority |
| Autonomy events in feed | New polling | `logAutonomyEvent` + existing `readAutonomyEventsByProject` | Feed already reads from `autonomy_events` — just add a new eventType |
| Upgrade modal | New modal | `UpgradeModal.tsx` with new reason variant | Add one entry to REASON_HEADLINES |

---

## Common Pitfalls

### Pitfall 1: Free-Tier `limit = 0` Division by Zero
`getTierBudgets('free').maxBackgroundLlmCallsPerProjectPerDay === 0`. Computing `used / limit` crashes. Guard with `if (limit === 0)` before any percentage calculation. Show "Autonomy requires Pro" text with upgrade CTA for free users.

### Pitfall 2: Multiple Maya Budget Messages (Race)
Multiple concurrent blocked tasks each independently reach the `if (!reserved)` block and each try to send a Maya message. Use a module-scope `budgetMessageSentToday = new Map<string, string>()` keyed by `projectId:YYYY-MM-DD`. Check before creating the message. Set after.

### Pitfall 3: `budget_blocked` vs `task_requires_approval` Confusion
Phase 22 emits `task_requires_approval` WS event (drives AutonomousApprovalCard). This is correct and must stay. Phase 23 adds `logAutonomyEvent({ eventType: 'budget_blocked' })` as an ADDITIONAL call to write to the `autonomy_events` audit table so the Activity feed can surface it. These are two different things for two different consumers.

### Pitfall 4: Stale Counter Row Missing
`/api/autonomy/budget` may find no row in `autonomy_daily_counters` for a project that has never run background tasks. Use `rows[0]?.reservedCount ?? 0`. Do NOT crash on undefined.

### Pitfall 5: UsageBar Placement — ChatHeader Fixed Height
`ChatHeader` has `h-11` fixed height (`flex items-center` row). Adding a vertical usage row breaks the layout. Recommendation: render UsageBar as a compact right-side pill in the header (`"47/50 runs"` text + small icon) rather than a full progress bar row. Full bar can live in the Activity tab. On mobile (`< lg`), hide the pill entirely.

### Pitfall 6: `budget_blocked` Events Polluting BUDG-03 Reconciliation
The Phase 22-03 reconciliation job counts `autonomy_events` with `event_type='autonomous_task_execution'` as the source of truth. `budget_blocked` events must NOT be counted as executions. Verify the reconciliation query already filters by a specific `event_type` value, not all events.

---

## Code Examples

### Existing Toast Call (BUDG-05)
```typescript
// Source: CenterPanel.tsx:61 + :972
const { toast } = useToast();  // from '@/hooks/use-toast'
toast({ title: 'Autonomy budget at 80%', description: '...', duration: 6000 });
```

### Existing UpgradeModal Trigger (BUDG-08)
```typescript
// Source: CenterPanel.tsx:87-88 + :998-1003
const [showUpgradeModal, setShowUpgradeModal] = useState(false);
const [upgradeReason, setUpgradeReason] = useState<string | undefined>();
// In WS message handler:
else if (message.type === 'upgrade_required') {
  setUpgradeReason(message.reason);  // 'autonomy_budget_exhausted'
  setShowUpgradeModal(true);
}
```

### Maya Message Store Pattern (BUDG-06)
```typescript
// Source: server/ai/returnBriefing.ts:126-147
const msg = await deps.storage.createMessage({
  conversationId: `project:${job.data.projectId}`,
  content: buildBudgetExhaustedMessage(tierLimit),
  messageType: 'agent',
  agentId: maya?.id ?? null,
  userId: null,
  metadata: { isBudgetMessage: true, dailyLimit: tierLimit } as any,
});
deps.broadcastToConversation(`project:${job.data.projectId}`, {
  type: 'new_message',
  conversationId: `project:${job.data.projectId}`,
  message: msg,
});
```

### logAutonomyEvent Call (BUDG-07)
```typescript
// Source: server/autonomy/events/eventLogger.ts:265 — confirmed signature
await logAutonomyEvent({
  eventType: 'budget_blocked',
  projectId: job.data.projectId,
  hatchId: job.data.agentId,
  payload: {
    taskId: job.data.taskId,
    taskTitle: task?.title ?? 'Unknown task',
    agentName: agent?.name ?? 'Unknown agent',
    dailyLimit: tierLimit,
    blockedAt: new Date().toISOString(),
  },
});
```

### TanStack Query for New Endpoint (BUDG-04)
```typescript
// Source: ActivityTab.tsx:36-43 — established pattern
const { data } = useQuery<{ used: number; limit: number; tier: string; date: string }>({
  queryKey: ['/api/autonomy/budget', `?projectId=${projectId}`],
  queryFn: () => fetch(`/api/autonomy/budget?projectId=${projectId}`).then(r => r.json()),
  enabled: !!projectId,
  staleTime: 30_000,
  refetchInterval: 60_000,
});
```

---

## Complete Change Map

| File | Change | Requirement(s) |
|------|--------|----------------|
| `server/autonomy/execution/taskExecutionPipeline.ts` | Add `logAutonomyEvent('budget_blocked')`, Maya message, `upgrade_required` dispatch in `if (!reserved)` block | BUDG-06, BUDG-07, BUDG-08 |
| `server/routes/autonomy.ts` | Add `GET /api/autonomy/budget` endpoint | BUDG-04 |
| `client/src/components/UsageBar.tsx` | CREATE new component | BUDG-04 |
| `client/src/components/chat/ChatHeader.tsx` | Add `autonomyBudget` prop + render UsageBar pill | BUDG-04 |
| `client/src/components/CenterPanel.tsx` | Add `useQuery` for budget, pass to ChatHeader, add soft-warn effect, handle new WS reason | BUDG-04, BUDG-05, BUDG-08 |
| `client/src/components/UpgradeModal.tsx` | Add `autonomy_budget_exhausted` to `REASON_HEADLINES` | BUDG-08 |
| `client/src/lib/autonomyEvents.ts` | Add `BUDGET_BLOCKED` constant | BUDG-07 |
| `client/src/hooks/useAutonomyFeed.ts` | Add `budget_blocked` to `mapEventTypeToCategory` and `buildLabel` | BUDG-07 |

**Files NOT changed:** `server/billing/usageTracker.ts`, `server/middleware/tierGate.ts`, `server/autonomy/events/eventLogger.ts` (accepts any eventType), `shared/schema.ts`, `ActivityFeedItem.tsx`.

---

## State of the Art

| Old | New | Requirement |
|-----|-----|-------------|
| No autonomy usage visible | UsageBar autonomy row in chat header | BUDG-04 |
| No warning before cap | Toast at 80% | BUDG-05 |
| Generic system event when blocked | In-character Maya message | BUDG-06 |
| `task_requires_approval` only (no audit trail event) | `budget_blocked` in `autonomy_events` | BUDG-07 |
| No upgrade path from autonomy context | UpgradeModal with autonomy framing | BUDG-08 |

---

## Open Questions

1. **UsageBar exact placement in ChatHeader:** Header has `h-11` fixed height. Options: compact right-side pill, or place in ActivityTab header instead. Recommend: compact pill ("47/50") in ChatHeader right area; full bar in Activity tab sidebar section.

2. **Soft-warn once per session vs once per day:** `useRef` guard fires once per component mount. Recommendation: store seen state in `sessionStorage` keyed by `projectId:date` to prevent re-showing on tab focus changes.

3. **`budget_blocked` reconciliation safety:** Verify Phase 22-03 reconciliation query filters by `event_type = 'autonomous_task_execution'`. If it counts ALL events, adding `budget_blocked` events would corrupt the drift calculation.

---

## Validation Architecture

> `workflow.nyquist_validation` absent from `.planning/config.json` — treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `tsx` scripts (project pattern) + Playwright E2E |
| Config file | `playwright.config.ts` (already exists — `test-results/` in git status confirms) |
| Quick run command | `npm run typecheck` |
| Full suite command | `npm run typecheck && npx tsx scripts/test-budget-ux.ts && npx playwright test tests/budget-ux.spec.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUDG-04 | `GET /api/autonomy/budget` returns `{ used, limit, tier, date }` for owned project | Integration | `npx tsx scripts/test-budget-ux.ts` | Wave 0 |
| BUDG-04 | UsageBar renders "47 of 50 runs remaining" when `used=3, limit=50` | E2E | `npx playwright test tests/budget-ux.spec.ts` | Wave 0 |
| BUDG-04 | UsageBar renders upgrade CTA when `limit=0` (Free tier) | E2E | `npx playwright test tests/budget-ux.spec.ts` | Wave 0 |
| BUDG-05 | `pct = (40/50)*100 = 80` → toast fires; second poll does NOT re-fire | Unit logic | `npx tsx scripts/test-budget-ux.ts` | Wave 0 |
| BUDG-06 | Maya message created with `isBudgetMessage: true` metadata on budget exhaustion | Integration | `npx tsx scripts/test-budget-ux.ts` | Wave 0 |
| BUDG-06 | Second blocked task in same project+day does NOT create second Maya message | Integration | `npx tsx scripts/test-budget-ux.ts` | Wave 0 |
| BUDG-07 | `budget_blocked` event written to `autonomy_events` table with correct payload | Integration | `npx tsx scripts/test-budget-ux.ts` | Wave 0 |
| BUDG-07 | `mapEventTypeToCategory('budget_blocked')` returns `'system'` | Unit | `npx tsx scripts/test-budget-ux.ts` | Wave 0 |
| BUDG-07 | Activity feed displays "task paused — daily limit reached" for `budget_blocked` event | E2E | `npx playwright test tests/budget-ux.spec.ts` | Wave 0 |
| BUDG-08 | Free-tier pipeline block emits `upgrade_required` WS event with `reason: "autonomy_budget_exhausted"` | Integration | `npx tsx scripts/test-budget-ux.ts` | Wave 0 |
| BUDG-08 | UpgradeModal renders correct title for `autonomy_budget_exhausted` reason | E2E | `npx playwright test tests/budget-ux.spec.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run typecheck`
- **Per wave merge:** `npm run typecheck && npx tsx scripts/test-budget-ux.ts`
- **Phase gate:** Full suite (typecheck + tsx + Playwright) green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/test-budget-ux.ts` — integration: new endpoint, event logging, Maya message, deduplication, Free-tier upgrade_required
- [ ] `tests/budget-ux.spec.ts` — E2E: UsageBar render, UpgradeModal, Activity feed item

*(No new framework install needed — tsx scripts and Playwright already in use)*

---

## Sources

### Primary (HIGH confidence)
- `client/src/pages/AccountPage.tsx` — confirmed UsageBar does NOT exist standalone; usage rows are inline JSX
- `client/src/components/UpgradeModal.tsx` — full read: REASON_HEADLINES map, props contract, TIER_FEATURES
- `client/src/components/CenterPanel.tsx` (lines 87-88, 998-1004, 1974-1978) — confirmed UpgradeModal trigger pattern + `useToast` import
- `client/src/components/sidebar/ActivityFeedItem.tsx` — full read: category/label functions, expansion
- `client/src/hooks/useAutonomyFeed.ts` — full read: mapEventTypeToCategory, buildLabel, REST + realtime merge
- `client/src/lib/autonomyEvents.ts` — full read: AUTONOMY_EVENTS constants
- `server/autonomy/events/eventLogger.ts` — full read: logAutonomyEvent signature
- `server/autonomy/execution/budgetLedger.ts` — confirmed reserveBudgetSlot returns false when exhausted
- `server/autonomy/execution/taskExecutionPipeline.ts` (lines 555-590) — confirmed `if (!reserved)` block location + WS event dispatch
- `server/autonomy/config/policies.ts` — confirmed `getTierBudgets('free') = { maxBackgroundLlmCallsPerProjectPerDay: 0 }`
- `server/ai/returnBriefing.ts` — full read: Maya message pattern (createMessage + broadcastToConversation)
- `server/routes/billing.ts` — confirmed `/api/billing/status` is user-scoped, no projectId, no autonomy run count
- `server/routes/autonomy.ts` (lines 706-766) — confirmed `/api/autonomy/stats` exists; `requireOwnedProject` helper available
- `shared/dto/wsSchemas.ts` (lines 231-244) — confirmed `upgrade_required.reason: z.string()` (no schema change needed); `usage_warning` exists
- `App.tsx:123` — confirmed `<Toaster />` mounted (Radix toast, NOT sonner)
- Phase 22-01 SUMMARY.md + Phase 22-02 SUMMARY.md — confirmed budgetLedger.ts contract and pipeline block location

**Research date:** 2026-04-26
**Valid until:** 2026-05-26
