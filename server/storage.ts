import { type User, type InsertUser, type Project, type InsertProject, type Team, type InsertTeam, type Agent, type InsertAgent, type Conversation, type InsertConversation, type Message, type InsertMessage, type MessageReaction, type InsertMessageReaction, type TypingIndicator, type InsertTypingIndicator, type Task, type InsertTask, type UsageDailySummary, type Deliverable, type InsertDeliverable, type DeliverableVersion, type InsertDeliverableVersion, type DeliverablePackage, type InsertDeliverablePackage, type AutonomyRun, type InsertAutonomyRun, type AutonomyRunStep, type InsertAutonomyRunStep } from "@shared/schema";
import { starterPacksByCategory, allHatchTemplates } from "@shared/templates";
import { parseConversationId } from "@shared/conversationId";
import { randomUUID } from "crypto";

// -----------------------------------------------------------------------------
// Phase 36 — Impression dedupe (FBK-03, D-20).
//
// 5s server-side window per (deliverableId, userId) drops React StrictMode
// double-fires in dev. Module-scope so both MemStorage and DatabaseStorage
// share it (single-server). A future multi-instance deployment can route
// through Redis behind a thin wrapper without changing the IStorage contract.
//
// Size bound + opportunistic cleanup keeps the Map bounded under DoS (T-36-15).
// -----------------------------------------------------------------------------

const __impressionDedupeMap = new Map<string, number>();
const __IMPRESSION_DEDUPE_MS = 5_000;
const __IMPRESSION_DEDUPE_MAX_ENTRIES = 1000;
const __IMPRESSION_DEDUPE_CLEANUP_OLDER_THAN_MS = 60_000;

function __shouldRecordImpression(deliverableId: string, userId: string): boolean {
  const key = `${deliverableId}:${userId}`;
  const now = Date.now();
  const last = __impressionDedupeMap.get(key) ?? 0;
  if (now - last < __IMPRESSION_DEDUPE_MS) return false;
  __impressionDedupeMap.set(key, now);
  if (__impressionDedupeMap.size > __IMPRESSION_DEDUPE_MAX_ENTRIES) {
    for (const [k, t] of __impressionDedupeMap) {
      if (now - t > __IMPRESSION_DEDUPE_CLEANUP_OLDER_THAN_MS) {
        __impressionDedupeMap.delete(k);
      }
    }
  }
  return true;
}

/**
 * DEV-only: clear the impression dedupe Map between tests. Throws FATAL in
 * production (T-36-13 mirror — mirrors __setForcedScoreForTests prod guard).
 */
export function __resetImpressionDedupeForTests(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: __resetImpressionDedupeForTests called in production');
  }
  __impressionDedupeMap.clear();
}

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

export interface OAuthUserInput {
  email: string;
  name: string;
  avatarUrl?: string | null;
  provider: "google";
  providerSub: string;
}

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
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByProviderSub(provider: string, providerSub: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertOAuthUser(input: OAuthUserInput): Promise<User>;

  // Projects
  // Soft-delete model: deleteProject sets deletedAt; restoreProject clears it;
  // purgeProject does the hard cascade. List methods (getProjects/getProjectsByUserId)
  // filter out soft-deleted rows; getProject returns soft-deleted rows so restore/purge
  // endpoints can find their target.
  getProjects(): Promise<Project[]>;
  getProjectsByUserId(userId: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  restoreProject(id: string): Promise<boolean>;
  purgeProject(id: string): Promise<boolean>;
  getProjectsNeedingPurge(olderThanMs: number): Promise<Array<{ id: string }>>;

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

  // Message search across project conversations
  searchMessages(projectId: string, query: string, limit?: number): Promise<Message[]>;

  // Task methods
  getTask(id: string): Promise<Task | undefined>;
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
  getMessage(id: string): Promise<Message | undefined>;
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

  // P3: Extracted project memories (cross-agent, cross-session)
  createConversationMemory(data: {
    conversationId: string;
    memoryType: string;
    content: string;
    importance: number;
    agentId?: string | null;
  }): Promise<unknown>;
  getRelevantProjectMemories(projectId: string, options: {
    query: string;
    limit: number;
    minImportance: number;
    excludeConversationId?: string;
  }): Promise<Array<{ content: string; memoryType: string; importance: number }>>;

  // P5: Proactive outreach rate limiting
  getLastProactiveOutreachAt(agentId: string): Promise<Date | null>;
  setLastProactiveOutreachAt(agentId: string): Promise<void>;

  // Phase 6: Background execution cost cap enforcement
  countAutonomyEventsForProjectToday(projectId: string, dateStr: string): Promise<number>;

  // SAFE-04: Count autonomy events by agent for trust scoring
  countAutonomyEventsByAgent(
    agentId: string,
    projectId: string,
    eventType: string,
  ): Promise<number>;

  // UX-03: Absence tracking for return briefing
  getProjectTimestamps(projectId: string): Promise<{ lastSeenAt: Date | null; lastBriefedAt: Date | null }>;
  setProjectLastSeenAt(projectId: string, timestamp: Date): Promise<void>;
  setProjectLastBriefedAt(projectId: string, timestamp: Date): Promise<void>;
  getAutonomyEventsSince(projectId: string, since: Date): Promise<Array<{ eventType: string; agentId: string | null; payload: unknown; createdAt: Date }>>;

  // Billing & Usage Tracking
  upsertDailyUsage(userId: string, date: string, increments: {
    messages?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    costCents?: number;
    standardMessages?: number;
    premiumMessages?: number;
    autonomyExecutions?: number;
  }): Promise<void>;
  getDailyUsage(userId: string, date: string): Promise<UsageDailySummary | undefined>;
  getMonthlyUsage(userId: string, yearMonth: string): Promise<UsageDailySummary[]>;
  updateUserTier(userId: string, tier: 'free' | 'pro', stripeData?: {
    customerId?: string;
    subscriptionId?: string;
    subscriptionStatus?: string;
    periodEnd?: Date;
    graceExpiresAt?: Date | null;
  }): Promise<void>;
  getUserTier(userId: string): Promise<{ tier: string; subscriptionStatus: string; graceExpiresAt: Date | null } | undefined>;
  getUserByStripeCustomerId(customerId: string): Promise<User | undefined>;
  checkWebhookProcessed(stripeEventId: string): Promise<boolean>;
  markWebhookProcessed(stripeEventId: string, eventType: string): Promise<void>;

  // v2.0: Deliverables
  getDeliverablesByProject(projectId: string): Promise<Deliverable[]>;
  getDeliverable(id: string): Promise<Deliverable | undefined>;
  createDeliverable(deliverable: InsertDeliverable): Promise<Deliverable>;
  updateDeliverable(id: string, updates: Partial<Deliverable>): Promise<Deliverable | undefined>;
  deleteDeliverable(id: string): Promise<boolean>;
  getDeliverableVersions(deliverableId: string): Promise<DeliverableVersion[]>;
  createDeliverableVersion(version: InsertDeliverableVersion): Promise<DeliverableVersion>;
  restoreDeliverableVersion(deliverableId: string, versionNumber: number): Promise<Deliverable | undefined>;

  // === Phase 36 (FBK-01..04 / RUBR-02..04) ===
  acceptDeliverable(id: string): Promise<Deliverable | undefined>;
  dismissDeliverable(id: string): Promise<Deliverable | undefined>;
  recordImpression(id: string, userId: string): Promise<{ deliverable: Deliverable | undefined; deduped: boolean }>;
  incrementEditsCount(id: string): Promise<Deliverable | undefined>;
  updateDeliverableVersionScore(
    versionId: string,
    fields: {
      rubricVersion: string;
      rubricScore: {
        total: number;
        breakdown: Array<{ criterion: string; score: number; justification: string }>;
        skipped?: boolean;
        reason?: string;
      };
    },
  ): Promise<DeliverableVersion | undefined>;
  getRecentFinalizedDeliverablesByAgent(projectId: string, agentId: string, limit: number): Promise<Deliverable[]>;

  // v2.0: Packages
  getPackagesByProject(projectId: string): Promise<DeliverablePackage[]>;
  getPackage(id: string): Promise<DeliverablePackage | undefined>;
  createPackage(pkg: InsertDeliverablePackage): Promise<DeliverablePackage>;
  updatePackage(id: string, updates: Partial<DeliverablePackage>): Promise<DeliverablePackage | undefined>;

  // Phase 37 — autonomy run tree (TREE-01)
  createRun(run: InsertAutonomyRun): Promise<AutonomyRun>;
  createRunStep(step: InsertAutonomyRunStep): Promise<AutonomyRunStep>;
  updateRunStep(id: string, updates: Partial<AutonomyRunStep>): Promise<AutonomyRunStep | undefined>;
  getRunsByProject(projectId: string, options?: { limit?: number; offset?: number }): Promise<{ runs: AutonomyRun[]; steps: AutonomyRunStep[] }>;
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
    const seedUser: User = {
      id: "seed-user",
      email: "seed@hatchin.local",
      name: "Seed User",
      avatarUrl: null,
      provider: "legacy",
      providerSub: "seed-user",
      tier: "free",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: "none",
      subscriptionPeriodEnd: null,
      graceExpiresAt: null,
      username: "seed",
      password: "seed",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(seedUser.id, seedUser);

    // Create SaaS Startup project
    const saasProject: Project = {
      id: "saas-startup",
      userId: seedUser.id,
      name: "SaaS Startup",
      emoji: "🚀",
      description: "Building the next generation SaaS platform",
      color: "blue",
      deletedAt: null,
      isExpanded: true,
      progress: 45,
      timeSpent: "32h 15m",
      coreDirection: {},
      executionRules: {},
      teamCulture: null,
      brain: {},
      lastSeenAt: null,
      lastBriefedAt: null,
    };
    this.projects.set(saasProject.id, saasProject);

    // Create Design Team
    const designTeam: Team = {
      id: "design-team",
      userId: seedUser.id,
      name: "Design Team",
      emoji: "🎨",
      projectId: saasProject.id,
      isExpanded: true,
    };
    this.teams.set(designTeam.id, designTeam);

    // Create Product Team
    const productTeam: Team = {
      id: "product-team",
      userId: seedUser.id,
      name: "Product Team",
      emoji: "📊",
      projectId: saasProject.id,
      isExpanded: true,
    };
    this.teams.set(productTeam.id, productTeam);

    // Create Design Team agents
    const productDesigner: Agent = {
      id: "product-designer",
      userId: seedUser.id,
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
      userId: seedUser.id,
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
      userId: seedUser.id,
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
      userId: seedUser.id,
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
      userId: seedUser.id,
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
      userId: seedUser.id,
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
  }

  async getUserByProviderSub(provider: string, providerSub: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.provider === provider && user.providerSub === providerSub,
    );
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const user: User = {
      id,
      email: insertUser.email,
      name: insertUser.name,
      avatarUrl: insertUser.avatarUrl || null,
      provider: insertUser.provider || "google",
      providerSub: insertUser.providerSub,
      tier: "free",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: "none",
      subscriptionPeriodEnd: null,
      graceExpiresAt: null,
      username: insertUser.username || null,
      password: insertUser.password || null,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    return user;
  }

  async upsertOAuthUser(input: OAuthUserInput): Promise<User> {
    const existing =
      (await this.getUserByProviderSub(input.provider, input.providerSub)) ||
      (await this.getUserByEmail(input.email));
    if (existing) {
      const updated: User = {
        ...existing,
        email: input.email,
        name: input.name,
        avatarUrl: input.avatarUrl || null,
        provider: input.provider,
        providerSub: input.providerSub,
        updatedAt: new Date(),
      };
      this.users.set(existing.id, updated);
      return updated;
    }

    return this.createUser({
      email: input.email,
      name: input.name,
      avatarUrl: input.avatarUrl || null,
      provider: input.provider,
      providerSub: input.providerSub,
      username: null,
      password: null,
    } as InsertUser);
  }

  // Project methods
  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(p => !(p as any).deletedAt);
  }

  async getProjectsByUserId(userId: string): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(p => p.userId === userId && !(p as any).deletedAt);
  }

  async getProject(id: string): Promise<Project | undefined> {
    // Unfiltered — matches DatabaseStorage so restore/purge endpoints can find soft-deleted rows.
    return this.projects.get(id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const resolvedUserId = (insertProject as any).userId;
    if (!resolvedUserId) {
      throw new Error("createProject requires userId");
    }
    const id = randomUUID();
    const project: Project = {
      ...insertProject,
      id,
      userId: resolvedUserId,
      description: insertProject.description || null,
      emoji: insertProject.emoji || "🚀",
      color: insertProject.color || "blue",
      deletedAt: null,
      isExpanded: insertProject.isExpanded ?? true,
      progress: insertProject.progress || 0,
      timeSpent: insertProject.timeSpent || "0h 0m",
      coreDirection: insertProject.coreDirection || {} as any,
      executionRules: (insertProject.executionRules as any) || {},
      teamCulture: insertProject.teamCulture || null,
      brain: insertProject.brain || {} as any,
      lastSeenAt: insertProject.lastSeenAt ?? null,
      lastBriefedAt: insertProject.lastBriefedAt ?? null,
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
    // Soft-delete — mark the project as deleted; purgeProject does the real cascade.
    const project = this.projects.get(id);
    if (!project) return false;
    this.projects.set(id, { ...project, deletedAt: new Date() } as Project);
    return true;
  }

  async restoreProject(id: string): Promise<boolean> {
    const project = this.projects.get(id);
    if (!project) return false;
    const restored = { ...project, deletedAt: null } as Project;
    this.projects.set(id, restored);
    return true;
  }

  async getProjectsNeedingPurge(olderThanMs: number): Promise<Array<{ id: string }>> {
    const cutoff = Date.now() - olderThanMs;
    const out: Array<{ id: string }> = [];
    for (const [id, p] of this.projects) {
      const d = (p as any).deletedAt;
      if (d && new Date(d).getTime() < cutoff) out.push({ id });
    }
    return out;
  }

  async purgeProject(id: string): Promise<boolean> {
    // Hard cascade — teams → agents → conversations → messages → memories → tasks → project.
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
    const resolvedUserId = (insertTeam as any).userId || this.projects.get(insertTeam.projectId)?.userId;
    if (!resolvedUserId) {
      throw new Error("createTeam requires userId or an owned project");
    }
    const id = randomUUID();
    const team: Team = {
      ...insertTeam,
      id,
      userId: resolvedUserId,
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
    const resolvedUserId =
      (insertAgent as any).userId ||
      (insertAgent.teamId ? this.teams.get(insertAgent.teamId)?.userId : undefined) ||
      this.projects.get(insertAgent.projectId)?.userId;
    if (!resolvedUserId) {
      throw new Error("createAgent requires userId or an owned team/project");
    }
    const id = randomUUID();
    const agent: Agent = {
      ...insertAgent,
      id,
      userId: resolvedUserId,
      teamId: insertAgent.teamId ?? null,
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
    // Cascade: clean up conversations, messages, and related data for this agent
    for (const [convId, conv] of this.conversations) {
      if ((conv as any).agentId === id) {
        // Delete messages and reactions in this conversation
        for (const [msgId, msg] of this.messages) {
          if (msg.conversationId === convId) {
            this.messageReactions.delete(msgId);
            this.messages.delete(msgId);
          }
        }
        this.conversations.delete(convId);
      }
    }
    return this.agents.delete(id);
  }

  async initializeIdeaProject(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) return;

    // Initialize project brain
    if (project) {
      const updatedProject = {
        ...project,
        brain: {
          documents: [{
            id: randomUUID(),
            title: "Idea Development",
            content: "This is where we'll capture and develop your core idea. You can add a Product Manager to help you refine your concept, identify key features, and create a roadmap for success.",
            type: "idea-development" as const,
            createdAt: new Date().toISOString()
          }],
          sharedMemory: "Project initialized for idea development."
        }
      };
      this.projects.set(projectId, updatedProject);

      // Create Maya as a project-level agent with no team (teamId: null)
      const mayaAgent: Agent = {
        id: randomUUID(),
        userId: project.userId,
        name: "Maya",
        role: "Idea Partner",
        color: "teal",
        teamId: null,
        projectId: projectId,
        personality: {
          traits: ["strategic", "supportive", "analytical"],
          communicationStyle: "Warm, direct, and structured",
          expertise: ["Idea Development", "Synthesis", "Reframing", "Cross-domain Connection"],
          welcomeMessage: "Hey, I'm Maya. Tell me what you're thinking and I'll help you shape it into something real."
        },
        isSpecialAgent: true,
      };
      this.agents.set(mayaAgent.id, mayaAgent);

      // Maya speaks at project level only — no 1-on-1 conversation needed
    }
  }

  async initializeStarterPackProject(projectId: string, starterPackId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) return;

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
        userId: project.userId,
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
            userId: project.userId,
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

    const resolvedUserId =
      (conversation as any).userId ||
      this.projects.get(conversation.projectId)?.userId;
    if (!resolvedUserId) {
      throw new Error("createConversation requires userId or an owned project");
    }

    const newConversation: Conversation = {
      id: conversationId,
      userId: resolvedUserId,
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

    // Sort ascending by createdAt (oldest first)
    messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Cursor-based filtering: keep messages before/after the cursor timestamp
    if (options?.before) {
      const cutoff = new Date(options.before).getTime();
      messages = messages.filter(m => new Date(m.createdAt).getTime() < cutoff);
    }
    if (options?.after) {
      const cutoff = new Date(options.after).getTime();
      messages = messages.filter(m => new Date(m.createdAt).getTime() > cutoff);
    }

    // Apply pagination: page-based takes priority, otherwise return last N (most recent window)
    const limit = options?.limit;
    if (options?.page && limit) {
      const start = (options.page - 1) * limit;
      messages = messages.slice(start, start + limit);
    } else if (limit) {
      // Return last `limit` items (most recent window), preserving ascending sort
      messages = messages.slice(Math.max(0, messages.length - limit));
    }

    return messages;
  }

  async getMessage(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
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

  async searchMessages(projectId: string, query: string, limit = 50): Promise<Message[]> {
    const queryLower = query.toLowerCase();
    const projectConvPrefix = `project:${projectId}`;
    const results: Message[] = [];
    for (const msg of this.messages.values()) {
      if (results.length >= limit) break;
      if (!msg.conversationId.includes(projectId)) continue;
      const content = typeof msg.content === 'string' ? msg.content : '';
      if (content.toLowerCase().includes(queryLower)) {
        results.push(msg);
      }
    }
    return results;
  }

  // Task methods
  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

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
    const resolvedUserId = t.userId || this.projects.get(t.projectId)?.userId;
    if (!resolvedUserId) {
      throw new Error("createTask requires userId or an owned project");
    }
    const newTask: Task = {
      id: t.id || randomUUID(),
      userId: resolvedUserId,
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

  // P3: createConversationMemory — store extracted project memory
  async createConversationMemory(data: { conversationId: string; memoryType: string; content: string; importance: number; agentId?: string | null; }): Promise<unknown> {
    const memory = { id: randomUUID(), ...data, createdAt: new Date() };
    if (!this.conversationMemories.has(data.conversationId)) {
      this.conversationMemories.set(data.conversationId, []);
    }
    this.conversationMemories.get(data.conversationId)!.push(memory);
    return memory;
  }

  // P3: getRelevantProjectMemories — retrieve cross-agent project memories by relevance
  async getRelevantProjectMemories(projectId: string, options: { query: string; limit: number; minImportance: number; excludeConversationId?: string; }): Promise<Array<{ content: string; memoryType: string; importance: number }>> {
    const projectKey = `project:${projectId}`;
    const memories = this.conversationMemories.get(projectKey) ?? [];
    const queryWords = options.query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    return memories
      .filter((m: any) => m.importance >= options.minImportance)
      .map((m: any) => ({
        ...m,
        _score: queryWords.filter(w => m.content.toLowerCase().includes(w)).length,
      }))
      .sort((a: any, b: any) => b._score - a._score || b.importance - a.importance)
      .slice(0, options.limit)
      .map(({ content, memoryType, importance }: any) => ({ content, memoryType, importance }));
  }

  // P5: Proactive outreach rate limiting (stored in agent personality)
  async getLastProactiveOutreachAt(agentId: string): Promise<Date | null> {
    const agent = this.agents.get(agentId);
    const lastAt = (agent?.personality as any)?.lastProactiveAt;
    return lastAt ? new Date(lastAt) : null;
  }
  async setLastProactiveOutreachAt(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      const personality = ((agent.personality ?? {}) as Record<string, unknown>);
      this.agents.set(agentId, { ...agent, personality: { ...personality, lastProactiveAt: new Date().toISOString() } as any });
    }
  }

  // Phase 6: MemStorage has no autonomy_events table — always returns 0
  async countAutonomyEventsForProjectToday(_projectId: string, _dateStr: string): Promise<number> {
    return 0;
  }

  // SAFE-04: MemStorage has no autonomy_events — always returns 0
  async countAutonomyEventsByAgent(
    _agentId: string,
    _projectId: string,
    _eventType: string,
  ): Promise<number> {
    return 0;
  }

  // UX-03: MemStorage has no real absence tracking — return nulls/no-ops
  async getProjectTimestamps(_projectId: string): Promise<{ lastSeenAt: Date | null; lastBriefedAt: Date | null }> {
    return { lastSeenAt: null, lastBriefedAt: null };
  }
  async setProjectLastSeenAt(_projectId: string, _timestamp: Date): Promise<void> {
    // no-op in MemStorage
  }
  async setProjectLastBriefedAt(_projectId: string, _timestamp: Date): Promise<void> {
    // no-op in MemStorage
  }
  async getAutonomyEventsSince(_projectId: string, _since: Date): Promise<Array<{ eventType: string; agentId: string | null; payload: unknown; createdAt: Date }>> {
    return [];
  }

  // Billing stubs (MemStorage — dev only)
  async upsertDailyUsage(): Promise<void> {}
  async getDailyUsage(): Promise<UsageDailySummary | undefined> { return undefined; }
  async getMonthlyUsage(): Promise<UsageDailySummary[]> { return []; }
  async updateUserTier(): Promise<void> {}
  async getUserTier(userId: string): Promise<{ tier: string; subscriptionStatus: string; graceExpiresAt: Date | null } | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    return { tier: 'pro', subscriptionStatus: 'none', graceExpiresAt: null };
  }
  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => (u as any).stripeCustomerId === customerId);
  }
  async checkWebhookProcessed(): Promise<boolean> { return false; }
  async markWebhookProcessed(): Promise<void> {}

  // v2.0: Deliverables (MemStorage — in-memory Maps)
  private deliverables = new Map<string, Deliverable>();
  private deliverableVersions = new Map<string, DeliverableVersion>();
  private deliverablePackages = new Map<string, DeliverablePackage>();

  async getDeliverablesByProject(projectId: string): Promise<Deliverable[]> {
    return Array.from(this.deliverables.values()).filter(d => d.projectId === projectId);
  }
  async getDeliverable(id: string): Promise<Deliverable | undefined> {
    return this.deliverables.get(id);
  }
  async createDeliverable(data: InsertDeliverable): Promise<Deliverable> {
    const id = randomUUID();
    const now = new Date();
    const deliverable: Deliverable = { id, ...data, content: data.content ?? '', currentVersion: 1, status: data.status ?? 'draft', metadata: data.metadata ?? {}, createdAt: now, updatedAt: now } as Deliverable;
    this.deliverables.set(id, deliverable);
    // Auto-create v1
    const vId = randomUUID();
    const version: DeliverableVersion = {
      id: vId,
      deliverableId: id,
      versionNumber: 1,
      content: deliverable.content,
      changeDescription: 'Initial version',
      createdByAgentId: data.agentId ?? null,
      createdAt: now,
      // Phase 36 — fields default for MemStorage v1 (pre-scoring path; 36-02 scorer writes real values)
      rubricVersion: null,
      rubricScore: null,
      revertedFromHigherScore: false,
    };
    this.deliverableVersions.set(vId, version);
    return deliverable;
  }
  async updateDeliverable(id: string, updates: Partial<Deliverable>): Promise<Deliverable | undefined> {
    const existing = this.deliverables.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.deliverables.set(id, updated);
    return updated;
  }
  async deleteDeliverable(id: string): Promise<boolean> {
    return this.deliverables.delete(id);
  }
  async getDeliverableVersions(deliverableId: string): Promise<DeliverableVersion[]> {
    return Array.from(this.deliverableVersions.values())
      .filter(v => v.deliverableId === deliverableId)
      .sort((a, b) => a.versionNumber - b.versionNumber);
  }
  async createDeliverableVersion(data: InsertDeliverableVersion): Promise<DeliverableVersion> {
    const id = randomUUID();
    const version: DeliverableVersion = { id, ...data, createdAt: new Date() } as DeliverableVersion;
    this.deliverableVersions.set(id, version);
    return version;
  }
  async restoreDeliverableVersion(deliverableId: string, versionNumber: number): Promise<Deliverable | undefined> {
    const versions = await this.getDeliverableVersions(deliverableId);
    const target = versions.find(v => v.versionNumber === versionNumber);
    if (!target) return undefined;
    return this.updateDeliverable(deliverableId, { content: target.content, currentVersion: versionNumber });
  }

  // === Phase 36 (FBK-01..04 / RUBR-02..04) — MemStorage impls ===
  async acceptDeliverable(id: string): Promise<Deliverable | undefined> {
    // D-18 mutually exclusive but reversible — set userAcceptedAt, clear dismissedAt.
    return this.updateDeliverable(id, { userAcceptedAt: new Date(), dismissedAt: null });
  }
  async dismissDeliverable(id: string): Promise<Deliverable | undefined> {
    // Symmetric to acceptDeliverable (D-18).
    return this.updateDeliverable(id, { dismissedAt: new Date(), userAcceptedAt: null });
  }
  async recordImpression(id: string, userId: string): Promise<{ deliverable: Deliverable | undefined; deduped: boolean }> {
    const existing = await this.getDeliverable(id);
    if (!existing) return { deliverable: undefined, deduped: false };
    if (!__shouldRecordImpression(id, userId)) {
      // 5s window hit — return current state without incrementing (D-20).
      return { deliverable: existing, deduped: true };
    }
    const updated = await this.updateDeliverable(id, {
      impressionCount: (existing.impressionCount ?? 0) + 1,
    });
    return { deliverable: updated, deduped: false };
  }
  async incrementEditsCount(id: string): Promise<Deliverable | undefined> {
    // MemStorage is single-threaded JS — RMW is safe here. DatabaseStorage uses
    // `sql\`${editsCount} + 1\`` to defeat parallel-iterate races.
    const existing = await this.getDeliverable(id);
    if (!existing) return undefined;
    return this.updateDeliverable(id, { editsCount: (existing.editsCount ?? 0) + 1 });
  }
  async updateDeliverableVersionScore(
    versionId: string,
    fields: {
      rubricVersion: string;
      rubricScore: {
        total: number;
        breakdown: Array<{ criterion: string; score: number; justification: string }>;
        skipped?: boolean;
        reason?: string;
      };
    },
  ): Promise<DeliverableVersion | undefined> {
    const existing = this.deliverableVersions.get(versionId);
    if (!existing) return undefined;
    const updated = { ...existing, ...fields } as DeliverableVersion;
    this.deliverableVersions.set(versionId, updated);
    return updated;
  }
  async getRecentFinalizedDeliverablesByAgent(
    projectId: string,
    agentId: string,
    limit: number,
  ): Promise<Deliverable[]> {
    const all = [...this.deliverables.values()]
      .filter(
        (d) =>
          d.projectId === projectId &&
          d.agentId === agentId &&
          d.status === 'complete',
      )
      .sort(
        (a, b) =>
          (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
      );
    return all.slice(0, limit);
  }

  // v2.0: Packages (MemStorage)
  async getPackagesByProject(projectId: string): Promise<DeliverablePackage[]> {
    return Array.from(this.deliverablePackages.values()).filter(p => p.projectId === projectId);
  }
  async getPackage(id: string): Promise<DeliverablePackage | undefined> {
    return this.deliverablePackages.get(id);
  }
  async createPackage(data: InsertDeliverablePackage): Promise<DeliverablePackage> {
    const id = randomUUID();
    const now = new Date();
    const pkg: DeliverablePackage = { id, ...data, status: data.status ?? 'not_started', metadata: data.metadata ?? {}, createdAt: now, updatedAt: now } as DeliverablePackage;
    this.deliverablePackages.set(id, pkg);
    return pkg;
  }
  async updatePackage(id: string, updates: Partial<DeliverablePackage>): Promise<DeliverablePackage | undefined> {
    const existing = this.deliverablePackages.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.deliverablePackages.set(id, updated);
    return updated;
  }

  // Phase 37 (TREE-01) — autonomy run tree (MemStorage)
  private autonomyRuns: Map<string, AutonomyRun> = new Map();
  private autonomyRunSteps: Map<string, AutonomyRunStep> = new Map();

  async createRun(input: InsertAutonomyRun): Promise<AutonomyRun> {
    const id = randomUUID();
    const now = new Date();
    const row = {
      id,
      traceId: input.traceId,
      projectId: input.projectId,
      userId: input.userId ?? null,
      rootAgentId: input.rootAgentId ?? null,
      rootGoal: input.rootGoal ?? null,
      status: input.status ?? 'running',
      stepCount: input.stepCount ?? 0,
      aggregateScoreDelta: input.aggregateScoreDelta ?? null,
      metadata: (input.metadata as Record<string, unknown>) ?? {},
      createdAt: now,
      updatedAt: now,
    } as AutonomyRun;
    this.autonomyRuns.set(id, row);
    return row;
  }

  async createRunStep(input: InsertAutonomyRunStep): Promise<AutonomyRunStep> {
    // Parent-mismatch guard — cross-run parentStepId claim is a tree-integrity violation
    if (input.parentStepId) {
      const parent = this.autonomyRunSteps.get(input.parentStepId);
      if (!parent || parent.runId !== input.runId) {
        throw new Error(`parentStepId ${input.parentStepId} does not belong to runId ${input.runId}`);
      }
    }
    const id = randomUUID();
    const startedAt = new Date();
    const status = input.status ?? 'pending';
    const isRunning = status === 'running' || status === 'pending';
    const row = {
      id,
      runId: input.runId,
      parentStepId: input.parentStepId ?? null,
      traceId: input.traceId,
      agentId: input.agentId ?? null,
      agentName: input.agentName ?? null,
      agentRole: input.agentRole ?? null,
      stepType: input.stepType,
      title: input.title ?? null,
      status,
      deliverableId: input.deliverableId ?? null,
      deliverableVersionId: input.deliverableVersionId ?? null,
      deliverableVersionNumber: input.deliverableVersionNumber ?? null,
      scoreDelta: input.scoreDelta ?? null,
      metadata: (input.metadata as Record<string, unknown>) ?? {},
      startedAt,
      completedAt: input.completedAt ?? null,
      latencyMs: input.latencyMs ?? null,
      // Q4: 30-min timeout matches pg-boss expireInMinutes — only set on running/pending inserts
      timeoutAt: isRunning ? new Date(startedAt.getTime() + 30 * 60 * 1000) : null,
    } as AutonomyRunStep;
    this.autonomyRunSteps.set(id, row);
    return row;
  }

  async updateRunStep(id: string, updates: Partial<AutonomyRunStep>): Promise<AutonomyRunStep | undefined> {
    const existing = this.autonomyRunSteps.get(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...updates };
    this.autonomyRunSteps.set(id, merged);
    return merged;
  }

  async getRunsByProject(projectId: string, options?: { limit?: number; offset?: number }): Promise<{ runs: AutonomyRun[]; steps: AutonomyRunStep[] }> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    // Q4: opportunistic sweep — mark stuck rows as failed (mirrors DB-mode semantics for parity)
    const now = new Date();
    for (const [stepId, step] of this.autonomyRunSteps.entries()) {
      if (step.status === 'running' && step.timeoutAt && step.timeoutAt.getTime() < now.getTime()) {
        const projectRun = this.autonomyRuns.get(step.runId);
        if (projectRun && projectRun.projectId === projectId) {
          this.autonomyRunSteps.set(stepId, {
            ...step,
            status: 'failed',
            completedAt: now,
            metadata: { ...step.metadata, timeoutReason: 'inferred from pg-boss expiry' },
          });
        }
      }
    }
    const allRuns = [...this.autonomyRuns.values()]
      .filter(r => r.projectId === projectId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const runs = allRuns.slice(offset, offset + limit);
    const runIds = new Set(runs.map(r => r.id));
    const steps = [...this.autonomyRunSteps.values()].filter(s => runIds.has(s.runId));
    return { runs, steps };
  }
}

// ============================================================
// DatabaseStorage — Fix 1: Full Neon/PostgreSQL persistence
// ============================================================
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, sql, desc, inArray, isNull, lt } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return user;
  }
  async getUserByProviderSub(provider: string, providerSub: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.provider, provider), eq(schema.users.providerSub, providerSub)));
    return user;
  }
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return user;
  }
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(schema.users).values(insertUser as any).returning();
    return user;
  }
  async upsertOAuthUser(input: OAuthUserInput): Promise<User> {
    const existing =
      (await this.getUserByProviderSub(input.provider, input.providerSub)) ||
      (await this.getUserByEmail(input.email));
    if (existing) {
      const [updated] = await db
        .update(schema.users)
        .set({
          email: input.email,
          name: input.name,
          avatarUrl: input.avatarUrl || null,
          provider: input.provider,
          providerSub: input.providerSub,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(schema.users)
      .values({
        email: input.email,
        name: input.name,
        avatarUrl: input.avatarUrl || null,
        provider: input.provider,
        providerSub: input.providerSub,
        username: null,
        password: null,
      } as any)
      .returning();
    return created;
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    // List excludes soft-deleted. Use getProject(id) directly when you need a soft-deleted row.
    return db.select().from(schema.projects).where(isNull(schema.projects.deletedAt));
  }
  async getProjectsByUserId(userId: string): Promise<Project[]> {
    return db.select().from(schema.projects)
      .where(and(eq(schema.projects.userId, userId), isNull(schema.projects.deletedAt)));
  }
  async getProject(id: string): Promise<Project | undefined> {
    // Intentionally NOT filtered by deletedAt — restore/purge endpoints need to find
    // soft-deleted projects, and the route layer already validates ownership.
    const [proj] = await db.select().from(schema.projects).where(eq(schema.projects.id, id));
    return proj;
  }
  async createProject(insertProject: InsertProject): Promise<Project> {
    const resolvedUserId = (insertProject as any).userId;
    if (!resolvedUserId) throw new Error("createProject requires userId");
    const [proj] = await db.insert(schema.projects).values({ ...(insertProject as any), userId: resolvedUserId }).returning();
    return proj;
  }
  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const [proj] = await db.update(schema.projects).set(updates).where(eq(schema.projects.id, id)).returning();
    return proj;
  }
  async deleteProject(id: string): Promise<boolean> {
    // Soft-delete: mark the row with deletedAt = NOW(). The Undo popup gets the chance
    // to fire restoreProject within its window; if dismissed, the client (or the cron
    // safety net in server/index.ts) calls purgeProject for the hard cascade.
    const result = await db.update(schema.projects)
      .set({ deletedAt: new Date() })
      .where(and(eq(schema.projects.id, id), isNull(schema.projects.deletedAt)))
      .returning({ id: schema.projects.id });
    return result.length > 0;
  }

  async restoreProject(id: string): Promise<boolean> {
    const result = await db.update(schema.projects)
      .set({ deletedAt: null })
      .where(eq(schema.projects.id, id))
      .returning({ id: schema.projects.id });
    return result.length > 0;
  }

  async getProjectsNeedingPurge(olderThanMs: number): Promise<Array<{ id: string }>> {
    // Returns soft-deleted projects whose deletedAt is older than the cutoff. Used by
    // the cron safety net to clean up rows where the client failed to call /purge
    // (browser close, network drop, etc.).
    const cutoff = new Date(Date.now() - olderThanMs);
    return db.select({ id: schema.projects.id })
      .from(schema.projects)
      .where(and(
        sql`${schema.projects.deletedAt} IS NOT NULL`,
        lt(schema.projects.deletedAt, cutoff),
      ));
  }

  async purgeProject(id: string): Promise<boolean> {
    // Hard cascade — permanently removes the project and ALL associated data.
    // Single transaction; uses IN (subquery) so each table is one statement instead of
    // a N+1 select-then-loop. Cuts wall-clock from ~seconds to <1s on typical projects.
    // Order respects FK constraints:
    //   autonomy_events/deliberation_traces → typing_indicators → message_reactions →
    //   messages → conversation_memory → tasks → conversations →
    //   deliverable_versions → deliverables → deliverable_packages → agents → teams → project
    return db.transaction(async (tx) => {
      const convIds = tx.select({ id: schema.conversations.id })
        .from(schema.conversations)
        .where(eq(schema.conversations.projectId, id));
      const msgIds = tx.select({ id: schema.messages.id })
        .from(schema.messages)
        .where(inArray(schema.messages.conversationId, convIds));
      const deliverableIds = tx.select({ id: schema.deliverables.id })
        .from(schema.deliverables)
        .where(eq(schema.deliverables.projectId, id));

      await tx.delete(schema.autonomyEvents).where(eq(schema.autonomyEvents.projectId, id));
      await tx.delete(schema.deliberationTraces).where(eq(schema.deliberationTraces.projectId, id));
      await tx.delete(schema.typingIndicators).where(inArray(schema.typingIndicators.conversationId, convIds));
      await tx.delete(schema.messageReactions).where(inArray(schema.messageReactions.messageId, msgIds));
      await tx.delete(schema.messages).where(inArray(schema.messages.conversationId, convIds));
      await tx.delete(schema.conversationMemory).where(inArray(schema.conversationMemory.conversationId, convIds));
      await tx.delete(schema.tasks).where(eq(schema.tasks.projectId, id));
      await tx.delete(schema.conversations).where(eq(schema.conversations.projectId, id));
      // v2.0: deliverable_versions FK→deliverables, deliverables/deliverable_packages FK→projects.
      // Must clear before agents (deliverables.agentId references agents.id).
      await tx.delete(schema.deliverableVersions).where(inArray(schema.deliverableVersions.deliverableId, deliverableIds));
      await tx.delete(schema.deliverables).where(eq(schema.deliverables.projectId, id));
      await tx.delete(schema.deliverablePackages).where(eq(schema.deliverablePackages.projectId, id));
      await tx.delete(schema.agents).where(eq(schema.agents.projectId, id));
      await tx.delete(schema.teams).where(eq(schema.teams.projectId, id));
      const result = await tx.delete(schema.projects).where(eq(schema.projects.id, id)).returning();
      return result.length > 0;
    });
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
    const resolvedUserId =
      (insertTeam as any).userId ||
      (await this.getProject((insertTeam as any).projectId))?.userId;
    if (!resolvedUserId) throw new Error("createTeam requires userId or owned project");
    const [team] = await db.insert(schema.teams).values({ ...(insertTeam as any), userId: resolvedUserId }).returning();
    return team;
  }
  async updateTeam(id: string, updates: Partial<Team>): Promise<Team | undefined> {
    const [team] = await db.update(schema.teams).set(updates).where(eq(schema.teams.id, id)).returning();
    return team;
  }
  async deleteTeam(id: string): Promise<boolean> {
    // Clean up autonomy_events and deliberation_traces referencing this team
    await db.delete(schema.autonomyEvents).where(eq(schema.autonomyEvents.teamId, id));
    await db.delete(schema.deliberationTraces).where(eq(schema.deliberationTraces.teamId, id));
    // Clean up agents (and their autonomy_events references)
    const teamAgents = await db.select({ id: schema.agents.id }).from(schema.agents).where(eq(schema.agents.teamId, id));
    for (const agent of teamAgents) {
      await db.delete(schema.autonomyEvents).where(eq(schema.autonomyEvents.hatchId, agent.id));
    }
    await db.delete(schema.agents).where(eq(schema.agents.teamId, id));
    const convs = await db.select({ id: schema.conversations.id }).from(schema.conversations).where(eq(schema.conversations.teamId, id));
    for (const conv of convs) {
      await db.delete(schema.typingIndicators).where(eq(schema.typingIndicators.conversationId, conv.id));
      const msgs = await db.select({ id: schema.messages.id }).from(schema.messages).where(eq(schema.messages.conversationId, conv.id));
      for (const msg of msgs) {
        await db.delete(schema.messageReactions).where(eq(schema.messageReactions.messageId, msg.id));
      }
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
    const team = await this.getTeam((insertAgent as any).teamId);
    const project = await this.getProject((insertAgent as any).projectId);
    const resolvedUserId = (insertAgent as any).userId || team?.userId || project?.userId;
    if (!resolvedUserId) throw new Error("createAgent requires userId or owned team/project");
    const [agent] = await db.insert(schema.agents).values({ ...(insertAgent as any), userId: resolvedUserId }).returning();
    return agent;
  }
  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | undefined> {
    const [agent] = await db.update(schema.agents).set(updates).where(eq(schema.agents.id, id)).returning();
    return agent;
  }
  async deleteAgent(id: string): Promise<boolean> {
    // Cascade: clean up conversations, messages, reactions, typing indicators for this agent
    const agentConvs = await db.select({ id: schema.conversations.id })
      .from(schema.conversations)
      .where(eq(schema.conversations.agentId, id));
    for (const conv of agentConvs) {
      await db.delete(schema.typingIndicators).where(eq(schema.typingIndicators.conversationId, conv.id));
      const msgs = await db.select({ id: schema.messages.id })
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conv.id));
      for (const msg of msgs) {
        await db.delete(schema.messageReactions).where(eq(schema.messageReactions.messageId, msg.id));
      }
      await db.delete(schema.messages).where(eq(schema.messages.conversationId, conv.id));
      await db.delete(schema.conversationMemory).where(eq(schema.conversationMemory.conversationId, conv.id));
    }
    await db.delete(schema.conversations).where(eq(schema.conversations.agentId, id));
    // Clean up typing indicators where this agent was typing
    await db.delete(schema.typingIndicators).where(eq(schema.typingIndicators.agentId, id));
    // Clean up message reactions from this agent
    await db.delete(schema.messageReactions).where(eq(schema.messageReactions.agentId, id));
    const result = await db.delete(schema.agents).where(eq(schema.agents.id, id)).returning();
    return result.length > 0;
  }

  // Special project initializers
  async initializeIdeaProject(projectId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) return;

    // Idempotency: check if Maya already exists for this project
    const existingAgents = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.projectId, projectId));

    const mayaExists = existingAgents.some(a => a.name === 'Maya' && a.isSpecialAgent);
    if (mayaExists) return;

    // Create Maya as a project-level agent with no team (teamId: null)
    await db.insert(schema.agents).values({
      id: randomUUID(),
      userId: project.userId,
      name: 'Maya',
      role: 'Idea Partner',
      color: 'teal',
      teamId: null,
      projectId,
      isSpecialAgent: true,
      personality: {
        traits: ['strategic', 'supportive', 'analytical'],
        communicationStyle: 'Warm, direct, and structured',
        expertise: ['Idea Development', 'Synthesis', 'Reframing', 'Cross-domain Connection'],
        welcomeMessage: "Hey, I'm Maya. Tell me what you're thinking and I'll help you shape it into something real."
      }
    });
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
    const project = await this.getProject(projectId);
    if (!project) return;
    const teamMap: Record<string, string> = {};
    for (const memberName of (starterPack as any).members) {
      const tpl = allHatchTemplates.find((h: any) => h.name === memberName);
      if (!tpl) continue;
      const catMap: Record<string, string> = { development: 'development', strategy: 'strategy', analytics: 'strategy', design: 'design', marketing: 'marketing', content: 'content', operations: 'operations' };
      const tKey = catMap[(tpl as any).category] || 'strategy';
      if (!teamMap[tKey]) {
        const teamData: Record<string, { name: string, emoji: string }> = { development: { name: 'Development', emoji: '💻' }, design: { name: 'Design', emoji: '🎨' }, marketing: { name: 'Marketing', emoji: '📈' }, strategy: { name: 'Strategy', emoji: '🎯' }, operations: { name: 'Operations', emoji: '⚙️' }, content: { name: 'Content', emoji: '✍️' } };
        const [team] = await db.insert(schema.teams).values({ userId: project.userId, name: teamData[tKey].name, emoji: teamData[tKey].emoji, projectId, isExpanded: true }).returning();
        teamMap[tKey] = team.id;
      }
      await db.insert(schema.agents).values({ userId: project.userId, name: (tpl as any).name, role: (tpl as any).role, color: (tpl as any).color, teamId: teamMap[tKey], projectId, isSpecialAgent: false, personality: { traits: (tpl as any).skills?.slice(0, 3) || [], communicationStyle: (tpl as any).description, expertise: (tpl as any).skills || [], welcomeMessage: `Hi! I'm ${(tpl as any).name}, your ${(tpl as any).role}.` } });
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

  async searchMessages(projectId: string, query: string, limit = 50): Promise<Message[]> {
    return db.select()
      .from(schema.messages)
      .where(
        and(
          sql`${schema.messages.conversationId} LIKE ${'%' + projectId + '%'}`,
          sql`LOWER(${schema.messages.content}) LIKE ${'%' + query.toLowerCase() + '%'}`
        )
      )
      .orderBy(desc(schema.messages.createdAt))
      .limit(limit);
  }

  // Tasks
  async getTask(id: string): Promise<Task | undefined> {
    const rows = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id));
    return rows[0];
  }
  async getTasksByProject(projectId: string): Promise<Task[]> {
    return db.select().from(schema.tasks).where(eq(schema.tasks.projectId, projectId));
  }
  async getTasksByAssignee(assigneeId: string): Promise<Task[]> {
    return db.select().from(schema.tasks).where(eq(schema.tasks.assignee, assigneeId));
  }
  async createTask(task: InsertTask): Promise<Task> {
    const resolvedUserId = (task as any).userId || (await this.getProject((task as any).projectId))?.userId;
    if (!resolvedUserId) throw new Error("createTask requires userId or owned project");
    const [t] = await db.insert(schema.tasks).values({ ...(task as any), userId: resolvedUserId }).returning();
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
    const resolvedUserId = (conversation as any).userId || (await this.getProject(conversation.projectId))?.userId;
    if (!resolvedUserId) throw new Error("createConversation requires userId or owned project");
    const [conv] = await db.insert(schema.conversations).values({ ...conversation, userId: resolvedUserId, id } as any).returning();
    return conv;
  }
  async hasConversation(id: string): Promise<boolean> {
    const result = await db.select({ id: schema.conversations.id }).from(schema.conversations).where(eq(schema.conversations.id, id));
    return result.length > 0;
  }
  async getMessagesByConversation(conversationId: string, options?: { page?: number; limit?: number; before?: string; after?: string; messageType?: string }): Promise<Message[]> {
    const rows = await db.select().from(schema.messages).where(eq(schema.messages.conversationId, conversationId));
    let msgs = rows as Message[];
    if (options?.messageType) msgs = msgs.filter(m => m.messageType === options.messageType);
    // Sort ascending by createdAt (oldest first)
    msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    // Cursor-based filtering
    if (options?.before) {
      const cutoff = new Date(options.before).getTime();
      msgs = msgs.filter(m => new Date(m.createdAt).getTime() < cutoff);
    }
    if (options?.after) {
      const cutoff = new Date(options.after).getTime();
      msgs = msgs.filter(m => new Date(m.createdAt).getTime() > cutoff);
    }
    // Apply pagination: page-based takes priority, otherwise return last N (most recent window)
    const limit = options?.limit;
    if (options?.page && limit) {
      const start = (options.page - 1) * limit;
      msgs = msgs.slice(start, start + limit);
    } else if (limit) {
      msgs = msgs.slice(Math.max(0, msgs.length - limit));
    }
    return msgs;
  }
  async getMessage(id: string): Promise<Message | undefined> {
    const rows = await db.select().from(schema.messages).where(eq(schema.messages.id, id));
    return rows[0];
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
    try {
      await db.insert(schema.autonomyEvents).values({
        traceId: `feedback-${agentId}-${userId}-${Date.now()}`,
        turnId: 'feedback',
        requestId: `feedback-${Date.now()}`,
        conversationId: `agent-feedback:${agentId}`,
        eventType: 'personality_feedback',
        payload: { agentId, userId, ...feedback },
        riskScore: 0,
        confidence: 1,
      });
    } catch { /* non-critical */ }
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

  // P3: createConversationMemory — insert extracted project memory
  async createConversationMemory(data: { conversationId: string; memoryType: string; content: string; importance: number; agentId?: string | null; }): Promise<unknown> {
    const [row] = await db.insert(schema.conversationMemory).values({
      conversationId: data.conversationId,
      memoryType: data.memoryType as any,
      content: data.content,
      importance: data.importance,
    }).returning();
    return row;
  }

  // P3: getRelevantProjectMemories — retrieve scored project-scoped memories
  async getRelevantProjectMemories(projectId: string, options: { query: string; limit: number; minImportance: number; excludeConversationId?: string; }): Promise<Array<{ content: string; memoryType: string; importance: number }>> {
    const projectKey = `project:${projectId}`;
    const rows = await db.select().from(schema.conversationMemory)
      .where(eq(schema.conversationMemory.conversationId, projectKey));
    const queryWords = options.query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    return rows
      .filter((m: any) => (m.importance ?? 0) >= options.minImportance)
      .map((m: any) => ({
        content: m.content as string,
        memoryType: m.memoryType as string,
        importance: m.importance as number,
        _score: queryWords.filter(w => (m.content as string).toLowerCase().includes(w)).length,
      }))
      .sort((a, b) => b._score - a._score || b.importance - a.importance)
      .slice(0, options.limit)
      .map(({ content, memoryType, importance }) => ({ content, memoryType, importance }));
  }

  // P5: Proactive outreach rate limiting (uses agents.personality JSONB)
  async getLastProactiveOutreachAt(agentId: string): Promise<Date | null> {
    const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.id, agentId));
    const lastAt = (agent?.personality as any)?.lastProactiveAt;
    return lastAt ? new Date(lastAt) : null;
  }
  async setLastProactiveOutreachAt(agentId: string): Promise<void> {
    const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.id, agentId));
    if (agent) {
      const personality = ((agent.personality ?? {}) as Record<string, unknown>);
      await db.update(schema.agents)
        .set({ personality: { ...personality, lastProactiveAt: new Date().toISOString() } as any })
        .where(eq(schema.agents.id, agentId));
    }
  }

  // Phase 6: Count autonomous task execution events today for cost cap enforcement
  // P1-5: Migrated from raw SQL to Drizzle ORM
  async countAutonomyEventsForProjectToday(projectId: string, dateStr: string): Promise<number> {
    const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
    const endOfDay = new Date(dateStr + 'T23:59:59.999Z');
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.autonomyEvents)
      .where(and(
        eq(schema.autonomyEvents.projectId, projectId),
        eq(schema.autonomyEvents.eventType, 'autonomous_task_execution'),
        sql`${schema.autonomyEvents.timestamp} >= ${startOfDay}`,
        sql`${schema.autonomyEvents.timestamp} <= ${endOfDay}`,
      ));
    return result[0]?.count ?? 0;
  }

  // SAFE-04: Count autonomy events by agent for trust scoring
  // P1-5: Migrated from raw SQL to Drizzle ORM
  async countAutonomyEventsByAgent(
    agentId: string,
    projectId: string,
    eventType: string,
  ): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.autonomyEvents)
      .where(and(
        eq(schema.autonomyEvents.hatchId, agentId),
        eq(schema.autonomyEvents.projectId, projectId),
        eq(schema.autonomyEvents.eventType, eventType),
      ));
    return result[0]?.count ?? 0;
  }

  // UX-03: Absence tracking for return briefing (P1-5: migrated from raw SQL to Drizzle ORM)
  async getProjectTimestamps(projectId: string): Promise<{ lastSeenAt: Date | null; lastBriefedAt: Date | null }> {
    const [proj] = await db.select({
      lastSeenAt: schema.projects.lastSeenAt,
      lastBriefedAt: schema.projects.lastBriefedAt,
    }).from(schema.projects).where(eq(schema.projects.id, projectId));
    if (!proj) return { lastSeenAt: null, lastBriefedAt: null };
    return {
      lastSeenAt: proj.lastSeenAt ? new Date(proj.lastSeenAt) : null,
      lastBriefedAt: proj.lastBriefedAt ? new Date(proj.lastBriefedAt) : null,
    };
  }

  async setProjectLastSeenAt(projectId: string, timestamp: Date): Promise<void> {
    await db.update(schema.projects)
      .set({ lastSeenAt: timestamp } as any)
      .where(eq(schema.projects.id, projectId));
  }

  async setProjectLastBriefedAt(projectId: string, timestamp: Date): Promise<void> {
    await db.update(schema.projects)
      .set({ lastBriefedAt: timestamp } as any)
      .where(eq(schema.projects.id, projectId));
  }

  // TODO(P1-5): Migrate to Drizzle ORM — raw SQL used for complex filtering + mapping.
  // This is parameterized (no injection risk) but bypasses type safety.
  async getAutonomyEventsSince(projectId: string, since: Date): Promise<Array<{ eventType: string; agentId: string | null; payload: unknown; createdAt: Date }>> {
    const { pool: dbPool } = await import('./db.js');
    const result = await dbPool.query(
      `SELECT event_type, hatch_id, payload, "timestamp" FROM autonomy_events
       WHERE project_id = $1
         AND "timestamp" > $2
         AND event_type IN ('task_completed', 'task_failed', 'proposal_approved', 'autonomous_task_execution')
       ORDER BY "timestamp" ASC`,
      [projectId, since],
    );
    return result.rows.map((row: any) => ({
      eventType: row.event_type as string,
      agentId: (row.payload?.agentId ?? row.hatch_id ?? null) as string | null,
      payload: row.payload,
      createdAt: new Date(row.timestamp),
    }));
  }

  // Billing & Usage Tracking
  async upsertDailyUsage(userId: string, date: string, increments: {
    messages?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    costCents?: number;
    standardMessages?: number;
    premiumMessages?: number;
    autonomyExecutions?: number;
  }): Promise<void> {
    const { pool: dbPool } = await import('./db.js');
    await dbPool.query(
      `INSERT INTO usage_daily_summary (id, user_id, date, total_messages, total_prompt_tokens, total_completion_tokens, total_tokens, estimated_cost_cents, standard_model_messages, premium_model_messages, autonomy_executions)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id, date) DO UPDATE SET
         total_messages = usage_daily_summary.total_messages + EXCLUDED.total_messages,
         total_prompt_tokens = usage_daily_summary.total_prompt_tokens + EXCLUDED.total_prompt_tokens,
         total_completion_tokens = usage_daily_summary.total_completion_tokens + EXCLUDED.total_completion_tokens,
         total_tokens = usage_daily_summary.total_tokens + EXCLUDED.total_tokens,
         estimated_cost_cents = usage_daily_summary.estimated_cost_cents + EXCLUDED.estimated_cost_cents,
         standard_model_messages = usage_daily_summary.standard_model_messages + EXCLUDED.standard_model_messages,
         premium_model_messages = usage_daily_summary.premium_model_messages + EXCLUDED.premium_model_messages,
         autonomy_executions = usage_daily_summary.autonomy_executions + EXCLUDED.autonomy_executions,
         updated_at = NOW()`,
      [
        userId, date,
        increments.messages ?? 0,
        increments.promptTokens ?? 0,
        increments.completionTokens ?? 0,
        increments.totalTokens ?? 0,
        increments.costCents ?? 0,
        increments.standardMessages ?? 0,
        increments.premiumMessages ?? 0,
        increments.autonomyExecutions ?? 0,
      ],
    );
  }

  async getDailyUsage(userId: string, date: string): Promise<UsageDailySummary | undefined> {
    const rows = await db.select().from(schema.usageDailySummary)
      .where(and(eq(schema.usageDailySummary.userId, userId), eq(schema.usageDailySummary.date, date)));
    return rows[0];
  }

  async getMonthlyUsage(userId: string, yearMonth: string): Promise<UsageDailySummary[]> {
    const { pool: dbPool } = await import('./db.js');
    const result = await dbPool.query(
      `SELECT * FROM usage_daily_summary WHERE user_id = $1 AND date LIKE $2 ORDER BY date ASC`,
      [userId, `${yearMonth}%`],
    );
    return result.rows;
  }

  async updateUserTier(userId: string, tier: 'free' | 'pro', stripeData?: {
    customerId?: string;
    subscriptionId?: string;
    subscriptionStatus?: string;
    periodEnd?: Date;
    graceExpiresAt?: Date | null;
  }): Promise<void> {
    const updates: Record<string, unknown> = { tier };
    if (stripeData?.customerId) updates.stripeCustomerId = stripeData.customerId;
    if (stripeData?.subscriptionId) updates.stripeSubscriptionId = stripeData.subscriptionId;
    if (stripeData?.subscriptionStatus) updates.subscriptionStatus = stripeData.subscriptionStatus;
    if (stripeData?.periodEnd) updates.subscriptionPeriodEnd = stripeData.periodEnd;
    if (stripeData?.graceExpiresAt !== undefined) updates.graceExpiresAt = stripeData.graceExpiresAt;
    await db.update(schema.users).set(updates).where(eq(schema.users.id, userId));
  }

  async getUserTier(userId: string): Promise<{ tier: string; subscriptionStatus: string; graceExpiresAt: Date | null } | undefined> {
    const rows = await db.select({
      tier: schema.users.tier,
      subscriptionStatus: schema.users.subscriptionStatus,
      graceExpiresAt: schema.users.graceExpiresAt,
    }).from(schema.users).where(eq(schema.users.id, userId));
    if (!rows[0]) return undefined;
    return {
      tier: rows[0].tier,
      subscriptionStatus: rows[0].subscriptionStatus,
      graceExpiresAt: rows[0].graceExpiresAt,
    };
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    const [row] = await db.select().from(schema.users).where(eq(schema.users.stripeCustomerId, customerId));
    return row;
  }

  async checkWebhookProcessed(stripeEventId: string): Promise<boolean> {
    const rows = await db.select().from(schema.processedWebhooks)
      .where(eq(schema.processedWebhooks.stripeEventId, stripeEventId));
    return rows.length > 0;
  }

  async markWebhookProcessed(stripeEventId: string, eventType: string): Promise<void> {
    await db.insert(schema.processedWebhooks).values({ stripeEventId, eventType });
  }

  // v2.0: Deliverables (DatabaseStorage)
  async getDeliverablesByProject(projectId: string): Promise<Deliverable[]> {
    return db.select().from(schema.deliverables).where(eq(schema.deliverables.projectId, projectId));
  }
  async getDeliverable(id: string): Promise<Deliverable | undefined> {
    const [row] = await db.select().from(schema.deliverables).where(eq(schema.deliverables.id, id));
    return row;
  }
  async createDeliverable(data: InsertDeliverable): Promise<Deliverable> {
    const [row] = await db.insert(schema.deliverables).values(data as any).returning();
    // Auto-create v1
    await db.insert(schema.deliverableVersions).values({
      deliverableId: row.id,
      versionNumber: 1,
      content: row.content,
      changeDescription: 'Initial version',
      createdByAgentId: data.agentId ?? null,
    });
    return row;
  }
  async updateDeliverable(id: string, updates: Partial<Deliverable>): Promise<Deliverable | undefined> {
    const [row] = await db.update(schema.deliverables).set({ ...updates, updatedAt: new Date() }).where(eq(schema.deliverables.id, id)).returning();
    return row;
  }
  async deleteDeliverable(id: string): Promise<boolean> {
    const result = await db.delete(schema.deliverables).where(eq(schema.deliverables.id, id));
    return (result.rowCount ?? 0) > 0;
  }
  async getDeliverableVersions(deliverableId: string): Promise<DeliverableVersion[]> {
    return db.select().from(schema.deliverableVersions)
      .where(eq(schema.deliverableVersions.deliverableId, deliverableId))
      .orderBy(schema.deliverableVersions.versionNumber);
  }
  async createDeliverableVersion(data: InsertDeliverableVersion): Promise<DeliverableVersion> {
    const [row] = await db.insert(schema.deliverableVersions).values(data).returning();
    return row;
  }
  async restoreDeliverableVersion(deliverableId: string, versionNumber: number): Promise<Deliverable | undefined> {
    const [target] = await db.select().from(schema.deliverableVersions)
      .where(and(eq(schema.deliverableVersions.deliverableId, deliverableId), eq(schema.deliverableVersions.versionNumber, versionNumber)));
    if (!target) return undefined;
    return this.updateDeliverable(deliverableId, { content: target.content, currentVersion: versionNumber });
  }

  // === Phase 36 (FBK-01..04 / RUBR-02..04) — DatabaseStorage impls ===
  async acceptDeliverable(id: string): Promise<Deliverable | undefined> {
    return this.updateDeliverable(id, { userAcceptedAt: new Date(), dismissedAt: null });
  }
  async dismissDeliverable(id: string): Promise<Deliverable | undefined> {
    return this.updateDeliverable(id, { dismissedAt: new Date(), userAcceptedAt: null });
  }
  async recordImpression(id: string, userId: string): Promise<{ deliverable: Deliverable | undefined; deduped: boolean }> {
    const existing = await this.getDeliverable(id);
    if (!existing) return { deliverable: undefined, deduped: false };
    if (!__shouldRecordImpression(id, userId)) {
      return { deliverable: existing, deduped: true };
    }
    // Atomic SQL increment — defeats RMW race two parallel /impression calls
    // would otherwise hit on the same (deliverable, user) outside the dedupe
    // window (e.g. two browser tabs).
    const [row] = await db.update(schema.deliverables)
      .set({
        impressionCount: sql`${schema.deliverables.impressionCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.deliverables.id, id))
      .returning();
    return { deliverable: row, deduped: false };
  }
  async incrementEditsCount(id: string): Promise<Deliverable | undefined> {
    // Atomic SQL increment — defeats RMW race two parallel iterate calls that
    // both pass scoring would otherwise hit (T-36-16 / W-5).
    const [row] = await db.update(schema.deliverables)
      .set({
        editsCount: sql`${schema.deliverables.editsCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.deliverables.id, id))
      .returning();
    return row;
  }
  async updateDeliverableVersionScore(
    versionId: string,
    fields: {
      rubricVersion: string;
      rubricScore: {
        total: number;
        breakdown: Array<{ criterion: string; score: number; justification: string }>;
        skipped?: boolean;
        reason?: string;
      };
    },
  ): Promise<DeliverableVersion | undefined> {
    const [row] = await db.update(schema.deliverableVersions)
      .set(fields)
      .where(eq(schema.deliverableVersions.id, versionId))
      .returning();
    return row;
  }
  async getRecentFinalizedDeliverablesByAgent(
    projectId: string,
    agentId: string,
    limit: number,
  ): Promise<Deliverable[]> {
    return db.select().from(schema.deliverables)
      .where(and(
        eq(schema.deliverables.projectId, projectId),
        eq(schema.deliverables.agentId, agentId),
        eq(schema.deliverables.status, 'complete'),
      ))
      .orderBy(desc(schema.deliverables.updatedAt))
      .limit(limit);
  }

  // v2.0: Packages (DatabaseStorage)
  async getPackagesByProject(projectId: string): Promise<DeliverablePackage[]> {
    return db.select().from(schema.deliverablePackages).where(eq(schema.deliverablePackages.projectId, projectId));
  }
  async getPackage(id: string): Promise<DeliverablePackage | undefined> {
    const [row] = await db.select().from(schema.deliverablePackages).where(eq(schema.deliverablePackages.id, id));
    return row;
  }
  async createPackage(data: InsertDeliverablePackage): Promise<DeliverablePackage> {
    const [row] = await db.insert(schema.deliverablePackages).values(data as any).returning();
    return row;
  }
  async updatePackage(id: string, updates: Partial<DeliverablePackage>): Promise<DeliverablePackage | undefined> {
    const [row] = await db.update(schema.deliverablePackages).set({ ...updates, updatedAt: new Date() }).where(eq(schema.deliverablePackages.id, id)).returning();
    return row;
  }

  // Phase 37 (TREE-01) — autonomy run tree (DatabaseStorage)
  async createRun(input: InsertAutonomyRun): Promise<AutonomyRun> {
    const [row] = await db.insert(schema.autonomyRuns).values(input as any).returning();
    return row;
  }

  async createRunStep(input: InsertAutonomyRunStep): Promise<AutonomyRunStep> {
    // Parent-mismatch guard — same write-time integrity enforcement as MemStorage
    if (input.parentStepId) {
      const [parent] = await db
        .select({ id: schema.autonomyRunSteps.id, runId: schema.autonomyRunSteps.runId })
        .from(schema.autonomyRunSteps)
        .where(eq(schema.autonomyRunSteps.id, input.parentStepId))
        .limit(1);
      if (!parent || parent.runId !== input.runId) {
        throw new Error(`parentStepId ${input.parentStepId} does not belong to runId ${input.runId}`);
      }
    }
    const status = input.status ?? 'pending';
    const isRunning = status === 'running' || status === 'pending';
    // Q4: timeoutAt = startedAt + 30min matches pg-boss expireInMinutes; set on running/pending inserts only
    const valuesWithTimeout = isRunning
      ? { ...input, timeoutAt: sql`NOW() + interval '30 minutes'` as unknown as Date }
      : input;
    const [row] = await db.insert(schema.autonomyRunSteps).values(valuesWithTimeout as any).returning();
    return row;
  }

  async updateRunStep(id: string, updates: Partial<AutonomyRunStep>): Promise<AutonomyRunStep | undefined> {
    const [row] = await db.update(schema.autonomyRunSteps).set(updates).where(eq(schema.autonomyRunSteps.id, id)).returning();
    return row;
  }

  async getRunsByProject(projectId: string, options?: { limit?: number; offset?: number }): Promise<{ runs: AutonomyRun[]; steps: AutonomyRunStep[] }> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    // Q4 opportunistic sweep — UPDATE stuck rows BEFORE the SELECT
    await db.execute(sql`
      UPDATE autonomy_run_steps
      SET status = 'failed',
          completed_at = NOW(),
          metadata = jsonb_set(metadata, '{timeoutReason}', '"inferred from pg-boss expiry"')
      WHERE status = 'running'
        AND timeout_at < NOW()
        AND run_id IN (SELECT id FROM autonomy_runs WHERE project_id = ${projectId})
    `);
    const runs = await db.select().from(schema.autonomyRuns)
      .where(eq(schema.autonomyRuns.projectId, projectId))
      .orderBy(desc(schema.autonomyRuns.createdAt))
      .limit(limit).offset(offset);
    if (runs.length === 0) return { runs: [], steps: [] };
    const runIds = runs.map(r => r.id);
    const steps = await db.select().from(schema.autonomyRunSteps).where(inArray(schema.autonomyRunSteps.runId, runIds));
    return { runs, steps };
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

/**
 * Phase 37 (TREE-01) — DEV-only test helper for clearing the in-memory run-tree state between cases.
 * Mirrors the prod-guard pattern from server/llm/providerHealthState.ts and
 * __resetImpressionDedupeForTests at the top of this file.
 */
export function __resetRunTreeForTests(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: __resetRunTreeForTests() called in production. Test-only helper must not run in a production code path.');
  }
  const mem = storage as { autonomyRuns?: Map<string, unknown>; autonomyRunSteps?: Map<string, unknown> };
  mem.autonomyRuns?.clear();
  mem.autonomyRunSteps?.clear();
}
