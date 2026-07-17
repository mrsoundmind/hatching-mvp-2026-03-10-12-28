import type { SafetyScore } from "./autonomyTypes.js";

export const AUTONOMOUS_SAFETY_THRESHOLDS = {
  peerReviewTrigger: 0.35,
  clarificationRequiredRisk: 0.70,
} as const;

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

// Explicit creation commands — user intent is clear, no clarification needed
const EXPLICIT_CREATION_INTENTS = [
  /\b(create|add|make|build|set up|start|spin up)\b.{0,30}\b(team|hatch|agent|task|project|channel|doc)\b/i,
  /\b(team|hatch|agent|task)\b.{0,20}\b(called|named|for)\b/i,
];

export function hasExplicitCreationIntent(userMessage: string): boolean {
  return EXPLICIT_CREATION_INTENTS.some(pattern => pattern.test(userMessage));
}

// Phase 38-02 — destructive intent detection (ALWY-04)
// Critical verbs: unambiguously destructive → base 0.60
// Reset verbs: destructive-in-context but ambiguous alone → base 0.45
// Bulk scope + data scope multiplicatively raise the score so combined
// intent like "delete all my data" crosses the 0.70 clarificationRequiredRisk gate.
const DESTRUCTIVE_VERB_CRITICAL = /\b(delete|wipe|nuke|erase|destroy|obliterate)\b/i;
const DESTRUCTIVE_VERB_RESET = /\b(reset|start over|restart|clean slate)\b/i;
const BULK_SCOPE = /\b(all|everything|every|entire)\b/i;
const DATA_SCOPE = /\b(data|database|db|project|history|conversations?|messages?|tasks?|team|agents?|brain)\b/i;

function scoreDestructiveIntent(userMessage: string): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let base = 0;

  if (DESTRUCTIVE_VERB_CRITICAL.test(userMessage)) {
    base = 0.60;
    reasons.push("destructive_verb_critical");
  } else if (DESTRUCTIVE_VERB_RESET.test(userMessage)) {
    base = 0.45;
    reasons.push("destructive_verb_reset");
  }

  if (base === 0) return { score: 0, reasons };

  let multiplier = 1.0;
  if (BULK_SCOPE.test(userMessage)) {
    multiplier *= 1.3;
    reasons.push("bulk_scope_modifier");
  }
  if (DATA_SCOPE.test(userMessage)) {
    multiplier *= 1.2;
    reasons.push("data_scope_modifier");
  }

  return { score: Math.min(1, base * multiplier), reasons };
}

export function evaluateSafetyScore(input: {
  userMessage: string;
  draftResponse?: string;
  conversationMode: "project" | "team" | "agent";
  projectName?: string;
  executionContext?: "chat" | "autonomous_task";
}): SafetyScore {
  const user = (input.userMessage || "").toLowerCase();
  const draft = (input.draftResponse || "").toLowerCase();
  const joined = `${user}\n${draft}`;
  const reasons: string[] = [];

  let hallucinationRisk = 0.15;
  let scopeRisk = 0.1;
  let executionRisk = 0.1;

  // Explicit creation commands get reduced baselines — user intent is clear
  if (hasExplicitCreationIntent(input.userMessage)) {
    hallucinationRisk = 0.05;
    scopeRisk = 0.05;
    executionRisk = 0.05;
    reasons.push("explicit_creation_intent_detected");
  }

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

  // Phase 38-02 — destructive-intent detector (ALWY-04)
  // Additive-max avoids inflating non-destructive scores while ensuring
  // "delete all my data" crosses clarificationRequiredRisk (0.70).
  const destructiveIntent = scoreDestructiveIntent(input.userMessage || "");
  if (destructiveIntent.score > 0) {
    executionRisk = Math.max(executionRisk, destructiveIntent.score);
    reasons.push(...destructiveIntent.reasons);
  }

  // Autonomous context raises execution risk baseline
  if (input.executionContext === "autonomous_task") {
    executionRisk = executionRisk + 0.10;
    reasons.push("autonomous_context_risk_boost");
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
  // #43: do NOT interpolate input.reasons here — they are internal codes (e.g.
  // "authority_default", "high_impact_action:delete") and were leaking into the user-facing reply.
  // The raw reasons still ride in the telemetry payload (logAutonomyEvent), just not in chat text.
  return [
    `I want to make sure we do this safely and accurately for ${projectLabel}.`,
    "Before I proceed, clarify these points:",
    "1. What exact outcome do you want in one sentence?",
    "2. What constraints are non-negotiable (time, budget, legal, quality)?",
    "3. Should I optimize for speed, quality, or balanced delivery right now?",
  ].join("\n");
}
