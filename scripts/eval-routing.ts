import { promises as fs } from 'fs';
import path from 'path';
import { evaluateConductorDecision } from '../server/ai/conductor.js';

interface RoutingCase {
  id: string;
  prompt: string;
  expectedHatch: string;
  expectedMode: 'single' | 'deliberation';
}

const DATASET_PATH = path.join(process.cwd(), 'eval', 'routing-prompts.jsonl');
const RESULT_DIR = path.join(process.cwd(), 'eval', 'results');

const DEFAULT_CASES: RoutingCase[] = [
  { id: 'route-01', prompt: 'Define MVP goals and timeline for launch in 7 days.', expectedHatch: 'Product Manager', expectedMode: 'single' },
  { id: 'route-02', prompt: 'Fix websocket duplicate sends and idempotency race condition.', expectedHatch: 'Backend Developer', expectedMode: 'deliberation' },
  { id: 'route-03', prompt: 'Design a cleaner right sidebar UX with better hierarchy.', expectedHatch: 'Product Designer', expectedMode: 'single' },
  { id: 'route-04', prompt: 'Plan GTM messaging and campaign sequence for launch week.', expectedHatch: 'Product Manager', expectedMode: 'deliberation' },
  { id: 'route-05', prompt: 'Create integration tests for project isolation and memory scoping.', expectedHatch: 'QA Lead', expectedMode: 'deliberation' },
  { id: 'route-06', prompt: 'Refactor API contract validation for websocket payloads.', expectedHatch: 'Backend Developer', expectedMode: 'deliberation' },
  { id: 'route-07', prompt: 'Improve typography and spacing for mobile breakpoints.', expectedHatch: 'Product Designer', expectedMode: 'single' },
  { id: 'route-08', prompt: 'What are the core business assumptions and risks?', expectedHatch: 'Product Manager', expectedMode: 'single' },
  { id: 'route-09', prompt: 'How should we monitor runtime latency p95 and drift?', expectedHatch: 'Backend Developer', expectedMode: 'deliberation' },
  { id: 'route-10', prompt: 'Define quality gate checklist before release.', expectedHatch: 'QA Lead', expectedMode: 'single' },
  { id: 'route-11', prompt: 'Set up approval-gated action proposal workflow.', expectedHatch: 'Product Manager', expectedMode: 'deliberation' },
  { id: 'route-12', prompt: 'Why is left sidebar scroll not working and how to fix?', expectedHatch: 'Backend Developer', expectedMode: 'single' },
  { id: 'route-13', prompt: 'Design interaction for visible reply and feedback actions.', expectedHatch: 'Product Designer', expectedMode: 'single' },
  { id: 'route-14', prompt: 'Assess production readiness with explicit rollback strategy.', expectedHatch: 'QA Lead', expectedMode: 'deliberation' },
  { id: 'route-15', prompt: 'Generate task graph for product, engineering, and operations.', expectedHatch: 'Product Manager', expectedMode: 'deliberation' },
  { id: 'route-16', prompt: 'Optimize message persistence across refresh and reconnect.', expectedHatch: 'Backend Developer', expectedMode: 'deliberation' },
  { id: 'route-17', prompt: 'Create emotional but direct user-facing response style guide.', expectedHatch: 'Product Designer', expectedMode: 'single' },
  { id: 'route-18', prompt: 'Should hatches disagree with user if evidence conflicts?', expectedHatch: 'Product Manager', expectedMode: 'single' },
  { id: 'route-19', prompt: 'Write regression tests for duplicate reply bug.', expectedHatch: 'QA Lead', expectedMode: 'single' },
  { id: 'route-20', prompt: 'Implement fallback chain OpenAI -> Ollama -> Mock safely.', expectedHatch: 'Backend Developer', expectedMode: 'deliberation' },
  { id: 'route-21', prompt: 'How to keep team replies contextual and project-scoped?', expectedHatch: 'Product Manager', expectedMode: 'single' },
  { id: 'route-22', prompt: 'Redesign right panel to auto-update from chat with manual override.', expectedHatch: 'Product Designer', expectedMode: 'deliberation' },
  { id: 'route-23', prompt: 'Validate safety redirect for illegal tax evasion prompt.', expectedHatch: 'QA Lead', expectedMode: 'deliberation' },
  { id: 'route-24', prompt: 'Add schema validation at WS ingress and client parse boundary.', expectedHatch: 'Backend Developer', expectedMode: 'single' },
  { id: 'route-25', prompt: 'Define launch decision forecast scenarios and mitigation.', expectedHatch: 'Product Manager', expectedMode: 'deliberation' },
  { id: 'route-26', prompt: 'Improve chat composer so long input does not overlap send icon.', expectedHatch: 'Product Designer', expectedMode: 'single' },
  { id: 'route-27', prompt: 'Build reliability budget and forced-resolution logic.', expectedHatch: 'Backend Developer', expectedMode: 'deliberation' },
  { id: 'route-28', prompt: 'Create non-coder report template for ship status.', expectedHatch: 'Product Manager', expectedMode: 'single' },
  { id: 'route-29', prompt: 'Audit hallucination intervention and stop-the-line behavior.', expectedHatch: 'QA Lead', expectedMode: 'deliberation' },
  { id: 'route-30', prompt: 'Design cleaner task cards and progress signals.', expectedHatch: 'Product Designer', expectedMode: 'single' },
];

const AVAILABLE_AGENTS = [
  { id: 'pm', name: 'PM', role: 'Product Manager' },
  { id: 'designer', name: 'Designer', role: 'Product Designer' },
  { id: 'engineer', name: 'Engineer', role: 'Backend Developer' },
  { id: 'qa', name: 'QA', role: 'QA Lead' },
];

async function ensureDataset(): Promise<RoutingCase[]> {
  await fs.mkdir(path.dirname(DATASET_PATH), { recursive: true });

  try {
    const raw = await fs.readFile(DATASET_PATH, 'utf8');
    const parsed = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as RoutingCase);
    if (parsed.length >= 30) {
      return parsed;
    }
  } catch {
    // ignore and rewrite defaults
  }

  await fs.writeFile(
    DATASET_PATH,
    `${DEFAULT_CASES.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
    'utf8'
  );
  return DEFAULT_CASES;
}

function normalizeMode(reviewRequired: boolean): 'single' | 'deliberation' {
  return reviewRequired ? 'deliberation' : 'single';
}

function toPercent(value: number): number {
  return Number((value * 100).toFixed(2));
}

async function main() {
  const cases = await ensureDataset();
  await fs.mkdir(RESULT_DIR, { recursive: true });

  let hatchCorrect = 0;
  let modeCorrect = 0;
  const rows: Array<Record<string, unknown>> = [];

  for (const testCase of cases) {
    const decision = evaluateConductorDecision({
      userMessage: testCase.prompt,
      conversationMode: 'project',
      availableAgents: AVAILABLE_AGENTS,
      projectName: 'Routing Harness',
    });

    const actualHatch = decision.primaryMatch?.role || 'Product Manager';
    const actualMode = normalizeMode(decision.decision.reviewRequired);
    const hatchPass = actualHatch.toLowerCase() === testCase.expectedHatch.toLowerCase();
    const modePass = actualMode === testCase.expectedMode;

    if (hatchPass) hatchCorrect += 1;
    if (modePass) modeCorrect += 1;

    rows.push({
      id: testCase.id,
      prompt: testCase.prompt,
      expectedHatch: testCase.expectedHatch,
      actualHatch,
      hatchPass,
      expectedMode: testCase.expectedMode,
      actualMode,
      modePass,
      confidence: decision.decision.confidence,
      reasons: decision.decision.reasons,
    });
  }

  const hatchAccuracy = hatchCorrect / cases.length;
  const modeAccuracy = modeCorrect / cases.length;
  const overallAccuracy = (hatchAccuracy + modeAccuracy) / 2;

  const verdict = overallAccuracy >= 0.8
    ? 'pass'
    : overallAccuracy >= 0.7
      ? 'warn'
      : 'fail';

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(RESULT_DIR, `${runId}-routing.json`);
  await fs.writeFile(
    outPath,
    JSON.stringify({
      runId,
      generatedAt: new Date().toISOString(),
      cases: rows,
      summary: {
        total: cases.length,
        hatchAccuracy: toPercent(hatchAccuracy),
        deliberationTriggerAccuracy: toPercent(modeAccuracy),
        overallAccuracy: toPercent(overallAccuracy),
        verdict,
      },
      thresholds: {
        passAt: 80,
        warnAt: 70,
      },
    }, null, 2),
    'utf8'
  );

  console.log(`[eval:routing] total=${cases.length} hatch=${toPercent(hatchAccuracy)}% deliberation=${toPercent(modeAccuracy)}% overall=${toPercent(overallAccuracy)}% verdict=${verdict}`);
  console.log(`[eval:routing] wrote ${outPath}`);

  if (verdict === 'fail') {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[eval:routing] failed', error);
  process.exit(1);
});
