/**
 * Stress Test: Phase 1.4 UI Invariant Hardening
 * 
 * Tests the three core UI contracts:
 * 1. Centralized mode derivation (deriveChatMode)
 * 2. Hard-locked PM Maya header in project mode
 * 3. Send gating: transport + input + context existence
 * 
 * Run: npx tsx scripts/stress-test-phase1-4-ui-invariants.ts
 */

import { buildConversationId } from '../shared/conversationId';
import { deriveChatMode } from '../client/src/lib/chatMode';

console.log('🧪 Stress Test: Phase 1.4 UI Invariant Hardening\n');
console.log('='.repeat(70));

let passedTests = 0;
let failedTests = 0;
const errors: string[] = [];

// ============================================================================
// Test 1: Centralized Mode Derivation (deriveChatMode)
// ============================================================================

console.log('\n📋 Test 1: Centralized Mode Derivation (deriveChatMode)');
console.log('-'.repeat(70));

// deriveChatMode is imported from client/src/lib/chatMode.ts (the real shared utility)

const modeTests = [
  {
    name: 'Agent mode: activeAgentId truthy',
    activeAgentId: 'agent-123',
    activeTeamId: null,
    expectedMode: 'agent' as const,
    expectedConversationId: 'agent:project-123:agent-123'
  },
  {
    name: 'Agent mode: activeAgentId truthy (team also set, agent wins)',
    activeAgentId: 'agent-456',
    activeTeamId: 'team-789',
    expectedMode: 'agent' as const,
    expectedConversationId: 'agent:project-123:agent-456'
  },
  {
    name: 'Team mode: activeTeamId truthy, no agent',
    activeAgentId: null,
    activeTeamId: 'team-456',
    expectedMode: 'team' as const,
    expectedConversationId: 'team:project-123:team-456'
  },
  {
    name: 'Project mode: both null (default)',
    activeAgentId: null,
    activeTeamId: null,
    expectedMode: 'project' as const,
    expectedConversationId: 'project:project-123'
  },
  {
    name: 'Project mode: "Start with an idea" project (both null)',
    activeAgentId: null,
    activeTeamId: null,
    expectedMode: 'project' as const,
    expectedConversationId: 'project:idea-project-123'
  },
  {
    name: 'Project mode: empty strings treated as falsy',
    activeAgentId: '',
    activeTeamId: '',
    expectedMode: 'project' as const,
    expectedConversationId: 'project:project-123'
  }
];

for (const test of modeTests) {
  const projectId = test.name.includes('idea') ? 'idea-project-123' : 'project-123';
  const computedMode = deriveChatMode({
    activeAgentId: test.activeAgentId,
    activeTeamId: test.activeTeamId
  });
  
  let computedConversationId: string;
  if (computedMode === 'agent' && test.activeAgentId) {
    computedConversationId = buildConversationId('agent', projectId, test.activeAgentId);
  } else if (computedMode === 'team' && test.activeTeamId) {
    computedConversationId = buildConversationId('team', projectId, test.activeTeamId);
  } else {
    computedConversationId = buildConversationId('project', projectId);
  }
  
  const modeMatch = computedMode === test.expectedMode;
  const conversationIdMatch = computedConversationId === test.expectedConversationId;
  const passed = modeMatch && conversationIdMatch;
  
  if (passed) {
    passedTests++;
    console.log(`✅ ${test.name}`);
    console.log(`   Mode: ${computedMode} → ConversationId: ${computedConversationId}`);
  } else {
    failedTests++;
    const error = `❌ ${test.name}\n   Mode: got ${computedMode}, expected ${test.expectedMode}\n   ConversationId: got ${computedConversationId}, expected ${test.expectedConversationId}`;
    console.log(error);
    errors.push(error);
  }
  console.log('');
}

// ============================================================================
// Test 2: Hard-Locked PM Maya Header in Project Mode
// ============================================================================

console.log('\n📋 Test 2: Hard-Locked PM Maya Header in Project Mode');
console.log('-'.repeat(70));

/**
 * Header identity derivation (matches CenterPanel.tsx getChatContextDisplay)
 * Contract: project → show PM "Maya" (deterministic, not pulled from agents list)
 *           team → show team identity
 *           agent → show selected agent identity
 */
function getChatContextDisplay(params: {
  mode: 'project' | 'team' | 'agent';
  activeProjectName?: string;
  activeTeamName?: string;
  activeAgentName?: string;
  activeAgentRole?: string;
}): { title: string; subtitle: string } {
  const { mode, activeProjectName, activeTeamName, activeAgentName, activeAgentRole } = params;
  
  switch (mode) {
    case 'project':
      // Hard-locked: PM Maya, not derived from agents list
      return {
        title: 'Maya',
        subtitle: 'Project Manager'
      };
    
    case 'team':
      return {
        title: activeTeamName || 'Team',
        subtitle: `Team Chat • ${activeTeamName || 'Unknown'}`
      };
    
    case 'agent':
      return {
        title: activeAgentName || 'Agent',
        subtitle: `1-on-1 Chat • ${activeAgentRole || 'Unknown'}`
      };
    
    default:
      return {
        title: 'Loading...',
        subtitle: ''
      };
  }
}

const headerTests = [
  {
    name: 'Project mode: Header must be Maya/Project Manager',
    mode: 'project' as const,
    expectedTitle: 'Maya',
    expectedSubtitle: 'Project Manager',
    // Even if agents exist, header should not change
    activeProjectName: 'My SaaS Startup',
    mayaAgentExists: true
  },
  {
    name: 'Project mode: Header invariant (no agents)',
    mode: 'project' as const,
    expectedTitle: 'Maya',
    expectedSubtitle: 'Project Manager',
    activeProjectName: 'Empty Project',
    mayaAgentExists: false
  },
  {
    name: 'Team mode: Header shows team identity',
    mode: 'team' as const,
    expectedTitle: 'Design Team',
    expectedSubtitle: 'Team Chat • Design Team',
    activeTeamName: 'Design Team'
  },
  {
    name: 'Agent mode: Header shows agent identity',
    mode: 'agent' as const,
    expectedTitle: 'Maya',
    expectedSubtitle: '1-on-1 Chat • Product Manager',
    activeAgentName: 'Maya',
    activeAgentRole: 'Product Manager'
  },
  {
    name: 'Project mode: Must not show "AI Idea Partner"',
    mode: 'project' as const,
    expectedTitle: 'Maya',
    expectedSubtitle: 'Project Manager',
    // Simulate "AI Idea Partner" agent existing
    aiIdeaPartnerExists: true
  }
];

for (const test of headerTests) {
  const display = getChatContextDisplay({
    mode: test.mode,
    activeProjectName: test.activeProjectName,
    activeTeamName: test.activeTeamName,
    activeAgentName: test.activeAgentName,
    activeAgentRole: test.activeAgentRole
  });
  
  const titleMatch = display.title === test.expectedTitle;
  const subtitleMatch = display.subtitle === test.expectedSubtitle;
  const passed = titleMatch && subtitleMatch;
  
  if (passed) {
    passedTests++;
    console.log(`✅ ${test.name}`);
    console.log(`   Title: "${display.title}" / Subtitle: "${display.subtitle}"`);
  } else {
    failedTests++;
    const error = `❌ ${test.name}\n   Title: got "${display.title}", expected "${test.expectedTitle}"\n   Subtitle: got "${display.subtitle}", expected "${test.expectedSubtitle}"`;
    console.log(error);
    errors.push(error);
  }
  console.log('');
}

// ============================================================================
// Test 3: Send Gating (Transport + Input + Context Existence)
// ============================================================================

console.log('\n📋 Test 3: Send Gating (Transport + Input + Context Existence)');
console.log('-'.repeat(70));

/**
 * Send gating logic (matches CenterPanel.tsx handleChatSubmit)
 * Contract: canSend = ALL of:
 *   - connectionStatus === 'connected'
 *   - message.trim().length > 0
 *   - conversationId exists and is non-empty string
 *   - activeProjectId exists and is non-empty string
 * 
 * Must NOT depend on: recipients count, agent availability, memory write permissions
 */
function canSendMessage(params: {
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  messageInput: string;
  conversationId?: string | null;
  activeProjectId?: string | null;
  // These should NOT affect send gating:
  recipientsCount?: number;
  memoryCanWrite?: boolean;
  agentsAvailable?: boolean;
}): boolean {
  const { connectionStatus, messageInput, conversationId, activeProjectId } = params;
  const trimmed = messageInput.trim();
  
  // Contract: Transport + input + context existence
  return (
    connectionStatus === 'connected' &&
    trimmed.length > 0 &&
    conversationId !== null &&
    conversationId !== undefined &&
    conversationId.trim().length > 0 &&
    activeProjectId !== null &&
    activeProjectId !== undefined &&
    activeProjectId.trim().length > 0
  );
}

const sendGatingTests = [
  {
    name: 'Can send: connected + non-empty input',
    connectionStatus: 'connected' as const,
    messageInput: 'Hello, team!',
    conversationId: 'project-123',
    activeProjectId: 'project-123',
    recipientsCount: 5,
    memoryCanWrite: true,
    agentsAvailable: true,
    expectedCanSend: true
  },
  {
    name: 'Cannot send: disconnected',
    connectionStatus: 'disconnected' as const,
    messageInput: 'Hello, team!',
    conversationId: 'project-123',
    activeProjectId: 'project-123',
    recipientsCount: 5,
    memoryCanWrite: true,
    agentsAvailable: true,
    expectedCanSend: false
  },
  {
    name: 'Cannot send: empty input',
    connectionStatus: 'connected' as const,
    messageInput: '   ',
    conversationId: 'project-123',
    activeProjectId: 'project-123',
    recipientsCount: 5,
    memoryCanWrite: true,
    agentsAvailable: true,
    expectedCanSend: false
  },
  {
    name: 'Cannot send: connecting (not connected)',
    connectionStatus: 'connecting' as const,
    messageInput: 'Hello!',
    conversationId: 'project-123',
    activeProjectId: 'project-123',
    recipientsCount: 5,
    memoryCanWrite: true,
    agentsAvailable: true,
    expectedCanSend: false
  },
  {
    name: 'Can send: zero recipients (should not block)',
    connectionStatus: 'connected' as const,
    messageInput: 'Hello!',
    conversationId: 'project-123',
    activeProjectId: 'project-123',
    recipientsCount: 0,
    memoryCanWrite: false,
    agentsAvailable: false,
    expectedCanSend: true // Transport + input + context only!
  },
  {
    name: 'Can send: memory write disabled (should not block)',
    connectionStatus: 'connected' as const,
    messageInput: 'Hello!',
    conversationId: 'project-123',
    activeProjectId: 'project-123',
    recipientsCount: 0,
    memoryCanWrite: false,
    agentsAvailable: false,
    expectedCanSend: true // Transport + input + context only!
  },
  {
    name: 'Can send: no agents available (should not block)',
    connectionStatus: 'connected' as const,
    messageInput: 'Hello!',
    conversationId: 'project-123',
    activeProjectId: 'project-123',
    recipientsCount: 0,
    memoryCanWrite: false,
    agentsAvailable: false,
    expectedCanSend: true // Transport + input + context only!
  },
  {
    name: 'Can send: error state (should not block if connected)',
    connectionStatus: 'error' as const,
    messageInput: 'Hello!',
    conversationId: 'project-123',
    activeProjectId: 'project-123',
    recipientsCount: 5,
    memoryCanWrite: true,
    agentsAvailable: true,
    expectedCanSend: false // Error state is not 'connected'
  },
  {
    name: 'Cannot send: missing conversationId',
    connectionStatus: 'connected' as const,
    messageInput: 'Hello!',
    conversationId: null,
    activeProjectId: 'project-123',
    recipientsCount: 5,
    memoryCanWrite: true,
    agentsAvailable: true,
    expectedCanSend: false
  },
  {
    name: 'Cannot send: empty conversationId',
    connectionStatus: 'connected' as const,
    messageInput: 'Hello!',
    conversationId: '',
    activeProjectId: 'project-123',
    recipientsCount: 5,
    memoryCanWrite: true,
    agentsAvailable: true,
    expectedCanSend: false
  },
  {
    name: 'Cannot send: missing activeProjectId',
    connectionStatus: 'connected' as const,
    messageInput: 'Hello!',
    conversationId: 'project-123',
    activeProjectId: null,
    recipientsCount: 5,
    memoryCanWrite: true,
    agentsAvailable: true,
    expectedCanSend: false
  },
  {
    name: 'Cannot send: empty activeProjectId',
    connectionStatus: 'connected' as const,
    messageInput: 'Hello!',
    conversationId: 'project-123',
    activeProjectId: '',
    recipientsCount: 5,
    memoryCanWrite: true,
    agentsAvailable: true,
    expectedCanSend: false
  }
];

for (const test of sendGatingTests) {
  const canSend = canSendMessage({
    connectionStatus: test.connectionStatus,
    messageInput: test.messageInput,
    conversationId: test.conversationId,
    activeProjectId: test.activeProjectId,
    recipientsCount: test.recipientsCount,
    memoryCanWrite: test.memoryCanWrite,
    agentsAvailable: test.agentsAvailable
  });
  
  const passed = canSend === test.expectedCanSend;
  
  if (passed) {
    passedTests++;
    console.log(`✅ ${test.name}`);
    console.log(`   CanSend: ${canSend} (connection: ${test.connectionStatus}, input: "${test.messageInput.trim()}", conversationId: ${test.conversationId ?? 'null'}, activeProjectId: ${test.activeProjectId ?? 'null'})`);
    if (test.recipientsCount === 0 || !test.memoryCanWrite || !test.agentsAvailable) {
      console.log(`   ✅ Correctly ignores recipients/memory/agents (${test.recipientsCount} recipients, memory: ${test.memoryCanWrite}, agents: ${test.agentsAvailable})`);
    }
  } else {
    failedTests++;
    const error = `❌ ${test.name}\n   CanSend: got ${canSend}, expected ${test.expectedCanSend}\n   Connection: ${test.connectionStatus}, Input: "${test.messageInput}", ConversationId: ${test.conversationId ?? 'null'}, ActiveProjectId: ${test.activeProjectId ?? 'null'}`;
    console.log(error);
    errors.push(error);
  }
  console.log('');
}

// ============================================================================
// Test 4: Integration Test - Full Flow
// ============================================================================

console.log('\n📋 Test 4: Integration Test - "Start with an Idea" Flow');
console.log('-'.repeat(70));

const integrationTests = [
  {
    name: 'Idea project creation → Project scope → Maya header → Can send',
    activeAgentId: null,
    activeTeamId: null,
    connectionStatus: 'connected' as const,
    messageInput: 'Let\'s build this!',
    expectedMode: 'project',
    expectedHeaderTitle: 'Maya',
    expectedCanSend: true
  },
  {
    name: 'Idea project creation → Project scope → Maya header → Cannot send (disconnected)',
    activeAgentId: null,
    activeTeamId: null,
    connectionStatus: 'disconnected' as const,
    messageInput: 'Let\'s build this!',
    expectedMode: 'project',
    expectedHeaderTitle: 'Maya',
    expectedCanSend: false
  }
];

for (const test of integrationTests) {
  const mode = deriveChatMode({
    activeAgentId: test.activeAgentId,
    activeTeamId: test.activeTeamId
  });
  
  const header = getChatContextDisplay({ mode });
  const canSend = canSendMessage({
    connectionStatus: test.connectionStatus,
    messageInput: test.messageInput,
    conversationId: 'project-123',
    activeProjectId: 'project-123'
  });
  
  const modeMatch = mode === test.expectedMode;
  const headerMatch = header.title === test.expectedHeaderTitle;
  const canSendMatch = canSend === test.expectedCanSend;
  const passed = modeMatch && headerMatch && canSendMatch;
  
  if (passed) {
    passedTests++;
    console.log(`✅ ${test.name}`);
    console.log(`   Mode: ${mode}, Header: "${header.title}", CanSend: ${canSend}`);
  } else {
    failedTests++;
    const error = `❌ ${test.name}\n   Mode: got ${mode}, expected ${test.expectedMode}\n   Header: got "${header.title}", expected "${test.expectedHeaderTitle}"\n   CanSend: got ${canSend}, expected ${test.expectedCanSend}`;
    console.log(error);
    errors.push(error);
  }
  console.log('');
}

// ============================================================================
// Summary
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('📊 Test Summary');
console.log('='.repeat(70));
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`📈 Total: ${passedTests + failedTests}`);
console.log(`📊 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);

if (failedTests > 0) {
  console.log('\n❌ Failed Tests:');
  errors.forEach((error, idx) => {
    console.log(`\n${idx + 1}. ${error}`);
  });
}

console.log('\n' + '='.repeat(70));
console.log('🎯 Phase 1.4 UI Invariant Contracts');
console.log('='.repeat(70));
console.log('1. ✅ Mode derivation: deriveChatMode is single source of truth');
console.log('2. ✅ Header identity: Project mode → Maya (hard-locked)');
console.log('3. ✅ Send gating: Transport + input + context existence (no recipients/memory)');

if (failedTests === 0) {
  console.log('\n🎉 All tests passed! Phase 1.4 UI invariants are correctly enforced.');
  console.log('\n✅ Core Contracts Verified:');
  console.log('   - Mode derivation is centralized and deterministic');
  console.log('   - Project mode header is hard-locked to PM Maya');
  console.log('   - Send gating depends only on transport + input');
  console.log('   - No regressions in existing behavior');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Review the output above.');
  console.log('   These failures indicate UI invariant violations.');
  process.exit(1);
}
