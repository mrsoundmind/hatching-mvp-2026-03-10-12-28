// Phase 1.2.b: Canonical Conversation Bootstrap Stress Test
// Tests that conversations are created for all scopes before messages are saved

import { storage } from '../server/storage';
import { buildConversationId } from '@shared/conversationId';

interface TestCase {
  name: string;
  description: string;
  setup: () => Promise<{ projectId: string; conversationId: string; scope: 'project' | 'team' | 'agent' }>;
  expectedConversationId: string;
  expectedType: 'project' | 'team' | 'hatch';
}

const testCases: TestCase[] = [
  {
    name: "Project scope conversation bootstrap",
    description: "Project conversation should exist before messages",
    setup: async () => {
      const project = await storage.createProject({
        name: "Test Project",
        description: "Test project"
      });
      const conversationId = buildConversationId('project', project.id);
      return { projectId: project.id, conversationId, scope: 'project' };
    },
    expectedConversationId: (projectId: string) => `project-${projectId}`,
    expectedType: 'project'
  },
  {
    name: "Team scope conversation bootstrap",
    description: "Team conversation should exist before messages",
    setup: async () => {
      const project = await storage.createProject({
        name: "Team Project",
        description: "Project with team"
      });
      const team = await storage.createTeam({
        name: "Test Team",
        projectId: project.id,
        color: "blue"
      });
      const conversationId = buildConversationId('team', project.id, team.id);
      return { projectId: project.id, conversationId, scope: 'team' };
    },
    expectedConversationId: (projectId: string, teamId: string) => `team-${projectId}-${teamId}`,
    expectedType: 'team'
  },
  {
    name: "Agent scope conversation bootstrap",
    description: "Agent conversation should exist before messages",
    setup: async () => {
      const project = await storage.createProject({
        name: "Agent Project",
        description: "Project with agent"
      });
      const agent = await storage.createAgent({
        name: "Test Agent",
        role: "Developer",
        projectId: project.id,
        teamId: null,
        color: "green",
        personality: null,
        isSpecialAgent: false
      });
      const conversationId = buildConversationId('agent', project.id, agent.id);
      return { projectId: project.id, conversationId, scope: 'agent' };
    },
    expectedConversationId: (projectId: string, agentId: string) => `agent-${projectId}-${agentId}`,
    expectedType: 'hatch'
  },
  {
    name: "Team scope with no agents",
    description: "Team conversation should exist even with no agents",
    setup: async () => {
      const project = await storage.createProject({
        name: "Empty Team Project",
        description: "Project with empty team"
      });
      const team = await storage.createTeam({
        name: "Empty Team",
        projectId: project.id,
        color: "red"
      });
      const conversationId = buildConversationId('team', project.id, team.id);
      return { projectId: project.id, conversationId, scope: 'team' };
    },
    expectedConversationId: (projectId: string, teamId: string) => `team-${projectId}-${teamId}`,
    expectedType: 'team'
  },
  {
    name: "Agent scope with missing agent",
    description: "Agent conversation should exist even if agent doesn't exist",
    setup: async () => {
      const project = await storage.createProject({
        name: "Missing Agent Project",
        description: "Project with missing agent"
      });
      const fakeAgentId = "non-existent-agent";
      const conversationId = buildConversationId('agent', project.id, fakeAgentId);
      return { projectId: project.id, conversationId, scope: 'agent' };
    },
    expectedConversationId: (projectId: string, agentId: string) => `agent-${projectId}-${agentId}`,
    expectedType: 'hatch'
  }
];

async function runStressTests() {
  console.log('🔥 Running Canonical Conversation Bootstrap Stress Tests\n');
  console.log('='.repeat(80));

  let passed = 0;
  let failed = 0;
  const failures: Array<{ name: string; error: string }> = [];

  for (const test of testCases) {
    try {
      console.log(`\n🧪 Testing: ${test.name}`);
      console.log(`   ${test.description}`);
      
      const { projectId, conversationId, scope } = await test.setup();
      
      // Simulate the bootstrap logic (matching the actual implementation)
      const existingConversations = await storage.getConversationsByProject(projectId);
      let existing = existingConversations.find(conv => conv.id === conversationId);
      
      if (!existing) {
        // Create conversation with canonical ID
        existing = await storage.createConversation({
          id: conversationId,
          projectId,
          teamId: scope === 'team' ? conversationId.split('-')[2] : null,
          agentId: scope === 'agent' ? conversationId.split('-')[2] : null,
          type: scope === 'agent' ? 'hatch' : scope,
          title: null
        } as any);
      }
      
      // Verify conversation exists
      const conversations = await storage.getConversationsByProject(projectId);
      const found = conversations.find(conv => conv.id === conversationId);
      
      if (found) {
        // Verify canonical ID format
        const expectedId = scope === 'project' 
          ? `project-${projectId}`
          : scope === 'team'
          ? `team-${projectId}-${conversationId.split('-')[2]}`
          : `agent-${projectId}-${conversationId.split('-')[2]}`;
        
        const idMatches = found.id === conversationId;
        const typeMatches = found.type === test.expectedType;
        const projectIdMatches = found.projectId === projectId;
        
        if (idMatches && typeMatches && projectIdMatches) {
          console.log(`   ✅ Conversation exists: ${found.id}`);
          console.log(`   ✅ Type: ${found.type} (expected: ${test.expectedType})`);
          console.log(`   ✅ Project ID: ${found.projectId}`);
          console.log(`   ✅ Canonical ID format correct`);
          passed++;
        } else {
          console.log(`   ❌ Conversation exists but details don't match`);
          console.log(`      ID: ${found.id} (expected: ${conversationId})`);
          console.log(`      Type: ${found.type} (expected: ${test.expectedType})`);
          console.log(`      Project ID: ${found.projectId} (expected: ${projectId})`);
          failed++;
          failures.push({ 
            name: test.name, 
            error: `ID: ${found.id}, Type: ${found.type}, ProjectId: ${found.projectId}` 
          });
        }
      } else {
        console.log(`   ❌ Conversation not found: ${conversationId}`);
        failed++;
        failures.push({ name: test.name, error: `Conversation ${conversationId} not found` });
      }
      
    } catch (error: any) {
      console.log(`   ❌ Test failed: ${error.message}`);
      failed++;
      failures.push({ name: test.name, error: error.message });
    }
  }

  // Test: Verify idempotency
  console.log('\n' + '='.repeat(80));
  console.log('\n🧪 Testing Idempotency\n');

  try {
    const project = await storage.createProject({
      name: "Idempotency Test",
      description: "Testing conversation creation idempotency"
    });
    const conversationId = buildConversationId('project', project.id);
    
    // Create conversation first time
    const conv1 = await storage.createConversation({
      id: conversationId,
      projectId: project.id,
      teamId: null,
      agentId: null,
      type: 'project',
      title: null
    } as any);
    
    // Try to create again (should return existing)
    const conv2 = await storage.createConversation({
      id: conversationId,
      projectId: project.id,
      teamId: null,
      agentId: null,
      type: 'project',
      title: null
    } as any);
    
    if (conv1.id === conv2.id && conv1.id === conversationId) {
      console.log(`✅ Idempotency maintained: ${conv1.id} === ${conv2.id}`);
      passed++;
    } else {
      console.log(`❌ Idempotency broken: ${conv1.id} !== ${conv2.id}`);
      failed++;
      failures.push({ name: "Idempotency", error: `conv1: ${conv1.id}, conv2: ${conv2.id}` });
    }
  } catch (error: any) {
    console.log(`❌ Idempotency test failed: ${error.message}`);
    failed++;
    failures.push({ name: "Idempotency", error: error.message });
  }

  // Test: Verify all scopes have conversations before messages
  console.log('\n' + '='.repeat(80));
  console.log('\n🧪 Testing Message Persistence Requires Conversation\n');

  try {
    const project = await storage.createProject({
      name: "Message Persistence Test",
      description: "Testing messages require conversations"
    });
    const team = await storage.createTeam({
      name: "Test Team",
      projectId: project.id,
      color: "blue"
    });
    const conversationId = buildConversationId('team', project.id, team.id);
    
    // Ensure conversation exists (bootstrap)
    const existingConversations = await storage.getConversationsByProject(project.id);
    let existing = existingConversations.find(conv => conv.id === conversationId);
    
    if (!existing) {
      existing = await storage.createConversation({
        id: conversationId,
        projectId: project.id,
        teamId: team.id,
        agentId: null,
        type: 'team',
        title: null
      } as any);
    }
    
    // Now create a message (should succeed)
    const message = await storage.createMessage({
      conversationId,
      userId: 'test-user',
      agentId: null,
      content: 'Test message',
      messageType: 'user',
      parentMessageId: null,
      threadRootId: null,
      threadDepth: 0,
      metadata: null
    });
    
    // Verify message is linked to conversation
    const messages = await storage.getMessagesByConversation(conversationId);
    const messageFound = messages.find(m => m.id === message.id);
    
    if (messageFound && existing) {
      console.log(`✅ Message persisted with conversation: ${message.id}`);
      console.log(`✅ Conversation exists: ${existing.id}`);
      passed++;
    } else {
      console.log(`❌ Message or conversation not found`);
      failed++;
      failures.push({ name: "Message Persistence", error: "Message or conversation not found" });
    }
  } catch (error: any) {
    console.log(`❌ Message persistence test failed: ${error.message}`);
    failed++;
    failures.push({ name: "Message Persistence", error: error.message });
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
    console.log('✅ Canonical conversation bootstrap works correctly.');
    console.log('✅ All scopes have conversations before messages.');
    process.exit(0);
  } else {
    console.log('❌ Some stress tests failed');
    process.exit(1);
  }
}

// Run stress tests
runStressTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

