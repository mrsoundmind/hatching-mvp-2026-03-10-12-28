// Smart Task Detection — Organic Extractor
// LLM-powered task extraction for ORGANIC_CANDIDATE messages.
// Only called after intent classifier gates the message (depth ≥ 4, action verbs present).

import { generateChatWithRuntimeFallback, getCurrentRuntimeConfig } from '../../llm/providerResolver.js';
import { checkForDuplicate } from './duplicateDetector.js';

export interface OrganicTask {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  suggestedAssignee: string;
  reasoning: string;
}

export interface OrganicExtractionResult {
  hasTasks: boolean;
  tasks: OrganicTask[];
  confidence: number;
}

// ── Cooldown ─────────────────────────────────────────────────────────────

const COOLDOWN_MS = 30000;
const cooldownMap = new Map<string, number>();

function isInCooldown(conversationId: string): boolean {
  const last = cooldownMap.get(conversationId) || 0;
  return Date.now() - last < COOLDOWN_MS;
}

function markExtraction(conversationId: string): void {
  cooldownMap.set(conversationId, Date.now());
}

// ── JSON extraction helper ───────────────────────────────────────────────

function extractJsonObject(text: string): string | null {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return null;
}

// ── Model resolver ───────────────────────────────────────────────────────

function resolveModel(): string | undefined {
  const runtime = getCurrentRuntimeConfig();
  if (runtime.provider !== 'openai') return undefined;
  return process.env.TASK_EXTRACTOR_MODEL || process.env.OPENAI_MODEL || runtime.model || 'gpt-4o-mini';
}

// ── Main extraction ──────────────────────────────────────────────────────

export async function extractOrganicTasks(
  userMessage: string,
  agentResponse: string,
  context: {
    projectName: string;
    teamName?: string;
    agentRole: string;
    availableAgents: string[];
    conversationId?: string;
    existingTasks?: Array<{ id: string; title: string; status: string; priority?: string }>;
  }
): Promise<OrganicExtractionResult> {
  const empty: OrganicExtractionResult = { hasTasks: false, tasks: [], confidence: 0 };

  // Cooldown check
  if (context.conversationId && isInCooldown(context.conversationId)) {
    return empty;
  }
  if (context.conversationId) markExtraction(context.conversationId);

  try {
    const systemPrompt = `You are a task extraction specialist. Analyze the conversation and identify actionable tasks.

PROJECT: ${context.projectName}
TEAM: ${context.teamName || 'General'}
AGENT: ${context.agentRole}
AVAILABLE ROLES: ${context.availableAgents.join(', ')}

RULES:
- Only extract tasks that are clearly actionable and specific
- Look for action verbs: fix, build, implement, design, test, deploy, update, refactor, migrate
- Ignore vague discussions, questions, or reactions
- Be conservative — when in doubt, don't extract
- Suggest the most suitable agent role as assignee

Return JSON: {"hasTasks": bool, "tasks": [{"title": "...", "description": "...", "priority": "low|medium|high|urgent", "suggestedAssignee": "role", "reasoning": "..."}], "confidence": 0.0-1.0}`;

    const userPrompt = `USER: "${userMessage}"\nAGENT: "${agentResponse}"\n\nExtract actionable tasks (be conservative).`;

    const completion = await generateChatWithRuntimeFallback({
      model: resolveModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      maxTokens: 800,
      timeoutMs: Number(process.env.HARD_RESPONSE_TIMEOUT_MS || 45000),
      seed: process.env.LLM_MODE === 'test' ? 42 : undefined,
    });

    const jsonText = extractJsonObject(completion.content || '');
    if (!jsonText) return empty;

    const result = JSON.parse(jsonText);
    const tasks: OrganicTask[] = (result.tasks || []).filter((t: any) => t.title);

    // Deduplicate against existing project tasks
    const dedupedTasks = context.existingTasks
      ? tasks.filter(t => !checkForDuplicate(t.title, context.existingTasks!).isDuplicate)
      : tasks;

    return {
      hasTasks: dedupedTasks.length > 0,
      tasks: dedupedTasks,
      confidence: result.confidence || 0,
    };
  } catch (error) {
    console.error('[OrganicExtractor] Error:', error);
    return empty;
  }
}
