import type { Request, Response, NextFunction } from 'express';
import { storage } from '../storage.js';
import { getDailyMessageCount } from '../billing/usageTracker.js';

// Kill switch — when anything other than a truthy "true"/"1" is set, gates pass through.
// Flipped the default from opt-out to opt-in: unset / empty / "false" all disable gates.
// This prevents the Free-tier project cap from firing unintentionally on the MVP deploy.
function billingGatesEnabled(): boolean {
  const v = (process.env.FEATURE_BILLING_GATES || '').trim().toLowerCase();
  return v === 'true' || v === '1';
}

// Tier limits — messages feel unlimited but have invisible safety caps.
// Users never see a counter. They only see a friendly message if they hit the cap.
const TIER_LIMITS = {
  free: {
    maxProjects: 3,
    autonomyEnabled: false,
    // Invisible daily message cap — 99% of users never hit this.
    // At ~$0.01/msg (Gemini Pro), 500 msgs = $5/day = $150/month max exposure per free user.
    dailyMessageCap: 500,
    // Per-minute rate cap — prevents scripted/bot abuse
    messagesPerMinute: 15,
  },
  pro: {
    maxProjects: Infinity,
    autonomyEnabled: true,
    dailyMessageCap: 2000,
    messagesPerMinute: 30,
  },
} as const;

type TierName = keyof typeof TIER_LIMITS;

// In-memory per-minute tracker (lightweight, no DB hit).
//
// SCALING LIMITATION (P1-6): This Map is per-process. When running multiple
// Node.js instances behind a load balancer, each instance tracks independently.
// A user could send `messagesPerMinute` to EACH instance, bypassing the limit
// by a factor of N (number of instances). The Map also resets on server restart.
//
// Before scaling horizontally, migrate this to Redis (INCR + EXPIRE pattern)
// or a shared rate-limit store. For single-node MVP this is acceptable.
const minuteTracker = new Map<string, { count: number; windowStart: number }>();

/**
 * Resolve effective tier for a user — handles grace period auto-downgrade.
 */
async function resolveEffectiveTier(userId: string): Promise<TierName> {
  const tierInfo = await storage.getUserTier(userId);
  if (!tierInfo) return 'free';

  // Grace period check: if tier is 'pro' but no active subscription and grace expired
  if (
    tierInfo.tier === 'pro' &&
    tierInfo.subscriptionStatus === 'none' &&
    tierInfo.graceExpiresAt &&
    new Date(tierInfo.graceExpiresAt) < new Date()
  ) {
    // Auto-downgrade (fire-and-forget)
    storage.updateUserTier(userId, 'free', { graceExpiresAt: null }).catch((err) => {
      console.error('[TierGate] Failed to auto-downgrade user:', userId, err);
    });
    return 'free';
  }

  return (tierInfo.tier === 'pro' ? 'pro' : 'free') as TierName;
}

/**
 * Block free users from Pro-only features.
 * Returns 403 with upgrade URL.
 */
export async function requirePro(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!billingGatesEnabled()) { next(); return; }

  const userId = (req.session as any)?.userId;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const tier = await resolveEffectiveTier(userId);
  if (tier === 'pro') { next(); return; }

  res.status(403).json({
    error: 'This feature requires a Pro subscription',
    code: 'PRO_REQUIRED',
    upgradeUrl: '/api/billing/checkout',
  });
}

/**
 * Check if a message is allowed — invisible safety caps.
 *
 * No counter shown to user. No "X remaining" UI.
 * Returns { allowed: true } for 99% of normal usage.
 * Only blocks at abuse-level volumes with a friendly upgrade nudge.
 */
export async function checkMessageSafetyCap(userId: string): Promise<{
  allowed: boolean;
  reason?: 'daily_cap' | 'rate_limit';
  tier: TierName;
}> {
  if (!billingGatesEnabled()) {
    return { allowed: true, tier: 'pro' as TierName };
  }

  const tier = await resolveEffectiveTier(userId);
  const limits = TIER_LIMITS[tier];

  // Check per-minute rate (in-memory, fast)
  const now = Date.now();
  const key = `${userId}:min`;
  const tracker = minuteTracker.get(key);
  if (tracker && (now - tracker.windowStart) < 60_000) {
    if (tracker.count >= limits.messagesPerMinute) {
      return { allowed: false, reason: 'rate_limit', tier };
    }
    tracker.count++;
  } else {
    minuteTracker.set(key, { count: 1, windowStart: now });
  }

  // Cleanup stale entries every ~100 checks (prevent memory leak)
  if (minuteTracker.size > 1000) {
    for (const [k, v] of minuteTracker) {
      if (now - v.windowStart > 120_000) minuteTracker.delete(k);
    }
  }

  // Check daily cap (DB hit, but only once per message — already tracked)
  const dailyUsage = await getDailyMessageCount(storage, userId);
  if (dailyUsage >= limits.dailyMessageCap) {
    return { allowed: false, reason: 'daily_cap', tier };
  }

  return { allowed: true, tier };
}

/**
 * Check project creation limit (3 free / unlimited pro).
 */
export async function checkProjectLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!billingGatesEnabled()) { next(); return; }

  const userId = (req.session as any)?.userId;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const tier = await resolveEffectiveTier(userId);
  const limits = TIER_LIMITS[tier];

  if (limits.maxProjects === Infinity) { next(); return; }

  // Count existing projects for this user only
  const userProjects = await storage.getProjectsByUserId(userId);

  if (userProjects.length >= limits.maxProjects) {
    res.status(403).json({
      error: `Free tier is limited to ${limits.maxProjects} projects. Upgrade to Pro for unlimited projects.`,
      code: 'PROJECT_LIMIT_REACHED',
      upgradeUrl: '/api/billing/checkout',
      currentCount: userProjects.length,
      limit: limits.maxProjects,
    });
    return;
  }

  next();
}

/**
 * Check if autonomy is enabled for the user's tier.
 */
export async function checkAutonomyAccess(userId: string): Promise<boolean> {
  if (!billingGatesEnabled()) return true;
  const tier = await resolveEffectiveTier(userId);
  return TIER_LIMITS[tier].autonomyEnabled;
}

export { TIER_LIMITS, type TierName, resolveEffectiveTier };
