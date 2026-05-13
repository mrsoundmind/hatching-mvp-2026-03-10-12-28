/**
 * Imperative intent parser — runs BEFORE LLM call to short-circuit obvious
 * commands. Returns null for ambiguous messages, which fall through to the
 * normal LLM-driven chat flow.
 *
 * Phase 36.5 hotfix (2026-05-13): closes the gap surfaced by the audit-day
 * probe where "create an agent named X / add a task to Y / rename the project
 * to Z" was met with clarifying questions instead of action. Bridges until
 * the structural fix lands in Phase 38/41/42/43.
 *
 * Pattern philosophy: conservative. False positives are costlier than false
 * negatives — better to ask one extra question than to mis-create an agent
 * the user did not ask for. Word-boundary anchored, specific tokens required
 * ("named" / "called" / "to"), and ambiguous-shape inputs return null.
 */

export type ImperativeIntent =
  | { kind: 'create-agent'; name: string; role: string }
  | { kind: 'create-task'; title: string; priority: 'low' | 'medium' | 'high' }
  | { kind: 'rename-project'; name: string }
  | {
      kind: 'set-brain-field';
      field: 'goals' | 'coreDirection' | 'teamCulture' | 'executionRules' | 'summary';
      value: string;
    };

// ─── helpers ─────────────────────────────────────────────────────────────────

function titleCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function trimEnd(input: string): string {
  return input.replace(/[\s.!?,;:]+$/g, '').trim();
}

// ─── create-agent ────────────────────────────────────────────────────────────
// "create an agent named Pixel as Social Media Manager"
// "add an agent called Sam who is a QA Lead"
// "spawn agent named Riley, a Designer"
// "create an agent named Alex"                  → role defaults to 'Specialist'
//
// Negative: "hire a Pixel as Social Media Manager" → no "named"/"called", no match.
const CREATE_AGENT_RE =
  /\b(?:create|add|make|spawn|hire)\s+(?:an?\s+)?agent\s+(?:named|called)\s+([A-Za-z][A-Za-z0-9'\- ]{0,30}?)(?:\s+(?:as|who\s+is|who's|,\s*a|—\s*a)\s+(?:an?\s+)?([A-Za-z][A-Za-z0-9 \-/]{1,40}?))?(?:[.!?]|\s*$)/i;

function parseCreateAgent(text: string): ImperativeIntent | null {
  const m = text.match(CREATE_AGENT_RE);
  if (!m) return null;
  const rawName = trimEnd(m[1] || '');
  const rawRole = m[2] ? trimEnd(m[2]) : '';
  if (!rawName) return null;
  // Reject single-letter names — too ambiguous.
  if (rawName.replace(/\s+/g, '').length < 2) return null;
  return {
    kind: 'create-agent',
    name: titleCase(rawName),
    role: rawRole ? titleCase(rawRole) : 'Specialist',
  };
}

// ─── create-task ─────────────────────────────────────────────────────────────
// "add a task to update the landing page"
// "create a task: review legal copy"
// "make a task for shipping the iOS build"
// Priority words bump the level: "urgent" / "high priority" → high; "minor" / "low priority" → low.
const CREATE_TASK_RE =
  /\b(?:add|create|make)\s+(?:an?\s+(?:urgent\s+|high[- ]priority\s+|low[- ]priority\s+|minor\s+)?)?task\s+(?:to|that|for|:)\s+(.{3,200}?)(?:[.!?]|\s*$)/i;

function detectPriority(fullText: string): 'low' | 'medium' | 'high' {
  const lower = fullText.toLowerCase();
  if (/\b(urgent|high[- ]priority|asap|critical)\b/.test(lower)) return 'high';
  if (/\b(low[- ]priority|minor|nice[- ]to[- ]have)\b/.test(lower)) return 'low';
  return 'medium';
}

function parseCreateTask(text: string): ImperativeIntent | null {
  const m = text.match(CREATE_TASK_RE);
  if (!m) return null;
  const title = trimEnd(m[1] || '');
  if (!title || title.length < 3) return null;
  return {
    kind: 'create-task',
    title,
    priority: detectPriority(text),
  };
}

// ─── rename-project ──────────────────────────────────────────────────────────
// "rename the project to Falcon"
// "rename project to Falcon Mobile App"
// "change the project name to Falcon"
// "call the project Falcon"
//
// Secondary pattern: "rename to X" / "call it X" only if the message also
// contains the word "project" earlier — keeps the regex narrow.
const RENAME_PROJECT_PRIMARY_RE =
  /\b(?:rename|call|change\s+the\s+(?:project\s+)?name)\s+(?:the\s+)?project\s+(?:to|:)?\s*([A-Za-z0-9 _'\-]{2,60}?)(?:[.!?]|\s*$)/i;

const RENAME_IT_RE = /\b(?:rename|call)\s+(?:it\s+)?(?:to|:)\s+([A-Za-z0-9 _'\-]{2,60}?)(?:[.!?]|\s*$)/i;

function parseRenameProject(text: string): ImperativeIntent | null {
  const primary = text.match(RENAME_PROJECT_PRIMARY_RE);
  if (primary) {
    const name = trimEnd(primary[1] || '');
    if (!name || name.length < 2) return null;
    return { kind: 'rename-project', name };
  }
  // Secondary form requires "project" word elsewhere in the message.
  if (/\bproject\b/i.test(text)) {
    const it = text.match(RENAME_IT_RE);
    if (it) {
      const name = trimEnd(it[1] || '');
      if (!name || name.length < 2) return null;
      return { kind: 'rename-project', name };
    }
  }
  return null;
}

// ─── set-brain-field ─────────────────────────────────────────────────────────
// "set the project goal to ship by Q4"
// "set the audience to enterprise SaaS founders"
// "set culture to async-first" / "set rules to ..."
const SET_BRAIN_FIELD_RE =
  /\bset\s+(?:the\s+)?(?:project\s+)?(goal|goals|direction|target\s+audience|audience|culture|rules)\s+(?:to|:)\s+(.{3,400}?)(?:[.!?]|\s*$)/i;

function mapBrainField(
  alias: string
): 'goals' | 'coreDirection' | 'teamCulture' | 'executionRules' | 'summary' | null {
  const a = alias.toLowerCase().trim();
  if (a === 'goal' || a === 'goals') return 'goals';
  if (a === 'direction' || a === 'target audience' || a === 'audience') return 'coreDirection';
  if (a === 'culture') return 'teamCulture';
  if (a === 'rules') return 'executionRules';
  return null;
}

function parseSetBrainField(text: string): ImperativeIntent | null {
  const m = text.match(SET_BRAIN_FIELD_RE);
  if (!m) return null;
  const field = mapBrainField(m[1] || '');
  const value = trimEnd(m[2] || '');
  if (!field || !value || value.length < 3) return null;
  return { kind: 'set-brain-field', field, value };
}

// ─── main entry ──────────────────────────────────────────────────────────────

/**
 * Inspect a chat message and return a structured imperative intent if the
 * message clearly maps to one of the four known action shapes. Returns null
 * for ambiguous text — caller should fall through to the LLM flow.
 *
 * Test order: most-specific first (create-agent, create-task, rename-project,
 * set-brain-field). First match wins.
 */
export function parseImperativeIntent(text: string): ImperativeIntent | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.length < 4) return null;

  const result =
    parseCreateAgent(trimmed) ||
    parseCreateTask(trimmed) ||
    parseRenameProject(trimmed) ||
    parseSetBrainField(trimmed);

  return result;
}
