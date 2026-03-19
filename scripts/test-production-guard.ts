// Test: assertProductionStorageMode() exported from server/index.ts
// Test 1: production + memory → throws with message mentioning STORAGE_MODE=db

function assert(condition: boolean, message: string) {
  if (!condition) { throw new Error(message); }
}

async function main() {
  // Import the guard function — pure function, no side effects, no DB connection
  const { assertProductionStorageMode } = await import('../server/productionGuard.js');

  assert(
    typeof assertProductionStorageMode === 'function',
    'assertProductionStorageMode must be exported from server/productionGuard.ts'
  );

  // Test 1: production + memory → throws
  let threw = false;
  try {
    assertProductionStorageMode('production', 'memory');
  } catch (e: any) {
    threw = true;
    assert(
      e.message.includes('STORAGE_MODE=db'),
      `Error should mention STORAGE_MODE=db, got: ${e.message}`
    );
  }
  assert(threw, 'assertProductionStorageMode should throw when NODE_ENV=production and STORAGE_MODE=memory');

  // Test 2: production + db → should NOT throw
  let threwOnDb = false;
  try {
    assertProductionStorageMode('production', 'db');
  } catch { threwOnDb = true; }
  assert(!threwOnDb, 'assertProductionStorageMode should NOT throw when STORAGE_MODE=db');

  // Test 3: development + memory → should NOT throw
  let threwOnDev = false;
  try {
    assertProductionStorageMode('development', 'memory');
  } catch { threwOnDev = true; }
  assert(!threwOnDev, 'assertProductionStorageMode should NOT throw in development regardless of STORAGE_MODE');

  // Test 4: server/index.ts must call assertProductionStorageMode (not just import it)
  const fs = await import('fs');
  const indexSource = fs.readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');
  assert(
    /assertProductionStorageMode\(/.test(indexSource),
    'server/index.ts must invoke assertProductionStorageMode() as a call expression'
  );

  // Test 5: CenterPanel.tsx must include idempotencyKey in WS metadata (at least 2 occurrences)
  const centerPanelSource = fs.readFileSync(new URL('../client/src/components/CenterPanel.tsx', import.meta.url), 'utf8');
  const idempotencyCount = (centerPanelSource.match(/idempotencyKey/g) || []).length;
  assert(
    idempotencyCount >= 2,
    `CenterPanel.tsx must include idempotencyKey in at least 2 WS send locations, found: ${idempotencyCount}`
  );

  console.log('[test:production-guard] PASS');
}

main().catch((error) => {
  console.error('[test:production-guard] FAIL', error.message);
  process.exit(1);
});
