# Phase 36: Frozen-Rubric Deliverable Iteration — Pattern Map

**Mapped:** 2026-05-11
**Files analyzed:** 17 (9 new, 8 modified)
**Analogs found:** 17 / 17 (all matched, 13 exact + 4 role-match)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `shared/deliverableRubrics.ts` (NEW) | shared-validation | static-registry | `shared/deliverableTypes.ts` + `server/ai/characterProfiles.ts` | exact (registry) |
| `shared/schema.ts` (MOD) | shared-schema | CRUD | `shared/schema.ts:301-349` (deliverables/deliverable_versions self) | exact (in-place) |
| `server/ai/rubricScorer.ts` (NEW) | server-llm | request-response (LLM call) | `server/ai/conversationCompactor.ts` + `server/ai/tasks/organicExtractor.ts` | exact (Groq+Zod+temp=0) |
| `server/ai/deliverableGenerator.ts` (MOD) | server-domain | transform | self (same function — wrap with scoring) | exact (in-place) |
| `server/routes/deliverables.ts` (MOD: +3 endpoints + iterate response) | server-route | request-response | self lines 87-118 (PATCH) + self lines 262-287 (iterate) | exact (sibling endpoint) |
| `server/routes/health.ts` (MOD: DEV-only force-judge-score) | server-route | request-response | self lines 107-150 (DEV-only force-outage/recovery) | exact (in-place) |
| `server/ai/openaiService.ts` (MOD: RECENT FEEDBACK section) | server-llm | transform (prompt build) | self lines 210-222 (ROLE EXPERTISE section), 326-362 (ASSIGNED TASKS injection) | exact (in-place) |
| `server/storage.ts` (MOD: feedback aggregation helper + Mem/DB impls) | server-domain | CRUD | self lines 197-205 (IStorage) + lines 1410-1453 (Mem) + 2152-2193 (DB) | exact (in-place) |
| `server/ai/deliverableFeedbackAggregator.ts` (NEW per RESEARCH §Recommended Structure) | server-domain | CRUD + cache | `server/llm/providerHealthState.ts` (in-process state) + `server/ai/tasks/organicExtractor.ts:24-42` (cooldown Map) | exact (in-process cache) |
| `client/src/components/deliverable/RubricBreakdown.tsx` (NEW) | client-component | request-response | `client/src/components/ArtifactPanel.tsx:36-95` (deliverable-data consumer) | role-match (presentation only) |
| `client/src/components/deliverable/AutoRevertBanner.tsx` (NEW) | client-component | event-driven | `client/src/components/legal/LegalModal.tsx` (shadcn Dialog) + `ArtifactPanel.tsx:125-131` (Framer entrance) | role-match (inline banner, NOT modal) |
| `client/src/components/ArtifactPanel.tsx` (MOD) | client-component | request-response | self lines 76-93 (iterateMutation), 59-74 (restoreMutation) | exact (in-place) |
| `tests/e2e/phase-36-rubric-iteration.spec.ts` (NEW) | test-e2e | request-response | `tests/e2e/phase-35-production-hotfix.spec.ts` | exact (template) |
| `scripts/test-rubric-scorer.ts` (NEW) | test-unit | pure-function | `scripts/test-provider-health-state.ts` | exact (assert-pattern) |
| `scripts/test-feedback-signal.ts` (NEW) | test-unit | pure-function | `scripts/test-provider-health-state.ts` (case-based asserts) | role-match (snapshot vs counter) |
| `playwright.config.ts` (MOD: phase-36 project) | config | n/a | self lines 72-81 (phase-35 project entry) | exact (in-place) |
| `shared/dto/apiSchemas.ts` (MOD: IterateDeliverableResponse) | shared-validation | transform | `shared/dto/wsSchemas.ts:14-39` (z.object pattern) | role-match (REST vs WS) |

---

## Pattern Assignments

### `shared/deliverableRubrics.ts` (NEW — shared-validation, static-registry)

**Primary analog:** `shared/deliverableTypes.ts` (whole file) — the existing per-type registry over the same 15-type domain.
**Secondary analog:** `server/ai/characterProfiles.ts:41-52` — registry-with-lookup pattern.

**Imports / registry shape pattern** (from `shared/deliverableTypes.ts:1-19`):
```typescript
/**
 * Deliverable Type Registry — maps agent roles to the deliverable types they can produce.
 * Each type has a canonical section schema for structured output.
 */

export interface DeliverableTypeSpec {
  type: string;
  label: string;
  description: string;
  sections: string[];
  estimatedMinutes: number;
}

export interface RoleDeliverableMap {
  role: string;
  types: DeliverableTypeSpec[];
}

export const DELIVERABLE_TYPE_REGISTRY: RoleDeliverableMap[] = [
  { role: 'Product Manager', types: [ { type: 'prd', label: '...', ... } ] },
  // ... 14 more entries
];
```

**Registry-with-lookup pattern** (from `server/ai/characterProfiles.ts:41-52`):
```typescript
export const characterProfiles: Record<string, CharacterProfile> = Object.fromEntries(
  ROLE_DEFINITIONS.map(d => [d.role, toCharacterProfile(d)])
);

export const mayaCharacterProfile: CharacterProfile =
  characterProfiles["Idea Partner"] ?? toCharacterProfile(ROLE_DEFINITIONS[ROLE_DEFINITIONS.length - 1]);

export function getCharacterProfile(role: string): CharacterProfile | null {
  if (role === "Maya" || role === "Idea Partner") return mayaCharacterProfile;
  const def = getRoleDefinition(role);
  return def ? toCharacterProfile(def) : null;
}
```

**Apply to Phase 36:** Mirror `DELIVERABLE_TYPE_REGISTRY` structure but key by `type` (not role) since rubrics are 1-per-type. Use Zod schema (`rubricSchema.parse(...)`) at module load (per RESEARCH §Pattern 1) — this is **stronger than the existing pattern** which uses bare `interface` + manual construction. Add `Object.freeze(_REGISTRY)` + per-rubric freeze loop (RESEARCH lines 329-334) so the immutability invariant is runtime-enforced. Export `getRubricForType(type: string): Rubric | null` mirroring `getCharacterProfile`.

**Type list to mirror (15 entries):** prd, tech-spec, design-brief, gtm-plan, user-stories, blog-post, landing-copy, content-calendar, email-sequence, seo-brief, project-plan, competitive-analysis, market-research, process-doc, data-report — exactly matching `shared/schema.ts:310-315` and `shared/deliverableTypes.ts`.

---

### `shared/schema.ts` (MOD — shared-schema, CRUD)

**Analog:** self at lines 301-349. The existing `deliverables` + `deliverable_versions` tables are the only analog needed — extend them in place.

**Column-addition pattern** (from `shared/schema.ts:316-330`, the `deliverables` table):
```typescript
export const deliverables = pgTable("deliverables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  // ... existing cols
  status: text("status").notNull().$type<"draft" | "in_review" | "complete">().default("draft"),
  content: text("content").notNull().default(""),
  currentVersion: integer("current_version").notNull().default(1),
  // ... existing cols
  metadata: jsonb("metadata").$type<{
    wordCount?: number;
    sections?: string[];
    references?: string[];
    generationTimeMs?: number;
    chainPosition?: number;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("deliverables_project_id_idx").on(table.projectId),
  agentIdIdx: index("deliverables_agent_id_idx").on(table.agentId),
  // ...
}));
```

**Apply to Phase 36:**
- On `deliverables` add: `userAcceptedAt: timestamp("user_accepted_at")` (nullable), `editsCount: integer("edits_count").notNull().default(0)`, `dismissedAt: timestamp("dismissed_at")` (nullable), `impressionCount: integer("impression_count").notNull().default(0)`.
- On `deliverable_versions` add: `rubricVersion: text("rubric_version")` (nullable — pre-Phase-36 versions have null per Q3), `rubricScore: jsonb("rubric_score").$type<{ total: number; breakdown: Array<{ criterion: string; score: number; justification: string }> }>()` (nullable), `revertedFromHigherScore: boolean("reverted_from_higher_score").notNull().default(false)`.
- No new index needed (FBK queries use existing `projectIdIdx` + `agentIdIdx`).
- Apply via `npm run db:push` per CONTEXT D-17 — no SQL migration script.

---

### `server/ai/rubricScorer.ts` (NEW — server-llm, request-response)

**Primary analog:** `server/ai/conversationCompactor.ts` (whole file) — closest existing Groq-based deterministic structured call.
**Secondary analog:** `server/ai/tasks/organicExtractor.ts:1-80` — for JSON-extraction helper + cooldown Map shape (we don't need cooldown here, but the JSON-extraction helper is reusable).

**Groq deterministic call pattern** (from `server/ai/conversationCompactor.ts:116-133`):
```typescript
const result = await generateWithPreferredProvider(
  {
    messages: [
      {
        role: 'system',
        content:
          'You are a concise conversation summarizer. Summarize the following conversation in 3-4 sentences, preserving key decisions, action items, and context that would be needed to continue the conversation.',
      },
      {
        role: 'user',
        content: `Summarize this conversation:\n\n${transcript}`,
      },
    ],
    temperature: 0.3,
    maxTokens: 300,
  },
  'groq',
);
```

**`generateWithPreferredProvider` signature** (from `server/llm/providerResolver.ts:626-650`):
```typescript
/**
 * Generate with a preferred provider (e.g. Groq for task extraction).
 * Falls back to default chain silently on failure.
 */
export async function generateWithPreferredProvider(
  request: LLMRequest,
  preferredProviderId: ProviderId,
): Promise<LLMGenerationResult> {
  const provider = providerRegistry[preferredProviderId];
  if (provider) {
    try {
      const config = resolveRuntimeConfig();
      const result = await provider.generateChat(
        applyModelDefaults(request, config, preferredProviderId),
        config.mode,
      );
      if (result.content?.trim()) {
        return result;
      }
    } catch { /* Silent fallback to default chain */ }
  }
  return generateChatWithRuntimeFallback(request);
}
```

**Zod-validated structured output pattern** (from `server/ai/tasks/organicExtractor.ts:44-54`):
```typescript
function extractJsonObject(text: string): string | null {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return null;
}
```

**Apply to Phase 36:**
- Use `generateWithPreferredProvider(request, 'groq')` — exact same call shape as compactor, but `temperature: 0` and `maxTokens: 800` (per CONTEXT D-12).
- Build judge prompt from `getRubricForType(type)` (see RESEARCH §Pattern 2 lines 380-400 for the prompt skeleton).
- Apply `extractJsonObject()` helper (copy verbatim) before `rubricScoreResultSchema.strict().parse(...)`.
- **Fail-open behavior:** on `safeParse({ success: false })` OR `generateWithPreferredProvider` throw → return `{ recommendation: 'keep_new', ... }` (so a flaky judge never blocks the user — matches CONTEXT D-09 implicit "ties keep new").
- Export `scoreIteration(oldContent, newContent, type): Promise<RubricScoreResult>`.

---

### `server/ai/deliverableGenerator.ts` (MOD — server-domain, transform)

**Analog:** self at lines 125-177 — the existing `iterateDeliverable()` is the wrap-point.

**Existing function shape** (from `server/ai/deliverableGenerator.ts:125-177`):
```typescript
export async function iterateDeliverable(
  deliverableId: string,
  instruction: string,
  agentName: string,
  agentRole: string,
): Promise<Deliverable | undefined> {
  const existing = await storage.getDeliverable(deliverableId);
  if (!existing) return undefined;

  let updatedContent = '';
  try {
    const response = await generateChatWithRuntimeFallback({ /* ... */ });
    updatedContent = response.content || existing.content;
  } catch {
    return existing;
  }

  // Create new version
  const versions = await storage.getDeliverableVersions(deliverableId);
  const nextVersion = versions.length + 1;
  await storage.createDeliverableVersion({
    deliverableId,
    versionNumber: nextVersion,
    content: updatedContent,
    changeDescription: instruction.slice(0, 200),
    createdByAgentId: existing.agentId,
  });

  // Update deliverable
  const updated = await storage.updateDeliverable(deliverableId, {
    content: updatedContent,
    currentVersion: nextVersion,
    metadata: { ...existing.metadata, wordCount: updatedContent.split(/\s+/).length },
  });

  return updated;
}
```

**Apply to Phase 36 (per CONTEXT D-06..D-11 and RESEARCH §System Architecture):**
1. Generate candidate `updatedContent` as today (no change).
2. **Insert scoring gate** AFTER generation, BEFORE `createDeliverableVersion`:
   - `const score = await scoreIteration(existing.content, updatedContent, existing.type);`
3. **Branch on `score.recommendation`:**
   - `'revert'`: still `createDeliverableVersion` with `{ rubricVersion, rubricScore: score.newScore, revertedFromHigherScore: true }`, but DO NOT call `updateDeliverable({ currentVersion, content })`. Return `{ deliverable: existing, reverted: true, oldScore: score.oldScore, newScore: score.newScore }`.
   - `'keep_new'`: create version with `{ rubricVersion, rubricScore: score.newScore, revertedFromHigherScore: false }`, update deliverable as today AND increment `editsCount` by 1. Return `{ deliverable: updated, reverted: false, oldScore, newScore }`.
4. **Change return type** from `Promise<Deliverable | undefined>` to `Promise<IterateResult>` where `IterateResult = { deliverable: Deliverable | undefined; reverted: boolean; oldScore?: RubricScoreResult['oldScore']; newScore?: RubricScoreResult['newScore'] }`.
5. **For v1 baseline (CONTEXT D-11):** also extend `generateDeliverable()` (lines 100-119) to score the just-generated content (no old comparison — pass `oldContent = ''` and store result on v1 row).

---

### `server/routes/deliverables.ts` (MOD — server-route, request-response)

**Primary analog:** self at lines 262-287 (existing iterate endpoint) and lines 87-118 (PATCH with version-create side-effect).
**Cross-cutting auth pattern:** lines 38-44 (`getSessionUserId` + `getOwnedProject`).

**Ownership + Zod pattern** (from `server/routes/deliverables.ts:38-86`):
```typescript
const getSessionUserId = (req: Request): string => (req.session as any).userId as string;

const getOwnedProject = async (projectId: string, userId: string) => {
  const project = await storage.getProject(projectId);
  if (!project) return null;
  return (project as any).userId === userId ? project : null;
};

// POST /api/deliverables
app.post('/api/deliverables', async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = createDeliverableSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error });

  const project = await getOwnedProject(parsed.data.projectId, userId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const deliverable = await storage.createDeliverable(parsed.data);
  return res.status(201).json({ deliverable });
});
```

**Existing iterate endpoint** (from `server/routes/deliverables.ts:262-287`):
```typescript
// POST /api/deliverables/:id/iterate — update deliverable based on user feedback
app.post('/api/deliverables/:id/iterate', async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const deliverable = await storage.getDeliverable(req.params.id);
  if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });

  const project = await getOwnedProject(deliverable.projectId, userId);
  if (!project) return res.status(404).json({ error: 'Deliverable not found' });

  const { instruction } = z.object({ instruction: z.string().min(1).max(2000) }).parse(req.body);

  try {
    const { iterateDeliverable } = await import('../ai/deliverableGenerator.js');
    const updated = await iterateDeliverable(
      req.params.id, instruction,
      deliverable.agentName || 'Agent', deliverable.agentRole || 'Team Member',
    );
    return res.json({ deliverable: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Iteration failed' });
  }
});
```

**Apply to Phase 36:**
- **Modify iterate response:** change `return res.json({ deliverable: updated })` to `return res.json({ deliverable: result.deliverable, reverted: result.reverted, oldScore: result.oldScore, newScore: result.newScore })`. Keep the 500-on-throw and `{ error }` shape.
- **Add `POST /api/deliverables/:id/accept`:** copy ownership pattern from `app.post('/api/deliverables', ...)` above. Body: empty (no Zod parse needed) OR optional `z.object({}).strict()` to enforce no payload. Call new storage helper `storage.acceptDeliverable(id)` which sets `userAcceptedAt = now()` and clears `dismissedAt`. Return `{ deliverable: updated }`. Idempotent per D-18.
- **Add `POST /api/deliverables/:id/dismiss`:** symmetric to accept — flips both flags the other way.
- **Add `POST /api/deliverables/:id/impression`:** ownership check + call `storage.recordImpression(id, userId)`. Implement a 5s dedupe inside the storage helper using an in-process `Map<string, number>` (key: `${id}:${userId}`). De-dupe drop → 200 OK with `{ deduped: true }`, accept → increment + return `{ deliverable: updated }`. See `server/ai/tasks/organicExtractor.ts:24-42` for the Map+timestamp dedupe pattern.

---

### `server/routes/health.ts` (MOD — server-route, request-response)

**Analog:** self at lines 107-150 — the existing DEV-only `/api/dev/force-outage` + `/api/dev/force-recovery` endpoints.

**DEV-only endpoint guard pattern** (from `server/routes/health.ts:107-150`):
```typescript
const forceOutageBodySchema = z.object({ enabled: z.boolean() });

app.post('/api/dev/force-outage', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).send();
  const parsed = forceOutageBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', details: parsed.error.flatten() });
  }
  if (parsed.data.enabled) {
    __resetCountersOnly();
    forceOutageMode(true);
    forceDegradedBroadcast();
  } else {
    forceOutageMode(false);
  }
  // eslint-disable-next-line no-console
  console.warn(
    `[DEV] /api/dev/force-outage called — enabled=${parsed.data.enabled} NODE_ENV=${process.env.NODE_ENV}`,
  );
  return res.json({ ok: true, mode: parsed.data.enabled ? 'forced' : 'restored' });
});
```

**Apply to Phase 36:**
- **Add `POST /api/dev/force-judge-score`** (per RESEARCH §"DEV-only adversarial trigger for Playwright"):
  - Same `if (process.env.NODE_ENV === 'production') return res.status(404).send();` short-circuit (defence in depth).
  - Zod body: `z.object({ recommendation: z.enum(['keep_new', 'revert']), oldTotal: z.number().min(0).max(10).optional(), newTotal: z.number().min(0).max(10).optional() }).strict()`.
  - Sets a module-level `forcedJudgeResult` variable in `server/ai/rubricScorer.ts` (exported `__setForcedScoreForTests(result | null)`) which `scoreIteration()` checks before calling the LLM (mirroring `outageModeActive` in `providerHealthState.ts:34`).
  - Log via `console.warn`, return `{ ok: true }`.
- **Production guard mirror in `rubricScorer.ts`:** `__setForcedScoreForTests` must `throw new Error('FATAL: ... DEV-only')` when `process.env.NODE_ENV === 'production'` — copy the pattern from `providerHealthState.ts:109-117`.

---

### `server/ai/openaiService.ts` (MOD — server-llm, transform)

**Analog:** self at lines 210-222 (ROLE EXPERTISE injection) and lines 326-362 (ASSIGNED TASKS injection — closest precedent for a database-query-driven prompt section).

**ROLE EXPERTISE injection (where the new section lands AFTER this)** (from `server/ai/openaiService.ts:210-222`):
```typescript
// Merged: PROFESSIONAL DEPTH + DOMAIN INTELLIGENCE → single ROLE EXPERTISE section
const intelligence = getRoleIntelligence(agentRole);
const expertiseParts: string[] = [];
if (roleProfile?.domainDepth) expertiseParts.push(`Domain: ${roleProfile.domainDepth}`);
if (intelligence?.reasoningPattern) expertiseParts.push(`Reasoning: ${intelligence.reasoningPattern}`);
if (intelligence?.outputStandards) expertiseParts.push(`Output standard: ${intelligence.outputStandards}`);
if (roleProfile?.criticalThinking) expertiseParts.push(`Critical thinking: ${roleProfile.criticalThinking}`);
if (characterProfile?.negativeHandling) expertiseParts.push(`Pushback: ${characterProfile.negativeHandling}`);
if (characterProfile?.collaborationStyle) expertiseParts.push(`Collaboration: ${characterProfile.collaborationStyle}`);
const professionalDepthSection = expertiseParts.length > 0
  ? `\n--- ROLE EXPERTISE ---\n${expertiseParts.join('\n')}\n--- END ROLE EXPERTISE ---`
  : '';
```

**ASSIGNED TASKS injection (closest analog: a section built from a per-(agent, project) DB query, with empty-string fallback)** (from `server/ai/openaiService.ts:325-362`):
```typescript
// 6.3: Inject assigned tasks for agent awareness
let assignedTasksSection = '';
if (context.projectId) {
  try {
    const projectTasks = await storage.getTasksByProject(context.projectId);
    const openTasks = (projectTasks as any[]).filter(
      (t: any) => t.status !== 'completed' && t.status !== 'cancelled'
    );
    const agentName = roleProfile?.characterName || agentRole;
    const myTasks = openTasks.filter((t: any) => {
      const assignee = (t.assignee || '').toLowerCase();
      return assignee.includes(agentName.toLowerCase()) || assignee.includes(agentRole.toLowerCase());
    });
    // ...
    if (myTasks.length > 0 || unassigned.length > 0) {
      // ...build `lines: string[]`...
      assignedTasksSection = `\n--- ASSIGNED TASKS ---\n${lines.join('\n')}\nReference these naturally if contextually relevant. Mention overdue tasks proactively.\n--- END ASSIGNED TASKS ---`;
    }
  } catch { /* non-critical — skip task injection on error */ }
}
```

**System-prompt assembly** (from `server/ai/openaiService.ts:376-404` — where to insert the new section):
```typescript
const systemPrompt = `${enhancedPrompt}
${characterSection}
${professionalDepthSection}        // ← INJECT recentFeedbackSection RIGHT AFTER THIS
${domainIntelligenceSection}
${emotionalSignatureSection}
${skillsSection}
${projectContextSection}
${projectMemorySection}
// ...
${assignedTasksSection}
${userFormatSection}
${hardFormatRules}`;
```

**Apply to Phase 36 (per CONTEXT D-22..D-26):**
- Build a new `recentFeedbackSection: string` variable using the **exact same try/catch + empty-string-fallback shape** as `assignedTasksSection`.
- Query: call new helper `await getRecentFeedbackSignal(context.projectId, agentId)` from `server/ai/deliverableFeedbackAggregator.ts` (NEW). Returns `null` if `<3` finalized deliverables (CONTEXT D-23) → leave `recentFeedbackSection = ''`.
- When non-null, format: `\n--- RECENT FEEDBACK ON YOUR WORK (this project) ---\nYour last ${n} ${typeLabel}: ${accepted} accepted, ${dismissed} dismissed, ${iterated} edited.${trendLine}\n--- END RECENT FEEDBACK ---` (CONTEXT D-24).
- **Inject point:** insert `${recentFeedbackSection}` template line between `${professionalDepthSection}` and `${domainIntelligenceSection}` (per RESEARCH "Inject after ROLE EXPERTISE (merged PROFESSIONAL DEPTH + DOMAIN INTELLIGENCE per current code) and before user-task context").
- **agentId resolution:** existing `context.agentId` is not currently passed — verify by grepping `buildSystemPrompt` callers. If absent, thread `agentId` through `context` (additive).

---

### `server/storage.ts` (MOD — server-domain, CRUD)

**Analog:** self at lines 197-211 (IStorage deliverable methods) + lines 1410-1453 (MemStorage impl) + lines 2152-2193 (DatabaseStorage impl).

**IStorage interface declaration pattern** (from `server/storage.ts:197-211`):
```typescript
// v2.0: Deliverables
getDeliverablesByProject(projectId: string): Promise<Deliverable[]>;
getDeliverable(id: string): Promise<Deliverable | undefined>;
createDeliverable(deliverable: InsertDeliverable): Promise<Deliverable>;
updateDeliverable(id: string, updates: Partial<Deliverable>): Promise<Deliverable | undefined>;
deleteDeliverable(id: string): Promise<boolean>;
getDeliverableVersions(deliverableId: string): Promise<DeliverableVersion[]>;
createDeliverableVersion(version: InsertDeliverableVersion): Promise<DeliverableVersion>;
restoreDeliverableVersion(deliverableId: string, versionNumber: number): Promise<Deliverable | undefined>;
```

**MemStorage Map-based impl pattern** (from `server/storage.ts:1416-1426`):
```typescript
async createDeliverable(data: InsertDeliverable): Promise<Deliverable> {
  const id = randomUUID();
  const now = new Date();
  const deliverable: Deliverable = { id, ...data, content: data.content ?? '', currentVersion: 1, status: data.status ?? 'draft', metadata: data.metadata ?? {}, createdAt: now, updatedAt: now } as Deliverable;
  this.deliverables.set(id, deliverable);
  // Auto-create v1
  const vId = randomUUID();
  const version: DeliverableVersion = { id: vId, deliverableId: id, versionNumber: 1, content: deliverable.content, changeDescription: 'Initial version', createdByAgentId: data.agentId ?? null, createdAt: now };
  this.deliverableVersions.set(vId, version);
  return deliverable;
}
async updateDeliverable(id: string, updates: Partial<Deliverable>): Promise<Deliverable | undefined> {
  const existing = this.deliverables.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date() };
  this.deliverables.set(id, updated);
  return updated;
}
```

**DatabaseStorage Drizzle impl pattern** (from `server/storage.ts:2159-2174`):
```typescript
async createDeliverable(data: InsertDeliverable): Promise<Deliverable> {
  const [row] = await db.insert(schema.deliverables).values(data as any).returning();
  await db.insert(schema.deliverableVersions).values({
    deliverableId: row.id, versionNumber: 1, content: row.content,
    changeDescription: 'Initial version', createdByAgentId: data.agentId ?? null,
  });
  return row;
}
async updateDeliverable(id: string, updates: Partial<Deliverable>): Promise<Deliverable | undefined> {
  const [row] = await db.update(schema.deliverables).set({ ...updates, updatedAt: new Date() }).where(eq(schema.deliverables.id, id)).returning();
  return row;
}
```

**Apply to Phase 36 — add to IStorage interface AND both impls:**
1. `acceptDeliverable(id: string): Promise<Deliverable | undefined>` — sets `userAcceptedAt = new Date()`, clears `dismissedAt = null`. Idempotent.
2. `dismissDeliverable(id: string): Promise<Deliverable | undefined>` — symmetric.
3. `recordImpression(id: string, userId: string): Promise<{ deliverable: Deliverable | undefined; deduped: boolean }>` — checks in-process `impressionDedupeMap: Map<string, number>` (key: `${id}:${userId}`); if within 5s of last fire → `{ deduped: true }`; else increment `impressionCount` by 1 via `updateDeliverable` with `sql\`${impressionCount} + 1\``-style increment.
4. `incrementEditsCount(id: string): Promise<Deliverable | undefined>` — called by `iterateDeliverable` on non-revert path only (CONTEXT D-19).
5. `getFinalizedDeliverableCountsForAgent(projectId: string, agentId: string): Promise<{ total: number; byType: Array<{ type: string; accepted: number; dismissed: number; iterated: number; total: number }> }>` — used by `deliverableFeedbackAggregator`. Query: `WHERE project_id = ? AND agent_id = ? AND status = 'complete'`, group by type, FILTER aggregates.

For MemStorage: iterate `this.deliverables.values()` in-memory.
For DatabaseStorage: use Drizzle `.select().from(...).where(...).groupBy(...)` or raw `sql\`...\`` template (allowed in storage layer per CLAUDE.md §14 "no raw SQL in application code" caveat — storage layer is the DB boundary).

---

### `server/ai/deliverableFeedbackAggregator.ts` (NEW — server-domain, CRUD + cache)

**Primary analog:** `server/llm/providerHealthState.ts` (whole file) — closest precedent for module-level in-process state with TTL semantics.
**Secondary analog:** `server/ai/tasks/organicExtractor.ts:23-42` — `cooldownMap: Map<string, number>` with prune-on-overflow.

**In-process state + window pattern** (from `server/llm/providerHealthState.ts:26-66`):
```typescript
const WINDOW_MS = 60_000;
const FAILURE_THRESHOLD = 3;
const DEFAULT_REASON = 'Agents are slow right now, hang tight';

let failureTimestamps: number[] = [];
let isDegraded = false;

function prune(now: number): void {
  const cutoff = now - WINDOW_MS;
  failureTimestamps = failureTimestamps.filter((ts) => ts >= cutoff);
}
```

**Cooldown Map pattern** (from `server/ai/tasks/organicExtractor.ts:23-42`):
```typescript
const COOLDOWN_MS = 30000;
const MAX_COOLDOWN_ENTRIES = 500;
const cooldownMap = new Map<string, number>();

function isInCooldown(conversationId: string): boolean {
  const last = cooldownMap.get(conversationId) || 0;
  return Date.now() - last < COOLDOWN_MS;
}

function markExtraction(conversationId: string): void {
  cooldownMap.set(conversationId, Date.now());
  if (cooldownMap.size > MAX_COOLDOWN_ENTRIES) {
    const now = Date.now();
    for (const [key, ts] of cooldownMap) {
      if (now - ts > COOLDOWN_MS) cooldownMap.delete(key);
    }
  }
}
```

**Apply to Phase 36 (per CONTEXT D-25, RESEARCH Q2):**
- `const CACHE_TTL_MS = 60_000;` + `const cache = new Map<string, { value: FeedbackSignal | null; expiresAt: number }>();` keyed by `${projectId}:${agentId}`.
- `export async function getRecentFeedbackSignal(projectId: string, agentId: string): Promise<FeedbackSignal | null>`:
  1. Check cache → if not expired, return cached value (including cached `null`).
  2. Call `storage.getFinalizedDeliverableCountsForAgent(projectId, agentId)`.
  3. If `total < 3` → cache `null` for TTL, return `null`.
  4. Else: build aggregate string (CONTEXT D-24), cache, return.
- Export `__resetCacheForTests()` for `scripts/test-feedback-signal.ts` — mirror `__resetForTests()` from `providerHealthState.ts:220-233`.

---

### `client/src/components/deliverable/RubricBreakdown.tsx` (NEW — client-component, request-response)

**Analog:** `client/src/components/ArtifactPanel.tsx:36-95` — closest example of a self-contained pure-presentation component reading `deliverable` data via TanStack Query.

**Component signature pattern** (from `client/src/components/ArtifactPanel.tsx:35-50`):
```typescript
interface ArtifactPanelProps {
  deliverableId: string;
  onClose: () => void;
}

export function ArtifactPanel({ deliverableId, onClose }: ArtifactPanelProps) {
  const queryClient = useQueryClient();
  // ...
  const { data: deliverableData, isLoading } = useQuery<{ deliverable: Deliverable }>({
    queryKey: ['/api/deliverables', deliverableId],
    enabled: !!deliverableId,
  });
```

**Apply to Phase 36:**
- Props: `interface RubricBreakdownProps { rubricScore: { total: number; breakdown: Array<{ criterion: string; score: number; justification: string }> } | null; rubricVersion: string | null; }`.
- Pure stateless component — NO TanStack Query, NO mutations. Renders a list of `{criterion: label, score: 0-10, justification: 1-sentence}` rows.
- Empty state: when `rubricScore === null`, render "No rubric score for this version yet." (handles pre-Phase-36 versions per Q3).
- Use existing Tailwind tokens: `hatchin-text`, `hatchin-text-muted`, `var(--hatchin-surface)`, `var(--hatchin-blue)` (per `ArtifactPanel.tsx:10-27`).
- No emojis, no icons in headers (project rule — only `lucide-react` icons where functional).

---

### `client/src/components/deliverable/AutoRevertBanner.tsx` (NEW — client-component, event-driven)

**Primary analog:** `client/src/components/legal/LegalModal.tsx` (whole file) — shadcn Dialog pattern (we will NOT use Dialog — banner is inline — but this confirms the local-state-only dismissal pattern).
**Secondary analog:** `client/src/components/ArtifactPanel.tsx:125-131` — Framer Motion entrance animation usable for slide-in.

**Framer entrance pattern** (from `client/src/components/ArtifactPanel.tsx:125-131`):
```typescript
<motion.div
  initial={{ width: 0, opacity: 0 }}
  animate={{ width: 480, opacity: 1 }}
  exit={{ width: 0, opacity: 0 }}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
  className="h-full min-h-0 premium-column-bg rounded-2xl flex flex-col my-2.5 overflow-hidden border border-[var(--hatchin-border-subtle)]"
>
```

**Apply to Phase 36 (per CONTEXT D-13..D-15):**
- Props: `interface AutoRevertBannerProps { oldScore: number; newScore: number; rejectedContent: string; rejectedBreakdown: Array<{ criterion: string; score: number; justification: string }>; onDismiss: () => void; }`.
- Inline `<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>` — slides down ABOVE deliverable content.
- Amber/warning style: `bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-900 dark:text-amber-100` (NOT a Dialog — explicitly non-blocking per CONTEXT D-13).
- Copy: `"Refinement made it worse, kept previous version. Click to see what changed."` (CONTEXT D-14 verbatim).
- Click expands `<details>` (or local `useState(expanded)`) showing rejected content + per-criterion breakdown via composed `<RubricBreakdown rubricScore={{ total: newScore, breakdown: rejectedBreakdown }} />`.
- Local `useState(dismissed)` → calls `props.onDismiss()` to remove from parent state (CONTEXT D-15: dismissal not persisted).

---

### `client/src/components/ArtifactPanel.tsx` (MOD — client-component, request-response)

**Analog:** self at lines 76-93 (`iterateMutation`), 59-74 (`restoreMutation`), 264-300 (footer button bar).

**TanStack mutation + onSuccess invalidation pattern** (from `client/src/components/ArtifactPanel.tsx:76-93`):
```typescript
const iterateMutation = useMutation({
  mutationFn: async (instruction: string) => {
    const res = await fetch(`/api/deliverables/${deliverableId}/iterate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction }),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to iterate');
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/deliverables', deliverableId] });
    queryClient.invalidateQueries({ queryKey: [`/api/deliverables/${deliverableId}/versions`] });
    setRefineInstruction('');
    setIsRefining(false);
  },
});
```

**Footer button pattern** (from `client/src/components/ArtifactPanel.tsx:264-300`):
```typescript
<div className="flex items-center gap-2">
  <button
    onClick={() => setIsRefining(!isRefining)}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] ${
      isRefining ? 'bg-[var(--hatchin-blue)] text-white' : 'bg-[var(--hatchin-surface)] hover:bg-[var(--hatchin-surface)]/80'
    }`}
  >
    <Pencil className="w-3.5 h-3.5" />
    Refine
  </button>
  <button onClick={handleCopy} className="...">
    {copied ? <Check className="w-3.5 h-3.5 text-[var(--hatchin-green)]" /> : <Copy className="w-3.5 h-3.5" />}
    {copied ? 'Copied' : 'Copy'}
  </button>
  // ...
</div>
```

**Apply to Phase 36:**
1. **Extend `iterateMutation.onSuccess`** to capture `reverted | oldScore | newScore` from response:
   ```typescript
   onSuccess: (data) => {
     queryClient.invalidateQueries({ queryKey: ['/api/deliverables', deliverableId] });
     queryClient.invalidateQueries({ queryKey: [`/api/deliverables/${deliverableId}/versions`] });
     if (data.reverted) {
       setRevertBannerData({ oldScore: data.oldScore.total, newScore: data.newScore.total, /* ... */ });
     } else {
       setRevertBannerData(null);
     }
     setRefineInstruction('');
     setIsRefining(false);
   },
   ```
2. **Add Accept/Dismiss mutations** — copy `iterateMutation` shape exactly, POST to `/api/deliverables/${id}/accept` and `/dismiss`. No body. Invalidate `['/api/deliverables', deliverableId]`.
3. **Add Accept/Dismiss buttons in footer button bar** — copy the `<button>` shape from the Refine button. Filled state when `deliverable.userAcceptedAt || deliverable.dismissedAt` is set (mutually exclusive per D-18). Icons: `lucide-react` `Check` for Accept, `X` for Dismiss.
4. **Add Rubric toggle button** in header (next to Status badge, lines 172-180): toggles `useState(showRubric)`. When open, renders `<RubricBreakdown />` below header consuming `deliverable.metadata?.rubricScore` (NOTE: this lives on the version row, not deliverable — fetch via `versionsData.versions.find(v => v.versionNumber === currentVersion).rubricScore`).
5. **Mount `<AutoRevertBanner />`** ABOVE content area (above line 215 `Content area`) when `revertBannerData !== null`. Wire `onDismiss={() => setRevertBannerData(null)}`.
6. **Impression-fire `useEffect`** (CONTEXT D-20 — the ONE allowed useEffect per RESEARCH §Constraints):
   ```typescript
   useEffect(() => {
     if (!deliverableId) return;
     fetch(`/api/deliverables/${deliverableId}/impression`, {
       method: 'POST', credentials: 'include',
     }).catch(() => { /* silent — non-critical */ });
   }, [deliverableId]); // deps array prevents re-fire on re-render
   ```

---

### `tests/e2e/phase-36-rubric-iteration.spec.ts` (NEW — test-e2e, request-response)

**Analog:** `tests/e2e/phase-35-production-hotfix.spec.ts` (whole file).

**Spec scaffolding pattern** (from `tests/e2e/phase-35-production-hotfix.spec.ts:25-66`):
```typescript
import { test, expect, type Page } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

async function forceOutage(page: Page, enabled: boolean): Promise<void> {
  const res = await page.request.post('/api/dev/force-outage', {
    data: { enabled },
    headers: { 'content-type': 'application/json' },
  });
  if (!res.ok()) {
    throw new Error(
      `force-outage POST failed: status=${res.status()} body=${await res.text()}`,
    );
  }
}

test.describe.serial('Phase 35 — Production Hotfix Pass', () => {
  test.setTimeout(60_000);

  test('1a — /legal/privacy deep-link page renders non-404 content', async ({ page }) => {
    await page.goto('/legal/privacy', { waitUntil: 'domcontentloaded' });
    // ...
  });
});
```

**Apply to Phase 36 (per CONTEXT D-27, 6 cases):**
- Use `test.describe.serial('Phase 36 — Frozen-Rubric Deliverable Iteration', () => { ... })`.
- Implement spec-local helper `forceJudgeScore(page, { recommendation, oldTotal, newTotal })` mirroring `forceOutage()` — POST to `/api/dev/force-judge-score`.
- 6 cases per CONTEXT D-27 — generate, iterate-neutral (kept), iterate-adversarial-via-force-judge (revert), accept, dismiss, impression-increment.
- For case 3 (revert): use `forceJudgeScore({ recommendation: 'revert', oldTotal: 8, newTotal: 5 })` BEFORE triggering iterate — deterministic without real LLM.
- Assert `AutoRevertBanner` visible via `page.getByText('Refinement made it worse').first()`.
- Reset between cases via spec-local `resetForcedScore(page)` helper.

---

### `scripts/test-rubric-scorer.ts` (NEW — test-unit, pure-function)

**Analog:** `scripts/test-provider-health-state.ts` (whole file).

**Test scaffolding pattern** (from `scripts/test-provider-health-state.ts:1-50`):
```typescript
#!/usr/bin/env tsx
import assert from 'node:assert/strict';
import {
  recordFailure, recordSuccess, getDegradedState, /* ... */
  __resetForTests,
} from '../server/llm/providerHealthState.js';

function freshSlate(): void {
  process.env.NODE_ENV = 'development';
  __resetForTests();
}

async function case1_threeFailuresTriggerDegraded(): Promise<void> {
  freshSlate();
  const r1 = recordFailure();
  // ...
  assert.equal(r3, true, 'case1: third failure within window should trigger degraded');
  console.log('PASS case1: 3 failures in 60s -> degraded');
}
```

**Apply to Phase 36 (per CONTEXT D-28):**
- Cases:
  1. `rubricScoreResultSchema.parse(...)` rejects malformed output (extra key, missing recommendation, score out of range).
  2. `recommendation === 'revert'` when `newScore.total < oldScore.total`.
  3. `recommendation === 'keep_new'` when equal (tie-break per D-09).
  4. Fail-open: when `generateWithPreferredProvider` throws → `scoreIteration` returns `{ recommendation: 'keep_new' }`.
  5. Deterministic criterion ordering: same rubric type always produces same `breakdown[].criterion` order.
- Mock LLM: monkey-patch `generateWithPreferredProvider` via dynamic import or stub via `__setForcedScoreForTests` (the same hook the DEV-only endpoint uses).
- Production-guard mirror test: `__setForcedScoreForTests` throws FATAL in production (copy case6 pattern from `test-provider-health-state.ts:107-120`).

---

### `scripts/test-feedback-signal.ts` (NEW — test-unit, pure-function)

**Analog:** `scripts/test-provider-health-state.ts` (case-based asserts).

**Apply to Phase 36 (per CONTEXT D-29):**
- Cases:
  1. **Below threshold:** seed 2 finalized deliverables for `(projectId, agentId)` via direct storage calls → assert `getRecentFeedbackSignal(...)` returns `null`.
  2. **At threshold:** seed 3 → assert returns non-null with `total: 3` and correct accepted/dismissed counts.
  3. **Cache hit:** call twice within 60s with same args → assert second call did NOT hit storage (use a counter wrapper).
  4. **Prompt snapshot:** call `buildSystemPrompt` (or equivalent test harness) with seeded data → assert `systemPrompt.includes('--- RECENT FEEDBACK ON YOUR WORK (this project) ---')` for ≥3 case AND `!systemPrompt.includes('RECENT FEEDBACK')` for <3 case.
- Use `__resetCacheForTests()` between cases (exported from `deliverableFeedbackAggregator.ts`).

---

### `playwright.config.ts` (MOD — config)

**Analog:** self at lines 72-81 — the `phase-35` project entry.

**Phase-N project entry pattern** (from `playwright.config.ts:68-81`):
```typescript
// Phase 35 production hotfix smoke — LEGAL-01 + LLMUX-02/03 + AUDIT-01.
// Needs authenticated session for cases 3-4 (ensureAppLoaded → chat page).
// Cases 3-4 exercise the WS round-trip path so we give it the same 2-min
// budget as chromium-ai. Cases 1a-2c are fast page loads.
{
  name: 'phase-35',
  use: {
    ...devices['Desktop Chrome'],
    storageState: 'tests/e2e/.auth/session.json',
  },
  dependencies: ['setup'],
  testMatch: /phase-35-production-hotfix\.spec\.ts/,
  timeout: 120000,
},
```

**Apply to Phase 36 — add a sibling entry** in the `projects` array (just after phase-35):
```typescript
{
  name: 'phase-36',
  use: {
    ...devices['Desktop Chrome'],
    storageState: 'tests/e2e/.auth/session.json',
  },
  dependencies: ['setup'],
  testMatch: /phase-36-rubric-iteration\.spec\.ts/,
  timeout: 120000,
},
```

---

### `shared/dto/apiSchemas.ts` (MOD — shared-validation, transform)

**Analog:** `shared/dto/wsSchemas.ts:14-39` — `.strict()`-able z.object pattern from Phase 35.

**Strict schema pattern** (from `shared/dto/wsSchemas.ts:14-39`):
```typescript
const sendMessageSchema = z.object({
  type: z.literal('send_message'),
  conversationId: z.string().min(1),
  message: z.object({
    conversationId: z.string().optional(),
    userId: z.string().optional(),
    agentId: z.string().optional(),
    content: z.string().min(1),
    messageType: z.enum(['user', 'agent', 'system']).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});
```

**Apply to Phase 36 (per RESEARCH §Pattern 2 + CONTEXT D-08):**
- Export `iterateDeliverableResponseSchema` matching the new server response shape:
  ```typescript
  export const iterateDeliverableResponseSchema = z.object({
    deliverable: z.object({ /* ... existing Deliverable shape */ }).passthrough(),
    reverted: z.boolean(),
    oldScore: versionScoreSchema.optional(),
    newScore: versionScoreSchema.optional(),
  }).strict();
  ```
- `.strict()` is mandatory per Phase 35 T-35-01 mitigation (CONTEXT "prior decisions").
- Co-locate `rubricScoreResultSchema` here OR re-export from `server/ai/rubricScorer.ts` (planner choice — RESEARCH §Pattern 2 lines 360-376 defines it inside the scorer file).

---

## Shared Patterns

### Auth / Ownership (apply to ALL new server routes)
**Source:** `server/routes/deliverables.ts:38-44`
**Apply to:** `POST /api/deliverables/:id/accept`, `POST /:id/dismiss`, `POST /:id/impression`
```typescript
const getSessionUserId = (req: Request): string => (req.session as any).userId as string;
const getOwnedProject = async (projectId: string, userId: string) => {
  const project = await storage.getProject(projectId);
  if (!project) return null;
  return (project as any).userId === userId ? project : null;
};
// Per-route:
const userId = getSessionUserId(req);
if (!userId) return res.status(401).json({ error: 'Unauthorized' });
const deliverable = await storage.getDeliverable(req.params.id);
if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });
const project = await getOwnedProject(deliverable.projectId, userId);
if (!project) return res.status(404).json({ error: 'Deliverable not found' });
```

### Zod `.strict()` discipline (apply to ALL new schemas)
**Source:** `shared/dto/wsSchemas.ts` (Phase 35 T-35-01 pattern, see CONTEXT prior decisions)
**Apply to:** `rubricSchema`, `rubricCriterionSchema`, `rubricScoreResultSchema`, `versionScoreSchema`, `criterionScoreSchema`, `iterateDeliverableResponseSchema`, request bodies for accept/dismiss/impression/force-judge-score.
- Every new `z.object({...})` must have `.strict()` appended (or `.passthrough()` only when intentional).
- `rubricSchema` adds `.refine(weights-sum-to-1.0)` per RESEARCH §Pattern 1.

### DEV-only endpoint guard (apply to force-judge-score)
**Source:** `server/routes/health.ts:109-110` + `server/llm/providerHealthState.ts:109-117`
**Apply to:** `POST /api/dev/force-judge-score` AND its underlying module-level setter `__setForcedScoreForTests`.
- Handler: `if (process.env.NODE_ENV === 'production') return res.status(404).send();` (defence in depth).
- Helper: `throw new Error('FATAL: __setForcedScoreForTests called in production. ...')` when `NODE_ENV === 'production'`.
- `console.warn` on every successful call so the dev-server log makes the action visible.

### In-process state + TTL (apply to feedback aggregator AND impression dedupe)
**Source:** `server/llm/providerHealthState.ts:30-91` + `server/ai/tasks/organicExtractor.ts:23-42`
**Apply to:** `deliverableFeedbackAggregator.ts` (60s TTL), `storage.recordImpression` (5s dedupe).
- Module-scope `Map<string, { value, expiresAt }>`.
- Prune-on-overflow safety: `if (map.size > MAX_ENTRIES) { for ([k, v] of map) if (now > v.expiresAt) map.delete(k); }`.
- Export `__resetCacheForTests()` (NODE_ENV-guarded) for unit tests.

### TanStack Query mutation invalidation (apply to all new client mutations)
**Source:** `client/src/components/ArtifactPanel.tsx:76-93`
**Apply to:** Accept mutation, Dismiss mutation in ArtifactPanel.
```typescript
const acceptMutation = useMutation({
  mutationFn: async () => {
    const res = await fetch(`/api/deliverables/${deliverableId}/accept`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to accept');
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/deliverables', deliverableId] });
  },
});
```

### Storage helper dual-impl (apply to ALL new storage methods)
**Source:** `server/storage.ts:197-211` (IStorage) + 1410-1453 (Mem) + 2152-2193 (DB)
**Apply to:** `acceptDeliverable`, `dismissDeliverable`, `recordImpression`, `incrementEditsCount`, `getFinalizedDeliverableCountsForAgent`.
- Add interface signature at `server/storage.ts:197-211` block.
- Implement in `MemStorage` using `this.deliverables.get(id)` / `.set(id, ...)` pattern.
- Implement in `DatabaseStorage` using Drizzle `db.update(schema.deliverables).set({...}).where(eq(...)).returning()` pattern.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | All Phase 36 files have at least a role-match analog in the codebase. The closest gap is the `AutoRevertBanner` inline-banner pattern — there is no prior inline-warning-banner-with-expandable-detail in the codebase, but `LegalModal` (shadcn) + `ArtifactPanel` (Framer entrance) together cover the constituent patterns. |

---

## Metadata

**Analog search scope:** `shared/`, `server/ai/`, `server/routes/`, `server/llm/`, `server/storage.ts`, `client/src/components/`, `client/src/components/legal/`, `tests/e2e/`, `scripts/`, `playwright.config.ts`.
**Files scanned:** 17 directly read; cross-referenced via grep with ≥40 file matches across schema, routes, storage, prompt assembly, WS schemas, tests.
**Pattern extraction date:** 2026-05-11

**Key cross-cutting patterns identified:**
1. **All controllers use** `getSessionUserId(req)` + `getOwnedProject(projectId, userId)` for auth/ownership — copied wholesale to all 3 new endpoints + the modified iterate endpoint.
2. **All new Zod schemas use `.strict()`** per Phase 35 T-35-01 mitigation (carried-forward decision).
3. **All in-process state modules** export `__resetForTests()` (or `__resetCacheForTests`) with `NODE_ENV` production guard — mirrors `providerHealthState.ts` invariant.
4. **All storage additions** require triple-edit: IStorage interface + MemStorage impl + DatabaseStorage impl.
5. **All DEV-only endpoints** double-guard: handler returns 404 in production AND underlying module helper throws FATAL.
6. **All TanStack mutations** invalidate the relevant `queryKey` array in `onSuccess`.
7. **All prompt sections** in `openaiService.ts` use the `let xSection = ''; try { ... if (...) xSection = '\n--- HEADER ---\n${...}\n--- END HEADER ---'; } catch {}` shape — preserves graceful degradation when the underlying query fails.

## PATTERN MAPPING COMPLETE

**Phase:** 36 — Frozen-Rubric Deliverable Iteration
**Files classified:** 17
**Analogs found:** 17 / 17 (13 exact, 4 role-match)

### Coverage
- Files with exact analog: 13
- Files with role-match analog: 4
- Files with no analog: 0

### Key Patterns Identified
- All new server routes follow `getSessionUserId` + `getOwnedProject` ownership-check pattern from `server/routes/deliverables.ts:38-44`
- All new server LLM calls follow Groq-preferred + Zod-strict pattern from `server/ai/conversationCompactor.ts:116-133` + `tasks/organicExtractor.ts:44-54`
- All new client components extend `ArtifactPanel.tsx` either by composition (RubricBreakdown, AutoRevertBanner) or in-place modification (Accept/Dismiss/impression-fire) — single host surface
- All new storage methods follow the triple-edit pattern (IStorage interface + MemStorage Map-based + DatabaseStorage Drizzle) per `server/storage.ts:197-211 / 1410-1453 / 2152-2193`
- All new in-process state modules mirror `providerHealthState.ts` (Phase 35 analog) with `__resetForTests()` + production-guard invariant — covers feedback cache AND impression dedupe
- The DEV-only `force-judge-score` endpoint follows the exact `force-outage` / `force-recovery` template from Phase 35 (`server/routes/health.ts:107-150`)
- Playwright spec mirrors `phase-35-production-hotfix.spec.ts` template + adds `phase-36` project entry in `playwright.config.ts:72-81` style

### File Created
`/Users/shashankrai/Documents/hatching-mvp-5th-march/.planning/phases/36-frozen-rubric-deliverable-iteration/36-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns with concrete file:line citations in each Phase 36 plan (36-01 Foundation, 36-02 Server scoring, 36-03 Client UI, 36-04 Agent prompt signal).
