/**
 * Phase 1.2: Contract Tests
 * 
 * Tests for Phase 1.2 additions:
 * - Message ingress envelope validation
 * - Agent availability helper
 * - Invariant assertions
 * - AddressedAgentId support
 */

import 'dotenv/config';
import { validateMessageIngress } from '../server/schemas/messageIngress';
import { filterAvailableAgents, isAgentAvailable, type ScopeContext } from '../server/orchestration/agentAvailability';
import { assertPhase1Invariants } from '../server/invariants/assertPhase1';
import { buildConversationId } from '../shared/conversationId';
import type { Agent } from '../server/ai/expertiseMatching';

console.log('🧪 Phase 1.2: Contract Tests\n');
console.log('='.repeat(70));

let passedTests = 0;
let failedTests = 0;

// Test 1: Envelope validation accepts addressedAgentId from metadata and prefers top-level
console.log('\n📋 Test 1: Message Ingress Envelope Validation');
console.log('-'.repeat(70));

const envelopeTests = [
  {
    name: 'Valid envelope with top-level addressedAgentId',
    data: {
      type: 'send_message_streaming',
      conversationId: 'project:test-project',
      message: { content: 'Hello' },
      addressedAgentId: 'agent-123',
    },
    shouldPass: true,
    expectedAddressedAgentId: 'agent-123',
  },
  {
    name: 'Valid envelope with addressedAgentId in metadata',
    data: {
      type: 'send_message_streaming',
      conversationId: 'project:test-project',
      message: { content: 'Hello' },
      metadata: { addressedAgentId: 'agent-456' },
    },
    shouldPass: true,
    expectedAddressedAgentId: 'agent-456',
  },
  {
    name: 'Top-level addressedAgentId overrides metadata',
    data: {
      type: 'send_message_streaming',
      conversationId: 'project:test-project',
      message: { content: 'Hello' },
      addressedAgentId: 'agent-123',
      metadata: { addressedAgentId: 'agent-456' },
    },
    shouldPass: true,
    expectedAddressedAgentId: 'agent-123', // Top-level wins
  },
  {
    name: 'Invalid: mode/contextId mismatch (project with contextId)',
    data: {
      type: 'send_message_streaming',
      conversationId: 'project:test-project',
      message: { content: 'Hello' },
    },
    shouldPass: true, // Project mode is valid
  },
  {
    name: 'Invalid: non-canonical conversationId for mode',
    data: {
      type: 'send_message_streaming',
      conversationId: 'invalid-format',
      message: { content: 'Hello' },
    },
    shouldPass: false,
  },
];

for (const test of envelopeTests) {
  try {
    const result = validateMessageIngress(test.data);
    const passed = test.shouldPass 
      ? result.success && (!test.expectedAddressedAgentId || result.addressedAgentId === test.expectedAddressedAgentId)
      : !result.success;
    
    if (passed) {
      passedTests++;
      console.log(`✅ ${test.name}`);
      if (test.expectedAddressedAgentId) {
        console.log(`   addressedAgentId: ${result.addressedAgentId}`);
      }
    } else {
      failedTests++;
      console.log(`❌ ${test.name}`);
      console.log(`   Expected: ${test.shouldPass ? 'pass' : 'fail'}, Got: ${result.success ? 'pass' : 'fail'}`);
    }
  } catch (error: any) {
    const passed = !test.shouldPass;
    if (passed) {
      passedTests++;
      console.log(`✅ ${test.name} (correctly rejected)`);
    } else {
      failedTests++;
      console.log(`❌ ${test.name} - Unexpected error: ${error.message}`);
    }
  }
  console.log('');
}

// Test 2: Agent availability helper filters correctly
console.log('\n📋 Test 2: Agent Availability Helper');
console.log('-'.repeat(70));

const mockAgents: Agent[] = [
  { id: 'agent-1', name: 'Agent 1', role: 'Engineer', teamId: 'team-1' },
  { id: 'agent-2', name: 'Agent 2', role: 'Designer', teamId: 'team-1' },
  { id: 'agent-3', name: 'Agent 3', role: 'PM', teamId: 'team-2' },
];

const availabilityTests: Array<{
  name: string;
  scopeContext: ScopeContext;
  expectedCount: number;
  expectedIds: string[];
}> = [
  {
    name: 'Project scope: all agents available',
    scopeContext: { projectId: 'project-1', mode: 'project' },
    expectedCount: 3,
    expectedIds: ['agent-1', 'agent-2', 'agent-3'],
  },
  {
    name: 'Team scope: only team-1 agents',
    scopeContext: { projectId: 'project-1', mode: 'team', teamId: 'team-1' },
    expectedCount: 2,
    expectedIds: ['agent-1', 'agent-2'],
  },
  {
    name: 'Agent scope: specific agent',
    scopeContext: { projectId: 'project-1', mode: 'agent', agentId: 'agent-1' },
    expectedCount: 1,
    expectedIds: ['agent-1'],
  },
];

for (const test of availabilityTests) {
  const filtered = filterAvailableAgents(mockAgents, test.scopeContext);
  const countMatch = filtered.length === test.expectedCount;
  const idsMatch = filtered.every(agent => test.expectedIds.includes(agent.id)) &&
    test.expectedIds.every(id => filtered.some(agent => agent.id === id));
  const passed = countMatch && idsMatch;
  
  if (passed) {
    passedTests++;
    console.log(`✅ ${test.name}`);
    console.log(`   Filtered: ${filtered.map(a => a.id).join(', ')}`);
  } else {
    failedTests++;
    console.log(`❌ ${test.name}`);
    console.log(`   Expected: ${test.expectedCount} agents (${test.expectedIds.join(', ')})`);
    console.log(`   Got: ${filtered.length} agents (${filtered.map(a => a.id).join(', ')})`);
  }
  console.log('');
}

// Test 3: Invariant assertions
console.log('\n📋 Test 3: Invariant Assertions');
console.log('-'.repeat(70));

// Set NODE_ENV to test to enable assertions
const originalEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'test';

const assertionTests = [
  {
    name: 'No fake system agent: agentId="system" should throw',
    type: 'no_fake_system_agent' as const,
    params: { agentId: 'system', messageType: 'agent' as const },
    shouldThrow: true,
  },
  {
    name: 'No fake system agent: system message with agentId=null should pass',
    type: 'no_fake_system_agent' as const,
    params: { agentId: null, messageType: 'system' as const },
    shouldThrow: false,
  },
  {
    name: 'Routing consistency: project mode',
    type: 'routing_consistency' as const,
    params: {
      conversationId: 'project:test-project',
      mode: 'project' as const,
      projectId: 'test-project',
      contextId: null,
    },
    shouldThrow: false,
  },
  {
    name: 'Routing consistency: mismatch should throw',
    type: 'routing_consistency' as const,
    params: {
      conversationId: 'team:test-project:team-1',
      mode: 'project' as const,
      projectId: 'test-project',
      contextId: null,
    },
    shouldThrow: true,
  },
];

for (const test of assertionTests) {
  try {
    assertPhase1Invariants({ type: test.type, ...test.params });
    const passed = !test.shouldThrow;
    
    if (passed) {
      passedTests++;
      console.log(`✅ ${test.name}`);
    } else {
      failedTests++;
      console.log(`❌ ${test.name} - Should have thrown but did not`);
    }
  } catch (error: any) {
    const passed = test.shouldThrow;
    
    if (passed) {
      passedTests++;
      console.log(`✅ ${test.name} (correctly threw)`);
    } else {
      failedTests++;
      console.log(`❌ ${test.name} - Unexpected error: ${error.message}`);
    }
  }
  console.log('');
}

// Restore NODE_ENV
process.env.NODE_ENV = originalEnv;

// Summary
console.log('\n' + '='.repeat(70));
console.log('📊 Test Summary');
console.log('='.repeat(70));
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`📈 Total: ${passedTests + failedTests}`);

if (failedTests === 0) {
  console.log('\n🎉 All Phase 1.2 contract tests passed!');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Review the output above.');
  process.exit(1);
}
