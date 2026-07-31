// Phase 39 calibration — does the fresh reader CATCH real context-gaps without CRYING WOLF on
// self-contained docs? Mirrors the Phase D judge calibration (eval-peer-review-judge.ts).
//
// Two metrics that must both hold:
//   - CATCH rate on context-heavy docs: reviewer calls them NOT-readable and flags the blocker.
//   - FALSE-ALARM rate on clean docs: reviewer must NOT slap high-severity annotations on docs a
//     stranger can genuinely follow. (Low-severity nitpicks on clean docs are tolerated.)
//
// Runs against LIVE Groq (free) by default. Run: npx tsx -r dotenv/config scripts/eval-reader-test-reviewer.ts
import { runReaderTest } from '../server/ai/readerTestReviewer.js';

interface Case {
  name: string;
  type: string;
  title: string;
  project: string;
  audience?: string;
  content: string;
  contextHeavy: boolean; // true = SHOULD be flagged as not-readable
  /** A phrase we expect a fresh reader to flag on the context-heavy cases. */
  expectFlagNear?: string;
}

const CASES: Case[] = [
  {
    name: 'PRD riddled with unexplained internal shorthand',
    type: 'prd', title: 'Q3 PRD', project: 'Atlas', audience: 'the leadership team',
    contextHeavy: true, expectFlagNear: 'NSM',
    content: `## Overview
This PRD covers the NSM push for Q3. Per the Tuesday sync we're deprioritizing Project Falcon and doubling down on the WAT lever Priya flagged. The Btravo cohort will get the new flow first.
## Goals
Move NSM from 0.4 to 0.6 by lifting activation the way we did for the Zeta launch.
## Scope
Everything in the Falcon epic minus the bits Dana owns.`,
  },
  {
    name: 'Blog post assuming reader was in the room',
    type: 'blog-post', title: 'Why we rebuilt it', project: 'Loom', audience: 'prospective customers',
    contextHeavy: true, expectFlagNear: 'the old system',
    content: `## The change
We finally killed the old system. You know the one — the thing everyone complained about in the retro. The new approach uses the pattern Sam proposed, and early numbers are way better than the baseline we set last quarter.
## What's next
More of the same, plus the stuff we parked in the backlog.`,
  },
  {
    name: 'Email referencing undefined prior decisions',
    type: 'email-sequence', title: 'Welcome flow', project: 'Ferns', audience: 'new signups',
    contextHeavy: true, expectFlagNear: 'as discussed',
    content: `Subject: Your account
Hi there — as discussed, we've moved you to the new tier. The migration follows the plan from the kickoff. Reply if the usual blockers come up and we'll loop in the same folks as before.`,
  },
  {
    name: 'Self-contained PRD a stranger can follow',
    type: 'prd', title: 'Dark Mode PRD', project: 'Notely', audience: 'the product and engineering team',
    contextHeavy: false,
    content: `## Overview
Notely is a note-taking app. This document specifies a dark mode: a theme with light text on a dark background, toggled by the user.
## Problem
Users working at night report eye strain from the bright white background. In a survey of 200 users, 68% asked for a dark theme.
## Goals
Ship a dark theme that users can switch on manually, with the choice remembered across sessions. Success: 30% of active users enable it within one month.
## Requirements
A toggle in Settings labeled "Dark mode". When on, all screens use the dark palette (background #1a1a1a, text #f5f5f5). The setting persists in the user's profile.`,
  },
  {
    name: 'Self-contained blog post',
    type: 'blog-post', title: 'How to write a good bug report', project: 'DevBlog', audience: 'software developers',
    contextHeavy: false,
    content: `## Why bug reports matter
A bug report tells a developer how to reproduce a problem. A vague report ("it's broken") wastes hours; a precise one gets fixed fast.
## The three parts
First, what you did — the exact steps, in order. Second, what you expected to happen. Third, what actually happened, with any error message copied in full.
## An example
"I clicked Save on the profile page (step). I expected a success message (expected). Instead the page went blank and the console showed 'undefined is not a function' (actual)."
That report can be acted on immediately.`,
  },
  {
    name: 'Self-contained landing copy',
    type: 'landing-copy', title: 'Homepage hero', project: 'Sprout', audience: 'small business owners',
    contextHeavy: false,
    content: `## Headline
Bookkeeping that does itself.
## Subhead
Sprout connects to your bank account and sorts every transaction into the right category automatically, so you can see your profit without touching a spreadsheet.
## How it works
Link your bank in two minutes. Sprout categorizes your income and expenses as they happen. At month end, download a clean profit-and-loss statement.
## Call to action
Start free for 30 days. No card required.`,
  },
];

(async () => {
  if (!process.env.GROQ_API_KEY) {
    console.log('SKIP: no GROQ_API_KEY — calibration needs the live free-tier reviewer.');
    process.exit(0);
  }

  let catchHits = 0, catchTotal = 0, falseAlarms = 0, cleanTotal = 0, nulls = 0;
  console.log('Reader-test calibration (live Groq):\n');

  for (const c of CASES) {
    const res = await runReaderTest({
      deliverableType: c.type, title: c.title, projectName: c.project, audience: c.audience, content: c.content,
    });
    if (!res) { nulls++; console.log(`  NULL  ${c.name} (reviewer unavailable)`); continue; }

    const highMed = res.annotations.filter((a) => a.severity === 'high' || a.severity === 'medium');
    if (c.contextHeavy) {
      catchTotal++;
      const flagged = !res.readableWithoutContext || highMed.length > 0;
      const nearHit = c.expectFlagNear
        ? res.annotations.some((a) => (a.quote + ' ' + a.issue).toLowerCase().includes(c.expectFlagNear!.toLowerCase()))
        : true;
      const good = flagged && nearHit;
      if (good) catchHits++;
      console.log(`  ${good ? 'CATCH' : 'MISS '} ${c.name}`);
      console.log(`        readable=${res.readableWithoutContext} annotations=${res.annotations.length} high/med=${highMed.length}`);
      if (res.annotations[0]) console.log(`        top: "${res.annotations[0].quote}" — ${res.annotations[0].issue}`);
    } else {
      cleanTotal++;
      // False alarm = the reviewer declared a genuinely clear doc NOT readable, or piled on 2+ high-severity flags.
      const highs = res.annotations.filter((a) => a.severity === 'high').length;
      const falseAlarm = !res.readableWithoutContext && highs >= 2;
      if (falseAlarm) falseAlarms++;
      console.log(`  ${falseAlarm ? 'WOLF ' : 'CLEAN'} ${c.name}`);
      console.log(`        readable=${res.readableWithoutContext} annotations=${res.annotations.length} high=${highs}`);
    }
  }

  const catchRate = catchTotal ? (catchHits / catchTotal) * 100 : 0;
  const falseAlarmRate = cleanTotal ? (falseAlarms / cleanTotal) * 100 : 0;
  console.log(`\n=== Calibration ===`);
  console.log(`Catch rate (context-heavy flagged):  ${catchHits}/${catchTotal} = ${catchRate.toFixed(0)}%`);
  console.log(`False-alarm rate (clean docs cried-wolf): ${falseAlarms}/${cleanTotal} = ${falseAlarmRate.toFixed(0)}%`);
  if (nulls) console.log(`Nulls (reviewer unavailable): ${nulls}`);

  // Acceptance: catch >= 66% AND false-alarm rate 0%. Mirrors Phase D's "catch real, block nothing good".
  const okCatch = catchRate >= 66;
  const okFalse = falseAlarmRate === 0;
  console.log(`\n${okCatch && okFalse ? 'PASS' : 'FAIL'} — catch>=66%:${okCatch} falseAlarm==0%:${okFalse}`);
  process.exit(okCatch && okFalse ? 0 : 1);
})();
