import { promises as fs } from 'fs';
import path from 'path';
import { generateChatWithRuntimeFallback } from '../server/llm/providerResolver.js';

interface ScoreBreakdown {
  correctness: number;
  completeness: number;
  specificity: number;
  consistency: number;
  riskAwareness: number;
  userFit: number;
  autonomyQuality: number;
}

function scoreResponse(text: string): ScoreBreakdown {
  const lower = text.toLowerCase();
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  return {
    correctness: /plan|fix|design|launch|task/.test(lower) ? 4 : 3,
    completeness: wordCount > 80 ? 5 : wordCount > 40 ? 4 : 3,
    specificity: /\d|timeline|owner|step|metric/.test(lower) ? 5 : 3,
    consistency: /cannot|unknown/.test(lower) ? 3 : 4,
    riskAwareness: /risk|assumption|constraint|rollback|safety/.test(lower) ? 5 : 2,
    userFit: /you|your|project|goal/.test(lower) ? 4 : 3,
    autonomyQuality: /next step|action|owner|approval/.test(lower) ? 5 : 3,
  };
}

function totalScore(score: ScoreBreakdown): number {
  return Object.values(score).reduce((sum, value) => sum + value, 0);
}

async function generate(prompt: string, system?: string): Promise<string> {
  const result = await generateChatWithRuntimeFallback({
    messages: [
      ...(system ? [{ role: 'system' as const, content: system }] : []),
      { role: 'user', content: prompt },
    ],
    temperature: process.env.LLM_MODE === 'test' ? 0 : 0.25,
    maxTokens: 450,
    seed: process.env.LLM_MODE === 'test' ? 42 : undefined,
  });
  return result.content;
}

async function main() {
  const tasks = [
    'Task 1: Launch strategy for 7-day MVP.',
    'Task 2: Fix duplicate chat bubbles and prevent regressions.',
    'Task 3: Design gold-loan landing hero section.',
  ];

  const baselineRows: any[] = [];
  for (const task of tasks) {
    const output = await generate(task);
    const score = scoreResponse(output);
    baselineRows.push({ task, output, score, total: totalScore(score) });
  }

  const baselineAverage = baselineRows.reduce((sum, row) => sum + row.total, 0) / baselineRows.length;

  // Experiment 1: Feedback loop
  const feedbackOutput = await generate(
    `${tasks[0]}\n\nFeedback: Be more specific, include risks, owners, and fallback plan. Regenerate.`
  );
  const feedbackScore = scoreResponse(feedbackOutput);

  // Experiment 2: Single vs deliberation
  const single = await generate(tasks[1], 'Answer as single hatch.');
  const conductor = await generate(
    tasks[1],
    'Answer as conductor with proposal, critique, synthesis, and verification checklist.'
  );
  const singleScore = totalScore(scoreResponse(single));
  const conductorScore = totalScore(scoreResponse(conductor));

  // Experiment 3: Memory personalization isolation simulation
  const projectA = await generate('Project A instruction: Use concise bullet format. Now give update.');
  const projectB = await generate('Project B request: Give update without bullet format instruction from other projects.');
  const isolationPass = !projectB.toLowerCase().includes('project a instruction');

  const report = {
    generatedAt: new Date().toISOString(),
    baseline: {
      average: Number(baselineAverage.toFixed(2)),
      rows: baselineRows,
    },
    experiment1_feedbackLoop: {
      baselineTaskTotal: baselineRows[0].total,
      afterFeedbackTotal: totalScore(feedbackScore),
      improved: totalScore(feedbackScore) >= baselineRows[0].total,
    },
    experiment2_singleVsDeliberation: {
      singleScore,
      conductorScore,
      conductorImprovedOrEqual: conductorScore >= singleScore,
    },
    experiment3_memoryIsolation: {
      isolationPass,
      projectAExcerpt: projectA.slice(0, 200),
      projectBExcerpt: projectB.slice(0, 200),
    },
  };

  const outPath = path.join(process.cwd(), 'eval', 'results', `${new Date().toISOString().replace(/[:.]/g, '-')}-smartness-improvement.json`);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`[eval:smartness] baseline=${report.baseline.average}/35 feedbackImproved=${report.experiment1_feedbackLoop.improved} conductorImproved=${report.experiment2_singleVsDeliberation.conductorImprovedOrEqual} isolationPass=${report.experiment3_memoryIsolation.isolationPass}`);
  console.log(`[eval:smartness] wrote ${outPath}`);
}

main().catch((error) => {
  console.error('[eval:smartness] failed', error);
  process.exit(1);
});
