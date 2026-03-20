import type { Express, Request } from 'express';
import { storage } from '../storage.js';
import { insertTaskSchema, type Task } from '@shared/schema';
import { parseConversationId } from '@shared/conversationId';
import { randomUUID } from 'crypto';
import { getCharacterProfile } from '../ai/characterProfiles.js';
import { TaskDetectionAI, type TaskSuggestion, type ConversationContext } from '../ai/taskDetection.js';
import { z } from 'zod';

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(["todo", "in_progress", "completed", "blocked"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignee: z.string().max(200).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.object({
    createdFromChat: z.boolean().optional(),
    messageId: z.string().optional(),
    estimatedHours: z.number().optional(),
    actualHours: z.number().optional(),
  }).nullable().optional(),
}).strict();

export interface RegisterTaskDeps {
  broadcastToConversation: (conversationId: string, data: unknown) => void;
  broadcastToProject: (projectId: string, data: unknown) => void;
}

export function registerTaskRoutes(app: Express, deps: RegisterTaskDeps): void {
  const devLog = (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(...args);
    }
  };

  const getSessionUserId = (req: Request): string => (req.session as any).userId as string;

  const getOwnedProjectIds = async (userId: string): Promise<Set<string>> => {
    const projects = await storage.getProjects();
    return new Set(projects.filter((project: any) => project.userId === userId).map((project) => project.id));
  };

  const getOwnedProject = async (projectId: string, userId: string) => {
    const project = await storage.getProject(projectId);
    if (!project) return null;
    return (project as any).userId === userId ? project : null;
  };

  const conversationOwnedByUser = async (conversationId: string, userId: string): Promise<boolean> => {
    const ownedProjectIds = await getOwnedProjectIds(userId);
    for (const projectId of ownedProjectIds) {
      const conversations = await storage.getConversationsByProject(projectId);
      if (conversations.some((conversation) => conversation.id === conversationId)) {
        return true;
      }
    }
    return false;
  };

  // Task Management Endpoints
  app.get("/api/tasks", async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      const { projectId } = req.query;
      if (!projectId) {
        return res.status(400).json({ error: "Project ID is required" });
      }
      const ownedProject = await getOwnedProject(projectId as string, userId);
      if (!ownedProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      const tasks = await storage.getTasksByProject(projectId as string);
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      const ownedProject = await getOwnedProject(req.body.projectId, userId);
      if (!ownedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      const validatedTask = insertTaskSchema.parse({ ...req.body, userId });
      const newTask = {
        ...validatedTask,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null
      } as Task;
      const created = await storage.createTask(newTask);
      res.status(201).json(created);
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(400).json({ error: "Failed to create task" });
    }
  });

  // Auto task extraction endpoint
  app.post("/api/tasks/extract", async (req, res) => {
    try {
      const { userMessage, agentResponse, projectContext } = req.body;

      if (!userMessage || !agentResponse) {
        return res.status(400).json({ error: "User message and agent response are required" });
      }

      // Import task extractor
      const { extractTasksFromMessage, extractTasksFallback } = await import('../ai/taskExtractor.js');

      // Try AI extraction first
      let result = await extractTasksFromMessage(userMessage, agentResponse, projectContext);

      // Fallback to keyword matching if AI extraction fails
      if (!result.hasTasks && result.confidence < 0.5) {
        result = extractTasksFallback(userMessage, agentResponse, projectContext.availableAgents);
      }

      res.json(result);
    } catch (error) {
      console.error('Error extracting tasks from conversation:', error);
      res.status(500).json({ error: "Failed to extract tasks" });
    }
  });

  // Task Suggestion Endpoints
  app.post("/api/task-suggestions/analyze", async (req, res) => {
    try {
      const { conversationId, projectId, teamId, agentId, messages: providedMessages } = req.body;
      const userId = getSessionUserId(req);
      if (projectId) {
        const ownedProject = await getOwnedProject(projectId, userId);
        if (!ownedProject) {
          return res.status(404).json({ error: "Project not found" });
        }
      } else if (conversationId) {
        const isOwned = await conversationOwnedByUser(conversationId, userId);
        if (!isOwned) {
          return res.status(404).json({ error: "Conversation not found" });
        }
      }

      // Get conversation messages
      const messages = (providedMessages && Array.isArray(providedMessages) && providedMessages.length > 0)
        ? providedMessages
        : await storage.getMessagesByConversation(conversationId);
      if (!messages || messages.length === 0) {
        return res.json({ suggestions: [] });
      }

      // Check if we should analyze this conversation
      const analyzedMessages = messages.map(m => ({
        role: m.messageType === 'user' ? 'user' : 'assistant',
        content: typeof m.content === 'string' ? m.content : '',
        timestamp: new Date(m.createdAt)
      }));
      const shouldAnalyze = await TaskDetectionAI.shouldAnalyzeConversation(analyzedMessages);
      if (!shouldAnalyze) {
        return res.json({ suggestions: [] });
      }

      // Get available agents for the project
      const agents = await storage.getAgents();
      const projectAgents = agents.filter(agent =>
        agent.projectId === projectId ||
        (teamId && agent.teamId === teamId)
      );

      // Create conversation context with proper role mapping
      const context: ConversationContext = {
        messages: messages.map(msg => {
          // Map messageType to role correctly
          let role: 'user' | 'assistant' | 'system' = 'assistant';
          if (msg.messageType === 'user') {
            role = 'user';
          } else if (msg.messageType === 'agent') {
            role = 'assistant';
          }

          const safeContent = typeof msg.content === 'string' ? msg.content : '';

          devLog('Message mapping:', {
            messageType: msg.messageType,
            role,
            content: safeContent.substring(0, 50) + '...'
          });

          return {
            role,
            content: safeContent,
            timestamp: new Date(msg.createdAt)
          };
        }),
        projectId,
        teamId,
        agentId,
        availableAgents: projectAgents.map(agent => ({
          id: agent.id,
          name: agent.name,
          role: agent.role,
          expertise: typeof agent.personality === 'object' && agent.personality ? (agent.personality as any).expertise || [] : []
        }))
      };

      // Analyze conversation for task suggestions
      const suggestions = await TaskDetectionAI.analyzeConversationForTasks(context);

      res.json({ suggestions });
    } catch (error) {
      console.error('Error analyzing conversation for tasks:', error);
      res.status(500).json({ error: "Failed to analyze conversation for tasks" });
    }
  });

  app.post("/api/task-suggestions/approve", async (req, res) => {
    try {
      const { approvedTasks, projectId } = req.body;
      const userId = getSessionUserId(req);
      if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({ error: "projectId is required" });
      }

      const project = await getOwnedProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!Array.isArray(approvedTasks)) {
        return res.status(400).json({ error: "approvedTasks must be an array" });
      }

      // Create tasks in the database
      const createdTasks: Task[] = [];
      for (const task of approvedTasks) {
        let assigneeId = task?.suggestedAssignee?.id;
        // Fallback: if only role string provided, resolve to an agent id in this project
        if (!assigneeId && typeof task?.suggestedAssignee === 'string') {
          const agents = await storage.getAgentsByProject(projectId);
          const match = agents.find(a => a.role === task.suggestedAssignee);
          assigneeId = match?.id;
        }

        const newTaskRaw = {
          id: randomUUID(),
          title: task.title,
          description: task.description || "",
          priority: task.priority || "medium",
          status: 'todo',
          assignee: task.suggestedAssignee && typeof task.suggestedAssignee === 'string'
            ? task.suggestedAssignee
            : task.suggestedAssignee?.name || null,
          projectId: projectId,
          teamId: task.teamId || null,
          parentTaskId: null,
          tags: [],
          metadata: { createdFromChat: true }
        };

        // Validate via Zod
        const validatedTask = insertTaskSchema.parse(newTaskRaw) as any;

        // Store task
        await storage.createTask(validatedTask);
        createdTasks.push(validatedTask);
      }

      // Broadcast task creation to all connected clients in the project
      deps.broadcastToProject(projectId, {
        type: 'task_created',
        data: { tasks: createdTasks, projectId }
      });

      // P2: Task acknowledgment by assigned agent (opt-in via env flag)
      if (process.env.TASK_ACKNOWLEDGMENT_ENABLED === 'true' && createdTasks.length > 0) {
        try {
          const task = createdTasks[0] as any;
          if (task.assignee) {
            const allAgents = await storage.getAgentsByProject(projectId);
            const assignedAgent = allAgents.find((a: any) =>
              a.name === task.assignee || a.role === task.assignee
            );
            if (assignedAgent) {
              const character = getCharacterProfile(assignedAgent.role);
              const ackText = character
                ? `On it — "${task.title.substring(0, 50)}" is now on my list. I'll dig into the specifics first.`
                : `Got it, I'll work on "${task.title}".`;
              const convId = `agent:${projectId}:${assignedAgent.id}`;
              const ackMsg = await storage.createMessage({
                id: randomUUID(),
                conversationId: convId,
                content: ackText,
                messageType: 'agent',
                agentId: assignedAgent.id,
                userId: null,
                metadata: { isTaskAck: true, taskId: task.id },
              } as any);
              deps.broadcastToConversation(convId, {
                type: 'new_message',
                conversationId: convId,
                message: ackMsg,
              });
            }
          }
        } catch { /* non-critical */ }
      }

      res.json({
        success: true,
        createdTasks,
        message: `Successfully created ${createdTasks.length} tasks`
      });
    } catch (error) {
      console.error('Error creating approved tasks:', error);
      res.status(500).json({ error: "Failed to create approved tasks" });
    }
  });

  // ─── Approve / Reject autonomous task actions ──────────────────────────────

  const approveRejectBodySchema = z.object({
    reason: z.string().max(500).optional(),
  }).strict();

  app.post("/api/tasks/:id/approve", async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });

      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      const project = await getOwnedProject(task.projectId, userId);
      if (!project) return res.status(404).json({ error: 'Task not found' });

      const meta = (task.metadata ?? {}) as Record<string, unknown>;
      if (!meta.awaitingApproval || !meta.draftOutput) {
        return res.status(400).json({ error: 'Task is not awaiting approval' });
      }

      // Resolve the assigned agent
      const allAgents = await storage.getAgentsByProject(task.projectId);
      const agent = allAgents.find(
        (a) => a.name === task.assignee || a.role === task.assignee,
      ) ?? null;

      // Publish draft output as an agent message in chat
      const convId = agent
        ? `agent:${task.projectId}:${agent.id}`
        : `project:${task.projectId}`;

      const draftContent = meta.draftOutput as string;
      const createdMsg = await storage.createMessage({
        conversationId: convId,
        content: draftContent,
        messageType: 'agent',
        agentId: agent?.id ?? null,
        userId: null,
        metadata: { approvedByUser: true },
      } as any);

      deps.broadcastToConversation(convId, {
        type: 'new_message',
        conversationId: convId,
        message: createdMsg,
      });

      // Mark task completed and clear approval state
      await storage.updateTask(req.params.id, {
        status: 'completed',
        metadata: {
          ...meta,
          awaitingApproval: false,
          draftOutput: draftContent,
          approvedAt: new Date().toISOString(),
        } as any,
      });

      deps.broadcastToConversation(convId, {
        type: 'task_execution_completed',
        taskId: task.id,
        approvedByUser: true,
      });

      devLog('[approve] Task approved:', task.id);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error approving task:', error);
      return res.status(500).json({ error: 'Failed to approve task' });
    }
  });

  app.post("/api/tasks/:id/reject", async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });

      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      const project = await getOwnedProject(task.projectId, userId);
      if (!project) return res.status(404).json({ error: 'Task not found' });

      const parsed = approveRejectBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
      }

      const meta = (task.metadata ?? {}) as Record<string, unknown>;
      await storage.updateTask(req.params.id, {
        status: 'todo',
        metadata: {
          ...meta,
          awaitingApproval: false,
          draftOutput: null,
          rejectedAt: new Date().toISOString(),
          ...(parsed.data.reason ? { rejectionReason: parsed.data.reason } : {}),
        } as any,
      });

      deps.broadcastToProject(task.projectId, {
        type: 'task_approval_rejected',
        taskId: task.id,
      });

      devLog('[reject] Task rejected:', task.id);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error rejecting task:', error);
      return res.status(500).json({ error: 'Failed to reject task' });
    }
  });

  // Task Mutators
  app.put("/api/tasks/:id", async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: "Task not found" });
      const owned = await getOwnedProject(task.projectId, getSessionUserId(req));
      if (!owned) return res.status(404).json({ error: "Task not found" });

      const parsed = updateTaskSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid task data", details: parsed.error.errors });

      const updatedTask = await storage.updateTask(req.params.id, parsed.data);
      res.json(updatedTask);
    } catch (error) {
      console.error("Failed to update task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: "Task not found" });
      const owned = await getOwnedProject(task.projectId, getSessionUserId(req));
      if (!owned) return res.status(404).json({ error: "Task not found" });

      await storage.deleteTask(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });
}
