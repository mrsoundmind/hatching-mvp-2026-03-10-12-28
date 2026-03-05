// Phase 1.0: Team Lead Resolution Test Harness
// Lightweight test script for resolveTeamLead function

import { resolveTeamLead, type Agent } from '../server/orchestration/resolveTeamLead';

interface TestCase {
  name: string;
  teamId: string;
  agents: Agent[];
  expectedLeadId: string;
  expectedReasonPrefix: string;
}

const testCases: TestCase[] = [
  // Test 1: Explicit team lead present
  {
    name: "Explicit team lead present",
    teamId: "team-1",
    agents: [
      { id: "agent-1", name: "Alice", role: "Developer", isTeamLead: false },
      { id: "agent-2", name: "Bob", role: "Designer", isTeamLead: true },
      { id: "agent-3", name: "Charlie", role: "Engineer", isTeamLead: false }
    ],
    expectedLeadId: "agent-2",
    expectedReasonPrefix: "explicit_team_lead"
  },

  // Test 2: Role-based lead (Tech Lead)
  {
    name: "Role-based lead (Tech Lead)",
    teamId: "team-2",
    agents: [
      { id: "agent-1", name: "Alice", role: "Developer" },
      { id: "agent-2", name: "Bob", role: "Tech Lead" },
      { id: "agent-3", name: "Charlie", role: "Engineer" }
    ],
    expectedLeadId: "agent-2",
    expectedReasonPrefix: "role_priority:Tech Lead"
  },

  // Test 3: PM present but skipped
  {
    name: "PM present but skipped",
    teamId: "team-3",
    agents: [
      { id: "agent-1", name: "Alice", role: "Product Manager" },
      { id: "agent-2", name: "Bob", role: "Engineering Lead" },
      { id: "agent-3", name: "Charlie", role: "Developer" }
    ],
    expectedLeadId: "agent-2",
    expectedReasonPrefix: "role_priority:Engineering Lead"
  },

  // Test 4: No matching role → fallback
  {
    name: "No matching role → fallback",
    teamId: "team-4",
    agents: [
      { id: "agent-1", name: "Alice", role: "Developer" },
      { id: "agent-2", name: "Bob", role: "Designer" },
      { id: "agent-3", name: "Charlie", role: "Engineer" }
    ],
    expectedLeadId: "agent-1",
    expectedReasonPrefix: "fallback:first_agent"
  },

  // Test 5: Multiple agents with same role → first deterministic
  {
    name: "Multiple agents with same role → first deterministic",
    teamId: "team-5",
    agents: [
      { id: "agent-1", name: "Alice", role: "Tech Lead" },
      { id: "agent-2", name: "Bob", role: "Tech Lead" },
      { id: "agent-3", name: "Charlie", role: "Tech Lead" }
    ],
    expectedLeadId: "agent-1",
    expectedReasonPrefix: "role_priority:Tech Lead"
  },

  // Test 6: Partial role match (Senior Frontend Engineer matches Senior Engineer)
  {
    name: "Partial role match (Senior Frontend Engineer)",
    teamId: "team-6",
    agents: [
      { id: "agent-1", name: "Alice", role: "Developer" },
      { id: "agent-2", name: "Bob", role: "Senior Frontend Engineer" },
      { id: "agent-3", name: "Charlie", role: "Engineer" }
    ],
    expectedLeadId: "agent-2",
    expectedReasonPrefix: "role_priority:Senior Engineer"
  },

  // Test 7: All PMs → fallback to first PM (edge case)
  {
    name: "All PMs → fallback to first PM",
    teamId: "team-7",
    agents: [
      { id: "agent-1", name: "Alice", role: "Product Manager" },
      { id: "agent-2", name: "Bob", role: "Product Manager" }
    ],
    expectedLeadId: "agent-1",
    expectedReasonPrefix: "fallback:first_agent"
  },

  // Test 8: Case-insensitive matching
  {
    name: "Case-insensitive matching",
    teamId: "team-8",
    agents: [
      { id: "agent-1", name: "Alice", role: "developer" },
      { id: "agent-2", name: "Bob", role: "TECH LEAD" },
      { id: "agent-3", name: "Charlie", role: "engineer" }
    ],
    expectedLeadId: "agent-2",
    expectedReasonPrefix: "role_priority:Tech Lead"
  },

  // Test 9: Single agent → that agent
  {
    name: "Single agent → that agent",
    teamId: "team-9",
    agents: [
      { id: "agent-1", name: "Alice", role: "Developer" }
    ],
    expectedLeadId: "agent-1",
    expectedReasonPrefix: "fallback:first_agent"
  },

  // Test 10: PM with explicit lead flag → explicit lead wins
  {
    name: "PM with explicit lead flag → explicit lead wins",
    teamId: "team-10",
    agents: [
      { id: "agent-1", name: "Alice", role: "Product Manager", isTeamLead: true },
      { id: "agent-2", name: "Bob", role: "Tech Lead" }
    ],
    expectedLeadId: "agent-1",
    expectedReasonPrefix: "explicit_team_lead"
  }
];

function runTests() {
  console.log('🧪 Running Team Lead Resolution Tests\n');
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const result = resolveTeamLead(testCase.teamId, testCase.agents);
      
      const leadMatches = result.lead.id === testCase.expectedLeadId;
      const reasonMatches = result.reason.startsWith(testCase.expectedReasonPrefix);
      
      if (leadMatches && reasonMatches) {
        console.log(`✅ ${testCase.name}`);
        console.log(`   Lead: ${result.lead.id} (${result.lead.name} - ${result.lead.role})`);
        console.log(`   Reason: ${result.reason}`);
        passed++;
      } else {
        console.log(`❌ ${testCase.name}`);
        console.log(`   Expected: Lead=${testCase.expectedLeadId}, Reason starts with "${testCase.expectedReasonPrefix}"`);
        console.log(`   Got: Lead=${result.lead.id}, Reason="${result.reason}"`);
        failed++;
      }
    } catch (error: any) {
      console.log(`❌ ${testCase.name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
    
    console.log('');
  }

  console.log('='.repeat(70));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${testCases.length} total\n`);

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

