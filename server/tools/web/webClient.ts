import { createHash } from 'crypto';
import { shouldAllowWebCalls } from '../../autonomy/config/policies.js';
import { resolveRoleWebPolicy, enforceWebBudget, isInjectionLike } from './webPolicy.js';
import { getSourceTrust, requiresHighStakesVerification } from './sourceTrust.js';
import { getCached, setCached } from '../cache/cacheStore.js';
import { resolveTopicTTL } from '../cache/ttlPolicy.js';
import fetch from 'node-fetch';

export interface SourceEvidence {
  title: string;
  url: string;
  summary: string;
  sourceDate: string;
  confidence: number;
  trustTier: 'A' | 'B' | 'C';
}

export interface WebResearchResult {
  role: string;
  topic: string;
  claim: string;
  evidence: SourceEvidence[];
  blocked: boolean;
  reason?: string;
}

function stableKey(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function sanitizeSummary(summary: string): string {
  const cleaned = (summary || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (isInjectionLike(cleaned)) {
    return 'Potential prompt-injection content removed from source summary.';
  }

  return cleaned.length > 350 ? `${cleaned.slice(0, 349)}…` : cleaned;
}

async function fetchDuckDuckGo(topic: string): Promise<Array<{ title: string; url: string; summary: string }>> {
  const endpoint = `https://duckduckgo.com/?q=${encodeURIComponent(topic)}&format=json&no_redirect=1&no_html=1`;
  const response = await fetch(endpoint, {
    headers: { 'User-Agent': 'Hatchin-AKL/1.0' },
  });

  if (!response.ok) {
    throw new Error(`duckduckgo_http_${response.status}`);
  }

  const data = await response.json() as {
    Heading?: string;
    Abstract?: string;
    AbstractURL?: string;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string } | { Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
  };

  const results: Array<{ title: string; url: string; summary: string }> = [];

  if (data.AbstractURL && data.Abstract) {
    results.push({
      title: data.Heading || 'DuckDuckGo Abstract',
      url: data.AbstractURL,
      summary: data.Abstract,
    });
  }

  for (const item of data.RelatedTopics || []) {
    if ('Topics' in item && Array.isArray(item.Topics)) {
      for (const nested of item.Topics) {
        if (nested.FirstURL && nested.Text) {
          results.push({
            title: nested.Text.split(' - ')[0] || 'Related Topic',
            url: nested.FirstURL,
            summary: nested.Text,
          });
        }
      }
      continue;
    }

    if ('FirstURL' in item && 'Text' in item && item.FirstURL && item.Text) {
      results.push({
        title: item.Text.split(' - ')[0] || 'Related Topic',
        url: item.FirstURL,
        summary: item.Text,
      });
    }
  }

  return results.slice(0, 8);
}

function fallbackEvidence(topic: string): SourceEvidence[] {
  const now = new Date().toISOString();
  return [
    {
      title: 'Operational fallback evidence',
      url: 'https://docs.openai.com/',
      summary: `Fallback evidence card for topic: ${topic}. Live web results were unavailable; treat this as low confidence planning input.`,
      sourceDate: now,
      confidence: 0.35,
      trustTier: 'A',
    },
  ];
}

function mapToEvidence(raw: Array<{ title: string; url: string; summary: string }>, topic: string): SourceEvidence[] {
  const now = new Date().toISOString();
  const output: SourceEvidence[] = [];

  for (const item of raw) {
    const trust = getSourceTrust(item.url);
    output.push({
      title: item.title || 'Untitled source',
      url: item.url,
      summary: sanitizeSummary(item.summary || topic),
      sourceDate: now,
      confidence: trust.tier === 'A' ? 0.8 : trust.tier === 'B' ? 0.65 : 0.45,
      trustTier: trust.tier,
    });
  }

  return output;
}

export async function runRoleScopedResearch(input: {
  role: string;
  topic: string;
  claim: string;
  highStakes?: boolean;
}): Promise<WebResearchResult> {
  const policy = resolveRoleWebPolicy(input.role);

  if (!shouldAllowWebCalls()) {
    return {
      role: input.role,
      topic: input.topic,
      claim: input.claim,
      evidence: [],
      blocked: true,
      reason: 'web_disabled_for_current_mode',
    };
  }

  const key = stableKey(`${policy.roleKey}:${input.topic}:${input.claim}`);
  const cached = await getCached<SourceEvidence[]>(key);
  if (cached && cached.length > 0) {
    return {
      role: input.role,
      topic: input.topic,
      claim: input.claim,
      evidence: cached,
      blocked: false,
      reason: 'cache_hit',
    };
  }

  const budget = enforceWebBudget({
    searchesUsed: 0,
    pagesUsed: 0,
    policy,
  });

  if (!budget.allowed) {
    return {
      role: input.role,
      topic: input.topic,
      claim: input.claim,
      evidence: [],
      blocked: true,
      reason: budget.reason,
    };
  }

  let rawSources: Array<{ title: string; url: string; summary: string }> = [];
  try {
    rawSources = await fetchDuckDuckGo(`${input.topic} ${input.role}`);
  } catch {
    rawSources = [];
  }

  const filtered = rawSources.filter((source) => {
    try {
      const domain = new URL(source.url).hostname.replace(/^www\./, '');
      return policy.allowedDomains.some((allowed) => domain.endsWith(allowed));
    } catch {
      return false;
    }
  }).slice(0, policy.maxPages);

  const evidence = filtered.length > 0 ? mapToEvidence(filtered, input.topic) : fallbackEvidence(input.topic);

  const highStakesCheck = requiresHighStakesVerification({
    highStakes: Boolean(input.highStakes),
    sources: evidence.map((entry) => ({ url: entry.url })),
  });

  const blocked = Boolean(input.highStakes) && !highStakesCheck.pass;

  const ttl = resolveTopicTTL(input.topic);
  await setCached(key, evidence, ttl);

  return {
    role: input.role,
    topic: input.topic,
    claim: input.claim,
    evidence,
    blocked,
    reason: blocked ? highStakesCheck.reason : undefined,
  };
}
