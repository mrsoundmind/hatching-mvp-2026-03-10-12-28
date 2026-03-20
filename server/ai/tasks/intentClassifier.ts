// Smart Task Detection — Intent Classifier
// Zero-LLM-cost pattern matching to gate all task operations.

export interface ClassifierContext {
  availableAgents: Array<{ id: string; name: string; role: string }>;
  conversationDepth: number;
}

export type TaskIntent =
  | { type: 'EXPLICIT_TASK_REQUEST'; taskDescription: string; priority?: string; assigneeHint?: string; dueDatePhrase?: string }
  | { type: 'USER_DELEGATION'; targetAgentId: string; targetAgentName: string; taskDescription: string }
  | { type: 'TASK_LIFECYCLE_COMMAND'; command: 'status_update' | 'priority_update' | 'assignee_update' | 'delete' | 'query' | 'filtered_query' | 'progress'; taskHint?: string; newStatus?: string; newPriority?: string; newAssignee?: string; filters?: { assignee?: string; status?: string; priority?: string } }
  | { type: 'ORGANIC_CANDIDATE' }
  | { type: 'NO_TASK_INTENT' };

// ── 1. Explicit Task Request ─────────────────────────────────────────

const EXPLICIT_TASK_PATTERNS = [
  /^(?:create|add|make|open|log)\s+(?:a\s+)?task\s+(?:to\s+|for\s+)?(.+)/i,
  /^task:\s*(.+)/i,
  /(?:add|put)\s+(?:this\s+)?(?:to|on|in)\s+(?:the\s+)?task\s*list[:\s]*(.+)?/i,
  /(?:need|want)\s+a\s+task\s+(?:to\s+|for\s+)(.+)/i,
];

function detectExplicitTaskRequest(msg: string): { taskDescription: string } | null {
  for (const pattern of EXPLICIT_TASK_PATTERNS) {
    const match = msg.match(pattern);
    if (match) {
      const desc = (match[1] || '').trim();
      return { taskDescription: desc || msg };
    }
  }
  return null;
}

// ── 2. User Delegation ───────────────────────────────────────────────

const DELEGATION_VERBS = /\b(handle|take\s+care\s+of|work\s+on|pick\s+up|do|tackle|own|take\s+on|take\s+over)\b/i;
const DELEGATION_PHRASES = [
  /(?:pass|hand)\s+(?:this|it)\s+to\s+(?:the\s+)?(\w+)/i,
  /assign\s+(?:this|it)\s+to\s+(\w+)/i,
  /(?:let|have)\s+(?:the\s+)?(\w+)\s+(?:handle|take|work|do)/i,
  /delegate\s+(?:this\s+)?to\s+(\w+)/i,
];

function detectDelegation(msg: string, agents: ClassifierContext['availableAgents']): { targetAgentId: string; targetAgentName: string; taskDescription: string } | null {
  // Check @mention + delegation verb
  const atMatch = msg.match(/@([A-Za-z][A-Za-z0-9_-]*)/);
  if (atMatch && DELEGATION_VERBS.test(msg)) {
    const mentionName = atMatch[1].trim().toLowerCase();
    const agent = agents.find(a => a.name.toLowerCase() === mentionName || a.name.toLowerCase().startsWith(mentionName));
    if (agent) {
      const desc = msg.replace(/@[A-Za-z][A-Za-z0-9 _-]*/, '').replace(DELEGATION_VERBS, '').trim();
      return { targetAgentId: agent.id, targetAgentName: agent.name, taskDescription: desc || msg };
    }
  }

  // Check delegation phrases (pass this to X, assign to X, let X handle)
  for (const pattern of DELEGATION_PHRASES) {
    const match = msg.match(pattern);
    if (match) {
      const target = match[1].trim().toLowerCase();
      // Match by name
      const agentByName = agents.find(a => a.name.toLowerCase() === target || a.name.toLowerCase().startsWith(target));
      if (agentByName) {
        return { targetAgentId: agentByName.id, targetAgentName: agentByName.name, taskDescription: msg };
      }
      // Match by role hint
      const ROLE_HINTS: Record<string, string[]> = {
        'developer': ['developer', 'dev', 'backend', 'frontend', 'engineer'],
        'designer': ['designer', 'design', 'ui', 'ux'],
        'product manager': ['pm', 'product manager', 'project manager'],
        'qa': ['qa', 'tester', 'quality'],
        'marketing': ['marketer', 'marketing', 'content'],
      };
      for (const [, hints] of Object.entries(ROLE_HINTS)) {
        if (hints.includes(target)) {
          const agentByRole = agents.find(a => a.role.toLowerCase().includes(target) || hints.some(h => a.role.toLowerCase().includes(h)));
          if (agentByRole) {
            return { targetAgentId: agentByRole.id, targetAgentName: agentByRole.name, taskDescription: msg };
          }
        }
      }
    }
  }

  return null;
}

// ── 3. Task Lifecycle Commands ───────────────────────────────────────

const STATUS_PATTERNS = [
  /(?:mark|set)\s+(?:the\s+)?(.+?)\s+(?:as\s+)?(done|complete|completed|finished|blocked|in[- ]?progress|todo)/i,
  /(?:close|finish|complete)\s+(?:the\s+)?(.+?)\s*(?:task)?$/i,
];

const PRIORITY_PATTERNS = [
  /(?:change|set|update)\s+(?:the\s+)?priority\s+(?:of\s+)?(.+?)\s+to\s+(urgent|high|medium|low)/i,
  /(?:make|set)\s+(?:the\s+)?(.+?)\s+(urgent|high|medium|low)\s*(?:priority)?/i,
];

const ASSIGNEE_PATTERNS = [
  /(?:reassign|assign|give)\s+(?:the\s+)?(.+?)\s+(?:task\s+)?to\s+(\w+)/i,
];

const DELETE_PATTERNS = [
  /(?:delete|remove|cancel)\s+(?:the\s+)?(.+?)\s*(?:task)?$/i,
  /(?:never\s*mind|forget)\s+(?:about\s+)?(?:the\s+)?(.+?)\s*(?:task)?$/i,
];

const QUERY_PATTERNS = [
  /(?:what|show|list|display)\s+(?:are\s+)?(?:the\s+|our\s+|my\s+)?tasks/i,
  /task\s*(?:list|status|overview)/i,
];

const FILTERED_QUERY_PATTERNS = [
  /(?:what|show)\s+(?:are\s+)?(\w+)(?:'s|s)\s+tasks/i,
  /(?:show|list|what)\s+(?:are\s+)?(?:the\s+)?(blocked|urgent|high|low|completed|done|in[- ]?progress|todo)\s+tasks/i,
  /(?:what(?:'s| is))\s+urgent/i,
];

const PROGRESS_PATTERNS = [
  /how(?:'s| is)\s+(?:the\s+)?(?:project|progress|things?)\s*(?:going|looking)?/i,
  /(?:project|task)\s+(?:progress|summary|overview|status)/i,
  /(?:give|show)\s+(?:me\s+)?(?:a\s+)?(?:progress|status)\s+(?:summary|update|report)/i,
];

function detectLifecycleCommand(msg: string, agents: ClassifierContext['availableAgents']): TaskIntent | null {
  // Status update
  for (const pattern of STATUS_PATTERNS) {
    const match = msg.match(pattern);
    if (match) {
      return { type: 'TASK_LIFECYCLE_COMMAND', command: 'status_update', taskHint: match[1]?.trim(), newStatus: match[2]?.trim() };
    }
  }

  // Priority update
  for (const pattern of PRIORITY_PATTERNS) {
    const match = msg.match(pattern);
    if (match) {
      return { type: 'TASK_LIFECYCLE_COMMAND', command: 'priority_update', taskHint: match[1]?.trim(), newPriority: match[2]?.trim() };
    }
  }

  // Assignee update
  for (const pattern of ASSIGNEE_PATTERNS) {
    const match = msg.match(pattern);
    if (match) {
      return { type: 'TASK_LIFECYCLE_COMMAND', command: 'assignee_update', taskHint: match[1]?.trim(), newAssignee: match[2]?.trim() };
    }
  }

  // Delete
  for (const pattern of DELETE_PATTERNS) {
    const match = msg.match(pattern);
    if (match) {
      return { type: 'TASK_LIFECYCLE_COMMAND', command: 'delete', taskHint: match[1]?.trim() };
    }
  }

  // Progress summary (check before generic query)
  for (const pattern of PROGRESS_PATTERNS) {
    if (pattern.test(msg)) {
      return { type: 'TASK_LIFECYCLE_COMMAND', command: 'progress' };
    }
  }

  // Filtered query
  for (const pattern of FILTERED_QUERY_PATTERNS) {
    const match = msg.match(pattern);
    if (match) {
      const filterValue = match[1]?.trim().toLowerCase();
      const filters: { assignee?: string; status?: string; priority?: string } = {};

      // Check if filter is a status
      const statusValues = ['blocked', 'completed', 'done', 'in-progress', 'in progress', 'todo'];
      const priorityValues = ['urgent', 'high', 'medium', 'low'];

      if (statusValues.includes(filterValue)) {
        filters.status = filterValue;
      } else if (priorityValues.includes(filterValue)) {
        filters.priority = filterValue;
      } else {
        // Assume it's an assignee name
        filters.assignee = filterValue;
      }

      return { type: 'TASK_LIFECYCLE_COMMAND', command: 'filtered_query', filters };
    }
  }

  // Generic query
  for (const pattern of QUERY_PATTERNS) {
    if (pattern.test(msg)) {
      return { type: 'TASK_LIFECYCLE_COMMAND', command: 'query' };
    }
  }

  return null;
}

// ── 4. Organic Candidate ─────────────────────────────────────────────

const ACTION_VERBS = /\b(fix|build|implement|design|deploy|test|update|refactor|migrate|integrate|create|develop|setup|configure)\b/i;
const GREETING_PATTERNS = /^(hey|hi|hello|howdy|sup|yo|greetings|good\s+(?:morning|afternoon|evening)|thanks|thank\s+you|great|nice|cool|awesome|interesting|ok|okay|sure|got\s+it|sounds\s+good)\b/i;

function detectOrganicCandidate(msg: string, depth: number): boolean {
  if (msg.length < 20) return false;
  if (depth < 4) return false;
  if (GREETING_PATTERNS.test(msg)) return false;
  // Skip pure questions without action verbs
  if (msg.endsWith('?') && !ACTION_VERBS.test(msg)) return false;
  return ACTION_VERBS.test(msg);
}

// ── Main Classifier ──────────────────────────────────────────────────

export function classifyTaskIntent(message: string, context: ClassifierContext): TaskIntent {
  const msg = (message || '').trim();
  if (!msg || msg.length < 3) return { type: 'NO_TASK_INTENT' };

  // 1. Explicit task request (highest priority)
  const explicit = detectExplicitTaskRequest(msg);
  if (explicit) {
    return { type: 'EXPLICIT_TASK_REQUEST', taskDescription: explicit.taskDescription };
  }

  // 2. User delegation
  const delegation = detectDelegation(msg, context.availableAgents);
  if (delegation) {
    return { type: 'USER_DELEGATION', ...delegation };
  }

  // 3. Task lifecycle commands
  const lifecycle = detectLifecycleCommand(msg, context.availableAgents);
  if (lifecycle) return lifecycle;

  // 4. Organic candidate (needs depth)
  if (detectOrganicCandidate(msg, context.conversationDepth)) {
    return { type: 'ORGANIC_CANDIDATE' };
  }

  // 5. No task intent
  return { type: 'NO_TASK_INTENT' };
}
