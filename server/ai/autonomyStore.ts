import { randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";
import path from "path";
import type {
  ActionProposal,
  DeliberationRound,
  DeliberationSession,
  LearningEvent,
  RoleIdentity,
} from "./autonomyTypes.js";

interface TrainingStatus {
  roleId: string;
  projectId: string;
  version: number;
  lastRunAt: string;
  promoted: boolean;
  driftBlocked?: boolean;
  metrics: {
    qualityDelta: number;
    safetyDelta: number;
    adherencePass: boolean;
    forecastErrorDelta: number;
  };
}

const deliberationSessions = new Map<string, DeliberationSession>();
const learningEvents: LearningEvent[] = [];
const actionProposals = new Map<string, ActionProposal>();
const trainingStatusByRole = new Map<string, TrainingStatus>();

function hasActiveDriftBlock(): boolean {
  try {
    const driftPath = path.join(process.cwd(), "eval", "drift", "latest.json");
    if (!existsSync(driftPath)) return false;
    const raw = readFileSync(driftPath, "utf8");
    const parsed = JSON.parse(raw) as { driftDetected?: boolean };
    return parsed.driftDetected === true;
  } catch {
    return false;
  }
}

export function createDeliberationSession(input: {
  projectId: string;
  conversationId: string;
  objective: string;
  rounds?: Array<{
    speakerRoleId: string;
    claim: string;
    critiqueOf?: string;
    confidence?: number;
    evidence?: string[];
  }>;
  finalSynthesis?: string;
}): DeliberationSession {
  const now = new Date().toISOString();
  const rounds: DeliberationRound[] = (input.rounds || []).map((round, index) => ({
    roundNo: index + 1,
    speakerRoleId: round.speakerRoleId,
    claim: round.claim,
    critiqueOf: round.critiqueOf,
    confidence: typeof round.confidence === "number" ? round.confidence : 0.6,
    evidence: round.evidence,
    createdAt: now,
  }));

  const session: DeliberationSession = {
    id: `delib-${randomUUID()}`,
    projectId: input.projectId,
    conversationId: input.conversationId,
    objective: input.objective,
    status: input.finalSynthesis ? "completed" : "active",
    rounds,
    finalSynthesis: input.finalSynthesis,
    createdAt: now,
    updatedAt: now,
  };

  deliberationSessions.set(session.id, session);
  return session;
}

export function getDeliberationSession(id: string): DeliberationSession | undefined {
  return deliberationSessions.get(id);
}

export function appendDeliberationRound(input: {
  sessionId: string;
  speakerRoleId: string;
  claim: string;
  critiqueOf?: string;
  confidence?: number;
  evidence?: string[];
}): DeliberationSession | undefined {
  const session = deliberationSessions.get(input.sessionId);
  if (!session) return undefined;

  const round: DeliberationRound = {
    roundNo: session.rounds.length + 1,
    speakerRoleId: input.speakerRoleId,
    claim: input.claim,
    critiqueOf: input.critiqueOf,
    confidence: typeof input.confidence === "number" ? input.confidence : 0.6,
    evidence: input.evidence,
    createdAt: new Date().toISOString(),
  };

  session.rounds.push(round);
  session.updatedAt = new Date().toISOString();
  deliberationSessions.set(session.id, session);
  return session;
}

export function finalizeDeliberationSession(input: {
  sessionId: string;
  finalSynthesis: string;
}): DeliberationSession | undefined {
  const session = deliberationSessions.get(input.sessionId);
  if (!session) return undefined;
  session.finalSynthesis = input.finalSynthesis;
  session.status = "completed";
  session.updatedAt = new Date().toISOString();
  deliberationSessions.set(session.id, session);
  return session;
}

export function recordLearningEvent(input: {
  projectId: string;
  conversationId: string;
  roleIdentity: RoleIdentity;
  eventType: LearningEvent["eventType"];
  input: string;
  output: string;
  outcome?: string;
  reward?: number;
}): LearningEvent {
  const event: LearningEvent = {
    id: `learn-${randomUUID()}`,
    projectId: input.projectId,
    conversationId: input.conversationId,
    roleIdentity: input.roleIdentity,
    eventType: input.eventType,
    input: input.input,
    output: input.output,
    outcome: input.outcome,
    reward: input.reward,
    createdAt: new Date().toISOString(),
  };

  learningEvents.push(event);
  return event;
}

export function getLearningEventsByRole(roleId: string, projectId?: string): LearningEvent[] {
  return learningEvents.filter((event) => {
    const roleMatch = event.roleIdentity.roleTemplateId === roleId || event.roleIdentity.agentId === roleId;
    if (!roleMatch) return false;
    if (projectId && event.projectId !== projectId) return false;
    return true;
  });
}

export function createActionProposal(input: {
  projectId: string;
  source: ActionProposal["source"];
  actionType: string;
  payload: Record<string, unknown>;
  riskLevel: ActionProposal["riskLevel"];
}): ActionProposal {
  const now = new Date().toISOString();
  const proposal: ActionProposal = {
    id: `act-${randomUUID()}`,
    projectId: input.projectId,
    source: input.source,
    actionType: input.actionType,
    payload: input.payload,
    riskLevel: input.riskLevel,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  actionProposals.set(proposal.id, proposal);
  return proposal;
}

export function getActionProposal(id: string): ActionProposal | undefined {
  return actionProposals.get(id);
}

export function updateActionProposalStatus(
  id: string,
  status: ActionProposal["status"],
): ActionProposal | undefined {
  const proposal = actionProposals.get(id);
  if (!proposal) return undefined;
  proposal.status = status;
  proposal.updatedAt = new Date().toISOString();
  actionProposals.set(id, proposal);
  return proposal;
}

export function runTrainingForRole(input: {
  roleId: string;
  projectId: string;
}): TrainingStatus {
  const current = trainingStatusByRole.get(`${input.projectId}:${input.roleId}`);
  const version = current ? current.version + 1 : 1;

  const roleEvents = getLearningEventsByRole(input.roleId, input.projectId);
  const successEvents = roleEvents.filter((event) => (event.reward || 0) > 0);
  const qualityDelta = Math.min(0.2, 0.02 + successEvents.length * 0.01);
  const safetyDelta = Math.max(-0.03, -0.01 + (roleEvents.length >= 3 ? 0.01 : 0));
  const adherencePass = roleEvents.length >= 1;
  const forecastErrorDelta = Math.max(-0.1, -0.03 + roleEvents.length * 0.002);
  const driftBlocked = hasActiveDriftBlock();

  const promoted =
    qualityDelta >= 0.08 &&
    safetyDelta >= 0 &&
    adherencePass &&
    forecastErrorDelta >= -0.001 &&
    !driftBlocked;

  const status: TrainingStatus = {
    roleId: input.roleId,
    projectId: input.projectId,
    version,
    lastRunAt: new Date().toISOString(),
    promoted,
    driftBlocked,
    metrics: {
      qualityDelta,
      safetyDelta,
      adherencePass,
      forecastErrorDelta,
    },
  };

  trainingStatusByRole.set(`${input.projectId}:${input.roleId}`, status);
  return status;
}

export function getTrainingStatus(input: {
  roleId: string;
  projectId: string;
}): TrainingStatus | undefined {
  return trainingStatusByRole.get(`${input.projectId}:${input.roleId}`);
}
