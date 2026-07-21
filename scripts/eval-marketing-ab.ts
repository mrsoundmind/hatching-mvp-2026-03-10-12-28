/**
 * eval-marketing-ab.ts
 *
 * A/B comparison of the marketing tactical-depth upgrade.
 * BASELINE strings = pre-edit reasoningPattern + outputStandards (read from git HEAD,
 * pasted here as literals so this script doesn't depend on git state).
 * UPGRADE strings  = current shared/roleIntelligence.ts (read live).
 *
 * Same 3 prompts × 2 conditions = 6 LLM calls.
 * Each check is a regex marker tied to the new tactical content.
 *
 * Run: tsx -r dotenv/config scripts/eval-marketing-ab.ts
 */

import "dotenv/config";
import { generateChatWithRuntimeFallback } from "../server/llm/providerResolver.js";
import { getRoleIntelligence } from "../shared/roleIntelligence.js";

interface Check {
  marker: string;
  match: (text: string) => boolean;
}

interface Probe {
  role: string;
  agentName: string;
  userPrompt: string;
  checks: Check[];
}

// ── BASELINE strings (extracted from git HEAD shared/roleIntelligence.ts) ─────

const BASELINE: Record<string, { reasoning: string; output: string }> = {
  Copywriter: {
    reasoning: `You reason through persuasion systematically: (1) READER — Who is this for? Not a persona, a person. What are they doing right before they read this? (2) HOOK — What stops them? What earns the next sentence? (3) PROBLEM — What pain or desire does this speak to? (4) PROOF — Why should they believe this claim? Evidence, social proof, specificity. (5) ACTION — What is the one thing they should do? Make it effortless. You test every piece of copy against "so what?" If the reader could say "so what?" after reading a line, that line needs to work harder.`,
    output: `Excellent copywriting includes: subject lines and headlines that earn attention without clickbait, body copy that builds desire through specificity rather than adjectives, calls to action that reduce friction rather than create pressure, voice-matched writing that sounds like it was written by one consistent person, and A/B test variants that test a real hypothesis not just word substitution.`,
  },
  "Growth Marketer": {
    reasoning: `You reason through growth as a system: (1) CONSTRAINT — What is the bottleneck right now? Acquisition, activation, retention, revenue, or referral? (2) HYPOTHESIS — What specific change would move the constrained metric? State it as "If we do X, Y metric will change by Z because of assumption A." (3) EXPERIMENT — What is the smallest test that would validate or kill this hypothesis? (4) MEASUREMENT — What metric, measured how, over what timeframe, with what sample size? (5) SCALE OR KILL — If the experiment works, what does 10x look like? If not, what did we learn? You never propose a tactic without identifying which funnel stage it targets and how you will measure whether it worked.`,
    output: `Excellent growth output includes: funnel analyses that identify the binding constraint, experiment designs with clear hypotheses and success criteria, attribution models that account for multi-touch journeys, retention analyses that distinguish engagement from value, and growth models that project compounding effects over time. Every recommendation includes how to measure its impact.`,
  },
  "SEO Specialist": {
    reasoning: `You think in search intent and authority: (1) INTENT — What is the user actually trying to find? Informational, navigational, commercial, or transactional? (2) COMPETITION — Who currently owns this query? How strong is their content and authority? (3) CONTENT FIT — Can we create content that genuinely answers this query better than what exists? (4) ARCHITECTURE — How does this page fit into a topical cluster? Does it strengthen the site's authority on this topic? (5) TECHNICAL — Can search engines crawl, index, and understand this content? Are there technical barriers to ranking? You play the long game — SEO is compounding authority, not quick hacks.`,
    output: `Excellent SEO output includes: keyword research organized by intent cluster rather than individual keywords, content briefs that address search intent comprehensively, technical audit reports with prioritized fixes by impact, topical authority maps showing how content pieces interrelate, and performance tracking that measures qualified organic traffic, not just rankings or total visits.`,
  },
};

// ── Probes (shared between baseline + upgrade) ────────────────────────────────

const PROBES: Probe[] = [
  {
    role: "Copywriter",
    agentName: "Wren",
    userPrompt:
      "Write a hero headline and CTA for our SaaS that streamlines workflow automation for innovative teams.",
    checks: [
      {
        marker: "Avoided ALL banned buzzwords",
        match: (t) => !/streamline|innovative|leverage|seamless|robust|world-class/i.test(t),
      },
      {
        marker: "Concrete numbers/timeframes",
        match: (t) => /\d+(?:\s?(?:%|x|minutes?|hours?|days?|weeks?|months?|hr))/i.test(t),
      },
      {
        marker: "Action+outcome CTA (not Submit/Learn More)",
        match: (t) =>
          /(start|get|try|see|claim|build|automate)\s+\w+/i.test(t) &&
          !/(submit|learn more|click here)/i.test(t),
      },
    ],
  },
  {
    role: "Growth Marketer",
    agentName: "Kai",
    userPrompt:
      "Our landing page isn't converting. Most visitors come from a Google ad. What should I do?",
    checks: [
      {
        marker: "Headline-to-traffic-source match",
        match: (t) => /(ad|paid|google)\b/i.test(t) && /(match|promise|deliver|align|consist)/i.test(t),
      },
      {
        marker: "Value-prop-first diagnosis (5 sec / first impression)",
        match: (t) => /(value prop|5 seconds|first 5|first impression)/i.test(t),
      },
      {
        marker: "Page-type or output-structure language",
        match: (t) =>
          /(quick win|high.?impact|test idea|copy alternative|landing page|page type)/i.test(t),
      },
    ],
  },
  {
    role: "SEO Specialist",
    agentName: "Robin",
    userPrompt:
      "Can you audit my SEO and tell me if I have schema markup on https://hatching.com?",
    checks: [
      {
        marker: "DOES NOT confidently claim schema present/absent",
        match: (t) =>
          !/i (?:have )?checked.{0,30}schema.{0,30}(?:exists|is present|implemented|in place|yes|confirmed|found)/i.test(
            t,
          ) &&
          !/you (?:do|don't) have schema/i.test(t),
      },
      {
        marker: "Mentions JS-injected / Rich Results / browser limitation",
        match: (t) =>
          /(rich results test|javascript|js-?injected|json-?ld|screaming frog|browser console|cannot.{1,40}(?:detect|see|check|confirm))/i.test(
            t,
          ),
      },
      {
        marker: "Attack order or structured findings",
        match: (t) =>
          /(crawl|index)/i.test(t) ||
          /(issue|impact|evidence|fix|priority)/i.test(t),
      },
    ],
  },
];

function buildSystem(probe: Probe, useUpgrade: boolean): string {
  const ri = getRoleIntelligence(probe.role);
  if (!ri) throw new Error(`No roleIntelligence for ${probe.role}`);
  const reasoning = useUpgrade ? ri.reasoningPattern : BASELINE[probe.role].reasoning;
  const output = useUpgrade ? ri.outputStandards : BASELINE[probe.role].output;
  return [
    `You are ${probe.agentName}, the ${probe.role} on a project team.`,
    `Respond in natural, colleague-style prose — no markdown headers, no bullet lists, max one question.`,
    "",
    "--- ROLE EXPERTISE ---",
    `Reasoning: ${reasoning}`,
    `Output standard: ${output}`,
    "--- END ROLE EXPERTISE ---",
  ].join("\n");
}

async function runOnce(probe: Probe, useUpgrade: boolean): Promise<{
  output: string;
  score: number;
  results: { check: Check; passed: boolean }[];
}> {
  const system = buildSystem(probe, useUpgrade);
  const result = await generateChatWithRuntimeFallback({
    messages: [
      { role: "system", content: system },
      { role: "user", content: probe.userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 600,
  });
  const output = result.content;
  const results = probe.checks.map((check) => ({ check, passed: check.match(output) }));
  return {
    output,
    score: results.filter((r) => r.passed).length,
    results,
  };
}

async function main(): Promise<void> {
  console.log("\n📊 Marketing tactical-depth A/B — baseline vs upgrade\n");
  console.log("═".repeat(76));

  let baselineTotal = 0;
  let upgradeTotal = 0;
  let totalChecks = 0;

  for (const probe of PROBES) {
    console.log(`\n▶ ${probe.agentName} (${probe.role})`);
    console.log(`  User: "${probe.userPrompt}"`);

    const baseline = await runOnce(probe, false);
    const upgrade = await runOnce(probe, true);

    console.log(`\n  ┌─ BASELINE (pre-edit) — ${baseline.score}/${probe.checks.length}`);
    for (const { check, passed } of baseline.results) {
      console.log(`  │   ${passed ? "✓" : "✗"} ${check.marker}`);
    }
    console.log(`  └─ excerpt: "${baseline.output.replace(/\s+/g, " ").slice(0, 200)}…"`);

    console.log(`\n  ┌─ UPGRADE (current) — ${upgrade.score}/${probe.checks.length}`);
    for (const { check, passed } of upgrade.results) {
      console.log(`  │   ${passed ? "✓" : "✗"} ${check.marker}`);
    }
    console.log(`  └─ excerpt: "${upgrade.output.replace(/\s+/g, " ").slice(0, 200)}…"`);

    const delta = upgrade.score - baseline.score;
    console.log(
      `\n  Δ ${delta >= 0 ? "+" : ""}${delta} markers (${
        delta > 0 ? "improvement" : delta < 0 ? "regression" : "no change"
      })`,
    );
    console.log("─".repeat(76));

    baselineTotal += baseline.score;
    upgradeTotal += upgrade.score;
    totalChecks += probe.checks.length;
  }

  const baselinePct = Math.round((baselineTotal / totalChecks) * 100);
  const upgradePct = Math.round((upgradeTotal / totalChecks) * 100);
  const absoluteLift = upgradePct - baselinePct;
  const relativeLift =
    baselineTotal === 0
      ? Infinity
      : Math.round(((upgradeTotal - baselineTotal) / baselineTotal) * 100);

  console.log("\n" + "═".repeat(76));
  console.log("FINAL");
  console.log(`  BASELINE:  ${baselineTotal}/${totalChecks} markers (${baselinePct}%)`);
  console.log(`  UPGRADE:   ${upgradeTotal}/${totalChecks} markers (${upgradePct}%)`);
  console.log(
    `  Absolute lift:  +${absoluteLift} percentage points  (${baselinePct}% → ${upgradePct}%)`,
  );
  console.log(
    `  Relative lift:  ${relativeLift === Infinity ? "∞" : "+" + relativeLift}%  (markers detected up from ${baselineTotal} to ${upgradeTotal})`,
  );
  console.log("═".repeat(76) + "\n");

  console.log(
    "Caveats: temperature 0.3 (some run-to-run variance). Single trial per side.",
  );
  console.log("Each probe = 1 LLM call per condition (3 probes × 2 conditions = 6 calls).\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
