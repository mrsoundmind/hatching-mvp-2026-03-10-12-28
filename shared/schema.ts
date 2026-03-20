import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb, timestamp, index, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  provider: text("provider").notNull().default("google"),
  providerSub: text("provider_sub").notNull().unique(),
  // Legacy fallback fields (deprecated)
  username: text("username").unique(),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("users_email_idx").on(table.email),
  providerSubIdx: index("users_provider_sub_idx").on(table.providerSub),
}));

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🚀"),
  description: text("description"),
  color: text("color").notNull().default("blue"),
  isExpanded: boolean("is_expanded").notNull().default(true),
  progress: integer("progress").notNull().default(0),
  timeSpent: text("time_spent").notNull().default("0h 0m"),
  coreDirection: jsonb("core_direction").$type<{
    whatBuilding?: string;
    whyMatters?: string;
    whoFor?: string;
  }>().default({}),
  brain: jsonb("brain").$type<{
    documents?: Array<{
      id: string;
      title: string;
      content: string;
      type: 'idea-development' | 'project-plan' | 'meeting-notes' | 'research';
      createdAt: string;
    }>;
    sharedMemory?: string;
  }>().default({}),
  executionRules: jsonb("execution_rules").$type<{
    autonomyEnabled?: boolean;
    rules?: string;
    taskGraph?: unknown;
  }>().default({}),
  teamCulture: text("team_culture"),
}, (table) => ({
  userIdIdx: index("projects_user_id_idx").on(table.userId),
}));

export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  isExpanded: boolean("is_expanded").notNull().default(true),
}, (table) => ({
  userIdIdx: index("teams_user_id_idx").on(table.userId),
  projectIdIdx: index("teams_project_id_idx").on(table.projectId),
}));


export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  color: text("color").notNull().default("blue"),
  teamId: varchar("team_id").references(() => teams.id), // nullable for project-level agents (e.g. Maya)
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  personality: jsonb("personality").$type<{
    traits?: string[];
    communicationStyle?: string;
    expertise?: string[];
    welcomeMessage?: string;
    adaptedTraits?: Record<string, Record<string, number>>;
    adaptationMeta?: Record<string, { interactionCount: number; adaptationConfidence: number; lastUpdated: string }>;
  }>().default({}),
  isSpecialAgent: boolean("is_special_agent").notNull().default(false),
}, (table) => ({
  userIdIdx: index("agents_user_id_idx").on(table.userId),
  teamIdIdx: index("agents_team_id_idx").on(table.teamId),
  projectIdIdx: index("agents_project_id_idx").on(table.projectId),
}));

// Chat System Tables

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  teamId: varchar("team_id").references(() => teams.id), // null for project-level chats
  agentId: varchar("agent_id").references(() => agents.id), // null for team/project chats
  type: text("type").notNull().$type<"project" | "team" | "hatch">(),
  title: text("title"), // optional conversation title
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("conversations_user_id_idx").on(table.userId),
  projectIdIdx: index("conversations_project_id_idx").on(table.projectId),
  teamIdIdx: index("conversations_team_id_idx").on(table.teamId),
  agentIdIdx: index("conversations_agent_id_idx").on(table.agentId),
  createdAtIdx: index("conversations_created_at_idx").on(table.createdAt),
}));

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id).notNull(),
  userId: varchar("user_id").references(() => users.id), // null for AI messages
  agentId: varchar("agent_id").references(() => agents.id), // null for user messages
  content: text("content").notNull(),
  messageType: text("message_type").notNull().$type<"user" | "agent" | "system">(),
  // C1.3: Thread navigation support
  parentMessageId: varchar("parent_message_id"), // for threading - self-reference
  threadRootId: varchar("thread_root_id"), // root message of thread - self-reference
  threadDepth: integer("thread_depth").notNull().default(0), // 0 = root, 1 = first reply, etc.
  metadata: jsonb("metadata").$type<{
    isStreaming?: boolean;
    typingDuration?: number;
    responseTime?: number;
    personality?: string;
    agentRole?: string | null;
    mentions?: string[];
    replyTo?: {
      id: string;
      content: string;
      senderName: string;
    };
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  conversationIdIdx: index("messages_conversation_id_idx").on(table.conversationId),
  createdAtIdx: index("messages_created_at_idx").on(table.createdAt),
}));

// Message Reactions Table for AI Training
export const messageReactions = pgTable("message_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").references(() => messages.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  reactionType: text("reaction_type").notNull().$type<"thumbs_up" | "thumbs_down">(),
  agentId: varchar("agent_id").references(() => agents.id), // which agent the feedback is about
  feedbackData: jsonb("feedback_data").$type<{
    responseQuality?: number; // 1-5 scale
    helpfulness?: number; // 1-5 scale
    accuracy?: number; // 1-5 scale
    notes?: string;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  messageIdIdx: index("message_reactions_message_id_idx").on(table.messageId),
}));

export const conversationMemory = pgTable("conversation_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id).notNull(),
  memoryType: text("memory_type").notNull().$type<"context" | "summary" | "key_points" | "decisions">(),
  content: text("content").notNull(),
  importance: integer("importance").notNull().default(5), // 1-10 scale
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  conversationIdIdx: index("conversation_memory_conversation_id_idx").on(table.conversationId),
}));

// Task Management Tables
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().$type<"todo" | "in_progress" | "completed" | "blocked">().default("todo"),
  priority: text("priority").notNull().$type<"low" | "medium" | "high" | "urgent">().default("medium"),
  assignee: text("assignee"), // Agent name/role who is assigned this task
  dueDate: timestamp("due_date"),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  teamId: varchar("team_id").references(() => teams.id), // null for project-level tasks
  parentTaskId: varchar("parent_task_id"), // self-reference for hierarchical tasks (hatches)
  tags: text("tags").array().default([]),
  metadata: jsonb("metadata").$type<{
    createdFromChat?: boolean;
    messageId?: string;
    estimatedHours?: number;
    actualHours?: number;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  userIdIdx: index("tasks_user_id_idx").on(table.userId),
  projectIdIdx: index("tasks_project_id_idx").on(table.projectId),
  assigneeIdx: index("tasks_assignee_idx").on(table.assignee),
}));

export const typingIndicators = pgTable("typing_indicators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id).notNull(),
  agentId: varchar("agent_id").references(() => agents.id).notNull(),
  isTyping: boolean("is_typing").notNull().default(false),
  estimatedDuration: integer("estimated_duration"), // seconds
  startedAt: timestamp("started_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  conversationIdIdx: index("typing_indicators_conversation_id_idx").on(table.conversationId),
}));

export const autonomyEvents = pgTable("autonomy_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  traceId: text("trace_id").notNull(),
  turnId: text("turn_id").notNull(),
  requestId: text("request_id").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  userId: varchar("user_id").references(() => users.id),
  projectId: varchar("project_id").references(() => projects.id),
  teamId: varchar("team_id").references(() => teams.id),
  conversationId: text("conversation_id").notNull(),
  hatchId: varchar("hatch_id").references(() => agents.id),
  provider: text("provider"),
  mode: text("mode"),
  latencyMs: integer("latency_ms"),
  confidence: doublePrecision("confidence"),
  riskScore: doublePrecision("risk_score"),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
}, (table) => ({
  traceIdIdx: index("autonomy_events_trace_id_idx").on(table.traceId),
  projectIdIdx: index("autonomy_events_project_id_idx").on(table.projectId),
  conversationIdIdx: index("autonomy_events_conversation_id_idx").on(table.conversationId),
  timestampIdx: index("autonomy_events_timestamp_idx").on(table.timestamp),
}));

export const deliberationTraces = pgTable("deliberation_traces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  traceId: text("trace_id").notNull().unique(),
  userId: varchar("user_id").references(() => users.id),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  teamId: varchar("team_id").references(() => teams.id),
  conversationId: text("conversation_id").notNull(),
  objective: text("objective").notNull(),
  rounds: jsonb("rounds").$type<Record<string, unknown>[]>().notNull().default([]),
  review: jsonb("review").$type<Record<string, unknown>[]>().notNull().default([]),
  finalSynthesis: jsonb("final_synthesis").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  traceIdIdx: index("deliberation_traces_trace_id_idx").on(table.traceId),
  projectIdIdx: index("deliberation_traces_project_id_idx").on(table.projectId),
  conversationIdIdx: index("deliberation_traces_conversation_id_idx").on(table.conversationId),
}));

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
}).extend({
  userId: z.string().optional(),
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
}).extend({
  userId: z.string().optional(),
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
}).extend({
  userId: z.string().optional(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  email: z.string().email(),
  name: z.string().min(1),
  provider: z.string().default("google"),
  providerSub: z.string().min(1),
  avatarUrl: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
});

// Chat Schema Validations
export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  userId: z.string().optional(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageReactionSchema = createInsertSchema(messageReactions).omit({
  id: true,
  createdAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
}).extend({
  userId: z.string().optional(),
});

// Task Type Exports
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export const insertConversationMemorySchema = createInsertSchema(conversationMemory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTypingIndicatorSchema = createInsertSchema(typingIndicators).omit({
  id: true,
  startedAt: true,
  updatedAt: true,
});

export const insertAutonomyEventSchema = createInsertSchema(autonomyEvents).omit({
  id: true,
  timestamp: true,
});

export const insertDeliberationTraceSchema = createInsertSchema(deliberationTraces).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type Exports
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Chat Type Exports
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessageReaction = z.infer<typeof insertMessageReactionSchema>;
export type MessageReaction = typeof messageReactions.$inferSelect;
export type InsertConversationMemory = z.infer<typeof insertConversationMemorySchema>;
export type ConversationMemory = typeof conversationMemory.$inferSelect;
export type InsertTypingIndicator = z.infer<typeof insertTypingIndicatorSchema>;
export type TypingIndicator = typeof typingIndicators.$inferSelect;
export type InsertAutonomyEvent = z.infer<typeof insertAutonomyEventSchema>;
export type AutonomyEventRow = typeof autonomyEvents.$inferSelect;
export type InsertDeliberationTrace = z.infer<typeof insertDeliberationTraceSchema>;
export type DeliberationTraceRow = typeof deliberationTraces.$inferSelect;

// Right Sidebar Specific Types
export interface RightSidebarExpandedSections {
  coreDirection: boolean;
  targetAudience: boolean;
  executionRules: boolean;
  brandCulture: boolean;
  performance?: boolean;
  skills?: boolean;
  activity?: boolean;
  // Team Dashboard sections
  teamGoal?: boolean;
  strategyPhase?: boolean;
  uiPolish?: boolean;
  mvpRelease?: boolean;
}

export interface RightSidebarUserPreferences {
  expandedSections: RightSidebarExpandedSections;
  defaultView: 'project' | 'team' | 'agent';
  autoSave: boolean;
  autoSaveDelay: number; // milliseconds
  showTimestamps: boolean;
  compactMode: boolean;
}

export interface RightSidebarState {
  // Core direction data
  coreDirection: {
    whatBuilding: string;
    whyMatters: string;
    whoFor: string;
  };
  executionRules: string;
  teamCulture: string;

  // UI state
  expandedSections: RightSidebarExpandedSections;
  recentlySaved: Set<string>;
  activeView: 'project' | 'team' | 'agent' | 'none';

  // User preferences
  preferences: RightSidebarUserPreferences;

  // Loading and error states
  isLoading: boolean;
  error: string | null;
  lastSaved: Record<string, Date>;
}

export interface RightSidebarActions {
  // Data updates
  updateCoreDirection: (field: keyof RightSidebarState['coreDirection'], value: string) => void;
  updateExecutionRules: (value: string) => void;
  updateTeamCulture: (value: string) => void;

  // UI actions
  toggleSection: (section: keyof RightSidebarExpandedSections) => void;
  setRecentlySaved: (section: string) => void;
  clearRecentlySaved: (section: string) => void;

  // Persistence actions
  saveSection: (section: string, data: any) => Promise<void>;
  saveAllSections: () => Promise<void>;

  // Preferences
  updatePreferences: (preferences: Partial<RightSidebarUserPreferences>) => void;
  resetPreferences: () => void;

  // State management
  setActiveView: (view: RightSidebarState['activeView']) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}
