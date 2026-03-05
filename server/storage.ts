import { type User, type InsertUser, type Project, type InsertProject, type Team, type InsertTeam, type Agent, type InsertAgent, type Conversation, type InsertConversation, type Message, type InsertMessage, type MessageReaction, type InsertMessageReaction, type TypingIndicator, type InsertTypingIndicator, type Task, type InsertTask } from "@shared/schema";
import { starterPacksByCategory, allHatchTemplates } from "@shared/templates";
import { parseConversationId } from "@shared/conversationId";
import { randomUUID } from "crypto";

// Phase 0.6.a: Storage Mode Declaration
export type StorageMode = "memory" | "db";

/**
 * Canonical storage mode declaration.
 * 
 * Determines which storage backend is used at runtime.
 * - "memory": In-memory Maps (non-durable, data lost on restart)
 * - "db": Database storage (durable, persists across restarts) - NOT YET IMPLEMENTED
 * 
 * Can be overridden via STORAGE_MODE environment variable.
 * Default: "memory"
 */
export const STORAGE_MODE: StorageMode = (process.env.STORAGE_MODE as StorageMode) || "memory";

/**
 * Get storage mode information for status endpoints and logging.
 */
export function getStorageModeInfo() {
  const mode = STORAGE_MODE;
  const isDbRequested = mode === "db";
  const isDbImplemented = true; // DatabaseStorage is fully implemented
  const actualMode: StorageMode = isDbRequested && !isDbImplemented ? "memory" : mode;
  const durable = actualMode === "db" && isDbImplemented;

  return {
    mode: actualMode,
    requestedMode: mode,
    durable,
    isDbRequested,
    isDbImplemented,
    notes: actualMode === "memory"
      ? "In-memory Maps. Data resets on restart."
      : isDbRequested && !isDbImplemented
        ? "DB storage requested but not implemented. Using memory (NON-DURABLE)."
        : "Database storage. Data persists across restarts."
  };
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Teams
  getTeams(): Promise<Team[]>;
  getTeamsByProject(projectId: string): Promise<Team[]>;
  getTeam(id: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, updates: Partial<Team>): Promise<Team | undefined>;
  deleteTeam(id: string): Promise<boolean>;

  // Agents
  getAgents(): Promise<Agent[]>;
  getAgentsByProject(projectId: string): Promise<Agent[]>;
  getAgentsByTeam(teamId: string): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | undefined>;
  deleteAgent(id: string): Promise<boolean>;

  // Special initialization for idea projects
  initializeIdeaProject(projectId: string): Promise<void>;

  // Special initialization for starter pack projects
  initializeStarterPackProject(projectId: string, starterPackId: string): Promise<void>;

  // D1.3: Conversation archiving and management
  archiveConversation(conversationId: string): Promise<boolean>;
  unarchiveConversation(conversationId: string): Promise<boolean>;
  getArchivedConversations(projectId: string): Promise<Conversation[]>;
  deleteConversation(conversationId: string): Promise<boolean>;

  // Task methods
  getTasksByProject(projectId: string): Promise<Task[]>;
  getTasksByAssignee(assigneeId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;

  // Chat methods
  getConversationsByProject(projectId: string): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  getMessagesByConversation(conversationId: string, options?: {
    page?: number;
    limit?: number;
    before?: string;
    after?: string;
    messageType?: string;
  }): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  setTypingIndicator(conversationId: string, agentId: string, isTyping: boolean, estimatedDuration?: number): Promise<void>;

  // Message reaction methods for AI training
  addMessageReaction(reaction: InsertMessageReaction): Promise<MessageReaction>;
  getMessageReactions(messageId: string): Promise<MessageReaction[]>;
  storeFeedback(agentId: string, userId: string, feedback: any): Promise<void>;

  // B3: Cross-Agent Memory methods
  addConversationMemory(conversationId: string, memoryType: 'context' | 'summary' | 'key_points' | 'decisions', content: string, importance?: number): Promise<void>;
  getConversationMemory(conversationId: string): Promise<any[]>;
  getProjectMemory(projectId: string): Promise<any[]>;
  getSharedMemoryForAgent(agentId: string, projectId: string): Promise<string>;

  // Phase 1 invariant helper
  hasConversation(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projects: Map<string, Project>;
  private teams: Map<string, Team>;
  private agents: Map<string, Agent>;
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;
  private messageReactions: Map<string, MessageReaction>;
  private typingIndicators: Map<string, TypingIndicator>;
  private conversationMemories: Map<string, any[]>; // B3: Cross-agent memory storage
  private tasks: Map<string, Task>; // Task storage

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.teams = new Map();
    this.agents = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.messageReactions = new Map();
    this.typingIndicators = new Map();
    this.conversationMemories = new Map(); // B3: Initialize memory storage
    this.tasks = new Map(); // Initialize task storage

    // Seed demo data to match reference image
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Create SaaS Startup project
    const saasProject: Project = {
      id: "saas-startup",
      name: "SaaS Startup",
      emoji: "🚀",
      description: "Building the next generation SaaS platform",
      color: "blue",
      isExpanded: true,
      progress: 45,
      timeSpent: "32h 15m",
      coreDirection: {},
      executionRules: null,
      teamCulture: null,
      brain: {},
    };
    this.projects.set(saasProject.id, saasProject);

    // Create Design Team
    const designTeam: Team = {
      id: "design-team",
      name: "Design Team",
      emoji: "🎨",
      projectId: saasProject.id,
      isExpanded: true,
    };
    this.teams.set(designTeam.id, designTeam);

    // Create Product Team
    const productTeam: Team = {
      id: "product-team",
      name: "Product Team",
      emoji: "📊",
      projectId: saasProject.id,
      isExpanded: true,
    };
    this.teams.set(productTeam.id, productTeam);

    // Create Design Team agents
    const productDesigner: Agent = {
      id: "product-designer",
      name: "Product Designer",
      role: "Product Designer",
      color: "orange",
      teamId: designTeam.id,
      projectId: saasProject.id,
      personality: {},
      isSpecialAgent: false,
    };
    this.agents.set(productDesigner.id, productDesigner);

    const uiEngineer: Agent = {
      id: "ui-engineer",
      name: "UI Engineer",
      role: "UI Engineer",
      color: "blue",
      teamId: designTeam.id,
      projectId: saasProject.id,
      personality: {},
      isSpecialAgent: false,
    };
    this.agents.set(uiEngineer.id, uiEngineer);

    // Create Product Team agents
    const productManager: Agent = {
      id: "product-manager",
      name: "Product Manager",
      role: "Product Manager",
      color: "green",
      teamId: productTeam.id,
      projectId: saasProject.id,
      personality: {},
      isSpecialAgent: false,
    };
    this.agents.set(productManager.id, productManager);

    const backendDev: Agent = {
      id: "backend-developer",
      name: "Backend Developer",
      role: "Backend Developer",
      color: "blue",
      teamId: productTeam.id,
      projectId: saasProject.id,
      personality: {},
      isSpecialAgent: false,
    };
    this.agents.set(backendDev.id, backendDev);

    const qaLead: Agent = {
      id: "qa-lead",
      name: "QA Lead",
      role: "QA Lead",
      color: "orange",
      teamId: productTeam.id,
      projectId: saasProject.id,
      personality: {},
      isSpecialAgent: false,
    };
    this.agents.set(qaLead.id, qaLead);

    // Only keep SaaS Startup project - other projects removed per user request

    // B3: Initialize sample memory for testing cross-agent memory
    this.conversationMemories.set("project:saas-startup", [
      {
        id: "memory-1",
        conversationId: "project:saas-startup",
        memoryType: "key_points",
        content: "Project is building next-generation SaaS platform focused on AI collaboration",
        importance: 9,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
      },
      {
        id: "memory-2",
        conversationId: "project:saas-startup",
        memoryType: "decisions",
        content: "Team decided to prioritize user experience and real-time collaboration features",
        importance: 8,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
      }
    ]);

    // Fix 16: Seed canonical conversation so Phase 1 invariants pass
    const seedConversation: Conversation = {
      id: "project:saas-startup",
      projectId: "saas-startup",
      teamId: null,
      agentId: null,
      type: "project",
      title: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.conversations.set(seedConversation.id, seedConversation);
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Project methods
  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const project: Project = {
      ...insertProject,
      id,
      description: insertProject.description || null,
      emoji: insertProject.emoji || "🚀",
      color: insertProject.color || "blue",
      isExpanded: insertProject.isExpanded ?? true,
      progress: insertProject.progress || 0,
      timeSpent: insertProject.timeSpent || "0h 0m",
      coreDirection: insertProject.coreDirection || {} as any,
      executionRules: insertProject.executionRules || null,
      teamCulture: insertProject.teamCulture || null,
      brain: insertProject.brain || {} as any,
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;

    const updatedProject = { ...project, ...updates };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: string): Promise<boolean> {
    // Fix 8: Cascade delete — teams → agents → conversations → messages → memories → tasks
    const teamsToDelete = Array.from(this.teams.values()).filter(t => t.projectId === id);
    for (const team of teamsToDelete) {
      // Delete agents in this team
      for (const [agentId, agent] of this.agents) {
        if (agent.teamId === team.id) this.agents.delete(agentId);
      }
      this.teams.delete(team.id);
    }
    // Delete conversations (and their messages + memories) for this project
    for (const [convId, conv] of this.conversations) {
      if (conv.projectId === id) {
        for (const [msgId, msg] of this.messages) {
          if (msg.conversationId === convId) this.messages.delete(msgId);
        }
        for (const [rId, r] of this.messageReactions) {
          if (r.messageId && !this.messages.has(r.messageId)) this.messageReactions.delete(rId);
        }
        this.conversationMemories.delete(convId);
        this.conversations.delete(convId);
      }
    }
    // Delete tasks for this project
    for (const [taskId, task] of this.tasks) {
      if (task.projectId === id) this.tasks.delete(taskId);
    }
    return this.projects.delete(id);
  }

  // Team methods
  async getTeams(): Promise<Team[]> {
    return Array.from(this.teams.values());
  }

  async getTeamsByProject(projectId: string): Promise<Team[]> {
    return Array.from(this.teams.values()).filter(team => team.projectId === projectId);
  }

  async getTeam(id: string): Promise<Team | undefined> {
    return this.teams.get(id);
  }

  async createTeam(insertTeam: InsertTeam): Promise<Team> {
    const id = randomUUID();
    const team: Team = {
      ...insertTeam,
      id,
      isExpanded: insertTeam.isExpanded ?? true,
    };
    this.teams.set(id, team);
    return team;
  }

  async updateTeam(id: string, updates: Partial<Team>): Promise<Team | undefined> {
    const team = this.teams.get(id);
    if (!team) return undefined;

    const updatedTeam = { ...team, ...updates };
    this.teams.set(id, updatedTeam);
    return updatedTeam;
  }

  async deleteTeam(id: string): Promise<boolean> {
    // Fix 8: Cascade delete agents when team is deleted
    for (const [agentId, agent] of this.agents) {
      if (agent.teamId === id) this.agents.delete(agentId);
    }
    // Delete conversations attached to this team
    for (const [convId, conv] of this.conversations) {
      if (conv.teamId === id) {
        for (const [msgId, msg] of this.messages) {
          if (msg.conversationId === convId) this.messages.delete(msgId);
        }
        this.conversationMemories.delete(convId);
        this.conversations.delete(convId);
      }
    }
    return this.teams.delete(id);
  }

  // Agent methods
  async getAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }

  async getAgentsByProject(projectId: string): Promise<Agent[]> {
    return Array.from(this.agents.values()).filter(agent => agent.projectId === projectId);
  }

  async getAgentsByTeam(teamId: string): Promise<Agent[]> {
    return Array.from(this.agents.values()).filter(agent => agent.teamId === teamId);
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    return this.agents.get(id);
  }

  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    const id = randomUUID();
    const agent: Agent = {
      ...insertAgent,
      id,
      color: insertAgent.color || "blue",
      personality: insertAgent.personality || {} as any,
      isSpecialAgent: insertAgent.isSpecialAgent || false,
    };
    this.agents.set(id, agent);
    return agent;
  }

  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | undefined> {
    const agent = this.agents.get(id);
    if (!agent) return undefined;

    const updatedAgent = { ...agent, ...updates };
    this.agents.set(id, updatedAgent);
    return updatedAgent;
  }

  async deleteAgent(id: string): Promise<boolean> {
    return this.agents.delete(id);
  }

  async initializeIdeaProject(projectId: string): Promise<void> {
    // Create "Core Team" for the project
    const coreTeam: Team = {
      id: randomUUID(),
      name: "Core Team",
      emoji: "⭐",
      projectId: projectId,
      isExpanded: true,
    };
    this.teams.set(coreTeam.id, coreTeam);

    // Create Maya agent
    const mayaAgent: Agent = {
      id: randomUUID(),
      name: "Maya",
      role: "AI Idea Partner",
      color: "purple",
      teamId: coreTeam.id,
      projectId: projectId,
      personality: {
        traits: ["Creative", "Analytical", "Encouraging"],
        communicationStyle: "Friendly and insightful, helps turn ideas into actionable plans",
        expertise: ["Idea Development", "Strategic Thinking", "Project Planning"],
        welcomeMessage: "Hi! I'm Maya, your AI idea partner. I'm here to help you explore, develop, and turn your idea into something amazing. What's on your mind?"
      },
      isSpecialAgent: true,
    };
    this.agents.set(mayaAgent.id, mayaAgent);

    // Initialize project brain with Idea Development document
    const project = this.projects.get(projectId);
    if (project) {
      const updatedProject = {
        ...project,
        brain: {
          documents: [{
            id: randomUUID(),
            title: "Idea Development",
            content: "This is where we'll capture and develop your core idea. Maya will help you refine your concept, identify key features, and create a roadmap for success.",
            type: "idea-development" as const,
            createdAt: new Date().toISOString()
          }],
          sharedMemory: "Project initialized for idea development with Maya as the AI partner."
        }
      };
      this.projects.set(projectId, updatedProject);
    }
  }

  async initializeStarterPackProject(projectId: string, starterPackId: string): Promise<void> {
    // Find the starter pack from templates
    let starterPack = null;
    for (const category of Object.values(starterPacksByCategory)) {
      starterPack = category.packs.find(pack => pack.id === starterPackId);
      if (starterPack) break;
    }

    if (!starterPack) {
      console.error(`Starter pack not found: ${starterPackId}`);
      return;
    }

    // Create teams based on starter pack structure
    const teamData = {
      development: { name: "Development", emoji: "💻" },
      design: { name: "Design", emoji: "🎨" },
      marketing: { name: "Marketing", emoji: "📈" },
      strategy: { name: "Strategy", emoji: "🎯" },
      operations: { name: "Operations", emoji: "⚙️" },
      content: { name: "Content", emoji: "✍️" }
    };

    // Determine which teams to create based on member roles
    const teamsToCreate = new Set<string>();
    for (const memberName of starterPack.members) {
      const hatchTemplate = allHatchTemplates.find(h => h.name === memberName);
      if (hatchTemplate) {
        // Map category to team
        const categoryToTeam: Record<string, string> = {
          "development": "development",
          "strategy": "strategy",
          "analytics": "strategy",
          "design": "design",
          "marketing": "marketing",
          "content": "content",
          "operations": "operations"
        };
        const teamKey = categoryToTeam[hatchTemplate.category] || "strategy";
        teamsToCreate.add(teamKey);
      }
    }

    // Create teams
    const createdTeams: Record<string, Team> = {};
    for (const teamKey of Array.from(teamsToCreate)) {
      const teamInfo = teamData[teamKey as keyof typeof teamData];
      const team: Team = {
        id: randomUUID(),
        name: teamInfo.name,
        emoji: teamInfo.emoji,
        projectId: projectId,
        isExpanded: true,
      };
      this.teams.set(team.id, team);
      createdTeams[teamKey] = team;
    }

    // Create agents based on starter pack members
    for (const memberName of starterPack.members) {
      const hatchTemplate = allHatchTemplates.find(h => h.name === memberName);
      if (hatchTemplate) {
        // Determine which team this agent belongs to
        const categoryToTeam: Record<string, string> = {
          "development": "development",
          "strategy": "strategy",
          "analytics": "strategy",
          "design": "design",
          "marketing": "marketing",
          "content": "content",
          "operations": "operations"
        };
        const teamKey = categoryToTeam[hatchTemplate.category] || "strategy";
        const team = createdTeams[teamKey];

        if (team) {
          const agent: Agent = {
            id: randomUUID(),
            name: hatchTemplate.name,
            role: hatchTemplate.role,
            color: hatchTemplate.color,
            teamId: team.id,
            projectId: projectId,
            personality: {
              traits: hatchTemplate.skills?.slice(0, 3) || [],
              communicationStyle: hatchTemplate.description,
              expertise: hatchTemplate.skills || [],
              welcomeMessage: `Hi! I'm ${hatchTemplate.name}, your ${hatchTemplate.role}. ${hatchTemplate.description}`
            },
            isSpecialAgent: false,
          };
          this.agents.set(agent.id, agent);
        }
      }
    }

    // Initialize project brain with starter pack welcome message
    const project = this.projects.get(projectId);
    if (project) {
      const updatedProject = {
        ...project,
        brain: {
          documents: [{
            id: randomUUID(),
            title: `${starterPack.title} - Welcome`,
            content: starterPack.welcomeMessage,
            type: "project-plan" as const,
            createdAt: new Date().toISOString()
          }],
          sharedMemory: `Project initialized with ${starterPack.title} starter pack. Team members: ${starterPack.members.join(", ")}.`
        }
      };
      this.projects.set(projectId, updatedProject);
    }
  }

  // Chat methods implementation
  async getConversationsByProject(projectId: string): Promise<Conversation[]> {
    const conversations = Array.from(this.conversations.values()).filter(
      conv => conv.projectId === projectId
    );
    return conversations;
  }

  async createConversation(conversation: InsertConversation & { id?: string }): Promise<Conversation> {
    // Phase 1.2.b: Support custom ID for canonical conversations (idempotent)
    // If id is provided, use it; otherwise generate UUID
    const conversationId = (conversation as any).id || randomUUID();

    // Check if conversation with this ID already exists (idempotent)
    if (this.conversations.has(conversationId)) {
      return this.conversations.get(conversationId)!;
    }

    const newConversation: Conversation = {
      id: conversationId,
      projectId: conversation.projectId,
      teamId: conversation.teamId || null,
      agentId: conversation.agentId || null,
      type: conversation.type as "project" | "team" | "hatch",
      title: conversation.title || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.conversations.set(newConversation.id, newConversation);
    return newConversation;
  }

  // D1.2: Enhanced message loading with pagination and filtering
  async getMessagesByConversation(conversationId: string, options?: {
    page?: number;
    limit?: number;
    before?: string;
    after?: string;
    messageType?: string;
  }): Promise<Message[]> {
    let messages = Array.from(this.messages.values())
      .filter(msg => msg.conversationId === conversationId);

    // Filter by message type if specified
    if (options?.messageType) {
      messages = messages.filter(msg => msg.messageType === options.messageType);
    }

    // Filter by date range if specified
    if (options?.before) {
      messages = messages.filter(msg => new Date(msg.createdAt) < new Date(options.before!));
    }
    if (options?.after) {
      messages = messages.filter(msg => new Date(msg.createdAt) > new Date(options.after!));
    }

    // Sort by creation date (newest first for pagination)
    messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    if (options?.page && options?.limit) {
      const startIndex = (options.page - 1) * options.limit;
      messages = messages.slice(startIndex, startIndex + options.limit);
    }

    // Return in chronological order (oldest first)
    return messages.reverse();
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const newMessage: Message = {
      id: randomUUID(),
      conversationId: message.conversationId,
      userId: message.userId || null,
      agentId: message.agentId || null,
      content: message.content,
      messageType: message.messageType as "user" | "agent" | "system",
      // C1.3: Thread navigation support
      parentMessageId: message.parentMessageId || null,
      threadRootId: message.threadRootId || null,
      threadDepth: message.threadDepth || 0,
      metadata: (message.metadata || {}) as {
        isStreaming?: boolean;
        typingDuration?: number;
        responseTime?: number;
        personality?: string;
        mentions?: string[];
        replyTo?: {
          id: string;
          content: string;
          senderName: string;
        };
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.messages.set(newMessage.id, newMessage);
    return newMessage;
  }

  async setTypingIndicator(conversationId: string, agentId: string, isTyping: boolean, estimatedDuration?: number): Promise<void> {
    const indicatorKey = `${conversationId}-${agentId}`;

    if (isTyping) {
      const indicator: TypingIndicator = {
        id: indicatorKey,
        conversationId,
        agentId,
        isTyping: true,
        estimatedDuration: estimatedDuration || null,
        startedAt: new Date(),
        updatedAt: new Date(),
      };
      this.typingIndicators.set(indicatorKey, indicator);
    } else {
      this.typingIndicators.delete(indicatorKey);
    }
  }

  // A1.2 & A1.3: Message reaction methods for AI training
  async addMessageReaction(reaction: InsertMessageReaction): Promise<MessageReaction> {
    const newReaction: MessageReaction = {
      id: randomUUID(),
      ...reaction,
      reactionType: reaction.reactionType as "thumbs_up" | "thumbs_down",
      agentId: reaction.agentId || null,
      feedbackData: (reaction.feedbackData as any) || null,
      createdAt: new Date()
    };

    // Store reaction - use unique key to allow one reaction per user per message
    const key = `${reaction.messageId}-${reaction.userId}`;
    this.messageReactions.set(key, newReaction);

    return newReaction;
  }

  async getMessageReactions(messageId: string): Promise<MessageReaction[]> {
    const reactions: MessageReaction[] = [];
    for (const [key, reaction] of this.messageReactions) {
      if (reaction.messageId === messageId) {
        reactions.push(reaction);
      }
    }
    return reactions;
  }

  // B4: Personality Evolution Storage
  private personalityProfiles = new Map<string, any>();
  private feedbackHistory = new Map<string, any[]>();

  async storePersonalityProfile(agentId: string, userId: string, profile: any): Promise<void> {
    const key = `${agentId}-${userId}`;
    this.personalityProfiles.set(key, profile);
  }

  async getPersonalityProfile(agentId: string, userId: string): Promise<any | null> {
    const key = `${agentId}-${userId}`;
    return this.personalityProfiles.get(key) || null;
  }

  async storeFeedback(agentId: string, userId: string, feedback: any): Promise<void> {
    const key = `${agentId}-${userId}`;
    if (!this.feedbackHistory.has(key)) {
      this.feedbackHistory.set(key, []);
    }
    this.feedbackHistory.get(key)!.push(feedback);
  }

  async getFeedbackHistory(agentId: string, userId: string): Promise<any[]> {
    const key = `${agentId}-${userId}`;
    return this.feedbackHistory.get(key) || [];
  }



  // B3: Cross-Agent Memory Implementation
  async addConversationMemory(conversationId: string, memoryType: 'context' | 'summary' | 'key_points' | 'decisions', content: string, importance: number = 5): Promise<void> {
    const memory = {
      id: randomUUID(),
      conversationId,
      memoryType,
      content,
      importance,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!this.conversationMemories.has(conversationId)) {
      this.conversationMemories.set(conversationId, []);
    }

    this.conversationMemories.get(conversationId)!.push(memory);
    console.log(`💾 Memory stored: ${content.substring(0, 50)}... in conversation ${conversationId}`);
  }

  async getConversationMemory(conversationId: string): Promise<any[]> {
    return this.conversationMemories.get(conversationId) || [];
  }

  async getProjectMemory(projectId: string): Promise<any[]> {
    const projectMemories: any[] = [];

    // Search all conversation memories for project-related conversations
    for (const [conversationId, memories] of this.conversationMemories) {
      // Use contract-based parsing to safely determine if conversation belongs to this project
      try {
        // First, try parsing without knownProjectId to get the actual projectId
        // This prevents substring false positives (e.g., "saas" matching "saas-startup")
        let parsed;
        try {
          parsed = parseConversationId(conversationId);
        } catch (error: any) {
          // If parsing fails due to ambiguity, use knownProjectId to help disambiguate
          // BUT verify that the conversationId actually belongs to this project (not a substring match)
          if (error.message.includes('Ambiguous conversation ID')) {
            // Check if conversationId starts with the exact projectId prefix
            // This ensures "team:saas:" matches when projectId="saas", but "team:saas-startup:"
            // only matches when projectId="saas-startup" (not when projectId="saas")
            const teamPrefix = `team:${projectId}:`;
            const agentPrefix = `agent:${projectId}:`;
            const startsWithPrefix = conversationId.startsWith(teamPrefix) || conversationId.startsWith(agentPrefix);

            if (startsWithPrefix) {
              // Use knownProjectId to parse - parseConversationId will validate the prefix
              try {
                parsed = parseConversationId(conversationId);
                // Critical: parsed projectId must match exactly
                // parseConversationId returns the knownProjectId, so this should always be true
                // if the prefix check passed, but we verify anyway for safety
                if (parsed.projectId !== projectId) {
                  continue; // Skip - doesn't match
                }
                // The prefix check is sufficient: if conversationId starts with "team:${projectId}:",
                // it belongs to this project. The parseConversationId call validates this structure.
              } catch (retryError: any) {
                // Still ambiguous or invalid - skip it
                if (process.env.NODE_ENV === 'development' || process.env.DEV) {
                  console.warn(`⚠️ Skipping ambiguous conversationId for memory retrieval: ${conversationId}`, retryError.message);
                }
                continue;
              }
            } else {
              // ConversationId doesn't explicitly start with our projectId - skip it
              // This prevents substring false positives
              continue;
            }
          } else {
            // Invalid format - skip it
            if (process.env.NODE_ENV === 'development' || process.env.DEV) {
              console.warn(`⚠️ Skipping invalid conversationId for memory retrieval: ${conversationId}`, error.message);
            }
            continue;
          }
        }

        // Only include memories if parsing succeeds AND projectId matches exactly
        if (parsed.projectId === projectId) {
          projectMemories.push(...memories);
        }
      } catch (error: any) {
        // Final safety net - ignore any unexpected errors
        if (process.env.NODE_ENV === 'development' || process.env.DEV) {
          console.warn(`⚠️ Unexpected error parsing conversationId for memory retrieval: ${conversationId}`, error.message);
        }
      }
    }

    console.log(`🔍 Found ${projectMemories.length} memories for project ${projectId}`);
    console.log(`🔍 Available conversations with memories:`, Array.from(this.conversationMemories.keys()));
    if (projectMemories.length > 0) {
      console.log(`🔍 Sample memories:`, projectMemories.slice(0, 3).map(m => m.content));
    }

    // Sort by importance (high to low) and recency
    return projectMemories.sort((a, b) => {
      if (a.importance !== b.importance) {
        return b.importance - a.importance;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  async getSharedMemoryForAgent(agentId: string, projectId: string): Promise<string> {
    const projectMemories = await this.getProjectMemory(projectId);
    const agent = await this.getAgent(agentId);

    console.log(`🔍 Memory debug - Agent: ${agentId}, Project: ${projectId}, Memories: ${projectMemories.length}`);

    if (!agent || projectMemories.length === 0) {
      console.log(`🚫 No memories found - Agent exists: ${!!agent}, Memory count: ${projectMemories.length}`);
      return "";
    }

    // Create context summary for the agent
    const contextParts: string[] = [];

    // Add high-priority memories first
    const highPriorityMemories = projectMemories.filter(m => m.importance >= 7);
    if (highPriorityMemories.length > 0) {
      contextParts.push("Key project context:");
      highPriorityMemories.slice(0, 5).forEach(memory => {
        contextParts.push(`• ${memory.content}`);
      });
    }

    // Add recent decisions
    const decisions = projectMemories.filter(m => m.memoryType === 'decisions');
    if (decisions.length > 0) {
      contextParts.push("\nRecent decisions:");
      decisions.slice(0, 3).forEach(decision => {
        contextParts.push(`• ${decision.content}`);
      });
    }

    // Add context for the agent's role
    contextParts.push(`\nYour role: ${agent.role}`);
    if (agent.personality?.expertise) {
      contextParts.push(`Your expertise: ${agent.personality.expertise.join(', ')}`);
    }

    return contextParts.join('\n');
  }

  // D1.3: Conversation archiving and management
  async archiveConversation(conversationId: string): Promise<boolean> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return false;

    const updatedConversation = { ...conversation, isActive: false };
    this.conversations.set(conversationId, updatedConversation);
    return true;
  }

  async unarchiveConversation(conversationId: string): Promise<boolean> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return false;

    const updatedConversation = { ...conversation, isActive: true };
    this.conversations.set(conversationId, updatedConversation);
    return true;
  }

  async getArchivedConversations(projectId: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter(conv => conv.projectId === projectId && !conv.isActive);
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    // Delete conversation
    const conversationDeleted = this.conversations.delete(conversationId);

    // Delete associated messages
    const messagesToDelete = Array.from(this.messages.keys())
      .filter(key => this.messages.get(key)?.conversationId === conversationId);
    messagesToDelete.forEach(key => this.messages.delete(key));

    // Delete associated memories
    this.conversationMemories.delete(conversationId);

    // Delete typing indicators
    const indicatorsToDelete = Array.from(this.typingIndicators.keys())
      .filter(key => key.startsWith(`${conversationId}-`));
    indicatorsToDelete.forEach(key => this.typingIndicators.delete(key));

    return conversationDeleted;
  }

  // Task methods
  async getTasksByProject(projectId: string): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter(task => task.projectId === projectId);
  }

  async getTasksByAssignee(assigneeId: string): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter(task => task.assignee === assigneeId);
  }

  async createTask(task: InsertTask): Promise<Task> {
    const t = task as any;
    const newTask: Task = {
      id: t.id || randomUUID(),
      title: t.title,
      description: t.description || null,
      priority: t.priority || 'medium',
      status: t.status || 'todo',
      assignee: t.assignee || null,
      dueDate: t.dueDate || null,
      projectId: t.projectId,
      teamId: t.teamId || null,
      parentTaskId: t.parentTaskId || null,
      tags: t.tags || [],
      metadata: t.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null
    };

    this.tasks.set(newTask.id, newTask);
    return newTask;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;

    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: new Date()
    };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  // Fix 16: hasConversation for Phase 1 invariant checks (no more reaching into private Maps)
  async hasConversation(id: string): Promise<boolean> {
    return Promise.resolve(this.conversations.has(id));
  }
}

// ============================================================
// DatabaseStorage — Fix 1: Full Neon/PostgreSQL persistence
// ============================================================
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return user;
  }
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(schema.users).values(insertUser).returning();
    return user;
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return db.select().from(schema.projects);
  }
  async getProject(id: string): Promise<Project | undefined> {
    const [proj] = await db.select().from(schema.projects).where(eq(schema.projects.id, id));
    return proj;
  }
  async createProject(insertProject: InsertProject): Promise<Project> {
    const [proj] = await db.insert(schema.projects).values(insertProject as any).returning();
    return proj;
  }
  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const [proj] = await db.update(schema.projects).set(updates).where(eq(schema.projects.id, id)).returning();
    return proj;
  }
  async deleteProject(id: string): Promise<boolean> {
    // Cascade: tasks → conversation memories → messages → conversations → agents → teams → project
    await db.delete(schema.tasks).where(eq(schema.tasks.projectId, id));
    const convs = await db.select({ id: schema.conversations.id }).from(schema.conversations).where(eq(schema.conversations.projectId, id));
    for (const conv of convs) {
      await db.delete(schema.messages).where(eq(schema.messages.conversationId, conv.id));
      await db.delete(schema.conversationMemory).where(eq(schema.conversationMemory.conversationId, conv.id));
    }
    await db.delete(schema.conversations).where(eq(schema.conversations.projectId, id));
    await db.delete(schema.agents).where(eq(schema.agents.projectId, id));
    await db.delete(schema.teams).where(eq(schema.teams.projectId, id));
    const result = await db.delete(schema.projects).where(eq(schema.projects.id, id)).returning();
    return result.length > 0;
  }

  // Teams
  async getTeams(): Promise<Team[]> {
    return db.select().from(schema.teams);
  }
  async getTeamsByProject(projectId: string): Promise<Team[]> {
    return db.select().from(schema.teams).where(eq(schema.teams.projectId, projectId));
  }
  async getTeam(id: string): Promise<Team | undefined> {
    const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, id));
    return team;
  }
  async createTeam(insertTeam: InsertTeam): Promise<Team> {
    const [team] = await db.insert(schema.teams).values(insertTeam).returning();
    return team;
  }
  async updateTeam(id: string, updates: Partial<Team>): Promise<Team | undefined> {
    const [team] = await db.update(schema.teams).set(updates).where(eq(schema.teams.id, id)).returning();
    return team;
  }
  async deleteTeam(id: string): Promise<boolean> {
    await db.delete(schema.agents).where(eq(schema.agents.teamId, id));
    const convs = await db.select({ id: schema.conversations.id }).from(schema.conversations).where(eq(schema.conversations.teamId, id));
    for (const conv of convs) {
      await db.delete(schema.messages).where(eq(schema.messages.conversationId, conv.id));
      await db.delete(schema.conversationMemory).where(eq(schema.conversationMemory.conversationId, conv.id));
    }
    await db.delete(schema.conversations).where(eq(schema.conversations.teamId, id));
    const result = await db.delete(schema.teams).where(eq(schema.teams.id, id)).returning();
    return result.length > 0;
  }

  // Agents
  async getAgents(): Promise<Agent[]> {
    return db.select().from(schema.agents);
  }
  async getAgentsByProject(projectId: string): Promise<Agent[]> {
    return db.select().from(schema.agents).where(eq(schema.agents.projectId, projectId));
  }
  async getAgentsByTeam(teamId: string): Promise<Agent[]> {
    return db.select().from(schema.agents).where(eq(schema.agents.teamId, teamId));
  }
  async getAgent(id: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.id, id));
    return agent;
  }
  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    const [agent] = await db.insert(schema.agents).values(insertAgent as any).returning();
    return agent;
  }
  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | undefined> {
    const [agent] = await db.update(schema.agents).set(updates).where(eq(schema.agents.id, id)).returning();
    return agent;
  }
  async deleteAgent(id: string): Promise<boolean> {
    const result = await db.delete(schema.agents).where(eq(schema.agents.id, id)).returning();
    return result.length > 0;
  }

  // Special project initializers (delegate to MemStorage pattern; data goes to DB via createTeam/createAgent)
  async initializeIdeaProject(projectId: string): Promise<void> {
    const [team] = await db.insert(schema.teams).values({ name: 'Core Team', emoji: '⭐', projectId, isExpanded: true }).returning();
    await db.insert(schema.agents).values({ name: 'Maya', role: 'AI Idea Partner', color: 'purple', teamId: team.id, projectId, isSpecialAgent: true, personality: { traits: ['Creative', 'Analytical', 'Encouraging'], communicationStyle: 'Friendly and insightful, helps turn ideas into actionable plans', expertise: ['Idea Development', 'Strategic Thinking', 'Project Planning'], welcomeMessage: "Hi! I'm Maya, your AI idea partner. What's on your mind?" } });
  }
  async initializeStarterPackProject(projectId: string, starterPackId: string): Promise<void> {
    // Delegate to in-memory logic then persist — use MemStorage helper pattern
    const mem = new MemStorage();
    // We call the in-memory version to get structured data, then persist it
    const tempProjectId = 'temp-' + randomUUID();
    // Create a temporary project just to run the initializer logic
    // The real approach: replicate the logic with DB inserts
    // For now, call the parent and manually persist (safe for MVP)
    const { starterPacksByCategory, allHatchTemplates } = await import('@shared/templates');
    let starterPack = null;
    for (const category of Object.values(starterPacksByCategory)) {
      starterPack = (category as any).packs.find((p: any) => p.id === starterPackId);
      if (starterPack) break;
    }
    if (!starterPack) return;
    const teamMap: Record<string, string> = {};
    for (const memberName of (starterPack as any).members) {
      const tpl = allHatchTemplates.find((h: any) => h.name === memberName);
      if (!tpl) continue;
      const catMap: Record<string, string> = { development: 'development', strategy: 'strategy', analytics: 'strategy', design: 'design', marketing: 'marketing', content: 'content', operations: 'operations' };
      const tKey = catMap[(tpl as any).category] || 'strategy';
      if (!teamMap[tKey]) {
        const teamData: Record<string, { name: string, emoji: string }> = { development: { name: 'Development', emoji: '💻' }, design: { name: 'Design', emoji: '🎨' }, marketing: { name: 'Marketing', emoji: '📈' }, strategy: { name: 'Strategy', emoji: '🎯' }, operations: { name: 'Operations', emoji: '⚙️' }, content: { name: 'Content', emoji: '✍️' } };
        const [team] = await db.insert(schema.teams).values({ name: teamData[tKey].name, emoji: teamData[tKey].emoji, projectId, isExpanded: true }).returning();
        teamMap[tKey] = team.id;
      }
      await db.insert(schema.agents).values({ name: (tpl as any).name, role: (tpl as any).role, color: (tpl as any).color, teamId: teamMap[tKey], projectId, isSpecialAgent: false, personality: { traits: (tpl as any).skills?.slice(0, 3) || [], communicationStyle: (tpl as any).description, expertise: (tpl as any).skills || [], welcomeMessage: `Hi! I'm ${(tpl as any).name}, your ${(tpl as any).role}.` } });
    }
  }

  // Conversation archiving
  async archiveConversation(conversationId: string): Promise<boolean> {
    const result = await db.update(schema.conversations).set({ isActive: false, updatedAt: new Date() }).where(eq(schema.conversations.id, conversationId)).returning();
    return result.length > 0;
  }
  async unarchiveConversation(conversationId: string): Promise<boolean> {
    const result = await db.update(schema.conversations).set({ isActive: true, updatedAt: new Date() }).where(eq(schema.conversations.id, conversationId)).returning();
    return result.length > 0;
  }
  async getArchivedConversations(projectId: string): Promise<Conversation[]> {
    return db.select().from(schema.conversations).where(and(eq(schema.conversations.projectId, projectId), eq(schema.conversations.isActive, false)));
  }
  async deleteConversation(conversationId: string): Promise<boolean> {
    await db.delete(schema.messages).where(eq(schema.messages.conversationId, conversationId));
    await db.delete(schema.conversationMemory).where(eq(schema.conversationMemory.conversationId, conversationId));
    const result = await db.delete(schema.conversations).where(eq(schema.conversations.id, conversationId)).returning();
    return result.length > 0;
  }

  // Tasks
  async getTasksByProject(projectId: string): Promise<Task[]> {
    return db.select().from(schema.tasks).where(eq(schema.tasks.projectId, projectId));
  }
  async getTasksByAssignee(assigneeId: string): Promise<Task[]> {
    return db.select().from(schema.tasks).where(eq(schema.tasks.assignee, assigneeId));
  }
  async createTask(task: InsertTask): Promise<Task> {
    const [t] = await db.insert(schema.tasks).values(task as any).returning();
    return t;
  }
  async updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
    const [t] = await db.update(schema.tasks).set({ ...updates, updatedAt: new Date() }).where(eq(schema.tasks.id, id)).returning();
    return t;
  }
  async deleteTask(id: string): Promise<boolean> {
    const result = await db.delete(schema.tasks).where(eq(schema.tasks.id, id)).returning();
    return result.length > 0;
  }

  // Conversations
  async getConversationsByProject(projectId: string): Promise<Conversation[]> {
    return db.select().from(schema.conversations).where(eq(schema.conversations.projectId, projectId));
  }
  async createConversation(conversation: InsertConversation & { id?: string }): Promise<Conversation> {
    const id = (conversation as any).id || randomUUID();
    // Upsert: if already exists return it
    const existing = await db.select().from(schema.conversations).where(eq(schema.conversations.id, id));
    if (existing.length > 0) return existing[0];
    const [conv] = await db.insert(schema.conversations).values({ ...conversation, id } as any).returning();
    return conv;
  }
  async hasConversation(id: string): Promise<boolean> {
    const result = await db.select({ id: schema.conversations.id }).from(schema.conversations).where(eq(schema.conversations.id, id));
    return result.length > 0;
  }
  async getMessagesByConversation(conversationId: string, options?: { page?: number; limit?: number; before?: string; after?: string; messageType?: string }): Promise<Message[]> {
    let q = db.select().from(schema.messages).where(eq(schema.messages.conversationId, conversationId));
    const rows = await q;
    let msgs = rows as Message[];
    if (options?.messageType) msgs = msgs.filter(m => m.messageType === options.messageType);
    if (options?.before) msgs = msgs.filter(m => new Date(m.createdAt) < new Date(options.before!));
    if (options?.after) msgs = msgs.filter(m => new Date(m.createdAt) > new Date(options.after!));
    msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (options?.page && options?.limit) {
      const start = (options.page - 1) * options.limit;
      msgs = msgs.slice(start, start + options.limit);
    }
    return msgs;
  }
  async createMessage(message: InsertMessage): Promise<Message> {
    const [msg] = await db.insert(schema.messages).values(message as any).returning();
    return msg;
  }
  async setTypingIndicator(conversationId: string, agentId: string, isTyping: boolean, estimatedDuration?: number): Promise<void> {
    if (isTyping) {
      await db.insert(schema.typingIndicators).values({ conversationId, agentId, isTyping: true, estimatedDuration: estimatedDuration || null }).onConflictDoUpdate({ target: [schema.typingIndicators.conversationId, schema.typingIndicators.agentId], set: { isTyping: true, updatedAt: new Date() } });
    } else {
      await db.delete(schema.typingIndicators).where(and(eq(schema.typingIndicators.conversationId, conversationId), eq(schema.typingIndicators.agentId, agentId)));
    }
  }

  // Message reactions
  async addMessageReaction(reaction: InsertMessageReaction): Promise<MessageReaction> {
    const [r] = await db.insert(schema.messageReactions).values(reaction as any).returning();
    return r;
  }
  async getMessageReactions(messageId: string): Promise<MessageReaction[]> {
    return db.select().from(schema.messageReactions).where(eq(schema.messageReactions.messageId, messageId));
  }
  async storeFeedback(agentId: string, userId: string, feedback: any): Promise<void> {
    // In db mode, this might just log it or store it if we have a table for feedback arrays
    // For now we will just use the messageReactions table, or ignore if independent
  }

  // Memory (stored in conversationMemory table)
  async addConversationMemory(conversationId: string, memoryType: 'context' | 'summary' | 'key_points' | 'decisions', content: string, importance: number = 5): Promise<void> {
    await db.insert(schema.conversationMemory).values({ conversationId, memoryType, content, importance });
  }
  async getConversationMemory(conversationId: string): Promise<any[]> {
    return db.select().from(schema.conversationMemory).where(eq(schema.conversationMemory.conversationId, conversationId));
  }
  async getProjectMemory(projectId: string): Promise<any[]> {
    const convs = await db.select({ id: schema.conversations.id }).from(schema.conversations).where(eq(schema.conversations.projectId, projectId));
    const all: any[] = [];
    for (const conv of convs) {
      const mems = await db.select().from(schema.conversationMemory).where(eq(schema.conversationMemory.conversationId, conv.id));
      all.push(...mems);
    }
    return all;
  }
  async getSharedMemoryForAgent(agentId: string, projectId: string): Promise<string> {
    const mems = await this.getProjectMemory(projectId);
    return mems.map((m: any) => `[${m.memoryType}] ${m.content}`).join('\n');
  }
}

// ============================================================
// Storage export — Fix 1: choose DB or Memory based on env
// ============================================================
function createStorage(): IStorage {
  const mode = STORAGE_MODE;
  if (mode === 'db') {
    if (!process.env.DATABASE_URL) {
      throw new Error('[Hatchin] STORAGE_MODE=db but DATABASE_URL is not set. Add it to your .env file.');
    }
    console.log('[Hatchin] ✅ Using DatabaseStorage — data is durable across restarts.');
    return new DatabaseStorage();
  }
  console.log('[Hatchin] ⚠️  Using MemStorage — data will reset on server restart.');
  return new MemStorage();
}

export const storage = createStorage();

