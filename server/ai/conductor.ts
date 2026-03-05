import {
  analyzeQuestion,
  findBestAgentMatch,
  type Agent as ExpertiseAgent,
} from "./expertiseMatching.js";
import {
  evaluateSafetyScore,
  SAFETY_THRESHOLDS,
  needsClarification,
} from "./safety.js";
import type { ConductorDecision, RoleIdentity, SafetyScore } from "./autonomyTypes.js";

function inferRoleFromMessage(userMessage: string, agents: ExpertiseAgent[]): ExpertiseAgent | undefined {
  const text = (userMessage || "").toLowerCase();
  const contains = (pattern: RegExp) => pattern.test(text);

  const rolePriority: Array<{ rolePattern: RegExp; cuePattern: RegExp }> = [
    { rolePattern: /qa|quality/i, cuePattern: /(qa|test|regression|invariant|safety suite|hallucination|non-regression|quality gate|readiness|illegal|tax|safety redirect|rollback)/i },
    { rolePattern: /backend|engineer|developer|technical/i, cuePattern: /(api|websocket|idempotency|race|stream|timeout|fallback|schema|\\bdb\\b|persistence|routing|contract|runtime|latency|drift|reliability|forced-resolution|budget)/i },
    { rolePattern: /designer|ui|ux/i, cuePattern: /(design|ux|ui|layout|typography|sidebar|interaction|mobile|visual|hierarchy|composer|overlap|spacing|scroll)/i },
    { rolePattern: /product manager|pm|manager/i, cuePattern: /(roadmap|strategy|scope|launch|mvp|owner|dependency|go-to-market|gtm|milestone)/i },
  ];

  for (const rule of rolePriority) {
    if (!contains(rule.cuePattern)) continue;
    const found = agents.find((agent) => rule.rolePattern.test(agent.role));
    if (found) return found;
  }

  return agents.find((agent) => /product manager|pm|manager/i.test(agent.role)) || agents[0];
}

function inferDeliberationNeed(userMessage: string): boolean {
  const text = (userMessage || "").toLowerCase();
  return /(approval gate|rollback|fallback chain|cross-functional|across|risk|safety|hallucination|drift|task graph|isolation|forecast|manual override|go-to-market|gtm|integration test|race condition|idempotency)/i.test(text);
}

export function buildRoleIdentity(input: {
  projectId: string;
  roleTemplateId: string;
  agentId?: string;
}): RoleIdentity {
  const canonicalRoleKey = `${input.projectId}:${input.roleTemplateId}:${input.agentId || "virtual"}`;
  return {
    projectId: input.projectId,
    roleTemplateId: input.roleTemplateId,
    agentId: input.agentId,
    canonicalRoleKey,
  };
}

export function evaluateConductorDecision(input: {
  userMessage: string;
  conversationMode: "project" | "team" | "agent";
  availableAgents: ExpertiseAgent[];
  addressedAgentId?: string;
  projectName?: string;
}): {
  decision: ConductorDecision;
  safetyScore: SafetyScore;
  primaryMatch?: ExpertiseAgent;
  fallbackMatches: ExpertiseAgent[];
} {
  const matches = findBestAgentMatch(input.userMessage, input.availableAgents);
  const inferredPrimary = inferRoleFromMessage(input.userMessage, input.availableAgents);
  const primaryMatch = inferredPrimary || matches[0]?.agent;
  const primaryScore = matches.find((match) => match.agent.id === primaryMatch?.id)?.confidence ?? (primaryMatch ? 0.72 : 0);
  const routeReasons: string[] = [];
  let route: ConductorDecision["route"] = "authority_default";

  if (input.addressedAgentId) {
    route = "addressed_agent";
    routeReasons.push("explicit_addressing");
  } else if (primaryMatch && primaryScore >= 0.55 && input.conversationMode !== "agent") {
    route = "intent_specialist";
    routeReasons.push(`intent_specialist:${primaryMatch.role}`);
  } else {
    routeReasons.push("authority_default");
  }

  const analysis = analyzeQuestion(input.userMessage);
  const safetyScore = evaluateSafetyScore({
    userMessage: input.userMessage,
    conversationMode: input.conversationMode,
    projectName: input.projectName,
  });

  const aggregateRisk = Math.max(
    safetyScore.hallucinationRisk,
    safetyScore.scopeRisk,
    safetyScore.executionRisk
  );

  const deliberationHint = inferDeliberationNeed(input.userMessage);

  const reviewRequired =
    aggregateRisk >= SAFETY_THRESHOLDS.peerReviewTrigger ||
    analysis.requiresMultipleAgents ||
    analysis.complexity === "high" ||
    deliberationHint;

  const reviewerCount: 0 | 1 | 2 =
    aggregateRisk >= SAFETY_THRESHOLDS.doubleReviewTrigger ? 2 :
      reviewRequired ? 1 : 0;

  const interventionRequired = needsClarification(safetyScore);
  const gateRequired = safetyScore.executionRisk >= SAFETY_THRESHOLDS.doubleReviewTrigger;

  const decision: ConductorDecision = {
    route,
    reviewRequired,
    interventionRequired,
    gateRequired,
    confidence: safetyScore.confidence,
    reviewerCount,
    reasons: [...routeReasons, ...safetyScore.reasons],
  };

  return {
    decision,
    safetyScore,
    primaryMatch,
    fallbackMatches: matches
      .map((m) => m.agent)
      .filter((agent) => agent.id !== primaryMatch?.id)
      .slice(0, 4),
  };
}
