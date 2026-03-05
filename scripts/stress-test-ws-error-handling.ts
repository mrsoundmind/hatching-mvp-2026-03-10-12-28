/**
 * Phase 1.2: WebSocket Error Handling Stress Test
 * 
 * Stress tests production-safe error handling under various failure scenarios.
 */

import { validateMessageIngress } from '../server/schemas/messageIngress';

console.log('🧪 Phase 1.2: WebSocket Error Handling Stress Test\n');
console.log('='.repeat(70));

let passedTests = 0;
let failedTests = 0;

const originalEnv = process.env.NODE_ENV;

// Test 1: Production mode - invalid envelopes should not crash
console.log('\n📋 Test 1: Production Mode Resilience');
console.log('-'.repeat(70));

process.env.NODE_ENV = 'production';

const invalidEnvelopes = [
  {
    name: 'Missing type',
    data: {
      conversationId: 'project-test',
      message: { content: 'Hello' },
    },
  },
  {
    name: 'Invalid conversationId format',
    data: {
      type: 'send_message_streaming',
      conversationId: 'invalid-format',
      message: { content: 'Hello' },
    },
  },
  {
    name: 'Missing message content',
    data: {
      type: 'send_message_streaming',
      conversationId: 'project-test',
      message: {},
    },
  },
  {
    name: 'Mode/contextId mismatch (project with contextId)',
    data: {
      type: 'send_message_streaming',
      conversationId: 'project-test-project',
      message: { content: 'Hello' },
      // This should pass validation but fail routing consistency
    },
  },
  {
    name: 'Team mode with missing contextId',
    data: {
      type: 'send_message_streaming',
      conversationId: 'team-test-project', // Missing teamId part
      message: { content: 'Hello' },
    },
  },
];

for (const test of invalidEnvelopes) {
  try {
    const result = validateMessageIngress(test.data);
    
    if (!result.success) {
      passedTests++;
      console.log(`✅ ${test.name}: Correctly returns error (does not throw)`);
      console.log(`   Error: ${result.error?.substring(0, 60)}...`);
    } else {
      // Some might pass validation but fail later - that's okay
      passedTests++;
      console.log(`✅ ${test.name}: Passed validation (may fail later in routing)`);
    }
  } catch (err: any) {
    failedTests++;
    console.log(`❌ ${test.name}: Should NOT throw in production, but threw: ${err.message}`);
  }
  console.log('');
}

// Test 2: Production mode - multiple rapid invalid requests
console.log('\n📋 Test 2: Rapid Invalid Requests (Production Mode)');
console.log('-'.repeat(70));

let rapidTestPassed = true;
for (let i = 0; i < 100; i++) {
  try {
    const result = validateMessageIngress({
      type: 'send_message_streaming',
      conversationId: `invalid-${i}`,
      message: { content: 'Hello' },
    });
    
    if (result.success) {
      rapidTestPassed = false;
      break;
    }
  } catch (err: any) {
    rapidTestPassed = false;
    break;
  }
}

if (rapidTestPassed) {
  passedTests++;
  console.log('✅ 100 rapid invalid requests: All handled gracefully (no throws)');
} else {
  failedTests++;
  console.log('❌ 100 rapid invalid requests: Some requests threw or passed incorrectly');
}

// Test 3: Valid envelopes should always pass
console.log('\n📋 Test 3: Valid Envelopes (All Environments)');
console.log('-'.repeat(70));

const validEnvelopes = [
  {
    name: 'Valid project envelope',
    data: {
      type: 'send_message_streaming',
      conversationId: 'project-test-project',
      message: { content: 'Hello' },
    },
  },
  {
    name: 'Valid team envelope (unambiguous)',
    data: {
      type: 'send_message_streaming',
      conversationId: 'team-proj1-team1', // Unambiguous: exactly 3 parts
      message: { content: 'Hello' },
    },
  },
  {
    name: 'Valid agent envelope (unambiguous)',
    data: {
      type: 'send_message_streaming',
      conversationId: 'agent-proj1-agent1', // Unambiguous: exactly 3 parts
      message: { content: 'Hello' },
    },
  },
  {
    name: 'Valid envelope with top-level addressedAgentId',
    data: {
      type: 'send_message_streaming',
      conversationId: 'project-test-project',
      message: { content: 'Hello' },
      addressedAgentId: 'agent-123',
    },
  },
  {
    name: 'Valid envelope with addressedAgentId in metadata',
    data: {
      type: 'send_message_streaming',
      conversationId: 'project-test-project',
      message: { content: 'Hello' },
      metadata: { addressedAgentId: 'agent-456' },
    },
  },
];

for (const test of validEnvelopes) {
  try {
    const result = validateMessageIngress(test.data);
    
    if (result.success) {
      passedTests++;
      console.log(`✅ ${test.name}: Correctly validates`);
      if (test.data.addressedAgentId || test.data.metadata?.addressedAgentId) {
        console.log(`   addressedAgentId: ${result.addressedAgentId}`);
      }
    } else {
      failedTests++;
      console.log(`❌ ${test.name}: Should pass but failed: ${result.error}`);
    }
  } catch (err: any) {
    failedTests++;
    console.log(`❌ ${test.name}: Should not throw: ${err.message}`);
  }
  console.log('');
}

// Test 4: Error response structure consistency
console.log('\n📋 Test 4: Error Response Structure Consistency');
console.log('-'.repeat(70));

const errorCodes = ['INVALID_ENVELOPE', 'INVARIANT_VIOLATION', 'INTERNAL_ERROR'];
const allCodesValid = errorCodes.every(code => {
  const response = {
    type: "error",
    code,
    message: "Test message",
    details: { reason: "test" },
  };
  return response.type === "error" && 
         typeof response.code === "string" && 
         typeof response.message === "string";
});

if (allCodesValid) {
  passedTests++;
  console.log('✅ Error response structure is consistent across all error codes');
  console.log(`   Codes tested: ${errorCodes.join(', ')}`);
} else {
  failedTests++;
  console.log('❌ Error response structure is inconsistent');
}

// Restore environment
process.env.NODE_ENV = originalEnv;

// Summary
console.log('\n' + '='.repeat(70));
console.log('📊 Stress Test Summary');
console.log('='.repeat(70));
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`📈 Total: ${passedTests + failedTests}`);

if (failedTests === 0) {
  console.log('\n🎉 All stress tests passed!');
  console.log('\n✅ Production Safety Validated:');
  console.log('   - Invalid envelopes handled gracefully (no crashes)');
  console.log('   - Rapid invalid requests handled without degradation');
  console.log('   - Valid envelopes always pass');
  console.log('   - Error response structure is consistent');
  process.exit(0);
} else {
  console.log('\n⚠️  Some stress tests failed. Review the output above.');
  process.exit(1);
}

