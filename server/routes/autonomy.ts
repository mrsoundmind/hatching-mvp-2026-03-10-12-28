import type { Express, Request } from 'express';
import { storage } from '../storage.js';
import { evaluateConductorDecision, buildRoleIdentity } from '../ai/conductor.js';
import { evaluateSafetyScore } from '../ai/safety.js';
import {
  createDeliberationSession,
  getActionProposal,
  getDeliberationSession,
  createActionProposal,
  updateActionProposalStatus,
  recordLearningEvent,
  runTrainingForRole,
  getTrainingStatus,
} from '../ai/autonomyStore.js';
import { findBestAgentMatch, type Agent } from '../ai/expertiseMatching.js';
import { buildDecisionForecast } from '../ai/forecast.js';
import { filterAvailableAgents, type ScopeContext } from '../orchestration/agentAvailability.js';
import { createTaskGraph } from '../autonomy/taskGraph/taskGraphEngine.js';
import { runAutonomousKnowledgeLoop } from '../knowledge/akl/runner.js';
import { getCurrentRuntimeConfig } from '../llm/providerResolver.js';
import { logAutonomyEvent, readAutonomyEvents, summarizeLatency } from '../autonomy/events/eventLogger.js';
import {
  createDeliberationTrace,
  getDeliberationTrace,
  listDeliberationTraces,
} from '../autonomy/traces/traceStore.js';
import { readConfigSnapshot, writeConfigSnapshot } from '../utils/configSnapshot.js';
import { detectDrift, loadRecentScores } from '../eval/drift/driftMonitor.js';

export function registerAutonomyRoutes(app: Express): void {
  const getSessionUserId = (req: Request): string | undefined => (req.session as any)?.userId as string | undefined;

  const getOwnedProjectIds = async (userId: string): Promise<Set<string>> => {
    const projects = await storage.getProjects();
    return new Set(projects.filter((project: any) => project.userId === userId).map((project) => project.id));
  };

  const requireOwnedProject = async (projectId: string, userId: string) => {
    const project = await storage.getProject(projectId);
    if (!project) {
      return null;
    }
    return (project as any).userId === userId ? project : null;
  };

  app.post('/api/conductor/evaluate-turn', async (req, res) => {
    try {
      const {
        userMessage,
        projectId,
        mode = 'project',
        contextId = null,
        addressedAgentId,
      } = req.body || {};

      if (!userMessage || !projectId) {
        return res.status(400).json({ error: 'userMessage and projectId are required' });
      }

      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const project = await requireOwnedProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const allProjectAgents = await storage.getAgentsByProject(projectId);
      const projectAgentsAsAgentType: Agent[] = allProjectAgents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        teamId: agent.teamId,
      }));

      const scopeContext: ScopeContext = {
        projectId,
        mode: mode as 'project' | 'team' | 'agent',
        ...(mode === 'team' && contextId ? { teamId: contextId } : {}),
        ...(mode === 'agent' && contextId ? { agentId: contextId } : {}),
      };
      const availableAgents = filterAvailableAgents(projectAgentsAsAgentType, scopeContext);
      const candidateMatches = findBestAgentMatch(userMessage, availableAgents);

      const result = evaluateConductorDecision({
        userMessage,
        conversationMode: mode as 'project' | 'team' | 'agent',
        availableAgents,
        addressedAgentId,
        projectName: project.name,
      });

      res.json({
        decision: result.decision,
        safetyScore: result.safetyScore,
        primaryMatch: result.primaryMatch,
        fallbackMatches: result.fallbackMatches,
        explainability: {
          decisionReason: result.decision.reasons.join(', '),
          candidateHatches: candidateMatches.map((match) => match.agent.id),
          selectionScores: Object.fromEntries(candidateMatches.map((match) => [match.agent.id, match.confidence])),
          selectionConfidence: result.decision.confidence,
        },
      });
    } catch (error) {
      console.error('Conductor evaluate-turn error:', error);
      res.status(500).json({ error: 'Failed to evaluate turn' });
    }
  });

  app.post('/api/safety/evaluate-turn', async (req, res) => {
    try {
      const { userMessage, draftResponse, mode = 'project', projectName } = req.body || {};
      if (!userMessage) {
        return res.status(400).json({ error: 'userMessage is required' });
      }

      const safetyScore = evaluateSafetyScore({
        userMessage,
        draftResponse,
        conversationMode: mode as 'project' | 'team' | 'agent',
        projectName,
      });

      res.json(safetyScore);
    } catch (error) {
      console.error('Safety evaluate-turn error:', error);
      res.status(500).json({ error: 'Failed to evaluate safety' });
    }
  });

  app.post('/api/deliberations', async (req, res) => {
    try {
      const { projectId, conversationId, objective, rounds, finalSynthesis } = req.body || {};
      if (!projectId || !conversationId || !objective) {
        return res.status(400).json({ error: 'projectId, conversationId, and objective are required' });
      }

      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const project = await requireOwnedProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const session = createDeliberationSession({
        projectId,
        conversationId,
        objective,
        rounds,
        finalSynthesis,
      });

      await createDeliberationTrace({
        traceId: session.id,
        userId: (req.session as any)?.userId || 'unknown-user',
        projectId,
        conversationId,
        objective,
        rounds: Array.isArray(rounds)
          ? rounds.map((round: any, index: number) => ({
            roundNo: Number(round?.roundNo || index + 1),
            hatchId: String(round?.speakerRoleId || 'unknown'),
            prompt: objective,
            output: String(round?.claim || ''),
            confidence: Number(round?.confidence || 0.6),
            riskScore: 0,
            latencyMs: 0,
            timestamp: new Date().toISOString(),
          }))
          : [],
        finalSynthesis: typeof finalSynthesis === 'string' ? finalSynthesis : undefined,
      });

      res.status(201).json(session);
    } catch (error) {
      console.error('Create deliberation error:', error);
      res.status(500).json({ error: 'Failed to create deliberation session' });
    }
  });

  app.get('/api/deliberations/:id', async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const session = getDeliberationSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: 'Deliberation session not found' });
      }
      const ownedProject = await requireOwnedProject(session.projectId, userId);
      if (!ownedProject) {
        return res.status(404).json({ error: 'Deliberation session not found' });
      }
      const trace = await getDeliberationTrace(req.params.id);
      res.json({
        ...session,
        trace,
      });
    } catch (error) {
      console.error('Get deliberation error:', error);
      res.status(500).json({ error: 'Failed to fetch deliberation session' });
    }
  });

  app.post('/api/forecasts/decision', async (req, res) => {
    try {
      const { userMessage, projectName, safetyScore } = req.body || {};
      if (!userMessage) {
        return res.status(400).json({ error: 'userMessage is required' });
      }

      const score = safetyScore || evaluateSafetyScore({
        userMessage,
        conversationMode: 'project',
        projectName,
      });

      const forecasts = buildDecisionForecast({
        userMessage,
        projectName,
        safetyScore: score,
      });

      res.json({ forecasts });
    } catch (error) {
      console.error('Decision forecast error:', error);
      res.status(500).json({ error: 'Failed to build decision forecast' });
    }
  });

  app.post('/api/roles/:id/learn/events', async (req, res) => {
    try {
      const roleId = req.params.id;
      const {
        projectId,
        conversationId,
        eventType = 'turn',
        input = '',
        output = '',
        outcome,
        reward,
        agentId,
      } = req.body || {};

      if (!projectId || !conversationId) {
        return res.status(400).json({ error: 'projectId and conversationId are required' });
      }
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const ownedProject = await requireOwnedProject(projectId, userId);
      if (!ownedProject) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const roleIdentity = buildRoleIdentity({
        projectId,
        roleTemplateId: roleId,
        agentId,
      });

      const event = recordLearningEvent({
        projectId,
        conversationId,
        roleIdentity,
        eventType,
        input,
        output,
        outcome,
        reward,
      });

      res.status(201).json(event);
    } catch (error) {
      console.error('Record learning event error:', error);
      res.status(500).json({ error: 'Failed to record learning event' });
    }
  });

  app.post('/api/training/run', async (req, res) => {
    try {
      const { roleId, projectId } = req.body || {};
      if (!roleId || !projectId) {
        return res.status(400).json({ error: 'roleId and projectId are required' });
      }
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const ownedProject = await requireOwnedProject(projectId, userId);
      if (!ownedProject) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const status = runTrainingForRole({ roleId, projectId });
      res.json(status);
    } catch (error) {
      console.error('Training run error:', error);
      res.status(500).json({ error: 'Failed to run training' });
    }
  });

  app.get('/api/training/roles/:id/status', async (req, res) => {
    try {
      const roleId = req.params.id;
      const projectId = String(req.query.projectId || '');
      if (!projectId) {
        return res.status(400).json({ error: 'projectId query parameter is required' });
      }
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const ownedProject = await requireOwnedProject(projectId, userId);
      if (!ownedProject) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const status = getTrainingStatus({ roleId, projectId });
      if (!status) {
        return res.status(404).json({ error: 'No training status found for role' });
      }
      res.json(status);
    } catch (error) {
      console.error('Get training status error:', error);
      res.status(500).json({ error: 'Failed to fetch training status' });
    }
  });

  app.post('/api/action-proposals', async (req, res) => {
    try {
      const { projectId, source, actionType, payload, riskLevel = 'medium' } = req.body || {};
      if (!projectId || !source || !actionType) {
        return res.status(400).json({ error: 'projectId, source, and actionType are required' });
      }
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const ownedProject = await requireOwnedProject(projectId, userId);
      if (!ownedProject) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const proposal = createActionProposal({
        projectId,
        source,
        actionType,
        payload: payload || {},
        riskLevel,
      });

      await logAutonomyEvent({
        eventType: 'proposal_created',
        projectId,
        teamId: null,
        conversationId: typeof payload?.conversationId === 'string' ? payload.conversationId : null,
        hatchId: null,
        provider: getCurrentRuntimeConfig().provider,
        mode: getCurrentRuntimeConfig().mode,
        latencyMs: null,
        confidence: null,
        riskScore: riskLevel === 'high' ? 0.8 : riskLevel === 'medium' ? 0.5 : 0.2,
        payload: {
          proposalId: proposal.id,
          actionType: proposal.actionType,
          source: proposal.source,
        },
      });

      res.status(201).json(proposal);
    } catch (error) {
      console.error('Create action proposal error:', error);
      res.status(500).json({ error: 'Failed to create action proposal' });
    }
  });

  app.post('/api/action-proposals/:id/approve', async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const proposalBeforeUpdate = getActionProposal(req.params.id);
      if (!proposalBeforeUpdate) {
        return res.status(404).json({ error: 'Action proposal not found' });
      }
      const ownedProject = await requireOwnedProject(proposalBeforeUpdate.projectId, userId);
      if (!ownedProject) {
        return res.status(404).json({ error: 'Action proposal not found' });
      }
      const proposal = updateActionProposalStatus(req.params.id, 'approved');
      if (!proposal) {
        return res.status(404).json({ error: 'Action proposal not found' });
      }
      await logAutonomyEvent({
        eventType: 'proposal_approved',
        projectId: proposal.projectId,
        teamId: null,
        conversationId: null,
        hatchId: null,
        provider: getCurrentRuntimeConfig().provider,
        mode: getCurrentRuntimeConfig().mode,
        latencyMs: null,
        confidence: null,
        riskScore: proposal.riskLevel === 'high' ? 0.8 : proposal.riskLevel === 'medium' ? 0.5 : 0.2,
        payload: {
          proposalId: proposal.id,
        },
      });
      res.json(proposal);
    } catch (error) {
      console.error('Approve action proposal error:', error);
      res.status(500).json({ error: 'Failed to approve action proposal' });
    }
  });

  app.post('/api/action-proposals/:id/reject', async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const proposalBeforeUpdate = getActionProposal(req.params.id);
      if (!proposalBeforeUpdate) {
        return res.status(404).json({ error: 'Action proposal not found' });
      }
      const ownedProject = await requireOwnedProject(proposalBeforeUpdate.projectId, userId);
      if (!ownedProject) {
        return res.status(404).json({ error: 'Action proposal not found' });
      }
      const proposal = updateActionProposalStatus(req.params.id, 'rejected');
      if (!proposal) {
        return res.status(404).json({ error: 'Action proposal not found' });
      }
      await logAutonomyEvent({
        eventType: 'revision_requested',
        projectId: proposal.projectId,
        teamId: null,
        conversationId: null,
        hatchId: null,
        provider: getCurrentRuntimeConfig().provider,
        mode: getCurrentRuntimeConfig().mode,
        latencyMs: null,
        confidence: null,
        riskScore: proposal.riskLevel === 'high' ? 0.8 : proposal.riskLevel === 'medium' ? 0.5 : 0.2,
        payload: {
          proposalId: proposal.id,
          status: proposal.status,
        },
      });
      res.json(proposal);
    } catch (error) {
      console.error('Reject action proposal error:', error);
      res.status(500).json({ error: 'Failed to reject action proposal' });
    }
  });

  app.post('/api/autonomy/task-graph', async (req, res) => {
    try {
      const {
        projectId,
        conversationId,
        objective,
        requestedTasks,
        roleHints,
      } = req.body || {};

      if (!projectId || !conversationId || !objective) {
        return res.status(400).json({ error: 'projectId, conversationId, and objective are required' });
      }
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const ownedProject = await requireOwnedProject(projectId, userId);
      if (!ownedProject) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const graph = createTaskGraph({
        objective: String(objective),
        requestedTasks: Array.isArray(requestedTasks) ? requestedTasks.map(String) : undefined,
        roleHints: Array.isArray(roleHints) ? roleHints.map(String) : undefined,
      });

      await logAutonomyEvent({
        eventType: 'task_graph_created',
        projectId,
        teamId: null,
        conversationId,
        hatchId: null,
        provider: getCurrentRuntimeConfig().provider,
        mode: getCurrentRuntimeConfig().mode,
        latencyMs: null,
        confidence: null,
        riskScore: null,
        payload: {
          graphId: graph.graphId,
          taskCount: graph.tasks.length,
        },
      });

      for (const task of graph.tasks) {
        await logAutonomyEvent({
          eventType: 'task_assigned',
          projectId,
          teamId: null,
          conversationId,
          hatchId: null,
          provider: getCurrentRuntimeConfig().provider,
          mode: getCurrentRuntimeConfig().mode,
          latencyMs: null,
          confidence: null,
          riskScore: null,
          payload: {
            graphId: graph.graphId,
            taskId: task.id,
            ownerRole: task.ownerRole,
            dependencies: task.dependencies,
          },
        });
      }

      res.status(201).json({ graph });
    } catch (error) {
      console.error('Task graph creation error:', error);
      res.status(500).json({ error: 'Failed to create task graph' });
    }
  });

  app.post('/api/akl/run', async (req, res) => {
    try {
      const {
        projectId,
        conversationId,
        role,
        userMessage,
        draftResponse,
        confidence = 0.5,
        highStakes = false,
      } = req.body || {};

      if (!projectId || !conversationId || !role || !userMessage || !draftResponse) {
        return res.status(400).json({
          error: 'projectId, conversationId, role, userMessage, and draftResponse are required',
        });
      }
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const ownedProject = await requireOwnedProject(projectId, userId);
      if (!ownedProject) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const runtime = getCurrentRuntimeConfig();
      const result = await runAutonomousKnowledgeLoop({
        projectId,
        conversationId,
        role,
        userMessage,
        draftResponse,
        confidence: Number(confidence),
        provider: runtime.provider,
        mode: runtime.mode,
        highStakes: Boolean(highStakes),
      });

      res.json(result);
    } catch (error) {
      console.error('AKL run error:', error);
      res.status(500).json({ error: 'Failed to execute autonomous knowledge loop' });
    }
  });

  app.get('/api/autonomy/events', async (req, res) => {
    try {
      const events = await readAutonomyEvents(1000);
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const ownedProjectIds = await getOwnedProjectIds(userId);
      const filteredEvents = events.filter((event) => {
        if (!event.projectId) {
          return true;
        }
        return ownedProjectIds.has(event.projectId);
      });
      res.json({ events: filteredEvents });
    } catch (error) {
      console.error('Autonomy events read error:', error);
      res.status(500).json({ error: 'Failed to read autonomy events' });
    }
  });

  app.get('/api/autonomy/traces', async (req, res) => {
    try {
      const traces = await listDeliberationTraces(200);
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const ownedProjectIds = await getOwnedProjectIds(userId);
      const filteredTraces = traces.filter((trace) => ownedProjectIds.has(trace.projectId));
      res.json({ traces: filteredTraces });
    } catch (error) {
      console.error('Deliberation traces read error:', error);
      res.status(500).json({ error: 'Failed to read deliberation traces' });
    }
  });

  app.get('/api/autonomy/evidence-pack', async (req, res) => {
    try {
      const snapshotResult = await writeConfigSnapshot('evidence_export');
      const currentSnapshot = await readConfigSnapshot();
      const events = await readAutonomyEvents(2000);
      const traces = await listDeliberationTraces(300);
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const ownedProjectIds = await getOwnedProjectIds(userId);
      const filteredEvents = events.filter((event) => {
        if (!event.projectId) {
          return true;
        }
        return ownedProjectIds.has(event.projectId);
      });
      const filteredTraces = traces.filter((trace) => ownedProjectIds.has(trace.projectId));
      const latency = await summarizeLatency(filteredEvents);
      const recentScores = await loadRecentScores(5);
      const currentScore = recentScores.length > 0 ? recentScores[recentScores.length - 1] : 0;
      const drift = detectDrift({
        currentScore,
        history: recentScores.slice(0, -1),
      });
      const eventTypeCounts = filteredEvents.reduce<Record<string, number>>((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      }, {});

      if (drift.driftDetected) {
        await logAutonomyEvent({
          eventType: 'drift_detected',
          projectId: null,
          teamId: null,
          conversationId: null,
          hatchId: null,
          provider: getCurrentRuntimeConfig().provider,
          mode: getCurrentRuntimeConfig().mode,
          latencyMs: null,
          confidence: null,
          riskScore: null,
          payload: drift as unknown as Record<string, unknown>,
        });
      }

      const evidencePack = {
        generatedAt: new Date().toISOString(),
        configSnapshot: {
          path: snapshotResult.path,
          hash: snapshotResult.hash,
          snapshot: currentSnapshot.snapshot,
          diffFromPrevious: snapshotResult.diffFromPrevious,
        },
        events: filteredEvents,
        eventTypeCounts,
        traces: filteredTraces,
        performance: latency,
        drift,
      };

      res.json(evidencePack);
    } catch (error) {
      console.error('Evidence pack export error:', error);
      res.status(500).json({ error: 'Failed to export evidence pack' });
    }
  });
}
