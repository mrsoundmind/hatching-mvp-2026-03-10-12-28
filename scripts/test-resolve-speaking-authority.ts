// Phase 1.1.a: Speaking Authority Resolution Test Harness
// Lightweight test script for resolveSpeakingAuthority function

import { resolveSpeakingAuthority, type Agent } from '../server/orchestration/resolveSpeakingAuthority';

interface TestCase {
  name: string;
  params: {
    conversationScope: 'project' | 'team' | 'agent';
    conversationId: string;
    availableAgents: Agent[];
    addressedAgentId?: string;
  };
  expectedSpeakerId: string;
  expectedReason: string;
}

const testCases: TestCase[] = [
  // Test 1: Project scope → PM speaks
  {
    name: "Project scope → PM speaks",
    params: {
      conversationScope: 'project',
      conversationId: 'project:saas-startup',
      availableAgents: [
        { id: 'agent-1', name: 'Alice', role: 'Developer' },
        { id: 'agent-2', name: 'Bob', role: 'Product Manager' },
        { id: 'agent-3', name: 'Charlie', role: 'Designer' }
      ]
    },
    expectedSpeakerId: 'agent-2',
    expectedReason: 'project_scope_pm_authority'
  },

  // Test 2: Team scope → Team Lead speaks
  {
    name: "Team scope → Team Lead speaks",
    params: {
      conversationScope: 'team',
      conversationId: 'team:saas-startup:design-team',
      availableAgents: [
        { id: 'agent-1', name: 'Alice', role: 'Developer' },
        { id: 'agent-2', name: 'Bob', role: 'Tech Lead' },
        { id: 'agent-3', name: 'Charlie', role: 'Designer' }
      ]
    },
    expectedSpeakerId: 'agent-2',
    expectedReason: 'team_scope_team_lead'
  },

  // Test 3: Direct agent conversation → agent speaks
  {
    name: "Direct agent conversation → agent speaks",
    params: {
      conversationScope: 'agent',
      conversationId: 'agent:saas-startup:agent-1',
      availableAgents: [
        { id: 'agent-1', name: 'Alice', role: 'Developer' },
        { id: 'agent-2', name: 'Bob', role: 'Product Manager' },
        { id: 'agent-3', name: 'Charlie', role: 'Designer' }
      ]
    },
    expectedSpeakerId: 'agent-1',
    expectedReason: 'direct_agent_conversation'
  },

  // Test 4: Explicit addressing overrides PM
  {
    name: "Explicit addressing overrides PM",
    params: {
      conversationScope: 'project',
      conversationId: 'project:saas-startup',
      availableAgents: [
        { id: 'agent-1', name: 'Alice', role: 'Developer' },
        { id: 'agent-2', name: 'Bob', role: 'Product Manager' },
        { id: 'agent-3', name: 'Charlie', role: 'Designer' }
      ],
      addressedAgentId: 'agent-3'
    },
    expectedSpeakerId: 'agent-3',
    expectedReason: 'explicit_addressing'
  },

  // Test 5: Explicit addressing overrides Team Lead
  {
    name: "Explicit addressing overrides Team Lead",
    params: {
      conversationScope: 'team',
      conversationId: 'team:saas-startup:design-team',
      availableAgents: [
        { id: 'agent-1', name: 'Alice', role: 'Developer' },
        { id: 'agent-2', name: 'Bob', role: 'Tech Lead' },
        { id: 'agent-3', name: 'Charlie', role: 'Designer' }
      ],
      addressedAgentId: 'agent-1'
    },
    expectedSpeakerId: 'agent-1',
    expectedReason: 'explicit_addressing'
  },

  // Test 6: Team scope with PM present → Team Lead still speaks
  {
    name: "Team scope with PM present → Team Lead still speaks",
    params: {
      conversationScope: 'team',
      conversationId: 'team:saas-startup:design-team',
      availableAgents: [
        { id: 'agent-1', name: 'Alice', role: 'Product Manager' },
        { id: 'agent-2', name: 'Bob', role: 'Tech Lead' },
        { id: 'agent-3', name: 'Charlie', role: 'Designer' }
      ]
    },
    expectedSpeakerId: 'agent-2',
    expectedReason: 'team_scope_team_lead'
  },

  // Test 7: Project scope without PM → fallback
  {
    name: "Project scope without PM → fallback",
    params: {
      conversationScope: 'project',
      conversationId: 'project:saas-startup',
      availableAgents: [
        { id: 'agent-1', name: 'Alice', role: 'Developer' },
        { id: 'agent-2', name: 'Bob', role: 'Designer' },
        { id: 'agent-3', name: 'Charlie', role: 'Engineer' }
      ]
    },
    expectedSpeakerId: 'agent-1',
    expectedReason: 'fallback_first_agent'
  },

  // Test 8: Multiple PMs → deterministic selection
  {
    name: "Multiple PMs → deterministic selection",
    params: {
      conversationScope: 'project',
      conversationId: 'project:saas-startup',
      availableAgents: [
        { id: 'agent-1', name: 'Alice', role: 'Product Manager' },
        { id: 'agent-2', name: 'Bob', role: 'Product Manager' },
        { id: 'agent-3', name: 'Charlie', role: 'Product Manager' }
      ]
    },
    expectedSpeakerId: 'agent-1',
    expectedReason: 'project_scope_pm_authority'
  },

  // Test 9: Explicit addressing in agent scope → explicit addressing wins
  {
    name: "Explicit addressing in agent scope → explicit addressing wins",
    params: {
      conversationScope: 'agent',
      conversationId: 'agent:saas-startup:agent-1',
      availableAgents: [
        { id: 'agent-1', name: 'Alice', role: 'Developer' },
        { id: 'agent-2', name: 'Bob', role: 'Product Manager' }
      ],
      addressedAgentId: 'agent-2'
    },
    expectedSpeakerId: 'agent-2',
    expectedReason: 'explicit_addressing'
  },

  // Test 10: Agent conversation with agent not in availableAgents → fallback
  {
    name: "Agent conversation with agent not in availableAgents → fallback",
    params: {
      conversationScope: 'agent',
      conversationId: 'agent:saas-startup:agent-999',
      availableAgents: [
        { id: 'agent-1', name: 'Alice', role: 'Developer' },
        { id: 'agent-2', name: 'Bob', role: 'Product Manager' }
      ]
    },
    expectedSpeakerId: 'agent-1',
    expectedReason: 'fallback_first_agent'
  }
];

function runTests() {
  console.log('🧪 Running Speaking Authority Resolution Tests\n');
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const result = resolveSpeakingAuthority(testCase.params);
      
      const speakerMatches = result.allowedSpeaker.id === testCase.expectedSpeakerId;
      const reasonMatches = result.reason === testCase.expectedReason;
      
      if (speakerMatches && reasonMatches) {
        console.log(`✅ ${testCase.name}`);
        console.log(`   Speaker: ${result.allowedSpeaker.id} (${result.allowedSpeaker.name} - ${result.allowedSpeaker.role})`);
        console.log(`   Reason: ${result.reason}`);
        passed++;
      } else {
        console.log(`❌ ${testCase.name}`);
        console.log(`   Expected: Speaker=${testCase.expectedSpeakerId}, Reason="${testCase.expectedReason}"`);
        console.log(`   Got: Speaker=${result.allowedSpeaker.id}, Reason="${result.reason}"`);
        failed++;
      }
    } catch (error: any) {
      console.log(`❌ ${testCase.name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
    
    console.log('');
  }

  // Test 11: Empty agents array → throws
  console.log('='.repeat(70));
  console.log('\n🧪 Testing Error Handling\n');
  
  try {
    resolveSpeakingAuthority({
      conversationScope: 'project',
      conversationId: 'project:test',
      availableAgents: []
    });
    console.log('❌ Empty agents array → should throw');
    failed++;
  } catch (error: any) {
    if (error.message.includes('no agents available')) {
      console.log('✅ Empty agents array → correctly throws');
      passed++;
    } else {
      console.log(`❌ Empty agents array → wrong error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${testCases.length + 1} total\n`);

  if (failed === 0) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests();
