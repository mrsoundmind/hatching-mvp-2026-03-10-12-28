import type { Express, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { storage } from '../storage.js';
import { pool } from '../db.js';
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
import { logAutonomyEvent, readAutonomyEvents, readAutonomyEventsByProject, summarizeLatency } from '../autonomy/events/eventLogger.js';
import { z } from 'zod';
import {
  createDeliberationTrace,
  getDeliberationTrace,
  listDeliberationTraces,
} from '../autonomy/traces/traceStore.js';
import { readConfigSnapshot, writeConfigSnapshot } from '../utils/configSnapshot.js';
import { detectDrift, loadRecentScores } from '../eval/drift/driftMonitor.js';

function mapEventTypeToCategory(eventType: string): 'task' | 'handoff' | 'review' | 'approval' | 'system' {
  switch (eventType) {
    case 'task_started':
    case 'task_completed':
    case 'task_executing':
    case 'background_execution_started':
    case 'background_execution_completed':
      return 'task';
    case 'handoff_announced':
    case 'handoff_chain_completed':
      return 'handoff';
    case 'peer_review_completed':
    case 'peer_review_started':
    case 'peer_review_feedback':
      return 'review';
    case 'approval_required':
    case 'approval_granted':
    case 'approval_rejected':
      return 'approval';
    default:
      return 'system';
  }
}

export function registerAutonomyRoutes(app: Express): void {
  const getSessionUserId = (req: Request): string | undefined => (req.session as any)?.userId as string | undefined;

  const getOwnedProjectIds = async (userId: string): Promise<Set<string>> => {
    const projects = await storage.getProjectsByUserId(userId);
    return new Set(projects.map((project) => project.id));
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
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

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
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

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

  // GET /api/autonomy/events — project-scoped events with traceId aggregation
  const eventsQuerySchema = z.object({
    projectId: z.string().uuid().optional(),
    limit: z.coerce.number().min(1).max(200).default(50),
    eventType: z.string().optional(),
  });

  app.get('/api/autonomy/events', async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const parsed = eventsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() });
      }
      const { projectId, limit, eventType } = parsed.data;

      let rawEvents;
      if (projectId) {
        const project = await requireOwnedProject(projectId, userId);
        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }
        rawEvents = await readAutonomyEventsByProject(projectId, limit);
      } else {
        const events = await readAutonomyEvents(limit);
        const ownedProjectIds = await getOwnedProjectIds(userId);
        rawEvents = events.filter((event) => {
          if (!event.projectId) return true;
          return ownedProjectIds.has(event.projectId);
        });
      }

      // Apply eventType filter if provided
      if (eventType) {
        rawEvents = rawEvents.filter(e => e.eventType === eventType);
      }

      // Map to feed-compatible shape with traceId grouping
      const traceGroups = new Map<string, typeof rawEvents>();
      for (const event of rawEvents) {
        const existing = traceGroups.get(event.traceId) || [];
        existing.push(event);
        traceGroups.set(event.traceId, existing);
      }

      // #110/#102: resolve agentId -> name at read time. Events carry hatchId but rarely agentName,
      // so the feed rendered an anonymous "Hatch" with a blank avatar. Build a name map once from the
      // relevant project(s); this also fixes history (old rows) since it resolves at read, not write.
      const agentNameById = new Map<string, string>();
      const nameLookupProjectIds = projectId
        ? [projectId]
        : Array.from(new Set(rawEvents.map((e) => e.projectId).filter((id): id is string => !!id)));
      for (const pid of nameLookupProjectIds) {
        try {
          const agents = await storage.getAgentsByProject(pid);
          for (const a of agents) agentNameById.set(a.id, a.name);
        } catch {
          // best-effort; falls back to a friendly generic below
        }
      }

      const feedEvents = [];
      for (const [traceId, group] of traceGroups) {
        const latest = group.reduce((a, b) =>
          new Date(a.timestamp) > new Date(b.timestamp) ? a : b
        );
        // #110: prefer an explicit payload name, else resolve from hatchId, else a friendly fallback.
        const agentName =
          (latest.payload?.agentName as string) ||
          (latest.hatchId ? agentNameById.get(latest.hatchId) : undefined) ||
          null;
        const readableType = latest.eventType.replace(/_/g, ' ');
        const rawTaskTitle = (latest.payload?.taskTitle as string) || '';
        const category = mapEventTypeToCategory(latest.eventType);

        // #102: self-documenting label — agent name + verb phrase, no duplicated "peer review
        // feedback: peer review feedback" junk (only append the task title when there is a real one).
        const displayName = agentName || 'A Hatch';
        const label = rawTaskTitle
          ? `${displayName} · ${readableType}: ${rawTaskTitle}`
          : `${displayName} · ${readableType}`;

        feedEvents.push({
          id: latest.requestId || `${traceId}-${latest.eventType}`,
          traceId,
          eventType: latest.eventType,
          agentId: latest.hatchId || null,
          agentName,
          label,
          category,
          timestamp: latest.timestamp,
          count: group.length,
          expandableData: {
            ...latest.payload,
            riskScore: latest.riskScore,
            confidence: latest.confidence,
            latencyMs: latest.latencyMs,
          },
        });
      }

      // Sort by timestamp descending (newest first for feed)
      feedEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json({ events: feedEvents.slice(0, limit) });
    } catch (error) {
      console.error('Autonomy events read error:', error);
      res.status(500).json({ error: 'Failed to read autonomy events' });
    }
  });

  // GET /api/autonomy/stats — aggregated stats for a project
  const statsQuerySchema = z.object({
    projectId: z.string().uuid(),
    period: z.enum(['today', '7days', 'all']).default('today'),
  });

  app.get('/api/autonomy/stats', async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const parsed = statsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() });
      }
      const { projectId, period } = parsed.data;

      const project = await requireOwnedProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const events = await readAutonomyEventsByProject(projectId, 500);

      // Filter by period
      const now = new Date();
      const filtered = events.filter(e => {
        if (period === 'all') return true;
        const eventDate = new Date(e.timestamp);
        if (period === 'today') {
          return eventDate.toDateString() === now.toDateString();
        }
        // 7days
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return eventDate >= sevenDaysAgo;
      });

      // Aggregate
      let tasksCompleted = 0;
      let handoffs = 0;
      let totalCost = 0;

      for (const event of filtered) {
        const et = event.eventType as string;
        if (et === 'task_completed') tasksCompleted++;
        if (et === 'handoff_announced') handoffs++;
        if (typeof event.payload?.cost === 'number') totalCost += event.payload.cost;
      }

      res.json({
        tasksCompleted,
        handoffs,
        costToday: `$${totalCost.toFixed(2)}`,
      });
    } catch (error) {
      console.error('Autonomy stats read error:', error);
      res.status(500).json({ error: 'Failed to read autonomy stats' });
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

  // Phase 37 (TREE-03) — autonomy run tree per project.
  // Returns runs + their step rows for client-side tree assembly (37-03 useAutonomyRunTree hook).
  // Ownership-checked; 401 on no session, 404 on mismatch (NOT 403 — T-37-12: 403 leaks resource existence).
  app.get('/api/projects/:projectId/runs', async (req: Request, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const project = await requireOwnedProject(req.params.projectId, userId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const tree = await storage.getRunsByProject(project.id, { limit: 20 });
      return res.json({ runs: tree.runs, steps: tree.steps });
    } catch (error) {
      console.error('Autonomy run tree read error:', error);
      return res.status(500).json({ error: 'Failed to read autonomy run tree' });
    }
  });

  // ---------------------------------------------------------------------
  // Phase 37 (TREE-05) — DEV-only seed/reset/mark-flat-historical endpoints.
  //
  // Used by tests/e2e/phase-37-run-tree.spec.ts to build deterministic tree
  // state without driving the live autonomy pipeline. Pattern mirrors Phase 36-02's
  // /api/dev/force-judge-score: double-guard (conditional registration AND
  // in-handler production throw). NEVER exposed in production.
  // ---------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    app.post('/api/dev/seed-run-tree', async (req: Request, res: Response) => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: /api/dev/seed-run-tree called in production. DEV-only endpoint must not run in a production code path.');
      }
      try {
        const { projectId, runs } = req.body as {
          projectId: string;
          runs: Array<{
            rootGoal: string;
            metadata?: Record<string, unknown>;
            steps: Array<{
              stepType: 'task' | 'handoff' | 'peer_review' | 'deliberation' | 'safety_block' | 'approval_request';
              parentStepIndex?: number | null;
              agentName: string;
              agentRole: string;
              title: string;
              status: 'pending' | 'running' | 'complete' | 'failed' | 'skipped';
              scoreDelta?: number | null;
              deliverableId?: string | null;
              deliverableVersionId?: string | null;
              deliverableVersionNumber?: number | null;
            }>;
          }>;
        };
        if (!projectId || !Array.isArray(runs)) {
          return res.status(400).json({ error: 'projectId and runs[] required' });
        }
        for (const r of runs) {
          const traceId = randomUUID();
          const run = await storage.createRun({
            traceId,
            projectId,
            userId: null,
            rootAgentId: null,
            rootGoal: r.rootGoal.slice(0, 500),
            status: 'complete',
            stepCount: r.steps.length,
            aggregateScoreDelta: null,
            metadata: r.metadata ?? {},
          });
          const createdStepIds: string[] = [];
          for (const s of r.steps) {
            const parentIdx = typeof s.parentStepIndex === 'number' ? s.parentStepIndex : -1;
            const parentStepId =
              parentIdx >= 0 && parentIdx < createdStepIds.length
                ? createdStepIds[parentIdx]
                : null;
            const step = await storage.createRunStep({
              runId: run.id,
              parentStepId,
              traceId,
              agentId: null,
              agentName: s.agentName,
              agentRole: s.agentRole,
              stepType: s.stepType,
              title: s.title.slice(0, 200),
              status: s.status,
              deliverableId: s.deliverableId ?? null,
              deliverableVersionId: s.deliverableVersionId ?? null,
              deliverableVersionNumber: s.deliverableVersionNumber ?? null,
              scoreDelta: s.scoreDelta ?? null,
              metadata: {},
              completedAt: s.status === 'complete' || s.status === 'failed' ? new Date() : null,
              latencyMs: null,
            });
            createdStepIds.push(step.id);
          }
        }
        return res.json({ ok: true });
      } catch (error) {
        console.error('[dev] seed-run-tree error:', error);
        return res.status(500).json({ error: 'Failed to seed run tree', detail: (error as Error).message });
      }
    });

    app.post('/api/dev/reset-run-tree', async (req: Request, res: Response) => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: /api/dev/reset-run-tree called in production. DEV-only endpoint must not run in a production code path.');
      }
      try {
        const { projectId } = req.body as { projectId: string };
        if (!projectId) return res.status(400).json({ error: 'projectId required' });
        // Reset path branches on storage type. In DB mode we use raw pool.query for
        // batch deletes. In MemStorage mode the in-process Maps are the source of
        // truth; mutate them directly via the same hook __resetRunTreeForTests uses.
        if (process.env.STORAGE_MODE === 'db') {
          await pool.query(
            `DELETE FROM autonomy_run_steps WHERE run_id IN (SELECT id FROM autonomy_runs WHERE project_id = $1)`,
            [projectId],
          );
          await pool.query(`DELETE FROM autonomy_runs WHERE project_id = $1`, [projectId]);
        } else {
          const mem = storage as unknown as {
            autonomyRuns?: Map<string, { id: string; projectId: string }>;
            autonomyRunSteps?: Map<string, { id: string; runId: string }>;
          };
          if (mem.autonomyRuns && mem.autonomyRunSteps) {
            const runIdsToDrop = new Set<string>();
            for (const [id, run] of mem.autonomyRuns.entries()) {
              if (run.projectId === projectId) runIdsToDrop.add(id);
            }
            for (const [stepId, step] of mem.autonomyRunSteps.entries()) {
              if (runIdsToDrop.has(step.runId)) mem.autonomyRunSteps.delete(stepId);
            }
            for (const id of runIdsToDrop) mem.autonomyRuns.delete(id);
          }
        }
        return res.json({ ok: true });
      } catch (error) {
        console.error('[dev] reset-run-tree error:', error);
        return res.status(500).json({ error: 'Failed to reset run tree', detail: (error as Error).message });
      }
    });

    app.post('/api/dev/mark-flat-historical', async (req: Request, res: Response) => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: /api/dev/mark-flat-historical called in production. DEV-only endpoint must not run in a production code path.');
      }
      try {
        const { projectId } = req.body as { projectId: string };
        if (!projectId) return res.status(400).json({ error: 'projectId required' });
        if (process.env.STORAGE_MODE === 'db') {
          await pool.query(
            `UPDATE autonomy_runs SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{flatHistorical}', 'true') WHERE project_id = $1`,
            [projectId],
          );
        } else {
          const mem = storage as unknown as {
            autonomyRuns?: Map<string, { id: string; projectId: string; metadata: Record<string, unknown> }>;
          };
          if (mem.autonomyRuns) {
            for (const [id, run] of mem.autonomyRuns.entries()) {
              if (run.projectId === projectId) {
                mem.autonomyRuns.set(id, {
                  ...run,
                  metadata: { ...(run.metadata ?? {}), flatHistorical: true },
                });
              }
            }
          }
        }
        return res.json({ ok: true });
      } catch (error) {
        console.error('[dev] mark-flat-historical error:', error);
        return res.status(500).json({ error: 'Failed to mark flat historical', detail: (error as Error).message });
      }
    });
  }

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
