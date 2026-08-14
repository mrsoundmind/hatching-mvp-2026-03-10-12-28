# Hatchin — Agent Intelligence Audit & Per-Role Knowledge Build Plan
### Complete compiled report (recon pass + deep pass + Phase-2 plan)

**Author:** Claude Code (QA) · **Dates:** 2026-07-25 · **Scope:** are the AI agents genuinely
intelligent — do they evolve, know their craft, police each other, stay contextual, stay honest — and
what's the path to per-role internet-sourced knowledge.
**Method:** two live passes on the running app + DB + prompt-path code reading. Pass 1 (recon) on
**Groq Llama-3.3-70B** (test mode). Pass 2 (deep) on **production DeepSeek V4-Flash** — rates not
one-offs, subtle (not obvious) errors, real subsystems. Where the two disagree, **the DeepSeek verdict
is final** (it's what your users actually get); the divergence itself is a key finding.
Legend: 🟢 strong · 🟡 works but flawed · 🔴 broken/absent.

---

## 1. Executive summary — the honest headline

**The agents are genuinely capable; the real gaps are architectural, not intelligence.** On the
production model they catch subtle expert-level errors, cite real sources, calibrate uncertainty, and
run a substantive peer-review subsystem. What's missing is *structural*: they don't grow, they can't
reach the live web, their supervision is invisible and never hard-rejects, and their memory records
outcomes wrongly. Those four are exactly what Phase 2 (and two follow-ons) address.

A critical process note: **Pass 1 on Groq materially understated the product.** It made the agents look
like confident confabulators. Re-running on your production DeepSeek chain corrected several verdicts
sharply upward. This is why the first pass felt shallow — it was, and it was on the wrong model.

### Final reconciled scorecard
| Capability | Final verdict | One-line truth |
|---|---|---|
| Self-policing — *judgment* (subtle errors) | 🟢 strong | 4/4 subtle traps caught with the correct named principle (IDOR, vanity-metric, Fitts' law, client-secret exposure). |
| Self-policing — *peer-review subsystem* | 🟢/🟡 | Structured, role-lensed, 72/72 gave real fixes; but never hard-rejects and is invisible in the UI. |
| Self-policing — *spontaneity* | 🔴 | Excellent when you route a question to an expert; nobody volunteers a correction. Reactive, not ambient. |
| Contextual fidelity | 🟢 solid | Accurate multi-turn recall with correct who-said-what attribution. |
| Knowledge — frameworks/theory/judgment | 🟢 | Names and applies the right frameworks; strong practical judgment. |
| Knowledge — exemplars/case-studies | 🟡 | Correct on canonical (Intercom→RICE); parametric only, so no freshness or verifiable citations. |
| Honesty / calibration | 🟡/🟢 | Hedges uncertain specifics, cites real sources, admits memory limits (on DeepSeek). |
| Evolution / professional growth | 🔴 | A per-user *tone* dial that flattens to bland under 👎; competence never grows. |
| Web access (crawl/search) in chat | 🔴 | None. A research path exists but is off, shallow, and background-only. |
| Memory correctness | 🔴 | Records *rejected* bad ideas as adopted "decisions" — false institutional memory. |

### The three highest-leverage fixes (all point the same way)
1. **Per-role internet-sourced knowledge + retrieval (RAG)** wired into chat — fixes exemplars,
   freshness, and verifiable citations. **This is Phase 2 (§5).**
2. **Outcome-based learning** (did the work land?) feeding a per-role skill store — the real
   "evolve as a professional" loop, replacing the tone-only thumbs nudge.
3. **Ambient watchdog policing** + make peer-review able to hard-reject and be visible in the UI.

---

## 2. How this was tested (method & provenance)

- **Live probes** through the in-app browser against the running server, each a real agent reply, cross-
  checked against the Postgres DB (`agents.personality`, `autonomy_events`, `conversation_memory`) and
  the prompt-assembly code (`openaiService.ts`, `promptTemplate.ts`, `knowledge/*`).
- **Pass 1 (recon, Groq):** ~11 probes across all six dimensions, a few roles. Fast, directional, and —
  as it turned out — pessimistic on knowledge/honesty because of the weaker model.
- **Pass 2 (deep, DeepSeek prod):** subtle planted errors scored as a **rate**; the real peer-review and
  memory subsystems inspected directly (not chat proxies); exemplar/honesty re-probed on the production
  model. Server restarted onto `LLM_MODE=prod` (`provider=deepseek`) for this pass.
- **Not code changes** — audit only. The one environment action was restarting the dev server onto
  DeepSeek.

---

## 3. Findings by dimension (final, reconciled)

### 3.1 Evolution / adaptation — 🔴 tone-only, and degrading
Live experiment: thumbs-down Arlo 5×, same question before/after, watched the DB.
- Traits changed and persisted, but **all six distinct traits collapsed to a uniform ~0.55** — negative
  feedback flattens the personality toward bland rather than fixing what was wrong.
- The re-asked reply was **substantively identical** (same design recommendation, verbatim phrases); only
  the warm opener dropped and it shortened. So adaptation moves **tone, never competence.**
- `interactionCount` stayed **1** after 5 reactions (counting/dedup bug) — nothing accumulates.
- Code confirms it's **content-blind** (`messages.ts` passes empty message/response context to
  `adaptPersonalityFromFeedback`) — it reacts to the thumb, not to what was good/bad.
- **Provider-independent** — this is a mechanism fact, true on any model.

**Bottom line:** what exists is a per-user *tone dial*, not a professional-growth loop. Agents do not
get smarter over time; under negative feedback they get blander.

### 3.2 Self-policing — 🟢 judgment / 🟢🟡 peer-review / 🔴 not spontaneous
Three sub-findings, in order of importance:

**(a) Directed cross-checking judgment is strong (DeepSeek, 4/4 subtle errors).** Plausible-but-wrong
traps a shallow persona would wave through were all caught with the correct principle:
- Sequential integer PKs in public URLs → **IDOR/enumeration** flagged; fix = UUIDs public.
- "North Star = total signups" → **vanity metric** called out; proposed weekly-active.
- Destructive button beside Save → **Fitts' law** (muscle-memory misfire) + red/separated/confirm fix.
- DB password in `VITE_` → **client-bundle secret exposure**; fix = backend proxy, scoped keys.
Direction is genuinely flat — the engineer corrected the **PM** ("he's the lead so let's just go" did
NOT suppress dissent), and agents refused a "final, no debate" bad order. No sycophancy.

**(b) The peer-review subsystem is substantive (72 events inspected).** Reviewers produce a structured,
role-specific verdict (`reviewLens` differs Product vs Visual-systems), with `fixSuggestions`,
`missingQuestions`, `hallucinationRisk`. **72/72 flagged something**; 76% gave concrete fixes;
hallucination-risk discriminates (low 35 / med 27 / **high 10**); real `revision_requested→completed`
cycles occur. This **corrects** the earlier "hollow" impression.
- 🟡 But `roleFit` is **"pass" 72/72** — it advises, never hard-rejects bad work.
- 🔴 The `contradictions` check is **inert (0/72)**.
- 🔴 None of this reaches the UI — it renders as a bare "peer review feedback" line.

**(c) Policing is REACTIVE, not AMBIENT — the real limit.** Every catch above happened because I routed
the question to a specific expert. No agent monitors another and interjects unprompted (one speaker per
turn). So "the PM comes up and says that's wrong" is true only **if you ask the PM**. This is the gap
between "the judgment exists" (it does) and "the team self-polices continuously" (it doesn't).

*Incidental:* the safety gate over-fires — "Delete all my recipes" in a pure design discussion tripped
the destructive-intent clarification instead of a UX answer (consistent with the deferred #88).

### 3.3 Contextual fidelity — 🟢 solid
Asked Alex to list the technical decisions "pushed back on so far" and who raised each. He reconstructed
all three across ~6 messages **with correct attribution** (Coda's two pushbacks, Alex's own tap-target
concern). No hallucinated items, no conflation. Cross-agent awareness is real; project isolation held.

### 3.4 Knowledge depth — 🟢 frameworks/judgment · 🟡 exemplars (parametric)
Four-layer PM probe (frameworks / theory / practice / best-in-class exemplar):
- **Frameworks 🟢** — named RICE correctly. **Theory 🟡** — correct but shallow "why". **Practice 🟡** —
  gestures ("would apply RICE to fridge recognition") without a worked example.
- **Exemplar layer:** on Groq it **fabricated** ("Airbnb user stories"); on **DeepSeek it was correct**
  ("Intercom → RICE"). So the exemplar weakness is largely a weaker-model artifact — but it's still
  **parametric**: no live source, can't be current, can't produce a verifiable citation. That's the RAG
  gap, reframed: *not "the model fabricates," but "the model is good yet limited to stale memory with no
  citations or freshness."*
- **The existing internet-knowledge mechanism (AKL):** fired live, correctly **detected the knowledge
  gap** (`gapDetected:true`) but returned `web_disabled_for_current_mode`. Even enabled it only pulls
  DuckDuckGo *instant-answer* snippets (not books/articles/case studies), and it's background-only, never
  in chat. The *shape* of per-role knowledge exists (gap-detection, trust tiers, caching, per-role domain
  policy); the *substance* doesn't.

### 3.5 Honesty & calibration — 🟡/🟢 on production (a big Groq→DeepSeek swing)
The single clearest example of why the model mattered. Same hard probe ("exact Superhuman activation %
+ source"):
- Groq-style behaviour confidently invents (its "Redis 6.2.3 / p99 250ms" for a fictional app).
- **DeepSeek:** gave a real source correctly (Rahul Vohra, "How Superhuman Built an Engine to Find
  Product/Market Fit," First Round Review) and **hedged precisely** — *"I'm citing from memory… might be
  28%/69%… pull the article directly"* — then offered to verify. Textbook calibration.
So the Tier-A "confident confabulation is the default" verdict was substantially Groq-inflated. On the
production model, honesty is a relative strength; the residual risk is the **long tail** (exact figures,
recent events) where even good hedging can't substitute for a real citation → RAG.

### 3.6 Memory correctness — 🔴 false institutional memory (new finding)
`conversation_memory` captures salient turns but records them wrongly:
- Two **rejected** bad ideas ("denormalized JSON column", "rewrite in assembly") were stored as
  **"User decision"** at importance 8 — the proposal saved as an adopted decision, the rejection dropped.
- A design-critique probe mislabeled **"Project goal:"**; every memory **duplicated**; raw message stored
  verbatim (with "@Coda") rather than a resolved fact.
Ask later "what did we decide about the database?" and it can answer with the thing the team **killed**.
For a product whose promise is "colleagues who remember," this is trust-critical. Fix: store the
*outcome* (accepted/rejected), extract a resolved fact, fix dedup.

### 3.7 Web access & persona bugs (misc)
- **Web access in chat: 🔴 none.** Pure parametric memory; the only web path is the disabled, shallow,
  background AKL loop.
- **Persona bugs:** agents refer to themselves in the third person ("I'll verify with Rex" — from Rex;
  "let me look at this from the Product Manager angle" — from the PM), and a shared canned opener
  ("Good call from the PM side —") leaks across every role, hurting distinctiveness.

---

## 4. Maturity readout & what it means

The agents are **more capable and more honest than a quick look suggests** — the durable gaps are
architectural, not "the model is dumb":
1. **No professional-growth loop** (evolution = tone dial).
2. **No web/RAG in chat** (parametric only; no freshness, no citations).
3. **Supervision is invisible and never hard-rejects** (peer-review advises silently; policing is
   reactive not ambient).
4. **Memory records outcomes incorrectly** (false decisions).

Phase 2 tackles #2 head-on and is the highest-leverage first move; #1 and #3/#4 are noted as separate
follow-on builds.

---

## 5. Phase 2 — Build plan: per-role internet-sourced knowledge (RAG)

**Status: plan only, no code until approved.** This is the concrete, reuse-first plan the audit points
to. Your goal restated: *each role answers from real internet-sourced knowledge (books/articles/case
studies), not the model's memory.*

### 5.1 The key structural finding
**The injection seam is already live in chat.** `openaiService.ts` already loads per-role knowledge into
every reply (`roleBrains` loader + `skillUpdates`), alongside the brain-doc grounding block. But the
stores behind it are **~1 KB of static hand-authored JSON per role** (`{role}.canon.json` +
`{role}.playbook.json`), for only **~5 of 30 roles**, read whole-file with no relevance ranking, not
internet-sourced. So Phase 2 is **"fill it with real sourced content + retrieve the right piece,"** not
"build the plumbing." That makes it much smaller than it sounds.

### 5.2 Reuse (do not rebuild)
Injection seam (`knowledge/roleBrains/loader.ts` → `openaiService.ts`) · gap detection
(`knowledge/akl/gapDetector.ts`) · fetch (`tools/web/webClient.ts`) · trust tiers (`sourceTrust.ts`) ·
per-role domain policy + injection sanitization (`webPolicy.ts`, `isInjectionLike`) · cache + TTL
(`cache/cacheStore.ts`, `ttlPolicy.ts`) · per-role promotion (`akl/promotion.ts`, `updateCard.ts`).

### 5.3 Build (five pieces)
1. **Enable pgvector** on Supabase (not enabled today) → `role_knowledge(id, role, chunk, embedding,
   source_url, source_title, source_date, trust_tier)`.
2. **Real ingestion** — curated per-role sources → fetch full text → clean → chunk → embed → store
   (replaces the shallow DuckDuckGo instant-answer fetch).
3. **Semantic retrieval** — `retrieveForRole(role, query, k)` via pgvector top-K, trust-filtered, cached.
4. **Gap-gated in chat** — retrieve only when `gapDetector` says the answer needs it (controls cost;
   fires on a minority of turns).
5. **Cite-or-admit** — carry source through to a "RETRIEVED KNOWLEDGE (cite these)" block + one prompt
   rule: *"answer from retrieved knowledge and cite [title](url); if it's not covered, say so — don't
   invent sources."* Directly kills the long-tail confabulation.

### 5.4 Recommended decisions (override any)
- **Sources → curated per-role allow-list, NOT open crawl** (quality, ToS/legal, injection surface).
  e.g. PM → Reforge/First Round/SVPG/Lenny's; UX → NN/g, Laws of UX; Eng → official docs, martinfowler,
  Google SRE; Growth → Reforge/AARRR canon. `webPolicy.ts` already models per-role allow-lists.
- **Freshness → hybrid** — one-time bulk ingest of the evergreen corpus + monthly refresh cron
  (reuse `worldSensor`/`ttlPolicy`) + on-demand gap-fill.
- **Host → Supabase pgvector** (already yours) + a small embeddings model. Near-zero at rest; per-turn
  cost is one embedding + one vector query, only when the gap fires.

### 5.5 Rollout
- **P2.0 Spike (2–3 roles):** enable pgvector; hand-ingest ~50 vetted docs for PM/Eng/UX; build
  `retrieveForRole` + the injection block; gate on `gapDetector`. **Success = the Superhuman-numbers
  probe now answers with a real clickable citation, zero fabrication.** *(This is the first actual code
  change of the whole engagement.)*
- **P2.1 Ingestion pipeline** → generalize fetch/clean/chunk/embed/store, wire the allow-list, backfill
  all 30 roles, add the refresh cron.
- **P2.2 Quality + safety + UI** → trust-tier ranking, dedupe, ingest-time injection sanitization,
  per-role budget caps, and a UI surface showing what a claim is grounded on (also fixes the
  invisible-knowledge gap).
- **P2.3 (optional)** → feed which retrieved chunks led to accepted work back into ranking — the start of
  the real growth loop.

### 5.6 Verification & risks
- **Verify:** re-run the Phase-1 knowledge/honesty probes; target ≥90% of factual/case-study claims
  carry a valid (openable) citation; zero confident fabrication on the long tail; retrieval < ~500 ms and
  fires on < ~40% of turns; no regression in policing/context.
- **Risks:** prompt-injection via ingested pages (sanitize + trust-rank + never execute retrieved
  instructions); source licensing (store snippet+link, not reproductions); cost creep (gap-gate + cache +
  one-time bulk embed); staleness (source-date + refresh); voice flattening (keep retrieved block small).

### 5.7 Out of scope for Phase 2
The outcome-based **growth loop** (finding #1) and **ambient policing + hard-reject + review visibility**
(finding #3/#4) are separate builds — noted here, not included. Phase 2 is specifically the per-role
internet-knowledge (RAG) pipeline.

---

## Appendix — provenance & notes
- Source working files (superseded by this compile): `intelligence-audit.md` (recon/Groq),
  `intelligence-audit-DEEP.md` (deep/DeepSeek), `phase2-per-role-rag-build-plan.md` (build plan).
- **Model caveat:** behavioral/architecture findings (evolution, reactive policing, no web/RAG, memory)
  are provider-independent; quality findings (knowledge, honesty) are reported on production DeepSeek.
- **Test debris:** probe messages/tasks remain in the "AI Recipe App" project as evidence; the server is
  currently on `LLM_MODE=prod` (DeepSeek). Both can be reset on request.
