/**
 * Stress test for conversationId utility
 * Tests edge cases, performance, and error handling
 */

import { buildConversationId, parseConversationId } from '../shared/conversationId';

console.log('🔥 Conversation ID Utility Stress Test\n');

interface StressTest {
  name: string;
  test: () => { pass: boolean; message?: string };
}

const stressTests: StressTest[] = [
  // Edge cases with hyphens
  {
    name: 'Build: projectId with multiple hyphens',
    test: () => {
      const result = buildConversationId('project', 'saas-startup-2024-q1');
      return {
        pass: result === 'project-saas-startup-2024-q1',
        message: result
      };
    }
  },
  {
    name: 'Build: teamId with multiple hyphens',
    test: () => {
      const result = buildConversationId('team', 'saas-startup', 'design-team-frontend');
      return {
        pass: result === 'team-saas-startup-design-team-frontend',
        message: result
      };
    }
  },
  {
    name: 'Parse: project with many hyphens',
    test: () => {
      const parsed = parseConversationId('project-a-b-c-d-e-f');
      return {
        pass: parsed.projectId === 'a-b-c-d-e-f',
        message: JSON.stringify(parsed)
      };
    }
  },
  {
    name: 'Parse: ambiguous ID correctly throws',
    test: () => {
      try {
        parseConversationId('team-a-b-c-d');
        return { pass: false, message: 'Should have thrown for ambiguous ID' };
      } catch (error: any) {
        return {
          pass: error.message.includes('Ambiguous'),
          message: error.message
        };
      }
    }
  },
  {
    name: 'Parse: ambiguous ID with known projectId succeeds',
    test: () => {
      const parsed = parseConversationId('team-a-b-c-d', 'a-b');
      return {
        pass: parsed.projectId === 'a-b' && parsed.contextId === 'c-d',
        message: JSON.stringify(parsed)
      };
    }
  },

  // Special characters and edge cases
  {
    name: 'Build: empty projectId throws',
    test: () => {
      try {
        buildConversationId('project', '');
        return { pass: false, message: 'Should have thrown' };
      } catch (error: any) {
        return {
          pass: error.message.includes('required') || error.message.includes('empty'),
          message: error.message
        };
      }
    }
  },
  {
    name: 'Build: whitespace-only projectId throws',
    test: () => {
      try {
        buildConversationId('project', '   ');
        return { pass: false, message: 'Should have thrown' };
      } catch (error: any) {
        return {
          pass: error.message.includes('required') || error.message.includes('empty'),
          message: error.message
        };
      }
    }
  },
  {
    name: 'Parse: whitespace handling',
    test: () => {
      const parsed = parseConversationId('  project-saas-startup  ');
      return {
        pass: parsed.projectId === 'saas-startup',
        message: JSON.stringify(parsed)
      };
    }
  },

  // Round-trip with complex IDs
  {
    name: 'Round-trip: complex project ID',
    test: () => {
      const built = buildConversationId('project', 'my-awesome-project-2024');
      const parsed = parseConversationId(built);
      return {
        pass: parsed.projectId === 'my-awesome-project-2024',
        message: `Built: ${built}, Parsed: ${parsed.projectId}`
      };
    }
  },
  {
    name: 'Round-trip: complex team ID with known projectId',
    test: () => {
      const projectId = 'my-awesome-project';
      const teamId = 'frontend-team-2024';
      const built = buildConversationId('team', projectId, teamId);
      const parsed = parseConversationId(built, projectId);
      return {
        pass: parsed.projectId === projectId && parsed.contextId === teamId,
        message: `Built: ${built}, Parsed: ${JSON.stringify(parsed)}`
      };
    }
  },

  // Error message quality
  {
    name: 'Error: descriptive message for ambiguous ID',
    test: () => {
      try {
        parseConversationId('team-a-b-c');
        return { pass: false, message: 'Should have thrown' };
      } catch (error: any) {
        return {
          pass: error.message.includes('Ambiguous') && 
                error.message.includes('cannot safely parse') &&
                error.message.includes('known projectId'),
          message: error.message.substring(0, 100)
        };
      }
    }
  },

  // Performance: many calls
  {
    name: 'Performance: build 1000 IDs',
    test: () => {
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        buildConversationId('project', `project-${i}`);
      }
      const duration = Date.now() - start;
      return {
        pass: duration < 1000, // Should be fast
        message: `Took ${duration}ms for 1000 builds`
      };
    }
  },
  {
    name: 'Performance: parse 1000 IDs',
    test: () => {
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        parseConversationId(`project-project-${i}`);
      }
      const duration = Date.now() - start;
      return {
        pass: duration < 1000, // Should be fast
        message: `Took ${duration}ms for 1000 parses`
      };
    }
  }
];

let passed = 0;
let failed = 0;
const failures: string[] = [];

stressTests.forEach((test, index) => {
  try {
    const result = test.test();
    if (result.pass) {
      passed++;
      console.log(`✅ Test ${index + 1}: ${test.name}`);
      if (result.message) {
        console.log(`   ${result.message}`);
      }
    } else {
      failed++;
      failures.push(test.name);
      console.log(`❌ Test ${index + 1}: ${test.name}`);
      if (result.message) {
        console.log(`   ${result.message}`);
      }
    }
  } catch (error: any) {
    failed++;
    failures.push(test.name);
    console.log(`❌ Test ${index + 1}: ${test.name}`);
    console.log(`   Error: ${error.message}`);
  }
});

console.log(`\n📊 Stress Test Results:`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   Total: ${stressTests.length}`);

if (failures.length > 0) {
  console.log(`\n❌ Failed Tests:`);
  failures.forEach(f => console.log(`   - ${f}`));
  process.exit(1);
} else {
  console.log(`\n🎉 All stress tests passed!`);
  process.exit(0);
}

