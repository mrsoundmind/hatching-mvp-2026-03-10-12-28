/**
 * test-reasoning-patterns.ts — Validates that every role in ROLE_INTELLIGENCE
 * has meaningful, distinct reasoning patterns and autonomy integration fields.
 *
 * Does NOT call an LLM — pure data validation against roleIntelligence.
 */

import { ROLE_INTELLIGENCE, type RoleIntelligence } from "../shared/roleIntelligence.js";

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

// ── Constants ────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set([
  "product",
  "engineering",
  "design",
  "quality",
  "content",
  "marketing",
  "data",
  "operations",
  "finance",
  "legal",
  "sales",
  "customer-success",
  "specialist",
  "special",
]);

const TRAIT_KEYS: (keyof RoleIntelligence["baseTraitDefaults"])[] = [
  "formality",
  "verbosity",
  "empathy",
  "directness",
  "enthusiasm",
  "technicalDepth",
];

// ── Tests ────────────────────────────────────────────────────────────────────

console.log("\n🧪 Reasoning Patterns Validation\n");

console.log("1. Every role has a reasoningPattern (>30 chars):");
for (const ri of ROLE_INTELLIGENCE) {
  test(`${ri.role} has reasoningPattern`, () => {
    assert(
      ri.reasoningPattern && ri.reasoningPattern.length > 30,
      `reasoningPattern is missing or too short (${ri.reasoningPattern?.length ?? 0} chars)`,
    );
  });
}

console.log("\n2. Every role has outputStandards (>30 chars):");
for (const ri of ROLE_INTELLIGENCE) {
  test(`${ri.role} has outputStandards`, () => {
    assert(
      ri.outputStandards && ri.outputStandards.length > 30,
      `outputStandards is missing or too short (${ri.outputStandards?.length ?? 0} chars)`,
    );
  });
}

console.log("\n3. Every role has peerReviewLens (>30 chars):");
for (const ri of ROLE_INTELLIGENCE) {
  test(`${ri.role} has peerReviewLens`, () => {
    assert(
      ri.peerReviewLens && ri.peerReviewLens.length > 30,
      `peerReviewLens is missing or too short (${ri.peerReviewLens?.length ?? 0} chars)`,
    );
  });
}

console.log("\n4. Every role has handoffProtocol (receives + passes non-empty):");
for (const ri of ROLE_INTELLIGENCE) {
  test(`${ri.role} has handoffProtocol.receives`, () => {
    assert(
      ri.handoffProtocol?.receives && ri.handoffProtocol.receives.length > 0,
      `handoffProtocol.receives is missing or empty`,
    );
  });
  test(`${ri.role} has handoffProtocol.passes`, () => {
    assert(
      ri.handoffProtocol?.passes && ri.handoffProtocol.passes.length > 0,
      `handoffProtocol.passes is missing or empty`,
    );
  });
}

console.log("\n5. Every role has escalationRules (>20 chars):");
for (const ri of ROLE_INTELLIGENCE) {
  test(`${ri.role} has escalationRules`, () => {
    assert(
      ri.escalationRules && ri.escalationRules.length > 20,
      `escalationRules is missing or too short (${ri.escalationRules?.length ?? 0} chars)`,
    );
  });
}

console.log("\n6. Categories are valid:");
for (const ri of ROLE_INTELLIGENCE) {
  test(`${ri.role} category "${ri.category}" is valid`, () => {
    assert(
      VALID_CATEGORIES.has(ri.category),
      `category "${ri.category}" is not one of: ${[...VALID_CATEGORIES].join(", ")}`,
    );
  });
}

console.log("\n7. baseTraitDefaults are valid (0-1 range):");
for (const ri of ROLE_INTELLIGENCE) {
  test(`${ri.role} has valid baseTraitDefaults`, () => {
    assert(ri.baseTraitDefaults, `baseTraitDefaults is missing`);
    for (const key of TRAIT_KEYS) {
      const val = ri.baseTraitDefaults[key];
      assert(
        typeof val === "number" && val >= 0 && val <= 1,
        `${key} = ${val} — must be a number between 0 and 1`,
      );
    }
  });
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${failed === 0 ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}\n`);

process.exit(failed > 0 ? 1 : 0);
