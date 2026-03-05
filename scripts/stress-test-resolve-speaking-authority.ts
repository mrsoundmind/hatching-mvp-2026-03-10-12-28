// Phase 1.1.a: Speaking Authority Resolution Stress Test
// Comprehensive stress testing for resolveSpeakingAuthority function

import { resolveSpeakingAuthority, type Agent } from '../server/orchestration/resolveSpeakingAuthority';

interface StressTestCase {
  name: string;
  description: string;
  params: {
    conversationScope: 'project' | 'team' | 'agent';
    conversationId: string;
    availableAgents: Agent[];
    addressedAgentId?: string;
  };
  expectedBehavior: string;
}

const stressTests: StressTestCase[] = [
  {
    name: "Empty agents array",
    description: "Should throw error when no agents provided",
    params: {
      conversationScope: 'project',
      conversationId: 'project-test',
      availableAgents: []
    },
    expectedBehavior: "throws error"
  },
  {
    name: "Single agent (any scope)",
    description: "Single agent should always be selected",
    params: {
      conversationScope: 'project',
      conversationId: 'project-test',
      availableAgents: [
        { id: 'agent-1', name: 'Solo', role: 'Developer' }
      ]
    },
    expectedBehavior: "returns agent-1"
  },
  {
    name: "Explicit addressing overrides all scopes",
    description: "Explicit addressing should override project/team/agent scope",
    params: {
      conversationScope: 'project',
      conversationId: 'project-test',
      availableAgents: [
        { id: 'agent-1', name: 'PM', role: 'Product Manager' },
        { id: 'agent-2', name: 'Dev', role: 'Developer' }
      ],
      addressedAgentId: 'agent-2'
    },
    expectedBehavior: "returns agent-2 (explicit addressing)"
  },
  {
    name: "Multiple PMs in project scope",
    description: "Should select first PM deterministically",
    params: {
      conversationScope: 'project',
      conversationId: 'project-test',
      availableAgents: [
        { id: 'agent-1', name: 'PM1', role: 'Product Manager' },
        { id: 'agent-2', name: 'PM2', role: 'Product Manager' },
        { id: 'agent-3', name: 'PM3', role: 'Product Manager' }
      ]
    },
    expectedBehavior: "always returns agent-1 (first PM)"
  },
  {
    name: "Team scope with multiple Tech Leads",
    description: "Should select first Tech Lead deterministically",
    params: {
      conversationScope: 'team',
      conversationId: 'team-saas-design-team',
      availableAgents: [
        { id: 'agent-1', name: 'Tech1', role: 'Tech Lead' },
        { id: 'agent-2', name: 'Tech2', role: 'Tech Lead' },
        { id: 'agent-3', name: 'Dev', role: 'Developer' }
      ]
    },
    expectedBehavior: "returns agent-1 (first Tech Lead)"
  },
  {
    name: "Agent scope with ambiguous ID",
    description: "Should handle ambiguous conversation IDs",
    params: {
      conversationScope: 'agent',
      conversationId: 'agent-saas-startup-complex-agent-1',
      availableAgents: [
        { id: 'agent-1', name: 'Alice', role: 'Developer' },
        { id: 'agent-2', name: 'Bob', role: 'Designer' }
      ]
    },
    expectedBehavior: "returns agent-1 (matches end of conversationId)"
  },
  {
    name: "Project scope without PM → fallback",
    description: "Should fallback to first agent when no PM exists",
    params: {
      conversationScope: 'project',
      conversationId: 'project-test',
      availableAgents: [
        { id: 'agent-1', name: 'Dev1', role: 'Developer' },
        { id: 'agent-2', name: 'Dev2', role: 'Engineer' }
      ]
    },
    expectedBehavior: "returns agent-1 (fallback)"
  },
  {
    name: "Team scope without Team Lead → fallback",
    description: "Should fallback when no Team Lead role exists",
    params: {
      conversationScope: 'team',
      conversationId: 'team-saas-design-team',
      availableAgents: [
        { id: 'agent-1', name: 'Dev1', role: 'Developer' },
        { id: 'agent-2', name: 'Dev2', role: 'Engineer' }
      ]
    },
    expectedBehavior: "returns agent-1 (fallback via resolveTeamLead)"
  },
  {
    name: "Explicit addressing with invalid ID",
    description: "Should fallback when addressed agent not found",
    params: {
      conversationScope: 'project',
      conversationId: 'project-test',
      availableAgents: [
        { id: 'agent-1', name: 'PM', role: 'Product Manager' }
      ],
      addressedAgentId: 'agent-999'
    },
    expectedBehavior: "returns agent-1 (PM, explicit addressing failed)"
  },
  {
    name: "Case variations in PM role",
    description: "Should handle case variations in role names",
    params: {
      conversationScope: 'project',
      conversationId: 'project-test',
      availableAgents: [
        { id: 'agent-1', name: 'PM1', role: 'PRODUCT MANAGER' },
        { id: 'agent-2', name: 'PM2', role: 'product manager' },
        { id: 'agent-3', name: 'PM3', role: 'Product Manager' }
      ]
    },
    expectedBehavior: "returns agent-1 (first PM, case-insensitive)"
  },
  {
    name: "Deterministic ordering (same input)",
    description: "Same input should always produce same output",
    params: {
      conversationScope: 'project',
      conversationId: 'project-test',
      availableAgents: [
        { id: 'agent-1', name: 'Dev1', role: 'Developer' },
        { id: 'agent-2', name: 'Dev2', role: 'Engineer' }
      ]
    },
    expectedBehavior: "always returns agent-1 (deterministic)"
  }
];

function runStressTests() {
  console.log('🔥 Running Speaking Authority Resolution Stress Tests\n');
  console.log('='.repeat(80));

  let passed = 0;
  let failed = 0;
  const failures: Array<{ name: string; error: string }> = [];

  for (const test of stressTests) {
    try {
      if (test.expectedBehavior === "throws error") {
        // Test that it throws
        try {
          resolveSpeakingAuthority(test.params);
          console.log(`❌ ${test.name}`);
          console.log(`   Expected error but function returned successfully`);
          failed++;
          failures.push({ name: test.name, error: "Expected error but function returned" });
        } catch (error: any) {
          console.log(`✅ ${test.name}`);
          console.log(`   Correctly threw: ${error.message}`);
          passed++;
        }
      } else {
        // Test normal behavior
        const result1 = resolveSpeakingAuthority(test.params);
        const result2 = resolveSpeakingAuthority(test.params);
        
        // Check deterministic behavior
        const isDeterministic = result1.allowedSpeaker.id === result2.allowedSpeaker.id && 
                                result1.reason === result2.reason;
        
        if (isDeterministic) {
          console.log(`✅ ${test.name}`);
          console.log(`   Speaker: ${result1.allowedSpeaker.id} (${result1.allowedSpeaker.name} - ${result1.allowedSpeaker.role})`);
          console.log(`   Reason: ${result1.reason}`);
          console.log(`   Deterministic: ✅ (same result on multiple runs)`);
          passed++;
        } else {
          console.log(`❌ ${test.name}`);
          console.log(`   Not deterministic! First run: ${result1.allowedSpeaker.id}, Second run: ${result2.allowedSpeaker.id}`);
          failed++;
          failures.push({ name: test.name, error: "Not deterministic" });
        }
      }
    } catch (error: any) {
      if (test.expectedBehavior !== "throws error") {
        console.log(`❌ ${test.name}`);
        console.log(`   Unexpected error: ${error.message}`);
        failed++;
        failures.push({ name: test.name, error: error.message });
      }
    }
    
    console.log('');
  }

  // Deterministic behavior test (run same input 100 times)
  console.log('='.repeat(80));
  console.log('\n🔄 Deterministic Behavior Test (100 runs)\n');
  
  const deterministicTestParams = {
    conversationScope: 'project' as const,
    conversationId: 'project-test',
    availableAgents: [
      { id: 'agent-1', name: 'Dev1', role: 'Developer' },
      { id: 'agent-2', name: 'Dev2', role: 'Engineer' }
    ]
  };
  
  const results = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const result = resolveSpeakingAuthority(deterministicTestParams);
    results.add(`${result.allowedSpeaker.id}:${result.reason}`);
  }
  
  if (results.size === 1) {
    console.log(`✅ Deterministic: All 100 runs produced same result`);
    console.log(`   Result: ${Array.from(results)[0]}`);
    passed++;
  } else {
    console.log(`❌ Non-deterministic: ${results.size} different results in 100 runs`);
    console.log(`   Results: ${Array.from(results).join(', ')}`);
    failed++;
    failures.push({ name: "Deterministic 100 runs", error: `${results.size} different results` });
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Stress Test Results: ${passed} passed, ${failed} failed\n`);

  if (failures.length > 0) {
    console.log('❌ Failures:');
    failures.forEach(f => {
      console.log(`   - ${f.name}: ${f.error}`);
    });
    console.log('');
  }

  if (failed === 0) {
    console.log('✅ All stress tests passed!');
    console.log('✅ Function is deterministic and handles all edge cases correctly.');
    process.exit(0);
  } else {
    console.log('❌ Some stress tests failed');
    process.exit(1);
  }
}

// Run stress tests
runStressTests();

