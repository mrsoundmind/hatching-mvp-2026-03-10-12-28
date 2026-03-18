/**
 * TDD tests for PersonalityEvolutionEngine bug fixes.
 * Run: npx tsx scripts/test-personality-evolution.ts
 */
import { PersonalityEvolutionEngine } from '../server/ai/personalityEvolution.js';
import type { UserBehaviorProfile, MessageAnalysis } from '../server/ai/userBehaviorAnalyzer.js';

let passed = 0; let failed = 0;
function assert(condition: boolean, message: string) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}
function makeBehavior(style: UserBehaviorProfile['communicationStyle'] = 'casual'): UserBehaviorProfile {
  return { communicationStyle: style, responsePreference: 'brief', technicalLevel: 0.5,
    engagementLevel: 0.5, decisionMaking: 'collaborative', interactionFrequency: 'regular',
    feedbackPattern: 'neutral', messagePatterns: [] } as any;
}
function makeAnalysis(): MessageAnalysis {
  return { complexity: 0.3, urgency: 0.3, emotionalTone: 'neutral', questionType: 'instruction',
    responseLength: 'short', timestamp: new Date().toISOString() } as any;
}

console.log('\nTest 1: Key normalisation — composite key resolves to same profile as bare agentId');
{
  const engine = new PersonalityEvolutionEngine();
  const agentId = 'agent-uuid-123'; const userId = 'user-uuid-456';
  const profileA = engine.getPersonalityProfile(agentId, userId);
  profileA.interactionCount = 7;
  const profileB = engine.getPersonalityProfile(`project-uuid:${agentId}`, userId);
  assert(profileB.interactionCount === 7, 'composite key resolves to same profile as bare agentId');
  assert(profileB.agentId === agentId, 'agentId stored without prefix');
}

console.log('\nTest 2: seedProfileFromDB restores persisted traits');
{
  const engine = new PersonalityEvolutionEngine();
  const persistedTraits = { formality: 0.2, verbosity: 0.9, empathy: 0.8, directness: 0.3, enthusiasm: 0.6, technicalDepth: 0.4 };
  engine.seedProfileFromDB('agent-seed', 'user-seed', persistedTraits, { interactionCount: 42, adaptationConfidence: 0.75, lastUpdated: new Date().toISOString() });
  const p = engine.getPersonalityProfile('agent-seed', 'user-seed');
  assert(p.adaptedTraits.verbosity === 0.9, 'verbosity restored from DB');
  assert(p.interactionCount === 42, 'interactionCount restored from DB');
}

console.log('\nTest 3: seedProfileFromDB does not overwrite live in-memory state');
{
  const engine = new PersonalityEvolutionEngine();
  const live = engine.getPersonalityProfile('agent-live', 'user-live');
  live.interactionCount = 15;
  engine.seedProfileFromDB('agent-live', 'user-live',
    { formality: 0.1, verbosity: 0.1, empathy: 0.1, directness: 0.1, enthusiasm: 0.1, technicalDepth: 0.1 },
    { interactionCount: 99, adaptationConfidence: 0.99, lastUpdated: new Date().toISOString() });
  assert(engine.getPersonalityProfile('agent-live', 'user-live').interactionCount === 15, 'live state preserved, DB seed ignored');
}

console.log('\nTest 4: No adaptation for first 3 interactions');
{
  const engine = new PersonalityEvolutionEngine();
  const base = engine.getPersonalityProfile('agent-cold', 'user-cold').adaptedTraits.verbosity;
  for (let i = 0; i < 3; i++) engine.adaptPersonalityFromBehavior('agent-cold', 'user-cold', makeBehavior('decisive'), makeAnalysis());
  const after = engine.getPersonalityProfile('agent-cold', 'user-cold');
  assert(after.adaptedTraits.verbosity === base, 'no adaptation in first 3 interactions');
  assert(after.interactionCount === 3, 'interactionCount incremented regardless');
}

console.log('\nTest 5: Adaptation fires on 5th interaction');
{
  const engine = new PersonalityEvolutionEngine();
  const base = engine.getPersonalityProfile('agent-t5', 'user-t5').adaptedTraits.verbosity;
  for (let i = 0; i < 5; i++) engine.adaptPersonalityFromBehavior('agent-t5', 'user-t5', makeBehavior('decisive'), makeAnalysis());
  assert(engine.getPersonalityProfile('agent-t5', 'user-t5').adaptedTraits.verbosity < base, 'verbosity reduced after 5 decisive interactions');
}

console.log('\nTest 6: No adaptation on interactions 6–9 (throttle window)');
{
  const engine = new PersonalityEvolutionEngine();
  for (let i = 0; i < 5; i++) engine.adaptPersonalityFromBehavior('agent-t6', 'user-t6', makeBehavior('decisive'), makeAnalysis());
  const at5 = engine.getPersonalityProfile('agent-t6', 'user-t6').adaptedTraits.verbosity;
  for (let i = 0; i < 4; i++) engine.adaptPersonalityFromBehavior('agent-t6', 'user-t6', makeBehavior('decisive'), makeAnalysis());
  assert(engine.getPersonalityProfile('agent-t6', 'user-t6').adaptedTraits.verbosity === at5, 'no adaptation between throttle windows (6–9)');
}

console.log('\nTest 7: Without join-time seed, restarted server loses learned traits on first message');
{
  // Build up learned traits across 5 interactions
  const engineBefore = new PersonalityEvolutionEngine();
  for (let i = 0; i < 5; i++) engineBefore.adaptPersonalityFromBehavior('agent-jr', 'user-jr', makeBehavior('decisive'), makeAnalysis());
  const learnedVerbosity = engineBefore.getPersonalityProfile('agent-jr', 'user-jr').adaptedTraits.verbosity;
  const defaultVerbosity = new PersonalityEvolutionEngine().getPersonalityProfile('default-check', 'user-jr').adaptedTraits.verbosity;
  assert(learnedVerbosity !== defaultVerbosity, 'learned verbosity differs from default (pre-condition)');

  // Fixed: join_conversation calls seedProfileFromDB BEFORE first message.
  const engineFixed = new PersonalityEvolutionEngine();
  engineFixed.seedProfileFromDB('agent-jr', 'user-jr',
    { formality: 0.5, verbosity: learnedVerbosity, empathy: 0.5, directness: 0.8, enthusiasm: 0.5, technicalDepth: 0.5 },
    { interactionCount: 10, adaptationConfidence: 0.7, lastUpdated: new Date().toISOString() }
  );
  const firstMessageTraits = engineFixed.getPersonalityProfile('agent-jr', 'user-jr').adaptedTraits.verbosity;
  assert(firstMessageTraits === learnedVerbosity, 'first message after restart uses learned verbosity when join seeds from DB');
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('TESTS FAILED'); process.exit(1); }
else { console.log('ALL TESTS PASSED'); }
