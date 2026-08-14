# Knowledge Corpus Gathering, Handoff for Claude Code

**Your job:** gather deep, top-1% domain knowledge for each role of an AI team and save it as JSON seed files in the exact format below, so it can be embedded into a per-role knowledge base. Quality over volume. This is a citation system, so **every source must be real and every extract faithful** (fabrication defeats the entire purpose).

You are producing DATA (seed JSON), not embeddings. Someone else runs the embedding/ingestion step.

---

## 1. What "top 1%" means here (the quality bar)

Not "scrape a lot of pages." Gather what a genuine top-1% practitioner in each field has internalized: the **canonical frameworks, seminal works, official documentation, and the recognized masters** of the domain, plus the **anti-patterns / common mistakes / debunked myths** (experts know the failure modes, not just the playbook). Prefer PRIMARY sources. Skip SEO spam, content farms, and AI-generated listicles.

**Method per role:**
1. First build a short **mastery map**: the 8 to 20 things a top expert in this role must know cold (the core frameworks, methods, metrics, principles, and the classic mistakes).
2. For each item, find the **best authoritative source** that covers it and fetch it (WebFetch).
3. Write a **faithful extract** of the substantive content (frameworks, definitions, exact numbers/thresholds, named concepts, concrete examples). Preserve specific numbers verbatim. Do not invent facts, numbers, or URLs.
4. Include at least a few **anti-pattern / "what not to do"** entries per role.

Aim for roughly **10 to 25 sources per role** (or fewer long, dense extracts that cover the mastery map). Depth beats count.

---

## 2. Exact output format (drop-in)

Write JSON arrays of source objects. One file per domain/role batch. Save into THIS folder:
`server/knowledge/rag/seed/` , filenames like `batch-<domain>.json` (e.g. `batch-finance.json`).

Each element:
```json
{
  "role": "<EXACT role label from the table in section 4>",
  "url": "<the real URL you fetched, or \"\" for offline/own material>",
  "title": "<Author or Site, Work / topic>  e.g. \"Martin Fowler, MonolithFirst\"",
  "date": "<YYYY or YYYY-MM-DD if visible; omit if unknown>",
  "trustTier": "A" | "B" | "C",
  "text": "<faithful extract, ~150 to ~1500 words>"
}
```

Rules for the fields:
- **role**: MUST be one of the exact strings in section 4 (they are the retrieval keys). Do not rename or abbreviate.
- **url**: a URL you actually fetched successfully. Real URLs only. Use `""` only for public-domain / offline material with no web source.
- **title**: rich and citable, "Author/Site, Work or Section". This becomes the citation the agent shows.
- **trustTier**: `A` = primary / official / recognized authority (the source itself). `B` = reputable secondary (a good summary of a primary idea). `C` = tertiary/among the weaker but still legitimate.
- **text**: faithful to the page. **You MAY include markdown headings (`## Section`) inside the text** , the ingester chunks on headings and keeps each section together, so structured extracts are ideal. Do NOT paste an entire copyrighted book; short faithful extracts + attribution only (see section 5).

Valid JSON only (a single array per file). Escape quotes/newlines. No em or en dashes in the text (use commas, colons, or "to").

---

## 3. Hard rules (non-negotiable)

- **Real sources only.** Every URL must be one you fetched. No invented links, quotes, statistics, or authors.
- **Faithful extracts.** The `text` must reflect what the page actually says. This is a citation system.
- **No injection payloads.** Do not include text like "ignore previous instructions" (it is stripped on ingest anyway).
- **Licensing (section 5).** Short attributed fair-use extracts, official docs, openly/CC-licensed material, and authors' own free writing. Never paste wholesale copyrighted books.
- **English.**
- Small, resumable batches: write each `batch-*.json` file as soon as a role/domain is done, so a session limit never loses work.

---

## 4. The 34 roles + domain + example authoritative sources

Use these EXACT `role` values. Example sources are starting points, find the best per the mastery map.

| role (exact) | domain | example authoritative sources |
|---|---|---|
| Product Manager | product strategy, prioritization, discovery | SVPG/Marty Cagan, Teresa Torres, Reforge, Lenny's Newsletter, Intercom (RICE) |
| Business Analyst | requirements, process analysis | IIBA BABOK, Karl Wiegers, BPMN |
| Backend Developer | services, data, APIs, security | martinfowler.com, 12factor.net, OWASP, official DB/framework docs |
| Software Engineer | code quality, testing, refactoring | martinfowler.com, Kent Beck, Google Engineering Practices |
| Technical Lead | architecture, team/tech strategy | martinfowler.com/architecture, Conway's Law, StaffEng |
| AI Developer | LLMs, RAG, prompting, ML systems | Anthropic + OpenAI docs, Chip Huyen, Google Rules of ML |
| DevOps Engineer | SRE, CI/CD, reliability | Google SRE Book (sre.google), dora.dev, 12factor |
| Product Designer | product design process, design thinking | Nielsen Norman Group, IDEO, Interaction Design Foundation |
| UX Designer | usability, research, IA | Nielsen Norman Group, Laws of UX (lawsofux.com) |
| UI Engineer | front-end craft, performance, a11y | web.dev, react.dev, MDN |
| UI Designer | visual/interface design, design systems | Laws of UX, Brad Frost Atomic Design, Material Design, Apple HIG |
| Designer | visual design principles | Nielsen Norman Group, Refactoring UI |
| Creative Director | creative strategy, art direction | AIGA, recognized creative-leadership writing |
| Brand Strategist | brand strategy, positioning, equity | Marty Neumeier (The Brand Gap), David Aaker, Ries & Trout |
| QA Lead | test strategy, quality | martinfowler.com Test Pyramid, Google Testing Blog |
| Content Writer | writing for the web, content strategy | Nielsen Norman Group, Ann Handley, Content Marketing Institute |
| Copywriter | copywriting, headlines, persuasion | Copyblogger, David Ogilvy, Gary Halbert, Joseph Sugarman |
| Growth Marketer | growth loops, activation, retention | Reforge, Andrew Chen, Brian Balfour, AARRR (Dave McClure) |
| Marketing Specialist | marketing mix, campaigns | Content Marketing Institute, HubSpot, Kotler |
| Social Media Manager | platform strategy, community | Sprout Social, Buffer, Hootsuite research |
| SEO Specialist | technical + content SEO, E-E-A-T | Google Search Central, Ahrefs, Moz, Backlinko |
| Email Specialist | deliverability, lifecycle, benchmarks | Litmus, Mailchimp, Really Good Emails |
| Data Analyst | modeling, dashboards, SQL, storytelling | Kimball Group, dbt docs, Storytelling with Data (Knaflic) |
| Data Scientist | ML practice, experimentation, metrics | Google Rules of ML, scikit-learn docs, Chip Huyen |
| Operations Manager | lean, process, quality | Lean Enterprise Institute, Toyota Production System, ASQ (Six Sigma) |
| Business Strategist | strategy frameworks | Michael Porter (isc.hbs.edu), Blue Ocean (Kim & Mauborgne), HBR |
| HR Specialist | people ops, hiring, team effectiveness | Google re:Work, SHRM BASK |
| Instructional Designer | learning design | Bloom's Taxonomy, ADDIE, Cathy Moore (action mapping), Mayer's multimedia principles |
| Audio Editor | audio/podcast production, loudness | Transom.org, iZotope Learn, EBU R128 / LUFS standards |
| Idea Partner | mental models, decision-making, ideation | Farnam Street (fs.blog), IDEO design thinking, Charlie Munger's models |
| Finance Analyst | unit economics, FP&A, SaaS metrics, cash | a16z metrics, David Skok / forEntrepreneurs, Reforge finance, Wall Street Prep, Rule of 40 / NRR / CAC payback |
| Legal Counsel | startup/company law, contracts, IP, compliance | Cooley GO, Y Combinator legal + SAFE docs, USPTO, GDPR/CCPA official texts, Common Paper, Bloomberg Law basics (framed as "not legal advice") |
| Sales Lead | B2B sales methodology, pipeline, closing | MEDDIC / MEDDPICC, Challenger Sale, SPIN Selling (Rackham), Winning by Design, Gong/Gap Selling data, JOLT (Dixon) |
| Customer Success Manager | onboarding, retention, expansion, churn | Gainsight, Lincoln Murphy (Sixteen Ventures), Kellblog (Kellogg), Bessemer, SaaStr, First Round Review |

(Design and Marketing/Growth/SEO/Copywriting already have some material; still welcome deeper sources. All 34 roles now covered; keep this table in sync when a new role is added, per DEEPENING-CAMPAIGN.md.)

---

## 5. Licensing posture

Prefer: official documentation, openly/CC-licensed material, standards bodies, and authors' own freely published writing. Store **short faithful extracts + attribution + link**, never a wholesale reproduction of a paid book. Purchased/owned materials the project owner supplies are fine to include as `url: ""` for private internal grounding.

---

## 6. Ingesting the corpus (embed + store), you CAN do this in Claude Code

The embedder is **pluggable** via `RAG_EMBED_PROVIDER`, so you can embed the whole corpus WITHOUT Gemini's free-tier 1,000/day cap. Running the ingest inside Claude Code does not bypass the cap by itself (embedding is an API call tied to the key/project), so the real fix is choosing a non-capped provider. **Pick ONE provider for the ENTIRE corpus**, all stored chunks and the live query must share one vector space; mixing providers silently breaks similarity.

Choose one:
- **OpenAI (recommended: cheap, high limits, works in production too):** set `OPENAI_API_KEY`, run with `RAG_EMBED_PROVIDER=openai` (text-embedding-3-small at 768 dims).
- **Local Ollama (free, unlimited, no cap):** `ollama pull nomic-embed-text`, then run with `RAG_EMBED_PROVIDER=ollama` (768 dims). Needs Ollama running; for production it must be hosted somewhere the server can reach.
- **Gemini (default):** free = 1,000 embeds/day (only ok for tiny corpora); a paid tier removes the cap.

First-time DB setup (only if the pgvector table does not exist yet):
```
./node_modules/.bin/tsx -r dotenv/config scripts/setup-role-knowledge-table.ts
```
Then ingest (from repo root; example uses OpenAI):
```
# all seed JSON files the gatherer wrote:
RAG_EMBED_PROVIDER=openai ./node_modules/.bin/tsx -r dotenv/config scripts/ingest-all-role-knowledge.ts
# markdown-course material too, if any (e.g. the UX course):
RAG_EMBED_PROVIDER=openai UX_COURSE_DIR=<path> ./node_modules/.bin/tsx -r dotenv/config scripts/ingest-ux-course.ts
```
Both are idempotent and chunk structure-aware (on markdown headings), so long heading-structured `text` extracts ingest cleanly with precise per-section citations. For free-tier Gemini bulk runs, add `RAG_INGEST_CONCURRENCY=1 RAG_EMBED_MIN_INTERVAL_MS=650` to avoid rate-limit thrashing (not needed for OpenAI/Ollama).

**One-vector-space rule:** the existing corpus (~558 chunks) was embedded with Gemini. If you switch to OpenAI or Ollama you must RE-EMBED EVERYTHING with the new provider (the ingest scripts wipe and re-embed per role from source), and set the SAME `RAG_EMBED_PROVIDER` for the live app so chat queries match the stored vectors. Never mix providers in one corpus.

**Verify after ingest** (same `RAG_EMBED_PROVIDER`):
```
RAG_EMBED_PROVIDER=openai ./node_modules/.bin/tsx -r dotenv/config scripts/test-rag-coverage.ts     # per-role counts + retrieval probes
RAG_EMBED_PROVIDER=openai ./node_modules/.bin/tsx -r dotenv/config scripts/test-rag-crossrole.ts     # the cross-role router
```

---

## 7. Paste-ready prompt (short version)

> You are gathering a deep, top-1% knowledge corpus for an AI team. For each role in the table in `server/knowledge/rag/seed/GATHERING-HANDOFF.md`, build a mastery map (the core frameworks, metrics, methods, and classic mistakes a top expert knows), fetch the best authoritative real sources with WebFetch, and write faithful extracts (preserve exact numbers, include anti-patterns). Save JSON arrays of `{role, url, title, date, trustTier, text}` (exact role labels from the table) into `server/knowledge/rag/seed/batch-<domain>.json`, one file per domain, written as you finish each so nothing is lost. Real URLs only, faithful extracts only, no fabrication, short fair-use extracts (no wholesale copyrighted books), no em/en dashes in text. Follow sections 1 to 5 of the handoff for the quality bar, format, and rules. Do not run embeddings; just produce the seed files.
