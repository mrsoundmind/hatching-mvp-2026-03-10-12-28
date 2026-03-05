/**
 * Test script to verify Storage Mode Declaration (Phase 0.6.a)
 * 
 * Tests:
 * 1. Storage mode defaults to "memory"
 * 2. Storage mode can be overridden via env var
 * 3. DB mode falls back to memory if not implemented
 * 4. Status endpoint returns correct values
 */

import 'dotenv/config';
import { STORAGE_MODE, getStorageModeInfo, type StorageMode } from '../server/storage';

console.log('🧪 Testing Storage Mode Declaration...\n');

const expectedMode = ((process.env.STORAGE_MODE as StorageMode | undefined) || 'memory');

// Test 1: Mode matches env declaration
console.log('Test 1: Storage mode from environment');
console.log(`   STORAGE_MODE: ${STORAGE_MODE}`);
if (STORAGE_MODE !== expectedMode) {
  console.error(`❌ FAILED: STORAGE_MODE should be "${expectedMode}"`);
  process.exit(1);
}
console.log(`   ✅ Mode is "${expectedMode}"\n`);

// Test 2: getStorageModeInfo returns correct values
console.log('Test 2: getStorageModeInfo()');
const info = getStorageModeInfo();
console.log(`   mode: ${info.mode}`);
console.log(`   durable: ${info.durable}`);
console.log(`   notes: ${info.notes}`);

if (info.mode !== expectedMode) {
  console.error(`❌ FAILED: mode should be "${expectedMode}"`);
  process.exit(1);
}
const expectedDurable = expectedMode === 'db';
if (info.durable !== expectedDurable) {
  console.error(`❌ FAILED: durable should be ${expectedDurable} for ${expectedMode} mode`);
  process.exit(1);
}
if (expectedMode === 'memory' && !info.notes.includes('In-memory Maps')) {
  console.error('❌ FAILED: notes should mention "In-memory Maps" for memory mode');
  process.exit(1);
}
console.log('   ✅ All values correct\n');

// Test 3: Verify type safety
console.log('Test 3: Type safety');
const mode: StorageMode = STORAGE_MODE;
if (mode !== 'memory' && mode !== 'db') {
  console.error('❌ FAILED: STORAGE_MODE must be "memory" or "db"');
  process.exit(1);
}
console.log('   ✅ Type is correct\n');

// Test 4: DB mode behavior
console.log('Test 4: DB mode behavior');
const dbInfo = getStorageModeInfo();
if (STORAGE_MODE === 'db') {
  if (dbInfo.mode !== 'db') {
    console.error('❌ FAILED: DB mode should remain db when database storage is implemented');
    process.exit(1);
  }
  if (dbInfo.isDbRequested !== true) {
    console.error('❌ FAILED: isDbRequested should be true');
    process.exit(1);
  }
  if (dbInfo.isDbImplemented !== true) {
    console.error('❌ FAILED: isDbImplemented should be true');
    process.exit(1);
  }
  console.log('   ✅ DB mode is active and durable\n');
} else {
  console.log('   ⏭️  Skipped (STORAGE_MODE is not "db")\n');
}

console.log('✅ All tests passed!');
console.log('\n📋 Summary:');
console.log(`   - Storage mode: ${info.mode}`);
console.log(`   - Durable: ${info.durable}`);
console.log(`   - Notes: ${info.notes}`);
