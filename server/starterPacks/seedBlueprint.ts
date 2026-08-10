// Business-in-a-Box — Blueprint seeder (BIAB-0)
// =============================================================================
// Reads a PackBlueprint (shared/packBlueprints.ts) and brings a project to life:
// the right team, a prefilled project direction, staged + assigned tasks, and
// pre-scaffolded documents linked to the tasks that produce them.
//
// It works entirely through the IStorage interface (createTeam/createAgent/
// createTask/createDeliverable/updateProject/updateDeliverable), so it behaves
// identically in MemStorage and DatabaseStorage — no raw DB access, no
// duplicated logic across the two storage backends.
//
// Cost model (OPS-01): documents are seeded as cheap structural scaffolds with
// ZERO LLM calls. An agent fills them in on demand later.
// =============================================================================

import type {
  Project, InsertTeam, Team, InsertAgent, Agent,
  InsertTask, Task, InsertDeliverable, Deliverable,
} from "@shared/schema";
import { ROLE_DEFINITIONS } from "@shared/roleRegistry";
import { getSectionsForType } from "@shared/deliverableTypes";
import type { PackBlueprint, BlueprintDocument } from "@shared/packBlueprints";

// Minimal structural contract — both MemStorage and DatabaseStorage satisfy it.
// Declared locally (not imported from storage.ts) to avoid an import cycle.
export interface BlueprintStore {
  getProject(id: string): Promise<Project | undefined>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
  getAgentsByProject(projectId: string): Promise<Agent[]>;
  getTasksByProject(projectId: string): Promise<Task[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  createTask(task: InsertTask): Promise<Task>;
  createDeliverable(deliverable: InsertDeliverable): Promise<Deliverable>;
  updateDeliverable(id: string, updates: Partial<Deliverable>): Promise<Deliverable | undefined>;
}

const CHARACTER_NAME_BY_ROLE = new Map(ROLE_DEFINITIONS.map((r) => [r.role, r.characterName]));
const characterName = (role: string): string => CHARACTER_NAME_BY_ROLE.get(role) || role;

// Role → team placement + display color for the roles used by the flagship
// blueprints. Kept here (not in roleRegistry, which has no team concept) so pack
// seeding stays self-contained. Colors are the client's canonical set.
const ROLE_TEAM: Record<string, string> = {
  "Product Manager": "strategy",
  "Business Strategist": "strategy",
  "Technical Lead": "development",
  "Product Designer": "design",
  "Brand Strategist": "design",
  "Growth Marketer": "marketing",
  "Social Media Manager": "marketing",
  "Copywriter": "content",
  "Finance Analyst": "finance",
  "Legal Counsel": "legal",
  "Operations Manager": "operations",
};

const ROLE_COLOR: Record<string, string> = {
  "Product Manager": "blue",
  "Business Strategist": "blue",
  "Technical Lead": "blue",
  "Product Designer": "green",
  "Brand Strategist": "purple",
  "Growth Marketer": "green",
  "Social Media Manager": "purple",
  "Copywriter": "green",
  "Finance Analyst": "amber",
  "Legal Counsel": "purple",
  "Operations Manager": "amber",
};

const TEAM_INFO: Record<string, { name: string; emoji: string }> = {
  development: { name: "Development", emoji: "💻" },
  design: { name: "Design", emoji: "🎨" },
  marketing: { name: "Marketing", emoji: "📈" },
  strategy: { name: "Strategy", emoji: "🎯" },
  operations: { name: "Operations", emoji: "⚙️" },
  content: { name: "Content", emoji: "✍️" },
  finance: { name: "Finance", emoji: "💰" },
  legal: { name: "Legal", emoji: "⚖️" },
};

const teamKeyForRole = (role: string): string => ROLE_TEAM[role] || "strategy";
const colorForRole = (role: string): string => ROLE_COLOR[role] || "blue";

/**
 * Build a cheap structural scaffold for a document (no LLM). Sections come from
 * the deliverable-type registry; each gets a header and a plain prompt line.
 */
function buildScaffold(doc: BlueprintDocument, packTitle: string, producerName: string): string {
  const sections = getSectionsForType(doc.type);
  const header = [
    `# ${doc.title}`,
    ``,
    doc.description,
    ``,
    `> Starter scaffold from your ${packTitle} pack. ${producerName} can draft any section with you. Edit anything, or delete what does not fit.`,
    ``,
  ].join("\n");
  const body = sections
    .map((s) => `## ${s}\n_Add your notes here, or ask ${producerName} to draft this section._\n`)
    .join("\n");
  return `${header}\n${body}`;
}

export interface SeedBlueprintResult {
  seeded: boolean;
  reason?: string;
  teams: number;
  agents: number;
  tasks: number;
  documents: number;
  links: number;
}

/**
 * Seed a project from a pack blueprint. Idempotent: if the project already has
 * agents or tasks (i.e. it was already initialized), it does nothing.
 */
export async function seedPackBlueprint(
  store: BlueprintStore,
  projectId: string,
  blueprint: PackBlueprint,
): Promise<SeedBlueprintResult> {
  const empty: SeedBlueprintResult = { seeded: false, teams: 0, agents: 0, tasks: 0, documents: 0, links: 0 };

  const project = await store.getProject(projectId);
  if (!project) return { ...empty, reason: "project_not_found" };
  const userId = project.userId;

  // Idempotency guard — never double-seed.
  const [existingAgents, existingTasks] = await Promise.all([
    store.getAgentsByProject(projectId),
    store.getTasksByProject(projectId),
  ]);
  const nonSpecialAgents = existingAgents.filter((a) => !a.isSpecialAgent);
  if (nonSpecialAgents.length > 0 || existingTasks.length > 0) {
    return { ...empty, reason: "already_initialized" };
  }

  // 1) Prefilled project direction (INTAKE-02) — only when still empty, never clobber —
  //    plus stamp the pack id on the project so the chat path can inject its field playbook.
  const dir = project.coreDirection || {};
  const directionEmpty = !dir.whatBuilding && !dir.whyMatters && !dir.whoFor;
  const updates: Partial<Project> = {
    executionRules: { ...(project.executionRules || {}), packId: blueprint.packId },
  };
  if (directionEmpty) updates.coreDirection = blueprint.direction;
  await store.updateProject(projectId, updates);

  // 2) Teams + agents (the right cast, correctly named, with a per-business brief — TEAM-01/03).
  const teamByKey = new Map<string, Team>();
  const agentByRole = new Map<string, Agent>();
  let teamCount = 0;
  for (const role of blueprint.team) {
    const teamKey = teamKeyForRole(role);
    let team = teamByKey.get(teamKey);
    if (!team) {
      const info = TEAM_INFO[teamKey] || TEAM_INFO.strategy;
      team = await store.createTeam({ userId, projectId, name: info.name, emoji: info.emoji, isExpanded: true } as InsertTeam);
      teamByKey.set(teamKey, team);
      teamCount++;
    }
    const name = characterName(role);
    const brief = blueprint.roleBriefs[role] || "";
    const agent = await store.createAgent({
      userId,
      projectId,
      teamId: team.id,
      name,
      role,
      color: colorForRole(role),
      isSpecialAgent: false,
      personality: {
        traits: [],
        communicationStyle: brief || `${role} for this project`,
        expertise: [],
        welcomeMessage: brief ? `Hi, I'm ${name}, your ${role}. ${brief}` : `Hi, I'm ${name}, your ${role}.`,
      },
    } as InsertAgent);
    agentByRole.set(role, agent);
  }

  // 3) Document scaffolds (DOC-01/03 — pre-scaffolded, staged, zero-LLM per OPS-01).
  const docByKey = new Map<string, Deliverable>();
  for (const doc of blueprint.documents) {
    const producer = agentByRole.get(doc.role);
    const producerName = producer?.name || characterName(doc.role);
    const content = buildScaffold(doc, blueprint.packTitle, producerName);
    const deliverable = await store.createDeliverable({
      projectId,
      agentId: producer?.id ?? null,
      title: doc.title,
      description: doc.description,
      type: doc.type as InsertDeliverable["type"],
      status: "draft",
      content,
      agentName: producer?.name ?? null,
      agentRole: doc.role,
      metadata: {
        sections: getSectionsForType(doc.type),
        stage: doc.stage,
        fromBlueprint: blueprint.packId,
        isScaffold: true,
      },
    } as InsertDeliverable);
    docByKey.set(doc.key, deliverable);
  }

  // 4) Staged, assigned tasks (PROC-01/02) + task↔document link (PROC-06).
  const orderByStage: Record<string, number> = {};
  let taskCount = 0;
  let linkCount = 0;
  for (const t of blueprint.tasks) {
    const assignee = agentByRole.get(t.role);
    const order = (orderByStage[t.stage] = (orderByStage[t.stage] ?? 0) + 1);
    const linkedDoc = t.producesDocKey ? docByKey.get(t.producesDocKey) : undefined;
    const task = await store.createTask({
      userId,
      projectId,
      teamId: assignee?.teamId ?? null,
      title: t.title,
      description: t.description,
      status: "todo",
      priority: t.priority,
      assignee: assignee?.name ?? t.role,
      tags: [`stage:${t.stage}`],
      metadata: {
        stage: t.stage,
        order,
        fromBlueprint: blueprint.packId,
        producesDocType: linkedDoc?.type,
        deliverableId: linkedDoc?.id,
      },
    } as InsertTask);
    taskCount++;

    // Bidirectional link — set the doc's back-reference to the task (PROC-06).
    if (linkedDoc) {
      await store.updateDeliverable(linkedDoc.id, {
        metadata: { ...(linkedDoc.metadata || {}), taskId: task.id },
      });
      linkCount++;
    }
  }

  return {
    seeded: true,
    teams: teamCount,
    agents: agentByRole.size,
    tasks: taskCount,
    documents: docByKey.size,
    links: linkCount,
  };
}
