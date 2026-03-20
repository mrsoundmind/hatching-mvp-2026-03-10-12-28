// Test: executionRules schema must be JSONB, not text
// This test FAILS because the current schema defines executionRules as text("execution_rules")
// which means .autonomyEnabled access always returns undefined

import { projects } from "../shared/schema.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name}`); }
}

console.log("\n=== executionRules Schema Type Tests ===\n");

// The column config object tells us what SQL type Drizzle will use
const col = (projects.executionRules as any);
const dataType = col.dataType;
const columnType = col.columnType;

// Test 1: executionRules must be jsonb, not text
assert(dataType === 'json', `executionRules dataType should be 'json', got '${dataType}'`);

// Test 2: column type must be PgJsonb
assert(columnType === 'PgJsonb', `executionRules columnType should be 'PgJsonb', got '${columnType}'`);

// Test 3: default should be an empty object
const defaultValue = col.default;
assert(typeof defaultValue === 'object' && defaultValue !== null, `executionRules default should be object, got ${typeof defaultValue}`);

console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed}\n`);
if (failed > 0) process.exit(1);
