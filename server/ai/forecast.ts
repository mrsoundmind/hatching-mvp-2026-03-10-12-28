import type { DecisionForecast, SafetyScore } from "./autonomyTypes.js";

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function isStrategicTurn(userMessage: string): boolean {
  const message = (userMessage || "").toLowerCase();
  return includesAny(message, [
    "strategy",
    "roadmap",
    "launch",
    "timeline",
    "milestone",
    "priority",
    "go to market",
    "gtm",
    "budget",
    "risk",
    "plan",
    "phase",
  ]);
}

export function buildDecisionForecast(input: {
  userMessage: string;
  safetyScore: SafetyScore;
  projectName?: string;
}): DecisionForecast[] {
  const user = (input.userMessage || "").toLowerCase();
  const aggregateRisk = Math.max(
    input.safetyScore.hallucinationRisk,
    input.safetyScore.scopeRisk,
    input.safetyScore.executionRisk,
  );

  const speedProb = clamp(0.58 - aggregateRisk * 0.22 + (includesAny(user, ["mvp", "ship fast", "quick"]) ? 0.08 : 0));
  const balancedProb = clamp(0.64 - Math.abs(0.45 - aggregateRisk) * 0.4);
  const qualityProb = clamp(0.52 + aggregateRisk * 0.25 + (includesAny(user, ["quality", "reliable", "secure"]) ? 0.08 : 0));

  const projectLabel = input.projectName || "this project";

  return [
    {
      scenario: `Fast-track launch path for ${projectLabel}`,
      probability: speedProb,
      impact: "medium",
      leadIndicators: [
        "Task throughput rises week-over-week",
        "Open blocker count remains under 3",
        "No high-severity defects in validation",
      ],
      mitigation: [
        "Define non-negotiable quality gates",
        "Freeze scope once validation starts",
        "Escalate unresolved blockers within 24h",
      ],
    },
    {
      scenario: `Balanced execution path for ${projectLabel}`,
      probability: balancedProb,
      impact: "high",
      leadIndicators: [
        "On-time milestone completion > 80%",
        "Forecast confidence remains above 0.6",
        "Cross-team dependencies resolved before phase handoff",
      ],
      mitigation: [
        "Weekly risk review with owners",
        "Keep one contingency sprint buffer",
        "Explicit approval gates before launch phase",
      ],
    },
    {
      scenario: `Quality-first hardened path for ${projectLabel}`,
      probability: qualityProb,
      impact: "high",
      leadIndicators: [
        "Defect escape rate trending down",
        "Security and compliance checks pass first time",
        "Critical path tasks have backup owners",
      ],
      mitigation: [
        "Require peer-review on high-risk changes",
        "Run pre-launch simulation and rollback drills",
        "Block release if unresolved high-risk items remain",
      ],
    },
  ];
}
