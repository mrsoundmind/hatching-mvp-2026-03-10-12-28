const devLog = (...args: unknown[]) => { if (process.env.NODE_ENV !== "production") console.log(...args); };
// Project Health Scorer
// Computes health signals for a project from the lens of each agent role.
// Uses existing storage methods — no new DB tables.



export interface FrictionPoint {
  signal: "blocked_tasks" | "stale_tasks" | "conversation_gap" | "unanswered_question" | "repeated_topic" | "team_imbalance";
  targetRole: string;       // Which agent role should address this
  severity: number;         // 0.0 - 1.0
  context: string;          // Human-readable description for outreach generation
  taskIds?: string[];
}

export interface ProjectHealthReport {
  projectId: string;
  scoredAt: string;
  frictionPoints: FrictionPoint[];
  lastMessageAt: Date | null;
  totalTasks: number;
  blockedTaskCount: number;
}

const STALE_TASK_HOURS = 72;
const CONVERSATION_GAP_HOURS = 48;

export async function scoreProjectHealth(
  projectId: string,
  storage: {
    getTasksByProject: (projectId: string) => Promise<Array<{
      id: string;
      title: string;
      status: string;
      assignee?: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>>;
    getMessagesByConversation: (conversationId: string, opts?: { limit?: number }) => Promise<Array<{
      id: string;
      content: string;
      messageType: string;
      createdAt?: Date;
    }>>;
  }
): Promise<ProjectHealthReport> {
  const frictionPoints: FrictionPoint[] = [];
  const now = new Date();

  try {
    // --- Task signals ---
    const tasks = await storage.getTasksByProject(projectId);
    const blockedTasks = tasks.filter((t) => t.status === "blocked");
    const staleTasks = tasks.filter((t) => {
      if (t.status !== "todo") return false;
      const updatedAt = new Date(t.updatedAt);
      const hoursOld = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
      return hoursOld > STALE_TASK_HOURS;
    });

    // Count tasks per assignee for imbalance detection
    const assigneeCounts: Record<string, number> = {};
    for (const task of tasks) {
      if (task.assignee) {
        assigneeCounts[task.assignee] = (assigneeCounts[task.assignee] ?? 0) + 1;
      }
    }
    const maxAssigned = Math.max(...Object.values(assigneeCounts), 0);
    const minAssigned = Math.min(...Object.values(assigneeCounts), 0);

    if (blockedTasks.length > 0) {
      frictionPoints.push({
        signal: "blocked_tasks",
        targetRole: "Product Manager",
        severity: Math.min(0.5 + blockedTasks.length * 0.15, 0.95),
        context: `${blockedTasks.length} task(s) are blocked: ${blockedTasks.slice(0, 2).map((t) => `"${t.title}"`).join(", ")}`,
        taskIds: blockedTasks.map((t) => t.id),
      });
    }

    if (staleTasks.length > 0) {
      frictionPoints.push({
        signal: "stale_tasks",
        targetRole: "Product Manager",
        severity: Math.min(0.4 + staleTasks.length * 0.1, 0.85),
        context: `${staleTasks.length} task(s) have been in "todo" for over ${STALE_TASK_HOURS}h with no updates`,
        taskIds: staleTasks.map((t) => t.id),
      });
    }

    if (maxAssigned - minAssigned > 4 && Object.keys(assigneeCounts).length > 1) {
      frictionPoints.push({
        signal: "team_imbalance",
        targetRole: "Product Manager",
        severity: 0.5,
        context: `Task load is uneven — some team members have ${maxAssigned} tasks while others have ${minAssigned}`,
      });
    }

    // --- Conversation gap signal ---
    const projectConvId = `project:${projectId}`;
    const recentMessages = await storage.getMessagesByConversation(projectConvId, { limit: 3 });

    let lastMessageAt: Date | null = null;
    if (recentMessages.length > 0) {
      const latest = recentMessages[0];
      if (latest.createdAt) {
        lastMessageAt = new Date(latest.createdAt);
        const hoursGap = (now.getTime() - lastMessageAt.getTime()) / (1000 * 60 * 60);
        if (hoursGap > CONVERSATION_GAP_HOURS) {
          frictionPoints.push({
            signal: "conversation_gap",
            targetRole: "Product Manager",
            severity: Math.min(0.4 + hoursGap / 200, 0.7),
            context: `No activity in the project for ${Math.round(hoursGap)} hours`,
          });
        }
      }
    }

    // Sort by severity descending
    frictionPoints.sort((a, b) => b.severity - a.severity);

    devLog(
      `[ProjectHealthScorer] Project ${projectId}: ${frictionPoints.length} friction points found`
    );

    return {
      projectId,
      scoredAt: now.toISOString(),
      frictionPoints,
      lastMessageAt,
      totalTasks: tasks.length,
      blockedTaskCount: blockedTasks.length,
    };
  } catch (err) {
    devLog(
      `[ProjectHealthScorer] Error scoring project ${projectId}: ${(err as Error).message}`
    );
    return {
      projectId,
      scoredAt: now.toISOString(),
      frictionPoints: [],
      lastMessageAt: null,
      totalTasks: 0,
      blockedTaskCount: 0,
    };
  }
}
