/**
 * eval-marketing-tactical.ts
 *
 * Targeted test for the marketing tactical-depth upgrade (Wren / Kai / Robin).
 * Three prompts designed to surface the new content if the LLM is actually using it.
 * Checks output for specific markers from the new tactical layer.
 *
 * Run: tsx -r dotenv/config scripts/eval-marketing-tactical.ts
 */

import "dotenv/config";
import { generateChatWithRuntimeFallback } from "../server/llm/providerResolver.js";
import { getRoleIntelligence } from "../shared/roleIntelligence.js";

interface Check {
  marker: string;
  match: (text: string) => boolean;
  why: string;
}

interface Probe {
  role: string;
  agentName: string;
  userPrompt: string;
  checks: Check[];
}

const PROBES: Probe[] = [
  {
    role: "Copywriter",
    agentName: "Wren",
    userPrompt:
      "Write a hero headline and CTA for our SaaS that streamlines workflow automation for innovative teams.",
    checks: [
      {
        marker: "Flags banned word",
        match: (t) =>
          /streamline/i.test(t) &&
          (/avoid|replace|instead|don'?t use|weak|vague|generic|specific/i.test(t)),
        why: 'Should flag "streamline" / "innovative" as banned weak-copy words.',
      },
      {
        marker: "Concrete specificity",
        match: (t) => /\d+(?:\s?(?:minutes?|hours?|days?|weeks?|%|x|hr))/i.test(t),
        why: "Should propose numbers/timeframes instead of vague verbs.",
      },
      {
        marker: "Action+outcome CTA",
        match: (t) =>
          /(start|get|see|try)\s+(your|my|free|the)\s+\w+/i.test(t) &&
          !/submit/i.test(t),
        why: 'CTA should be action+outcome ("Start Free Trial", "Get My Report") not "Submit".',
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
        marker: "Identifies traffic source / message match",
        match: (t) => /(ad|paid|google)\b/i.test(t) && /(match|promise|deliver|align|consist)/i.test(t),
        why: "Should connect the Google-ad traffic source to headline/message match.",
      },
      {
        marker: "Quick Wins / High-Impact / Test Ideas structure",
        match: (t) =>
          /(quick win|high.?impact|test idea|copy alternative)/i.test(t),
        why: "Should use the explicit 4-section CRO output structure.",
      },
      {
        marker: "Value-prop-first diagnosis",
        match: (t) => /(value prop|5 seconds|understand what)/i.test(t),
        why: "Should diagnose value-prop clarity first, not trust signals first.",
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
        marker: "Schema detection caveat",
        match: (t) =>
          /(rich results test|javascript.?injected|<script>|json-?ld|screaming frog|cannot.{1,40}(detect|see|check).{1,40}schema)/i.test(t),
        why: "Should warn that web_fetch/curl can't see JS-injected schema; recommend Rich Results Test.",
      },
      {
        marker: "Attack order language",
        match: (t) => /(crawl|index)/i.test(t) && /(first|before|priority|order)/i.test(t),
        why: "Should describe attack order: Crawlability → Technical → On-page → Content → Authority.",
      },
      {
        marker: "Structured finding format",
        match: (t) => /(issue|impact|evidence|fix|priority)/i.test(t),
        why: "Should structure findings in Issue/Impact/Evidence/Fix/Priority shape.",
      },
    ],
  },
];

function buildSystemPrompt(probe: Probe): string {
  const ri = getRoleIntelligence(probe.role);
  if (!ri) throw new Error(`No roleIntelligence entry for "${probe.role}"`);
  return [
    `You are ${probe.agentName}, the ${probe.role} on a project team.`,
    `Respond in natural, colleague-style prose — no markdown headers, no bullet lists, max one question.`,
    "",
    "--- ROLE EXPERTISE ---",
    `Reasoning: ${ri.reasoningPattern}`,
    `Output standard: ${ri.outputStandards}`,
    "--- END ROLE EXPERTISE ---",
  ].join("\n");
}

async function runProbe(probe: Probe): Promise<{
  probe: Probe;
  output: string;
  results: { check: Check; passed: boolean }[];
  passedCount: number;
}> {
  const system = buildSystemPrompt(probe);
  const result = await generateChatWithRuntimeFallback({
    messages: [
      { role: "system", content: system },
      { role: "user", content: probe.userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 600,
  });
  const output = result.content;
  const results = probe.checks.map((check) => ({
    check,
    passed: check.match(output),
  }));
  const passedCount = results.filter((r) => r.passed).length;
  return { probe, output, results, passedCount };
}

async function main(): Promise<void> {
  console.log("\n🧪 Marketing tactical-depth probe — Wren / Kai / Robin\n");
  console.log("─".repeat(72));

  let totalPassed = 0;
  let totalChecks = 0;

  for (const probe of PROBES) {
    console.log(`\n▶ ${probe.agentName} (${probe.role})`);
    console.log(`  User: "${probe.userPrompt}"`);
    console.log("");

    try {
      const r = await runProbe(probe);
      console.log("  ── Response ───────────────────────────────────────");
      console.log(
        "  " +
          r.output
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .join("\n  ")
            .slice(0, 800) +
          (r.output.length > 800 ? "…" : ""),
      );
      console.log("");
      console.log("  ── Tactical-depth markers ─────────────────────────");
      for (const { check, passed } of r.results) {
        console.log(`  ${passed ? "✓" : "✗"} ${check.marker}`);
        if (!passed) console.log(`      reason: ${check.why}`);
      }
      console.log(
        `  Score: ${r.passedCount}/${probe.checks.length} markers present`,
      );
      totalPassed += r.passedCount;
      totalChecks += probe.checks.length;
    } catch (e) {
      console.log(`  ✗ ERROR: ${(e as Error).message}`);
    }
    console.log("─".repeat(72));
  }

  console.log(
    `\n📊 Total: ${totalPassed}/${totalChecks} tactical-depth markers surfaced (${Math.round(
      (totalPassed / totalChecks) * 100,
    )}%)\n`,
  );

  process.exit(totalPassed === 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
