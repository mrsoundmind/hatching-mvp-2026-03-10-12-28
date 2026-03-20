// Test: Intent classifier pipeline is wired into chat.ts (replaces old broken extraction)

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const chatTsPath = path.resolve(__dirname, '../server/routes/chat.ts');
const chatTsContent = fs.readFileSync(chatTsPath, 'utf-8');

console.log('=== Intent Classifier Wiring Tests ===\n');

// Test 1: classifyTaskIntent is actually CALLED (not just imported)
const importIdx = chatTsContent.indexOf('import { classifyTaskIntent }');
const callMatch = chatTsContent.match(/classifyTaskIntent\(/g);
const callCount = callMatch ? callMatch.length : 0;
// If only the import line contains it, callCount would be 0 for actual calls
const hasCall = callCount > 0 && chatTsContent.indexOf('classifyTaskIntent(') !== importIdx;

if (hasCall) {
  console.log('  PASS: classifyTaskIntent() is called in chat.ts');
} else {
  console.log('  FAIL: classifyTaskIntent() is imported but never called in chat.ts');
}

console.log(`\n=== Results: ${hasCall ? 1 : 0} passed, ${hasCall ? 0 : 1} failed ===`);
process.exit(hasCall ? 0 : 1);
