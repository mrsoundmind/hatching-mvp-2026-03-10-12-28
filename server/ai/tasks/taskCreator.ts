// Smart Task Detection — Task Creator
// Handles direct creation, delegated creation, due date + priority extraction.

// ── Due Date Extraction ──────────────────────────────────────────────

const DUE_DATE_PATTERNS: Array<{ pattern: RegExp; resolver: (match: RegExpMatchArray) => Date }> = [
  {
    pattern: /\bby\s+tomorrow\b/i,
    resolver: () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; },
  },
  {
    pattern: /\bby\s+tonight\b/i,
    resolver: () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; },
  },
  {
    pattern: /\bin\s+(\d+)\s+days?\b/i,
    resolver: (m) => { const d = new Date(); d.setDate(d.getDate() + parseInt(m[1], 10)); return d; },
  },
  {
    pattern: /\b(?:by\s+)?next\s+week\b/i,
    resolver: () => { const d = new Date(); d.setDate(d.getDate() + 7); return d; },
  },
  {
    pattern: /\bby\s+(?:end\s+of\s+)?(?:this\s+)?week\b/i,
    resolver: () => {
      const d = new Date();
      const daysUntilFriday = (5 - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + daysUntilFriday);
      return d;
    },
  },
  {
    pattern: /\bby\s+(?:this\s+)?friday\b/i,
    resolver: () => {
      const d = new Date();
      const daysUntilFriday = (5 - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + daysUntilFriday);
      return d;
    },
  },
  {
    pattern: /\bby\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/i,
    resolver: (m) => {
      const months: Record<string, number> = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
      const d = new Date();
      d.setMonth(months[m[1].toLowerCase()], parseInt(m[2], 10));
      if (d < new Date()) d.setFullYear(d.getFullYear() + 1);
      return d;
    },
  },
  {
    pattern: /\bby\s+(\d{1,2})\/(\d{1,2})\b/,
    resolver: (m) => {
      const d = new Date();
      d.setMonth(parseInt(m[1], 10) - 1, parseInt(m[2], 10));
      if (d < new Date()) d.setFullYear(d.getFullYear() + 1);
      return d;
    },
  },
];

export function extractDueDate(message: string): Date | null {
  for (const { pattern, resolver } of DUE_DATE_PATTERNS) {
    const match = message.match(pattern);
    if (match) return resolver(match);
  }
  return null;
}

// ── Priority Extraction ──────────────────────────────────────────────

export function extractPriority(message: string): 'urgent' | 'high' | 'medium' | 'low' | undefined {
  const msg = message.toLowerCase();

  if (/\b(urgent|asap|emergency|critical|immediately|right\s+now)\b/.test(msg)) return 'urgent';
  if (/\b(high\s+priority|important|must\s+have|essential)\b/.test(msg)) return 'high';
  if (/\b(low\s+priority|nice\s+to\s+have|would\s+be\s+nice|not\s+urgent|whenever|eventually)\b/.test(msg)) return 'low';

  return undefined;
}

// ── Rate Limiting ────────────────────────────────────────────────────

const creationCounts = new Map<string, { count: number; resetAt: number }>();
const MAX_CREATES_PER_MINUTE = 10;

export function checkRateLimit(userId: string): { allowed: boolean; remaining: number; message?: string } {
  const now = Date.now();
  const entry = creationCounts.get(userId);

  if (!entry || now > entry.resetAt) {
    creationCounts.set(userId, { count: 1, resetAt: now + 60000 });
    return { allowed: true, remaining: MAX_CREATES_PER_MINUTE - 1 };
  }

  if (entry.count >= MAX_CREATES_PER_MINUTE) {
    return { allowed: false, remaining: 0, message: "You've been creating a lot of tasks — maybe consolidate first?" };
  }

  entry.count++;
  return { allowed: true, remaining: MAX_CREATES_PER_MINUTE - entry.count };
}
