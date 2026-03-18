/**
 * Test: Route module exports for phase 05-01 refactoring
 *
 * Verifies that the three extracted route modules exist and export
 * the expected registerXxxRoutes functions. This is the RED step —
 * it fails until all three modules are created.
 */

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

async function main() {
  console.log('Testing route module exports...\n');

  // Test 1: teams.ts exports registerTeamRoutes
  let teamsModule: any;
  try {
    teamsModule = await import('../server/routes/teams.js');
  } catch (e: any) {
    throw new Error(`FAIL: server/routes/teams.ts could not be imported: ${e.message}`);
  }
  assert(
    typeof teamsModule.registerTeamRoutes === 'function',
    'teams.ts must export registerTeamRoutes as a function'
  );
  console.log('PASS: server/routes/teams.ts exports registerTeamRoutes');

  // Test 2: agents.ts exports registerAgentRoutes
  let agentsModule: any;
  try {
    agentsModule = await import('../server/routes/agents.js');
  } catch (e: any) {
    throw new Error(`FAIL: server/routes/agents.ts could not be imported: ${e.message}`);
  }
  assert(
    typeof agentsModule.registerAgentRoutes === 'function',
    'agents.ts must export registerAgentRoutes as a function'
  );
  console.log('PASS: server/routes/agents.ts exports registerAgentRoutes');

  // Test 3: messages.ts exports registerMessageRoutes
  let messagesModule: any;
  try {
    messagesModule = await import('../server/routes/messages.js');
  } catch (e: any) {
    throw new Error(`FAIL: server/routes/messages.ts could not be imported: ${e.message}`);
  }
  assert(
    typeof messagesModule.registerMessageRoutes === 'function',
    'messages.ts must export registerMessageRoutes as a function'
  );
  console.log('PASS: server/routes/messages.ts exports registerMessageRoutes');

  // Test 4: routes.ts wires registerTeamRoutes (grep check via file read)
  const fs = await import('fs');
  const routesContent = fs.readFileSync('./server/routes.ts', 'utf8');

  assert(
    routesContent.includes('registerTeamRoutes(app)'),
    'routes.ts must call registerTeamRoutes(app)'
  );
  console.log('PASS: routes.ts calls registerTeamRoutes(app)');

  assert(
    routesContent.includes('registerAgentRoutes(app)'),
    'routes.ts must call registerAgentRoutes(app)'
  );
  console.log('PASS: routes.ts calls registerAgentRoutes(app)');

  assert(
    routesContent.includes('registerMessageRoutes(app)'),
    'routes.ts must call registerMessageRoutes(app)'
  );
  console.log('PASS: routes.ts calls registerMessageRoutes(app)');

  // Test 5: routes.ts no longer contains the moved route handlers
  assert(
    !routesContent.includes('app.get("/api/teams"'),
    'routes.ts must NOT contain app.get("/api/teams") — moved to teams.ts'
  );
  console.log('PASS: routes.ts does not contain /api/teams handler');

  assert(
    !routesContent.includes('app.get("/api/agents"'),
    'routes.ts must NOT contain app.get("/api/agents") — moved to agents.ts'
  );
  console.log('PASS: routes.ts does not contain /api/agents handler');

  assert(
    !routesContent.includes('app.get("/api/conversations/:projectId"'),
    'routes.ts must NOT contain app.get("/api/conversations/:projectId") — moved to messages.ts'
  );
  console.log('PASS: routes.ts does not contain /api/conversations/:projectId handler');

  assert(
    !routesContent.includes('app.post(\'/api/messages/:messageId/reactions\''),
    'routes.ts must NOT contain reactions handler — moved to messages.ts'
  );
  console.log('PASS: routes.ts does not contain reactions handler');

  assert(
    !routesContent.includes('app.post("/api/training/feedback"'),
    'routes.ts must NOT contain /api/training/feedback handler — moved to messages.ts'
  );
  console.log('PASS: routes.ts does not contain /api/training/feedback handler');

  console.log('\nAll route module tests passed.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
