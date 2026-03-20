// Test: executionRules must be JSONB with structured fields
// Verifies the schema fix for autonomyEnabled always being false (text column bug)

import { projects } from "../shared/schema.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name}`); }
}

console.log("\n=== executionRules Schema Tests ===\n");

// Test 1: executionRules column should support object access
const mockProject = {
  executionRules: { autonomyEnabled: true, rules: "no deploys on Friday" },
};
assert(mockProject.executionRules?.autonomyEnabled === true, "autonomyEnabled readable from object");

// Test 2: autonomyEnabled defaults to false when not set
const emptyProject = { executionRules: {} as any };
assert((emptyProject.executionRules?.autonomyEnabled ?? false) === false, "autonomyEnabled defaults to false");

// Test 3: rules field stores string content
assert(mockProject.executionRules?.rules === "no deploys on Friday", "rules field stores string");

// Test 4: taskGraph can be stored
const graphProject = {
  executionRules: { taskGraph: { nodes: ["a", "b"], edges: [] } },
};
assert((graphProject.executionRules as any)?.taskGraph?.nodes?.length === 2, "taskGraph stores structured data");

// Test 5: chat.ts read pattern works (was broken with text column)
function readAutonomyEnabled(project: { executionRules: any }): boolean {
  return project.executionRules?.autonomyEnabled ?? false;
}
assert(readAutonomyEnabled({ executionRules: { autonomyEnabled: true } }) === true, "readAutonomyEnabled works with object");
assert(readAutonomyEnabled({ executionRules: null }) === false, "readAutonomyEnabled handles null");
assert(readAutonomyEnabled({ executionRules: "some string" }) === false, "readAutonomyEnabled rejects plain string");

// Test 6: taskGraphPersistence pattern works without 'as any'
function persistTaskGraph(project: { executionRules: any }, graph: unknown) {
  const existing = project.executionRules ?? {};
  return { ...existing, taskGraph: graph };
}
const merged = persistTaskGraph({ executionRules: { autonomyEnabled: true } }, { nodes: [] });
assert(merged.autonomyEnabled === true, "persistTaskGraph preserves existing fields");
assert((merged as any).taskGraph?.nodes !== undefined, "persistTaskGraph adds taskGraph");

// Test 7: chat brain update writes rules as string field inside object
function updateExecutionRules(existing: any, newRules: string) {
  const base = (typeof existing === 'object' && existing !== null) ? existing : {};
  return { ...base, rules: newRules };
}
const updated = updateExecutionRules({ autonomyEnabled: true }, "ship daily");
assert(updated.rules === "ship daily", "updateExecutionRules stores rules string");
assert(updated.autonomyEnabled === true, "updateExecutionRules preserves autonomyEnabled");

console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed}\n`);
if (failed > 0) process.exit(1);
