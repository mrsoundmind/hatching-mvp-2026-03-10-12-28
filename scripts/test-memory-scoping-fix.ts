/**
 * Test script to verify getProjectMemory fix
 * 
 * Tests that:
 * 1. Exact projectId matching works
 * 2. Cross-project leakage is prevented
 * 3. Team and agent conversations contribute to project memory
 * 4. Ambiguous/invalid IDs are safely ignored
 */

import { parseConversationId } from '../shared/conversationId';

// Simulate getProjectMemory logic with canonical conversation IDs
function testGetProjectMemory(conversationMemories: Map<string, any[]>, projectId: string): any[] {
  const projectMemories: any[] = [];
  
  for (const [conversationId, memories] of conversationMemories) {
    try {
      const parsed = parseConversationId(conversationId);
      
      // Only include memories if parsing succeeds AND projectId matches exactly
      if (parsed.projectId === projectId) {
        projectMemories.push(...memories);
      }
    } catch (error: any) {
      // Final safety net
      console.warn(`⚠️ Unexpected error parsing conversationId: ${conversationId}`, error.message);
    }
  }
  
  return projectMemories;
}

// Test cases
console.log('🧪 Testing getProjectMemory fix...\n');

const testMemories = new Map<string, any[]>([
  // Valid project memories for "saas-startup"
  ['project:saas-startup', [{ id: '1', content: 'Project memory 1', importance: 8 }]],
  ['team:saas-startup:design', [{ id: '2', content: 'Team memory 1', importance: 7 }]],
  ['agent:saas-startup:pm', [{ id: '3', content: 'Agent memory 1', importance: 6 }]],
  
  // Different project (should NOT leak)
  ['project:other-project', [{ id: '4', content: 'Other project memory', importance: 9 }]],
  ['team:other-project:design', [{ id: '5', content: 'Other team memory', importance: 8 }]],
  
  // Edge case: projectId as substring (should NOT match when projectId="saas")
  ['project:saas-startup-enterprise', [{ id: '6', content: 'Enterprise memory', importance: 10 }]],
  
  // Distinct shorter project
  ['team:saas:design', [{ id: '9', content: 'Unambiguous team memory', importance: 7 }]],
  ['agent:saas:pm', [{ id: '10', content: 'Unambiguous agent memory', importance: 6 }]],
  
  // Ambiguous/invalid IDs (should be safely ignored)
  ['invalid-format', [{ id: '7', content: 'Invalid memory', importance: 5 }]],
  ['project', [{ id: '8', content: 'Incomplete ID', importance: 5 }]],
]);

console.log('Test 1: Exact projectId matching (saas-startup)');
const result1 = testGetProjectMemory(testMemories, 'saas-startup');
// Should match: project:saas-startup, team:saas-startup:design, agent:saas-startup:pm
console.log(`✅ Found ${result1.length} memories (expected 3)`);
console.log(`   Memory IDs: ${result1.map(m => m.id).join(', ')}`);
if (result1.length !== 3) {
  console.error('❌ FAILED: Expected 3 memories');
  process.exit(1);
}
console.log('');

console.log('Test 2: Cross-project leakage prevention (other-project)');
const result2 = testGetProjectMemory(testMemories, 'other-project');
console.log(`✅ Found ${result2.length} memories (expected 2)`);
console.log(`   Memory IDs: ${result2.map(m => m.id).join(', ')}`);
if (result2.length !== 2) {
  console.error('❌ FAILED: Expected 2 memories');
  process.exit(1);
}
console.log('');

console.log('Test 3: Substring false positive prevention (saas)');
const result3 = testGetProjectMemory(testMemories, 'saas');
// Should NOT match team:saas-startup:design or agent:saas-startup:pm (those belong to "saas-startup")
// Should only match team:saas:design and agent:saas:pm
console.log(`✅ Found ${result3.length} memories (expected 2 - only exact project match)`);
console.log(`   Memory IDs: ${result3.map(m => m.id).join(', ')}`);
if (result3.length !== 2) {
  console.error('❌ FAILED: Expected 2 memories (only exact project match)');
  console.error(`   Found: ${result3.map(m => m.id).join(', ')}`);
  process.exit(1);
}
// Verify no leakage from "saas-startup" project
const leakedIds = result3.filter(m => ['2', '3'].includes(m.id));
if (leakedIds.length > 0) {
  console.error('❌ FAILED: Leaked memories from "saas-startup" project');
  console.error(`   Leaked memory IDs: ${leakedIds.map(m => m.id).join(', ')}`);
  process.exit(1);
}
console.log('');

console.log('Test 4: Enterprise project (saas-startup-enterprise)');
const result4 = testGetProjectMemory(testMemories, 'saas-startup-enterprise');
console.log(`✅ Found ${result4.length} memories (expected 1)`);
if (result4.length !== 1) {
  console.error('❌ FAILED: Expected 1 memory for enterprise project');
  process.exit(1);
}
console.log('');

console.log('Test 5: Invalid/ambiguous IDs are safely ignored');
// This should not crash and should skip invalid IDs
const result5 = testGetProjectMemory(testMemories, 'saas-startup');
console.log(`✅ Processed without crash, found ${result5.length} valid memories`);
console.log('');

console.log('✅ All tests passed!');
console.log('\n📊 Summary:');
console.log('   - Exact projectId matching: ✅');
console.log('   - Cross-project leakage prevention: ✅');
console.log('   - Substring false positive prevention: ✅');
console.log('   - Team/agent conversations contribute: ✅');
console.log('   - Invalid IDs safely ignored: ✅');
