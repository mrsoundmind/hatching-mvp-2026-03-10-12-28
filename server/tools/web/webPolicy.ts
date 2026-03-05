import { BUDGETS } from '../../autonomy/config/policies.js';

export interface RoleWebPolicy {
  roleKey: string;
  allowedDomains: string[];
  maxSearches: number;
  maxPages: number;
  requireCitation: boolean;
  highStakesTwoSourceRule: boolean;
}

const DEFAULT_ALLOWED_DOMAINS = [
  'openai.com',
  'docs.openai.com',
  'developer.mozilla.org',
  'w3.org',
  'owasp.org',
  'github.com',
];

const ROLE_POLICY: Record<string, RoleWebPolicy> = {
  'product-manager': {
    roleKey: 'product-manager',
    allowedDomains: [...DEFAULT_ALLOWED_DOMAINS, 'mckinsey.com', 'gartner.com'],
    maxSearches: Math.min(BUDGETS.maxSearches, 3),
    maxPages: Math.min(BUDGETS.maxPages, 4),
    requireCitation: true,
    highStakesTwoSourceRule: true,
  },
  engineer: {
    roleKey: 'engineer',
    allowedDomains: [...DEFAULT_ALLOWED_DOMAINS, 'typescriptlang.org', 'nodejs.org'],
    maxSearches: Math.min(BUDGETS.maxSearches, 3),
    maxPages: Math.min(BUDGETS.maxPages, 5),
    requireCitation: true,
    highStakesTwoSourceRule: true,
  },
  designer: {
    roleKey: 'designer',
    allowedDomains: [...DEFAULT_ALLOWED_DOMAINS, 'a11yproject.com', 'material.io'],
    maxSearches: Math.min(BUDGETS.maxSearches, 2),
    maxPages: Math.min(BUDGETS.maxPages, 3),
    requireCitation: true,
    highStakesTwoSourceRule: false,
  },
};

function normalizeRoleKey(role: string): string {
  return role
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function resolveRoleWebPolicy(role: string): RoleWebPolicy {
  const roleKey = normalizeRoleKey(role);
  return ROLE_POLICY[roleKey] || {
    roleKey,
    allowedDomains: DEFAULT_ALLOWED_DOMAINS,
    maxSearches: Math.min(BUDGETS.maxSearches, 2),
    maxPages: Math.min(BUDGETS.maxPages, 3),
    requireCitation: true,
    highStakesTwoSourceRule: true,
  };
}

export function enforceWebBudget(input: {
  searchesUsed: number;
  pagesUsed: number;
  policy: RoleWebPolicy;
}): { allowed: boolean; reason: string } {
  if (input.searchesUsed >= input.policy.maxSearches) {
    return { allowed: false, reason: 'search_budget_exceeded' };
  }
  if (input.pagesUsed >= input.policy.maxPages) {
    return { allowed: false, reason: 'page_budget_exceeded' };
  }
  return { allowed: true, reason: 'within_budget' };
}

export function isInjectionLike(text: string): boolean {
  const lower = (text || '').toLowerCase();
  return (
    lower.includes('ignore previous instructions') ||
    lower.includes('reveal system prompt') ||
    lower.includes('you are now') ||
    lower.includes('developer message') ||
    lower.includes('jailbreak')
  );
}
