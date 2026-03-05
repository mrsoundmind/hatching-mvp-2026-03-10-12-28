import type { SafetyScore } from "./autonomyTypes.js";

export const SAFETY_THRESHOLDS = {
  peerReviewTrigger: 0.35,
  doubleReviewTrigger: 0.65,
  clarificationRequiredRisk: 0.70,
  clarificationRequiredConfidence: 0.45,
} as const;

const ABSOLUTE_CLAIMS = [
  "guaranteed",
  "always",
  "never fails",
  "100%",
  "certainly",
  "definitely",
  "no risk",
];

const RISKY_EXECUTION = [
  "delete",
  "drop table",
  "production deploy",
  "publish",
  "send to all users",
];

const EVASION_PATTERNS = [
  /\bwithout being detected\b/i,
  /\bnot be detected\b/i,
  /\b(avoid|bypass|evade|circumvent|ignore|disable)\b.{0,40}\b(tax|taxes|legal|compliance|security)\b/i,
  /\b(tax|taxes|legal|compliance|security)\b.{0,40}\b(avoid|bypass|evade|circumvent|ignore|disable)\b/i,
];

const SCOPE_CONFLICT = [
  "other project",
  "another project",
  "cross project",
  "different project",
];

const PROMPT_INJECTION_PATTERNS = [
  "ignore previous instructions",
  "reveal system prompt",
  "developer message",
  "god mode",
  "bypass policy",
  "disable safeguards",
  "jailbreak",
  "tool output says",
];

export function evaluateSafetyScore(input: {
  userMessage: string;
  draftResponse?: string;
  conversationMode: "project" | "team" | "agent";
  projectName?: string;
}): SafetyScore {
  const user = (input.userMessage || "").toLowerCase();
  const draft = (input.draftResponse || "").toLowerCase();
  const joined = `${user}\n${draft}`;
  const reasons: string[] = [];

  let hallucinationRisk = 0.15;
  let scopeRisk = 0.1;
  let executionRisk = 0.1;

  for (const phrase of ABSOLUTE_CLAIMS) {
    if (draft.includes(phrase)) {
      hallucinationRisk += 0.12;
      reasons.push(`absolute_claim:${phrase}`);
    }
  }

  if (draft.length > 180 && !draft.includes("assumption") && !draft.includes("depends")) {
    hallucinationRisk += 0.1;
    reasons.push("missing_uncertainty_markers");
  }

  if (user.includes("predict") || user.includes("future")) {
    hallucinationRisk += 0.1;
    reasons.push("future_claim_request");
  }

  for (const phrase of SCOPE_CONFLICT) {
    if (user.includes(phrase) || draft.includes(phrase)) {
      scopeRisk += 0.18;
      reasons.push(`scope_conflict:${phrase}`);
    }
  }

  let promptInjectionDetected = false;
  for (const phrase of PROMPT_INJECTION_PATTERNS) {
    if (user.includes(phrase) || draft.includes(phrase)) {
      promptInjectionDetected = true;
      reasons.push(`prompt_injection:${phrase}`);
    }
  }

  if (promptInjectionDetected) {
    hallucinationRisk = Math.max(hallucinationRisk, 0.82);
    scopeRisk = Math.max(scopeRisk, 0.74);
    executionRisk = Math.max(executionRisk, 0.72);
  }

  if (input.conversationMode === "agent" && user.includes("all teams")) {
    scopeRisk += 0.12;
    reasons.push("scope_mismatch_agent_vs_project");
  }

  for (const phrase of RISKY_EXECUTION) {
    if (joined.includes(phrase)) {
      executionRisk += 0.15;
      reasons.push(`high_impact_action:${phrase}`);
    }
  }

  for (const pattern of EVASION_PATTERNS) {
    if (pattern.test(joined)) {
      executionRisk += 0.15;
      reasons.push(`high_impact_action:${pattern.source}`);
    }
  }

  // Clamp all risks
  hallucinationRisk = Math.min(1, hallucinationRisk);
  scopeRisk = Math.min(1, scopeRisk);
  executionRisk = Math.min(1, executionRisk);

  const aggregateRisk = Math.max(hallucinationRisk, scopeRisk, executionRisk);
  const confidence = Math.max(0, Math.min(1, 0.92 - (aggregateRisk * 0.75)));

  return {
    hallucinationRisk,
    scopeRisk,
    executionRisk,
    confidence,
    reasons,
  };
}

export function needsClarification(score: SafetyScore): boolean {
  return (
    score.hallucinationRisk >= SAFETY_THRESHOLDS.clarificationRequiredRisk ||
    score.scopeRisk >= SAFETY_THRESHOLDS.clarificationRequiredRisk ||
    score.executionRisk >= SAFETY_THRESHOLDS.clarificationRequiredRisk ||
    score.confidence < SAFETY_THRESHOLDS.clarificationRequiredConfidence
  );
}

export function buildClarificationIntervention(input: {
  projectName?: string;
  reasons: string[];
}): string {
  const projectLabel = input.projectName || "this project";
  const reasonHint = input.reasons.slice(0, 2).join(", ");
  const hint = reasonHint ? ` (${reasonHint})` : "";
  return [
    `I want to make sure we do this safely and accurately for ${projectLabel}${hint}.`,
    "Before I proceed, clarify these points:",
    "1. What exact outcome do you want in one sentence?",
    "2. What constraints are non-negotiable (time, budget, legal, quality)?",
    "3. Should I optimize for speed, quality, or balanced delivery right now?",
  ].join("\n");
}
