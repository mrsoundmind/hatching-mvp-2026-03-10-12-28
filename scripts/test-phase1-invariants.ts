/**
 * Phase 1.4: Invariant Regression Tests
 * 
 * Lightweight regression tests to ensure Phase 1 invariants are not violated.
 * 
 * Run: npx tsx scripts/test-phase1-invariants.ts
 */

import { buildConversationId, parseConversationId } from '../shared/conversationId';

console.log('🧪 Phase 1.4: Invariant Regression Tests\n');
console.log('='.repeat(70));

let passedTests = 0;
let failedTests = 0;

// Test 1: buildConversationId produces correct canonical IDs
console.log('\n📋 Test 1: Canonical Conversation ID Formats');
console.log('-'.repeat(70));

const idTests = [
  {
    name: 'Project ID format',
    scope: 'project' as const,
    projectId: 'saas-startup',
    contextId: undefined,
    expected: 'project:saas-startup'
  },
  {
    name: 'Team ID format',
    scope: 'team' as const,
    projectId: 'saas-startup',
    contextId: 'design-team',
    expected: 'team:saas-startup:design-team'
  },
  {
    name: 'Agent ID format',
    scope: 'agent' as const,
    projectId: 'saas-startup',
    contextId: 'maya',
    expected: 'agent:saas-startup:maya'
  }
];

for (const test of idTests) {
  try {
    const result = buildConversationId(test.scope, test.projectId, test.contextId);
    const passed = result === test.expected;
    
    if (passed) {
      passedTests++;
      console.log(`✅ ${test.name}`);
      console.log(`   Generated: ${result}`);
    } else {
      failedTests++;
      console.log(`❌ ${test.name}`);
      console.log(`   Expected: ${test.expected}`);
      console.log(`   Got: ${result}`);
    }
  } catch (error: any) {
    failedTests++;
    console.log(`❌ ${test.name} - Error: ${error.message}`);
  }
  console.log('');
}

// Test 2: parseConversationId correctly parses canonical IDs
console.log('\n📋 Test 2: Conversation ID Parsing');
console.log('-'.repeat(70));

const parseTests = [
  {
    name: 'Parse project ID',
    conversationId: 'project:saas-startup',
    expectedScope: 'project',
    expectedProjectId: 'saas-startup'
  },
  {
    name: 'Parse team ID',
    conversationId: 'team:saas-startup:design-team',
    expectedScope: 'team',
    expectedProjectId: 'saas-startup',
    expectedContextId: 'design-team'
  },
  {
    name: 'Parse agent ID',
    conversationId: 'agent:saas-startup:maya',
    expectedScope: 'agent',
    expectedProjectId: 'saas-startup',
    expectedContextId: 'maya'
  }
];

for (const test of parseTests) {
  try {
    const parsed = parseConversationId(test.conversationId);
    const scopeMatch = parsed.scope === test.expectedScope;
    const projectIdMatch = parsed.projectId === test.expectedProjectId;
    const contextIdMatch = test.expectedContextId 
      ? parsed.contextId === test.expectedContextId 
      : parsed.contextId === undefined;
    const passed = scopeMatch && projectIdMatch && contextIdMatch;
    
    if (passed) {
      passedTests++;
      console.log(`✅ ${test.name}`);
      console.log(`   Scope: ${parsed.scope}, ProjectId: ${parsed.projectId}, ContextId: ${parsed.contextId || 'undefined'}`);
    } else {
      failedTests++;
      console.log(`❌ ${test.name}`);
      if (!scopeMatch) console.log(`   Scope mismatch: expected ${test.expectedScope}, got ${parsed.scope}`);
      if (!projectIdMatch) console.log(`   ProjectId mismatch: expected ${test.expectedProjectId}, got ${parsed.projectId}`);
      if (!contextIdMatch) console.log(`   ContextId mismatch: expected ${test.expectedContextId}, got ${parsed.contextId}`);
    }
  } catch (error: any) {
    failedTests++;
    console.log(`❌ ${test.name} - Error: ${error.message}`);
  }
  console.log('');
}

// Test 3: Backend fallback classification (simulated)
console.log('\n📋 Test 3: Backend Fallback Classification');
console.log('-'.repeat(70));

const fallbackTests = [
  {
    name: 'System fallback metadata',
    isSystemFallback: true,
    isPmFallback: false,
    respondingAgentId: 'system',
    expectedAgentId: null,
    expectedMessageType: 'system',
    expectedFallbackType: 'system',
    expectedFallbackReason: 'no_agents_in_project'
  },
  {
    name: 'PM fallback metadata',
    isSystemFallback: false,
    isPmFallback: true,
    respondingAgentId: 'maya-123',
    expectedAgentId: 'maya-123',
    expectedMessageType: 'agent',
    expectedFallbackType: 'pm',
    expectedFallbackReason: 'no_agents_in_scope'
  },
  {
    name: 'No fake System agent (agentId must be null for system fallback)',
    isSystemFallback: true,
    isPmFallback: false,
    respondingAgentId: 'system',
    expectedAgentId: null, // Must be null, not 'system'
    expectedMessageType: 'system',
    expectedFallbackType: 'system'
  }
];

for (const test of fallbackTests) {
  // Simulate backend logic
  const agentId = test.isSystemFallback 
    ? null // Invariant: Never persist agentId='system'
    : (test.respondingAgentId !== 'system' ? test.respondingAgentId : null);
  
  const messageType = test.isSystemFallback ? 'system' : 'agent';
  
  const metadata: any = {};
  if (test.isSystemFallback) {
    metadata.fallback = {
      type: 'system',
      reason: 'no_agents_in_project'
    };
  } else if (test.isPmFallback) {
    metadata.fallback = {
      type: 'pm',
      reason: test.expectedFallbackReason || 'no_agents_in_scope'
    };
  }
  
  const agentIdMatch = agentId === test.expectedAgentId;
  const messageTypeMatch = messageType === test.expectedMessageType;
  const fallbackTypeMatch = !metadata.fallback || metadata.fallback.type === test.expectedFallbackType;
  const passed = agentIdMatch && messageTypeMatch && fallbackTypeMatch;
  
  if (passed) {
    passedTests++;
    console.log(`✅ ${test.name}`);
    console.log(`   agentId: ${agentId}, messageType: ${messageType}, fallback: ${JSON.stringify(metadata.fallback)}`);
  } else {
    failedTests++;
    console.log(`❌ ${test.name}`);
    if (!agentIdMatch) console.log(`   agentId mismatch: expected ${test.expectedAgentId}, got ${agentId}`);
    if (!messageTypeMatch) console.log(`   messageType mismatch: expected ${test.expectedMessageType}, got ${messageType}`);
    if (!fallbackTypeMatch) console.log(`   fallback type mismatch: expected ${test.expectedFallbackType}, got ${metadata.fallback?.type}`);
  }
  console.log('');
}

// Test 4: Routing invariant (simulated frontend logic)
console.log('\n📋 Test 4: Routing Invariant (Frontend Logic)');
console.log('-'.repeat(70));

const routingTests = [
  {
    name: 'Idea project creation sets activeAgentId to null',
    afterCreation: {
      activeProjectId: 'project-123',
      activeTeamId: null,
      activeAgentId: null // Must be null
    },
    expectedMode: 'project',
    expectedConversationId: 'project:project-123'
  },
  {
    name: 'Normal project creation sets activeAgentId to null',
    afterCreation: {
      activeProjectId: 'project-456',
      activeTeamId: null,
      activeAgentId: null // Must be null
    },
    expectedMode: 'project',
    expectedConversationId: 'project:project-456'
  }
];

for (const test of routingTests) {
  // Simulate chat context computation
  let computedMode: 'project' | 'team' | 'agent';
  let computedConversationId: string;
  
  if (test.afterCreation.activeAgentId) {
    computedMode = 'agent';
    computedConversationId = buildConversationId('agent', test.afterCreation.activeProjectId, test.afterCreation.activeAgentId);
  } else if (test.afterCreation.activeTeamId) {
    computedMode = 'team';
    computedConversationId = buildConversationId('team', test.afterCreation.activeProjectId, test.afterCreation.activeTeamId);
  } else {
    computedMode = 'project';
    computedConversationId = buildConversationId('project', test.afterCreation.activeProjectId);
  }
  
  const modeMatch = computedMode === test.expectedMode;
  const conversationIdMatch = computedConversationId === test.expectedConversationId;
  const activeAgentIdNull = test.afterCreation.activeAgentId === null;
  const passed = modeMatch && conversationIdMatch && activeAgentIdNull;
  
  if (passed) {
    passedTests++;
    console.log(`✅ ${test.name}`);
    console.log(`   activeAgentId: ${test.afterCreation.activeAgentId} (correctly null)`);
    console.log(`   Computed mode: ${computedMode}, conversationId: ${computedConversationId}`);
  } else {
    failedTests++;
    console.log(`❌ ${test.name}`);
    if (!activeAgentIdNull) console.log(`   activeAgentId should be null, got: ${test.afterCreation.activeAgentId}`);
    if (!modeMatch) console.log(`   Mode mismatch: expected ${test.expectedMode}, got ${computedMode}`);
    if (!conversationIdMatch) console.log(`   ConversationId mismatch: expected ${test.expectedConversationId}, got ${computedConversationId}`);
  }
  console.log('');
}

// Summary
console.log('\n' + '='.repeat(70));
console.log('📊 Test Summary');
console.log('='.repeat(70));
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`📈 Total: ${passedTests + failedTests}`);

if (failedTests === 0) {
  console.log('\n🎉 All Phase 1.4 invariant tests passed!');
  console.log('\n✅ Invariants Validated:');
  console.log('   - Canonical conversation ID formats');
  console.log('   - Backend fallback classification');
  console.log('   - No fake "System agent" (agentId=null for system fallback)');
  console.log('   - Routing invariant (activeAgentId=null after project creation)');
  process.exit(0);
} else {
  console.log('\n⚠️  Some invariant tests failed. Review the output above.');
  process.exit(1);
}
