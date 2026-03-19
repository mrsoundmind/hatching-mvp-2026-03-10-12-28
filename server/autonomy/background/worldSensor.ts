const devLog = (...args: unknown[]) => { if (process.env.NODE_ENV !== "production") console.log(...args); };
// World Sensor — Scheduled role-scoped research for world awareness
// Wraps existing AKL runRoleScopedResearch() with time-based triggering.
// Agents stay current on developments relevant to their domain and the project.


import { createSkillUpdateCard, addSkillUpdate } from "../../knowledge/skillUpdates/skillUpdateStore.js";
import { logAutonomyEvent } from "../events/eventLogger.js";

interface WorldSensorDeps {
  runRoleScopedResearch: (input: {
    role: string;
    query: string;
    projectId?: string | null;
  }) => Promise<{ content: string; confidence: number; sources?: string[] }>;
}

interface WorldSensorInput {
  projectId: string;
  projectName: string;
  whatBuilding?: string | null;
  agentRoles: string[];
  traceId: string;
}

// Role-specific world sensing queries
const ROLE_SENSING_TOPICS: Record<string, string> = {
  "Backend Developer": "backend security vulnerabilities, API design patterns, database performance",
  "Product Designer": "UX patterns, accessibility standards, design system updates",
  "UI Engineer": "browser API changes, React updates, CSS features, performance techniques",
  "QA Lead": "testing methodologies, browser compatibility, automated testing tools",
  "Content Writer": "copywriting best practices, SEO updates, content strategy",
  "Product Manager": "product management frameworks, SaaS market trends",
  "Designer": "brand strategy, visual identity trends, design tools",
};

export async function runWorldSensorForProject(
  input: WorldSensorInput,
  deps: WorldSensorDeps
): Promise<void> {
  devLog(
    `[WorldSensor] Running world sensor for project ${input.projectId} (${input.agentRoles.length} roles)`
  );

  for (const role of input.agentRoles) {
    try {
      const topicHints = ROLE_SENSING_TOPICS[role] ?? role;
      const projectContext = input.whatBuilding
        ? ` relevant to building: ${input.whatBuilding.substring(0, 80)}`
        : "";

      const query = `Latest ${topicHints}${projectContext}`;

      const result = await deps.runRoleScopedResearch({
        role,
        query,
        projectId: input.projectId,
      });

      if (result.confidence < 0.7) {
        devLog(`[WorldSensor] Low confidence for ${role} research, skipping`);
        continue;
      }

      // Create a skill update card with the world insight
      const card = createSkillUpdateCard(
        role,
        "world-sensing",
        "new_heuristic",
        `Current context: ${result.content.substring(0, 200)}`,
        [input.traceId],
        result.confidence
      );
      addSkillUpdate(card);

      await logAutonomyEvent({
        eventType: "world_update_detected" as any,
        traceId: input.traceId,
        userId: null,
        projectId: input.projectId,
        teamId: null,
        conversationId: null,
        hatchId: null,
        provider: null,
        mode: null,
        latencyMs: null,
        confidence: result.confidence,
        riskScore: null,
        payload: {
          role,
          confidence: result.confidence,
          skillCardId: card.id,
        } as any,
      });

      devLog(
        `[WorldSensor] World update detected for ${role} (confidence: ${result.confidence.toFixed(2)})`
      );

      // Small delay between role research to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      devLog(
        `[WorldSensor] Error for role ${role}: ${(err as Error).message}`
      );
    }
  }
}
