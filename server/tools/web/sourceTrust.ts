export type TrustTier = 'A' | 'B' | 'C';

export interface SourceTrustResult {
  domain: string;
  tier: TrustTier;
  reason: string;
}

export const DOMAIN_TRUST_MAP_VERSION = process.env.DOMAIN_TRUST_MAP_VERSION || 'v1';

const TIER_A = new Set([
  'openai.com',
  'docs.openai.com',
  'developer.mozilla.org',
  'w3.org',
  'ietf.org',
  'nist.gov',
  'iso.org',
  'owasp.org',
]);

const TIER_B = new Set([
  'github.com',
  'arxiv.org',
  'cloudflare.com',
  'vercel.com',
  'microsoft.com',
  'google.com',
  'aws.amazon.com',
]);

function normalizeDomain(urlOrDomain: string): string {
  const raw = (urlOrDomain || '').trim().toLowerCase();
  if (!raw) return '';
  try {
    const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return raw.replace(/^www\./, '').split('/')[0];
  }
}

export function getSourceTrust(urlOrDomain: string): SourceTrustResult {
  const domain = normalizeDomain(urlOrDomain);

  if (!domain) {
    return {
      domain: 'unknown',
      tier: 'C',
      reason: 'invalid_domain',
    };
  }

  if (TIER_A.has(domain)) {
    return {
      domain,
      tier: 'A',
      reason: 'official_or_standards_source',
    };
  }

  if (TIER_B.has(domain)) {
    return {
      domain,
      tier: 'B',
      reason: 'reputable_industry_source',
    };
  }

  return {
    domain,
    tier: 'C',
    reason: 'community_or_unknown_source',
  };
}

export function requiresHighStakesVerification(input: {
  highStakes: boolean;
  sources: Array<{ url: string }>;
}): { pass: boolean; reason: string } {
  if (!input.highStakes) {
    return { pass: true, reason: 'not_high_stakes' };
  }

  const trusts = input.sources.map((source) => getSourceTrust(source.url));
  const tierA = trusts.filter((trust) => trust.tier === 'A').length;
  const tierBPlus = trusts.filter((trust) => trust.tier === 'A' || trust.tier === 'B').length;

  if (tierA >= 1) {
    return { pass: true, reason: 'tier_a_present' };
  }

  if (tierBPlus >= 2) {
    return { pass: true, reason: 'two_sources_confirmation' };
  }

  return { pass: false, reason: 'high_stakes_requires_tier_a_or_two_sources' };
}
