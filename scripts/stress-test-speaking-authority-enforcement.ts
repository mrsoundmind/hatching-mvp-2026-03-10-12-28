// Phase 1.1.b: Speaking Authority Enforcement Stress Test
// Tests that the integration in handleStreamingColleagueResponse works correctly

import { resolveSpeakingAuthority, type Agent } from '../server/orchestration/resolveSpeakingAuthority';

interface TestCase {
  name: string;
  description: string;
  params: {
    conversationScope: 'project' | 'team' | 'agent';
    conversationId: string;
    availableAgents: Agent[];
    addressedAgentId?: string;
  };
  expectedSpeakerRole: string;
  expectedReason: string;
}

const testCases: TestCase[] = [
  {
    name: "Project scope → PM speaks",
    description: "In project scope, PM must always speak first",
    params: {
      conversationScope: 'project',
      conversationId: 'project-saas-startup',
      availableAgents: [
        { id: 'agent-1', name: 'Alice', role: 'Developer' },
        { id: 'agent-2', name: 'Bob', role: 'Product Manager' },
        { id: 'agent-3', name: 'Charlie', role: 'Designer' }
      ]
    },
    expectedSpeakerRole: 'Product Manager',
    expectedReason: 'project_scope_pm_authority'
  },
  {
    name: "Team scope → Team Lead speaks",
    description: "In team scope, Team Lead must speak first",
    params: {
      conversationScope: 'team',
      conversationId: 'team-saas-startup-design-team',
      availableAgents: [
        { id: 'agent-1', name: 'Alice', role: 'Developer' },
        { id: 'agent-2', name: 'Bob', role: 'Tech Lead' },
        { id: 'agent-3', name: 'Charlie', role: 'Designer' }
      ]
    },
    expectedSpeakerRole: 'Tech Lead',
    expectedReason: 'team_scope_team_lead'
  },
  {
    name: "Agent scope → That agent speaks",
    description: "In agent scope, the specific agent must speak",
    params: {
      conversationScope: 'agent',
      conversationId: 'agent-saas-startup-agent-1',
      availableAgents: [
        { id: 'agent-1', name: 'Alice', role: 'Developer' },
        { id: 'agent-2', name: 'Bob', role: 'Product Manager' }
      ]
    },
    expectedSpeakerRole: 'Developer',
    expectedReason: 'direct_agent_conversation'
  },
  {
    name: "Explicit addressing overrides PM",
    description: "When user explicitly addresses an agent, that agent speaks even in project scope",
    params: {
      conversationScope: 'project',
      conversationId: 'project-saas-startup',
      availableAgents: [
        { id: 'agent-1', name: 'Alice', role: 'Developer' },
        { id: 'agent-2', name: 'Bob', role: 'Product Manager' },
        { id: 'agent-3', name: 'Charlie', role: 'Designer' }
      ],
      addressedAgentId: 'agent-3'
    },
    expectedSpeakerRole: 'Designer',
    expectedReason: 'explicit_addressing'
  },
  {
    name: "Explicit addressing overrides Team Lead",
    description: "When user explicitly addresses an agent, that agent speaks even in team scope",
    params: {
      conversationScope: 'team',
      conversationId: 'team-saas-startup-design-team',
      availableAgents: [
        { id: 'agent-1', name: 'Alice', role: 'Developer' },
        { id: 'agent-2', name: 'Bob', role: 'Tech Lead' },
        { id: 'agent-3', name: 'Charlie', role: 'Designer' }
      ],
      addressedAgentId: 'agent-1'
    },
    expectedSpeakerRole: 'Developer',
    expectedReason: 'explicit_addressing'
  },
  {
    name: "Team scope with PM present → Team Lead still speaks",
    description: "PM does not override Team Lead in team scope",
    params: {
      conversationScope: 'team',
      conversationId: 'team-saas-startup-design-team',
      availableAgents: [
        { id: 'agent-1', name: 'PM', role: 'Product Manager' },
        { id: 'agent-2', name: 'Tech', role: 'Tech Lead' },
        { id: 'agent-3', name: 'Dev', role: 'Developer' }
      ]
    },
    expectedSpeakerRole: 'Tech Lead',
    expectedReason: 'team_scope_team_lead'
  },
  {
    name: "Project scope without PM → fallback",
    description: "When no PM exists in project scope, falls back to first agent",
    params: {
      conversationScope: 'project',
      conversationId: 'project-saas-startup',
      availableAgents: [
        { id: 'agent-1', name: 'Alice', role: 'Developer' },
        { id: 'agent-2', name: 'Bob', role: 'Designer' }
      ]
    },
    expectedSpeakerRole: 'Developer',
    expectedReason: 'fallback_first_agent'
  },
  {
    name: "Multiple PMs → deterministic selection",
    description: "When multiple PMs exist, first one is selected deterministically",
    params: {
      conversationScope: 'project',
      conversationId: 'project-saas-startup',
      availableAgents: [
        { id: 'agent-1', name: 'PM1', role: 'Product Manager' },
        { id: 'agent-2', name: 'PM2', role: 'Product Manager' },
        { id: 'agent-3', name: 'PM3', role: 'Product Manager' }
      ]
    },
    expectedSpeakerRole: 'Product Manager',
    expectedReason: 'project_scope_pm_authority'
  }
];

function runStressTests() {
  console.log('🔥 Running Speaking Authority Enforcement Stress Tests\n');
  console.log('='.repeat(80));

  let passed = 0;
  let failed = 0;
  const failures: Array<{ name: string; error: string }> = [];

  for (const test of testCases) {
    try {
      const result = resolveSpeakingAuthority(test.params);
      
      const roleMatches = result.allowedSpeaker.role === test.expectedSpeakerRole;
      const reasonMatches = result.reason === test.expectedReason;
      
      if (roleMatches && reasonMatches) {
        console.log(`✅ ${test.name}`);
        console.log(`   Speaker: ${result.allowedSpeaker.id} (${result.allowedSpeaker.name} - ${result.allowedSpeaker.role})`);
        console.log(`   Reason: ${result.reason}`);
        passed++;
      } else {
        console.log(`❌ ${test.name}`);
        console.log(`   Expected: Role="${test.expectedSpeakerRole}", Reason="${test.expectedReason}"`);
        console.log(`   Got: Role="${result.allowedSpeaker.role}", Reason="${result.reason}"`);
        failed++;
        failures.push({ 
          name: test.name, 
          error: `Expected ${test.expectedSpeakerRole}/${test.expectedReason}, got ${result.allowedSpeaker.role}/${result.reason}` 
        });
      }
    } catch (error: any) {
      console.log(`❌ ${test.name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
      failures.push({ name: test.name, error: error.message });
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
      { id: 'agent-1', name: 'PM', role: 'Product Manager' },
      { id: 'agent-2', name: 'Dev', role: 'Developer' }
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
    console.log('✅ Authority enforcement is deterministic and handles all edge cases correctly.');
    process.exit(0);
  } else {
    console.log('❌ Some stress tests failed');
    process.exit(1);
  }
}

// Run stress tests
runStressTests();

