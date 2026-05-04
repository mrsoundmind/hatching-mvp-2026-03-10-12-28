# Hatchin Showcase — Remotion Workspace

Programmatic walkthrough videos for the 12-case showcase. One MP4 per case, all
generated from a shared component library so output stays on-brand and
production is fast.

## Setup (one-time)

```bash
cd showcase/remotion
npm install
```

## Develop / preview

Start the Remotion Studio (live-reloading preview at http://localhost:3000):

```bash
npm run dev
```

Pick `Case01` from the sidebar to preview the first case.

## Render to MP4

```bash
# Render Case 01 → out/case-01-launch-saas.mp4
npm run render:case01

# Render all cases (currently just Case 01)
npm run render:all

# Manual: render any composition by id
npx remotion render src/index.tsx Case01 out/case-01-launch-saas.mp4
```

Output is 1920×1080 H.264 MP4 at 30fps. Render time on a MacBook Pro is ~2-3
minutes per 90s case.

## Workspace layout

```
showcase/remotion/
├── src/
│   ├── index.tsx              # Remotion entry point — registers Root
│   ├── Root.tsx               # All <Composition> registrations
│   ├── design/
│   │   └── tokens.ts          # Brand colors + typography (sync'd with PDF)
│   ├── components/            # 7 reusable building blocks
│   │   ├── CaseIntro.tsx           Title card
│   │   ├── UserPrompt.tsx          Typewriter chat bubble
│   │   ├── TeamAssembling.tsx      Agent avatars sliding in
│   │   ├── HandoffSequence.tsx     Animated handoff timeline
│   │   ├── DeliverableReveal.tsx   PDF-styled artifact reveal
│   │   ├── CostFooter.tsx          Proof-point overlay (₹/time/agents)
│   │   └── CTA.tsx                 Outro with hatchin.app URL
│   └── cases/
│       └── Case01.tsx          "Launch a SaaS in 7 days" — 90s
├── package.json
├── tsconfig.json
├── remotion.config.ts
└── README.md
```

## Building Case 02-12

Each new case is a composition that uses the same 7 components with different
props. Copy `Case01.tsx` as a template:

1. **Plan the beat sheet** (90s = 2700 frames @ 30fps):
   - 0-5s    CaseIntro
   - 5-15s   UserPrompt (the actual prompt for this case)
   - 15-27s  TeamAssembling (the actual Hatches involved)
   - 27-65s  HandoffSequence (the actual deliverable chain)
   - 65-78s  DeliverableReveal (the headline artifact)
   - 78-87s  CostFooter (real numbers from the live run)
   - 87-90s  CTA

2. **Run the case live in Hatchin first**, capture:
   - Exact user prompt → goes into `UserPrompt.text`
   - Which Hatches showed up → goes into `TeamAssembling.agents`
   - The handoff chain → goes into `HandoffSequence.steps`
   - Final PDF → first page sections → goes into `DeliverableReveal.sections`
   - LLM cost from `usage_records` → `CostFooter.rupees`
   - Wall-clock time → `CostFooter.timeMinutes`

3. **Author `src/cases/CaseNN.tsx`** using the same `<Series>` shape as Case01.

4. **Register in `Root.tsx`** with a `<Composition id="CaseNN" ... />`.

5. **Add to `package.json` scripts**: `"render:caseNN": "remotion render src/index.tsx CaseNN out/case-NN-shortname.mp4"`.

## The 12 cases (locked priority order)

| # | Case | Status |
|---|---|---|
| 1 | Launch a SaaS in 7 days | scaffolded — needs live data |
| 2 | Validate startup idea before quitting | not started |
| 3 | Open a cafe in Bangalore | not started |
| 4 | Content engine for D2C brand | not started |
| 5 | Launch paid newsletter / course | not started |
| 6 | Hire first employee | not started |
| 7 | Plan wedding under ₹15L | not started |
| 8 | Pitch to 10 podcasts as a guest | not started |
| 9 | Write YC application in a day | not started |
| 10 | Get into Master's in Europe | not started |
| 11 | Q3 OKRs for 15-person startup | not started |
| 12 | Run a product launch like a unicorn | not started |

## Brand consistency

Component colors, typography, and the Hatchin-blue brand bar (`#6C82FF`) match:
- The exported PDF deliverables (`server/ai/pdfExport.ts`)
- The `LLM-ARCHITECTURE.pdf` document
- The main app's Tailwind tokens

If you change brand tokens, update them in `src/design/tokens.ts` here AND in
`scripts/build-llm-architecture-pdf.py` AND in the main app's `tailwind.config.ts`.

## Output naming convention

`out/case-{NN}-{kebab-shortname}.mp4`

Examples:
- `case-01-launch-saas.mp4`
- `case-04-d2c-content-engine.mp4`
- `case-07-wedding-15l.mp4`

Push these to the public `hatchin-showcase` GitHub repo for distribution and
embedding on `hatchin.com/cases`.
