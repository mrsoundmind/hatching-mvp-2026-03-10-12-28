/**
 * Voice Distinctiveness Tests
 *
 * Validates that all 30 AI agent role personalities are meaningfully
 * distinct from each other — no duplicate names, no copy-paste voice
 * prompts, and full coverage across roleRegistry and roleIntelligence.
 *
 * Run: npx tsx scripts/test-voice-distinctiveness.ts
 */

import { ROLE_DEFINITIONS } from "../shared/roleRegistry.js";
import { ROLE_INTELLIGENCE } from "../shared/roleIntelligence.js";

// ── Test harness ────────────────────────────────────────────────────────────

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: ${(e as Error).message}`);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract meaningful words (length > 4, lowercased) from a string.
 */
function extractWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4),
  );
}

/**
 * Jaccard similarity between two sets: |intersection| / |union|.
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ── Tests ───────────────────────────────────────────────────────────────────

console.log("\n=== Voice Distinctiveness Tests ===\n");
console.log(`  Roles in ROLE_DEFINITIONS: ${ROLE_DEFINITIONS.length}`);
console.log(
  `  Roles in ROLE_INTELLIGENCE: ${ROLE_INTELLIGENCE.length}\n`,
);

// 1. All character names are unique
test("All character names are unique", () => {
  const names = ROLE_DEFINITIONS.map((r) => r.characterName);
  const unique = new Set(names);
  const dupes = names.filter(
    (n, i) => names.indexOf(n) !== i,
  );
  assert(
    unique.size === names.length,
    `Duplicate characterNames found: ${dupes.join(", ")}`,
  );
});

// 2. All voicePrompts differ significantly — tightened gate (v2.2 T4).
//
// The original gate failed only at Jaccard >0.60 / warned >0.50, but the measured maximum across all
// 30 voices is 0.221 (Nyx <-> Sage, two adjacent quantitative roles that legitimately share domain
// vocabulary); mean is 0.090. A 0.60 gate could therefore never catch a real regression — a voice
// could be rewritten generic and blur most of the way toward another before tripping. The audit's
// stated fear was that "distinctiveness silently erodes again", so this locks in the current strong
// separation: FAIL >0.40 (≈2× the current max, still generous for legitimate voice evolution),
// WARN >0.28. The closest observed pair is printed every run as a health signal.
const VOICE_FAIL = 0.40;
const VOICE_WARN = 0.28;
test(`All voicePrompts differ significantly (Jaccard < ${VOICE_FAIL})`, () => {
  const roles = ROLE_DEFINITIONS;
  const wordSets = roles.map((r) => extractWords(r.voicePrompt));
  const violations: string[] = [];
  const warnings: string[] = [];
  let closest = { pair: "", sim: 0 };

  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      const sim = jaccardSimilarity(wordSets[i], wordSets[j]);
      if (sim > closest.sim) closest = { pair: `${roles[i].characterName} <-> ${roles[j].characterName}`, sim };
      if (sim > VOICE_FAIL) {
        violations.push(
          `${roles[i].characterName} <-> ${roles[j].characterName}: ${sim.toFixed(3)}`,
        );
      } else if (sim > VOICE_WARN) {
        warnings.push(
          `${roles[i].characterName} <-> ${roles[j].characterName}: ${sim.toFixed(3)}`,
        );
      }
    }
  }

  console.log(`    closest voice pair: ${closest.pair} (${closest.sim.toFixed(3)}) · gate fail>${VOICE_FAIL} warn>${VOICE_WARN}`);
  if (warnings.length > 0) {
    console.log(`    ⚠ approaching the gate (>${VOICE_WARN}):`);
    for (const w of warnings) {
      console.log(`      ${w}`);
    }
  }

  assert(
    violations.length === 0,
    `${violations.length} pair(s) exceed ${VOICE_FAIL} similarity (voices blurring together):\n      ${violations.join("\n      ")}`,
  );
});

// 3. All negativeHandling fields are populated (>20 chars)
test("All negativeHandling fields are populated (>20 chars)", () => {
  const missing: string[] = [];
  for (const r of ROLE_DEFINITIONS) {
    if (!r.negativeHandling || r.negativeHandling.length <= 20) {
      missing.push(`${r.characterName} (${r.role})`);
    }
  }
  assert(
    missing.length === 0,
    `Missing or short negativeHandling: ${missing.join(", ")}`,
  );
});

// 4. All criticalThinking fields are populated (>20 chars)
test("All criticalThinking fields are populated (>20 chars)", () => {
  const missing: string[] = [];
  for (const r of ROLE_DEFINITIONS) {
    if (!r.criticalThinking || r.criticalThinking.length <= 20) {
      missing.push(`${r.characterName} (${r.role})`);
    }
  }
  assert(
    missing.length === 0,
    `Missing or short criticalThinking: ${missing.join(", ")}`,
  );
});

// 5. All collaborationStyle fields are populated (>20 chars)
test("All collaborationStyle fields are populated (>20 chars)", () => {
  const missing: string[] = [];
  for (const r of ROLE_DEFINITIONS) {
    if (!r.collaborationStyle || r.collaborationStyle.length <= 20) {
      missing.push(`${r.characterName} (${r.role})`);
    }
  }
  assert(
    missing.length === 0,
    `Missing or short collaborationStyle: ${missing.join(", ")}`,
  );
});

// 6. All domainDepth fields are populated (>20 chars)
test("All domainDepth fields are populated (>20 chars)", () => {
  const missing: string[] = [];
  for (const r of ROLE_DEFINITIONS) {
    if (!r.domainDepth || r.domainDepth.length <= 20) {
      missing.push(`${r.characterName} (${r.role})`);
    }
  }
  assert(
    missing.length === 0,
    `Missing or short domainDepth: ${missing.join(", ")}`,
  );
});

// 7. roleIntelligence covers all roles
test("roleIntelligence covers all roles", () => {
  const registryRoles = new Set(ROLE_DEFINITIONS.map((r) => r.role));
  const intelligenceRoles = new Set(ROLE_INTELLIGENCE.map((r) => r.role));
  const missing: string[] = [];

  for (const role of registryRoles) {
    if (!intelligenceRoles.has(role)) {
      missing.push(role);
    }
  }
  assert(
    missing.length === 0,
    `Roles missing from ROLE_INTELLIGENCE: ${missing.join(", ")}`,
  );
});

// 8. All reasoningPatterns differ significantly (Jaccard < 0.60)
test("All reasoningPatterns differ significantly (Jaccard < 0.60)", () => {
  const roles = ROLE_INTELLIGENCE;
  const wordSets = roles.map((r) => extractWords(r.reasoningPattern));
  const violations: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      const sim = jaccardSimilarity(wordSets[i], wordSets[j]);
      if (sim > 0.6) {
        violations.push(
          `${roles[i].role} <-> ${roles[j].role}: ${sim.toFixed(3)}`,
        );
      } else if (sim > 0.5) {
        warnings.push(
          `${roles[i].role} <-> ${roles[j].role}: ${sim.toFixed(3)}`,
        );
      }
    }
  }

  if (warnings.length > 0) {
    console.log(`    ⚠ High-similarity warnings (>0.50):`);
    for (const w of warnings) {
      console.log(`      ${w}`);
    }
  }

  assert(
    violations.length === 0,
    `${violations.length} pair(s) exceed 0.60 similarity:\n      ${violations.join("\n      ")}`,
  );
});

// ── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
