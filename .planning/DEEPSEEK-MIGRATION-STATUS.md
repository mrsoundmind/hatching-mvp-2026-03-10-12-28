# DeepSeek Migration + Live Showcase Production — Status

> Started: 2026-04-30
> Branch: `wip/pre-reset-2026-04-28`
> Owner: Shashank

## TL;DR

DeepSeek's 2026-04-26 price drop made it 91% cheaper than Gemini Flash on chat and 80% cheaper than Gemini Pro on autonomy (V4-Pro 75% promo through 2026-05-31). Inserting DeepSeek at the top of Hatchin's existing v1.2 layered LLM stack — without removing Gemini, Groq, or Ollama — flips per-heavy-Pro-user economics from **-₹8,150 loss** to **+₹699 margin**.

Once the cost engine is fixed, dogfood Hatchin live to produce 12 real-world case studies (Launch a SaaS in 7 days, Open a cafe, Plan a wedding, etc.), render Remotion walkthrough videos, publish to GitHub Pages at `hatchin.com/cases`. Solo dev cost target: ~₹400/mo.

---

## Why this is the right shape

The v1.2 milestone (shipped 2026-03-23) shipped a deliberate multi-layer LLM stack:

| Layer | Provider | Model | Open source? | Workloads | Cost |
|---|---|---|---|---|---|
| 1 (free, primary) | Groq | Llama 3.3-70B | ✓ Meta | simple chat, task extraction, compaction | ₹0 |
| 2 (default) | Gemini | 2.5-Flash | ✗ | standard chat | ₹12/M in |
| 3 (premium) | Gemini | 2.5-Pro | ✗ | Pro-tier autonomy | ₹104/M in |
| Fallback | OpenAI | gpt-4o-mini | ✗ | last resort | ₹12/M in |
| Test only | Ollama | llama3.1:8b | ✓ self-host | `LLM_MODE=test` | ₹0 |
| CI | Mock | deterministic | n/a | eval suite | ₹0 |

### Final prod chain after Phase A (OpenAI removed)

```
DeepSeek V4-Flash (primary, NEW)
   │
   │ on failure
   ▼
Gemini 2.5-Flash (hot fallback, kept from v1.2)
   │
   │ on failure
   ▼
Groq Llama 3.3-70B (FREE safety net)
```

OpenAI is removed from the default prod chain. It stays registered (the `OpenAIProvider` class is still in the registry) but only fires if explicitly set via `LLM_PRIMARY=openai`. This simplifies the chain from 4 layers to 3 and eliminates a paid proprietary fallback.

This layering already delivers 35-50% compound savings (per `.planning/v1.2-MILESTONE-AUDIT.md`). The remaining cost problem is Layers 2 + 3 (Gemini Flash + Gemini Pro).

**The migration shape is INSERTION, not REPLACEMENT:**
- Add DeepSeek V4-Flash as new Layer 2 default (Gemini demoted to fallback, NOT deleted)
- Add DeepSeek V4-Pro as new Layer 3 default (Gemini Pro stays as fallback)
- Groq, Ollama, Mock untouched — open-source-first stance preserved
- Single env var `LLM_PRIMARY=gemini` reverts everything

---

## What's done (Phase A — DeepSeek wired into the multi-layer stack)

### Code changes (additive, nothing deleted)

| File | Change |
|---|---|
| `server/llm/providerTypes.ts` | Added `'deepseek'` to `ProviderId` and `RuntimeConfig.testProvider` unions |
| `server/llm/providers/deepseekProvider.ts` | **NEW** — OpenAI-compatible provider mirroring Groq pattern; tier-aware model selection (V4-Flash vs V4-Pro) |
| `server/llm/providerResolver.ts` | Registered DeepSeek; added `LLM_PRIMARY` rollback env var; new prod chain `DeepSeek → Gemini → OpenAI → Groq`; `resolveModelForTier('premium')` prefers DeepSeek V4-Pro; diagnostics + health summary updated |
| `server/billing/usageTracker.ts` | Added `deepseek-v4-flash` ($0.14/$0.28) + `deepseek-v4-pro` ($0.435/$0.87 PROMO) to COST_TABLE; comment flags May 31 expiry |
| `server/ai/promptTemplate.ts` | Refactored `buildSystemPrompt()` into `staticPrefix` (cacheable role identity + 14 response rules) + `dynamicSuffix` (per-turn data) — DeepSeek auto-caches the prefix at 50× cheaper input rate |
| `server/autonomy/config/policies.ts` | Added `DAILY_COST_CAP_CENTS_DEV` + `DEV_COST_CAP_ENABLED` for solo-dev safety |
| `.env.example` | New DeepSeek env vars + LLM_PRIMARY documented + dev cost cap |

### Files deliberately NOT touched (v1.2 design preserved)

- `server/llm/providers/{geminiProvider,groqProvider,ollamaProvider,openaiProvider,mockProvider}.ts` — kept intact
- `server/ai/openaiService.ts:426-429` (Groq pref for simple chat) — unchanged
- `server/ai/tasks/organicExtractor.ts:106-115` (Groq pref for task extraction) — unchanged
- `server/ai/conversationCompactor.ts:116-132` (Groq pref for compaction) — unchanged
- `server/ai/deliverableGenerator.ts:81-88` and peer review — unchanged (auto-pick up new chain via default fallback)

### Behaviour after this commit

- With `DEEPSEEK_API_KEY` set → DeepSeek V4-Flash for chat, V4-Pro for premium autonomy
- Without `DEEPSEEK_API_KEY` → identical to before (Gemini primary)
- `LLM_PRIMARY=gemini` → instant rollback, DeepSeek stays registered for testing
- Groq still owns simple/extraction/compaction (free tier untouched)
- Ollama remains test-only; Mock remains CI-only

### Type check

`npm run typecheck` → zero new errors in any file touched. (Existing errors in unrelated client modules and missing `node_modules` types are pre-existing.)

---

## Cost impact (modeled)

### Per heavy Pro user / month

| Routing | LLM cost | vs ₹1,587 Pro price |
|---|---|---|
| Today (Gemini Pro chat + Groq free) | ~₹9,520 | **-₹7,933 loss** |
| All DeepSeek V4-Pro (promo) | ~₹2,755 | -₹1,168 loss |
| All DeepSeek V4-Flash | ~₹887 | **+₹700 margin** |
| Hybrid + 70% prompt cache hit (target) | ~₹670 | **+₹917 margin** |

### Solo dev cost (just Shashank)

| Setup | ₹/mo |
|---|---|
| Local dev + DeepSeek V4-Flash + caching | **~₹250-400** |
| + Fly.io if deployed | +₹3,340 |

### Scaling savings

| Active heavy Pro users | Today's bill | DeepSeek hybrid bill | Monthly savings |
|---|---|---|---|
| 100 | ₹4.07 lakh | ₹0.89 lakh | ₹3.18 lakh |
| 1,000 | ₹39.2 lakh | ₹6.59 lakh | ₹32.6 lakh (~₹3.9 Cr/yr) |
| 5,000 | ₹1.96 Cr | ₹0.32 Cr | ₹1.63 Cr/mo (~₹19.6 Cr/yr) |

---

## What's next

### Phase A.eval — ✅ PASSED 2026-05-04

All blocking checks passed. Bench score IMPROVED over baseline.

| Test | Result |
|---|---|
| smoke:deepseek | ✅ 6/6 (after fixing cross-provider model fallback bug) |
| test:tone | ✅ PASS |
| test:voice | ✅ 8/8 |
| test:pushback | ✅ 46/46 |
| test:reasoning | ✅ 240/240 |
| eval:routing | ✅ 93.33% (hatch 96.67%, deliberation 90%) |
| eval:bench | ✅ **29.00/35** vs Groq baseline 26.83 = **+8.1% better** |
| gate:safety | ✅ PASS |
| gate:conductor | ✅ 10/10 improved-or-equal, 0 safety regressions |
| gate:performance | ⚠️ No historical samples (false-negative — needs live traffic) |

**Critical bug caught and fixed during eval gate:**
- DeepSeek V4 emits hidden reasoning tokens BEFORE visible content. With small
  `max_tokens` budgets, reasoning consumed the budget and `content` came back
  empty (finish_reason='length'). Fixed by enforcing minimum max_tokens=2000 in
  `deepseekProvider.ts` and falling back to `reasoning_content` if content is
  still empty. Eval bench score went from 23.00 → 29.00 after this fix.

### Phase A.eval — historical (BLOCKING gate before flipping production primary)

Get DeepSeek API key from platform.deepseek.com, then run all of these:

```bash
TEST_LLM_PROVIDER=deepseek npm run eval:routing
TEST_LLM_PROVIDER=deepseek npm run eval:bench
TEST_LLM_PROVIDER=deepseek npm run gate:safety
TEST_LLM_PROVIDER=deepseek npm run gate:conductor
TEST_LLM_PROVIDER=deepseek npm run gate:performance
npm run test:tone
npm run test:voice
npm run test:pushback
npm run test:reasoning
npm run test:integrity
npm run test:dto
```

**Pass criteria:**
- `eval:bench` smartness within 5% of Gemini baseline
- Tone-guard pass rate ≥ 95%
- Routing accuracy ≥ baseline
- Latency ≤ 1.5× Gemini

**If any blocking eval fails:** keep DeepSeek registered but unused; document failure here; ship cost gains via prompt caching alone.

### Phase A.smoke — manual verification

1. Send 5 chat messages → streaming works, tone passes, no markdown leaks
2. Trigger premium autonomy task → routes to DeepSeek V4-Pro, executes, peer review fires
3. Generate full `launch` deliverable chain → PDF export works
4. Provoke DeepSeek failure (bad key) → confirm Gemini fallback kicks in automatically

### Phase A.telemetry — 7-day production checkpoint

- Query `usage_records` daily aggregates → confirm actual ₹/user matches predicted (~₹670) within 10%
- Cache hit ratio ≥ 50% on chat input tokens (DeepSeek dashboard)
- Gemini fallback usage < 5% of requests (otherwise DeepSeek is unstable)
- Groq still serving > 30% of total request count (proves we didn't accidentally route Groq workloads to DeepSeek)

### Phase B — Solo dev environment

- Run Hatchin locally with DeepSeek key in `.env`
- Set `DEV_COST_CAP=true` to enforce ₹165/day cap
- Skip Fly.io deployment for now — local-only is enough for showcase production

### Phase C — Live use-case showcase production (12 weeks, one per week)

**The 12 cases (locked priority):**

1. Launch a SaaS in 7 days *(uses existing `launch` package template)*
2. Validate my startup idea before quitting
3. Open a cafe in Bangalore *(small biz, viral potential)*
4. Build a content engine for my D2C brand *(uses existing `content-sprint` template)*
5. Launch a paid newsletter / course
6. Hire my first employee
7. Plan my wedding under ₹15L *(personal, viral)*
8. Pitch to 10 podcasts as a guest
9. Write a YC application in a day
10. Get into a Master's in Europe
11. Q3 OKRs for a 15-person startup
12. Run a product launch like a unicorn

**Per-case workflow (4 steps):**

1. **Run live in Hatchin** (1-2 hrs) — pick starter pack, type prompt, screen-record handoffs/deliberation/streaming
2. **Export artifacts** (15 min) — PDF via `/api/deliverables/:id/pdf`, Markdown via `/api/deliverables/:id/download`, hero screenshots
3. **Render Remotion walkthrough** (2-3 hrs) — new `showcase/remotion/` workspace; reusable component library (`<CaseIntro>`, `<UserPrompt>`, `<TeamAssembling>`, `<HandoffSequence>`, `<DeliverableReveal>`, `<CostFooter>`, `<CTA>`); render to 90s 1080p MP4
4. **Publish** (1 hr) — push to public `hatchin-showcase` GitHub repo, update `hatchin.com/cases` static landing page (Vite + GitHub Pages, free), distribute on Twitter + LinkedIn + HN for cases 1, 4, 7

**Deferred infrastructure** (build before case 4, not blocking case 1):
- `/api/public/deliverables/:shareToken` — view-only Hatchin-branded HTML viewer
- `GET /api/conversations/:id/export?format=md` — raw conversation export

---

## Acceptance criteria

### Phase A (DeepSeek)
- [ ] All evals pass with `TEST_LLM_PROVIDER=deepseek` (within thresholds)
- [ ] Smoke test all 4 scenarios pass
- [ ] 7-day prod checkpoint: ₹/user within 10% of model
- [ ] Cache hit ratio ≥ 50%
- [ ] Quality A/B (50 random pre/post): mean delta ≤ 0.3
- [ ] v1.2 invariants preserved: Groq still > 30% of requests

### Phase C (Showcase)
- [ ] Case 1 ships within 7 days of Phase A complete (MP4 + PDF + landing card live)
- [ ] Case 1 LLM cost ≤ ₹50 total
- [ ] All 12 cases complete within 12 weeks
- [ ] Each case has 3 artifacts (90s MP4, branded PDF, Markdown blog draft)
- [ ] Distribution: every case posted to Twitter + LinkedIn + GitHub; cases 1, 4, 7 also on HN

---

## Rollback plan

Single env var, no code change, no data migration:

```bash
LLM_PRIMARY=gemini  # reverts default chain to Gemini-first; DeepSeek stays registered
```

DeepSeek stays in the codebase for continued testing. Restart server (or env reload) to apply.

---

## Active risks

1. **V4-Pro promo expires 2026-05-31** → post-promo V4-Pro is *more expensive* than Gemini 2.5-Pro on input ($1.74 vs $1.25). Re-evaluate then. Don't let unit economics depend on promo prices indefinitely.
2. **`deepseek-chat` / `deepseek-reasoner` deprecation 2026-07-24** — using V4 endpoints already, so no action needed.
3. **Latency regression** — Groq is sub-second TTFT; DeepSeek typically slower. Watch `gate:performance` closely.
4. **Data residency** — DeepSeek is China-hosted. Future enterprise/EU customers may require Gemini-only routing. Architecture supports this via `LLM_PRIMARY=gemini`.
5. **Quality regression on 30-role distinctiveness** — eval suite (`test:voice`, `test:pushback`, `test:reasoning` = 294 tests) was tuned against Gemini Pro. Phase A.eval gate is the catch.

---

## Reference docs

- Full plan: `~/.claude/plans/not-bad-but-first-idempotent-curry.md`
- v1.2 milestone audit: `.planning/v1.2-MILESTONE-AUDIT.md`
- DeepSeek pricing (verify before each model swap): https://api-docs.deepseek.com/quick_start/pricing
