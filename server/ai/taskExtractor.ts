import { generateChatWithRuntimeFallback, getCurrentRuntimeConfig } from '../llm/providerResolver.js';

export interface ExtractedTask {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  suggestedAssignee: string;
  category: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  reasoning: string;
}

export interface TaskExtractionResult {
  hasTasks: boolean;
  tasks: ExtractedTask[];
  confidence: number;
}

const EXTRACTION_COOLDOWN_MS = 30000;
const extractionDebounceMap = new Map<string, number>();
function resolveExtractorModel(): string | undefined {
  const runtime = getCurrentRuntimeConfig();
  if (runtime.provider !== 'openai') {
    // In test mode, avoid forcing an OpenAI model name on ollama/mock providers.
    return undefined;
  }
  return process.env.TASK_EXTRACTOR_MODEL || process.env.OPENAI_MODEL || runtime.model || 'gpt-4o-mini';
}

function extractJsonObject(text: string): string | null {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return null;
}

/**
 * Extract actionable tasks from chat messages using AI
 */
export async function extractTasksFromMessage(
  userMessage: string,
  agentResponse: string,
  projectContext: {
    projectName: string;
    teamName?: string;
    agentRole: string;
    availableAgents: string[];
    conversationId?: string;
  }
): Promise<TaskExtractionResult> {

  if (projectContext.conversationId) {
    const lastExtractionTime = extractionDebounceMap.get(projectContext.conversationId) || 0;
    const now = Date.now();

    if (now - lastExtractionTime < EXTRACTION_COOLDOWN_MS) {
      console.log(`[TaskExtractor] Skipping AI extraction for conversation ${projectContext.conversationId} (in ${EXTRACTION_COOLDOWN_MS}ms cooldown)`);
      return { hasTasks: false, tasks: [], confidence: 0 };
    }

    extractionDebounceMap.set(projectContext.conversationId, now);
  }

  try {
    const systemPrompt = `You are an AI task extraction specialist. Analyze chat conversations to identify actionable tasks that need to be created.

PROJECT CONTEXT:
- Project: ${projectContext.projectName}
- Team: ${projectContext.teamName || 'General'}
- Responding Agent: ${projectContext.agentRole}
- Available Agents: ${projectContext.availableAgents.join(', ')}

TASK EXTRACTION RULES:
1. Only extract tasks that are clearly actionable and specific
2. Look for verbs like: fix, create, build, implement, design, test, deploy, update, review
3. Ignore general discussions, questions, or vague statements
4. Focus on concrete deliverables or problems to solve
5. Consider urgency indicators: "urgent", "asap", "critical", "blocking"
6. Assign appropriate priority based on language used
7. Suggest the most suitable agent based on the task type

RESPONSE FORMAT:
Return a JSON object with this structure:
{
  "hasTasks": boolean,
  "tasks": [
    {
      "title": "Clear, actionable task title",
      "description": "Detailed description of what needs to be done",
      "priority": "low|medium|high|urgent",
      "suggestedAssignee": "Agent role from available agents",
      "category": "Development|Design|Testing|Deployment|Research|Other",
      "estimatedEffort": "low|medium|high",
      "reasoning": "Why this task was identified and assigned this priority"
    }
  ],
  "confidence": 0.0-1.0
}

EXAMPLES OF TASK-INDICATING LANGUAGE:
- "We need to fix the authentication bug"
- "Let's create a user dashboard"
- "The API is broken and needs to be fixed"
- "We should implement user authentication"
- "The design needs to be updated"
- "We need to test the new feature"
- "Deploy the hotfix to production"

EXAMPLES OF NON-TASK LANGUAGE:
- "How are you doing?"
- "What do you think about this?"
- "I'm not sure about that"
- "Let's discuss this later"
- "That's interesting"`;

    const userPrompt = `CONVERSATION TO ANALYZE:

USER MESSAGE: "${userMessage}"

AGENT RESPONSE: "${agentResponse}"

Extract any actionable tasks from this conversation. Be conservative - only extract tasks that are clearly actionable and specific.`;

    const completion = await generateChatWithRuntimeFallback({
      model: resolveExtractorModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      maxTokens: 1000,
      timeoutMs: Number(process.env.HARD_RESPONSE_TIMEOUT_MS || 45000),
      seed: process.env.LLM_MODE === 'test' ? 42 : undefined,
    });

    const response = completion.content;

    try {
      const jsonText = extractJsonObject(response || '');
      if (!jsonText) {
        return {
          hasTasks: false,
          tasks: [],
          confidence: 0
        };
      }
      const result = JSON.parse(jsonText);
      return {
        hasTasks: result.hasTasks || false,
        tasks: result.tasks || [],
        confidence: result.confidence || 0
      };
    } catch (parseError) {
      console.warn('Task extractor response was not valid JSON; using no-task fallback.');
      return {
        hasTasks: false,
        tasks: [],
        confidence: 0
      };
    }

  } catch (error) {
    console.error('Error extracting tasks from message:', error);
    return {
      hasTasks: false,
      tasks: [],
      confidence: 0
    };
  }
}

/**
 * Fallback task extraction using keyword matching
 */
export function extractTasksFallback(
  userMessage: string,
  agentResponse: string,
  availableAgents: string[]
): TaskExtractionResult {

  const taskKeywords = [
    'fix', 'create', 'build', 'implement', 'design', 'test', 'deploy',
    'update', 'review', 'debug', 'resolve', 'complete', 'finish'
  ];

  const urgentKeywords = ['urgent', 'asap', 'critical', 'blocking', 'emergency'];

  const combinedText = `${userMessage} ${agentResponse}`.toLowerCase();

  const hasTaskKeywords = taskKeywords.some(keyword => combinedText.includes(keyword));
  const hasUrgentKeywords = urgentKeywords.some(keyword => combinedText.includes(keyword));

  if (!hasTaskKeywords) {
    return {
      hasTasks: false,
      tasks: [],
      confidence: 0
    };
  }

  // Simple task extraction
  const tasks: ExtractedTask[] = [];

  // Look for "fix" patterns
  if (combinedText.includes('fix') && combinedText.includes('bug')) {
    tasks.push({
      title: 'Fix bug mentioned in conversation',
      description: `Task extracted from: "${userMessage}"`,
      priority: hasUrgentKeywords ? 'urgent' : 'high',
      suggestedAssignee: availableAgents.includes('Backend Developer') ? 'Backend Developer' : availableAgents[0],
      category: 'Development',
      estimatedEffort: 'medium',
      reasoning: 'Bug fix identified from conversation'
    });
  }

  // Look for "create" patterns
  if (combinedText.includes('create') || combinedText.includes('build')) {
    tasks.push({
      title: 'Create feature mentioned in conversation',
      description: `Task extracted from: "${userMessage}"`,
      priority: hasUrgentKeywords ? 'urgent' : 'medium',
      suggestedAssignee: availableAgents.includes('Product Designer') ? 'Product Designer' : availableAgents[0],
      category: 'Development',
      estimatedEffort: 'high',
      reasoning: 'Feature creation identified from conversation'
    });
  }

  return {
    hasTasks: tasks.length > 0,
    tasks,
    confidence: 0.6
  };
}
