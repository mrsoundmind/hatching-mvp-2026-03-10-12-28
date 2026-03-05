/**
 * Test harness for conversationId utility
 * Run with: node --import tsx scripts/test-conversationId.ts
 */

import { buildConversationId, parseConversationId } from '../shared/conversationId';

interface TestCase {
  name: string;
  test: () => boolean | string;
}

const testCases: TestCase[] = [
  {
    name: 'buildConversationId: project scope',
    test: () => {
      const result = buildConversationId('project', 'saas-startup');
      return result === 'project:saas-startup' || `Expected "project:saas-startup", got "${result}"`;
    }
  },
  {
    name: 'buildConversationId: team scope',
    test: () => {
      const result = buildConversationId('team', 'saas-startup', 'design-team');
      return result === 'team:saas-startup:design-team' || `Expected "team:saas-startup:design-team", got "${result}"`;
    }
  },
  {
    name: 'buildConversationId: agent scope',
    test: () => {
      const result = buildConversationId('agent', 'saas-startup', 'product-manager');
      return result === 'agent:saas-startup:product-manager' || `Expected "agent:saas-startup:product-manager", got "${result}"`;
    }
  },
  {
    name: 'buildConversationId: project scope rejects contextId',
    test: () => {
      try {
        buildConversationId('project', 'saas-startup', 'should-fail');
        return 'Should have thrown error for project scope with contextId';
      } catch (error: any) {
        return error.message.includes('must not accept contextId') || `Wrong error: ${error.message}`;
      }
    }
  },
  {
    name: 'parseConversationId: valid project ID',
    test: () => {
      const parsed = parseConversationId('project:saas-startup');
      return (
        parsed.scope === 'project' &&
        parsed.projectId === 'saas-startup' &&
        parsed.contextId === undefined &&
        parsed.raw === 'project:saas-startup'
      ) || `Failed: ${JSON.stringify(parsed)}`;
    }
  },
  {
    name: 'parseConversationId: valid team ID',
    test: () => {
      const parsed = parseConversationId('team:saas-startup:design-team');
      return (
        parsed.scope === 'team' &&
        parsed.projectId === 'saas-startup' &&
        parsed.contextId === 'design-team'
      ) || `Failed: ${JSON.stringify(parsed)}`;
    }
  },
  {
    name: 'parseConversationId: valid agent ID',
    test: () => {
      const parsed = parseConversationId('agent:saas-startup:product-manager');
      return (
        parsed.scope === 'agent' &&
        parsed.projectId === 'saas-startup' &&
        parsed.contextId === 'product-manager'
      ) || `Failed: ${JSON.stringify(parsed)}`;
    }
  },
  {
    name: 'parseConversationId: invalid (missing colon)',
    test: () => {
      try {
        parseConversationId('project-saas-startup');
        return 'Should have thrown for missing ":" delimiter';
      } catch (error: any) {
        return error.message.includes('must contain ":"') || `Wrong error: ${error.message}`;
      }
    }
  },
  {
    name: 'parseConversationId: invalid team part count',
    test: () => {
      try {
        parseConversationId('team:saas-startup');
        return 'Should have thrown for invalid team format';
      } catch (error: any) {
        return error.message.includes('expected 3 parts') || `Wrong error: ${error.message}`;
      }
    }
  },
  {
    name: 'round trip: build -> parse (team)',
    test: () => {
      const built = buildConversationId('team', 'saas-startup', 'design-team');
      const parsed = parseConversationId(built);
      return (
        parsed.scope === 'team' &&
        parsed.projectId === 'saas-startup' &&
        parsed.contextId === 'design-team'
      ) || `Round-trip failed: ${JSON.stringify(parsed)}`;
    }
  }
];

console.log('🧪 Conversation ID Utility Test Suite\n');

let passed = 0;
let failed = 0;
const failures: string[] = [];

testCases.forEach((testCase, index) => {
  try {
    const result = testCase.test();
    if (result === true) {
      passed++;
      console.log(`✅ Test ${index + 1}: ${testCase.name}`);
    } else {
      failed++;
      failures.push(testCase.name);
      console.log(`❌ Test ${index + 1}: ${testCase.name}`);
      console.log(`   ${result}`);
    }
  } catch (error: any) {
    failed++;
    failures.push(testCase.name);
    console.log(`❌ Test ${index + 1}: ${testCase.name}`);
    console.log(`   Error: ${error.message}`);
  }
});

console.log('\n📊 Test Results:');
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   Total: ${testCases.length}`);

if (failures.length > 0) {
  console.log('\n❌ Failed Tests:');
  failures.forEach((f) => console.log(`   - ${f}`));
  process.exit(1);
}

console.log('\n🎉 All tests passed!');
