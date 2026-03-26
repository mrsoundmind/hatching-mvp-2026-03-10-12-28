/**
 * Unit tests for isApprovalExpired (approvalUtils.ts)
 * Coverage: APPR-03 expiry logic
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isApprovalExpired, APPROVAL_EXPIRY_MS } from '../client/src/components/sidebar/approvalUtils';

const NOW = new Date('2026-03-26T10:00:00.000Z').getTime();

function makeTask(overrides: {
  awaitingApproval?: boolean;
  approvedAt?: string;
  rejectedAt?: string;
  updatedAt?: string | Date;
  minutesAgo?: number;
}) {
  const minutesAgo = overrides.minutesAgo ?? 0;
  const updatedAt =
    overrides.updatedAt ?? new Date(NOW - minutesAgo * 60 * 1000).toISOString();

  const metadata: Record<string, unknown> = {};
  if (overrides.awaitingApproval !== undefined) {
    metadata.awaitingApproval = overrides.awaitingApproval;
  }
  if (overrides.approvedAt !== undefined) {
    metadata.approvedAt = overrides.approvedAt;
  }
  if (overrides.rejectedAt !== undefined) {
    metadata.rejectedAt = overrides.rejectedAt;
  }

  return { metadata, updatedAt };
}

describe('isApprovalExpired', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false for a task with awaitingApproval=true and updatedAt within 30 minutes', () => {
    const task = makeTask({ awaitingApproval: true, minutesAgo: 15 });
    expect(isApprovalExpired(task)).toBe(false);
  });

  it('returns true for a task with awaitingApproval=true and updatedAt older than 30 minutes', () => {
    const task = makeTask({ awaitingApproval: true, minutesAgo: 31 });
    expect(isApprovalExpired(task)).toBe(true);
  });

  it('returns false for a task with awaitingApproval=false (not an approval task)', () => {
    const task = makeTask({ awaitingApproval: false, minutesAgo: 60 });
    expect(isApprovalExpired(task)).toBe(false);
  });

  it('returns false for a task with awaitingApproval not set', () => {
    const task = makeTask({ minutesAgo: 60 });
    expect(isApprovalExpired(task)).toBe(false);
  });

  it('returns false for a task with approvedAt set (already actioned)', () => {
    const task = makeTask({
      awaitingApproval: true,
      approvedAt: new Date(NOW - 45 * 60 * 1000).toISOString(),
      minutesAgo: 45,
    });
    expect(isApprovalExpired(task)).toBe(false);
  });

  it('returns false for a task with rejectedAt set (already actioned)', () => {
    const task = makeTask({
      awaitingApproval: true,
      rejectedAt: new Date(NOW - 45 * 60 * 1000).toISOString(),
      minutesAgo: 45,
    });
    expect(isApprovalExpired(task)).toBe(false);
  });

  it('returns false for a task exactly at the 30-minute boundary', () => {
    // Exactly 30 minutes — not yet expired
    const task = makeTask({ awaitingApproval: true, minutesAgo: 30 });
    expect(isApprovalExpired(task)).toBe(false);
  });

  it('returns true for a task just over 30 minutes (30min + 1ms)', () => {
    const task = {
      metadata: { awaitingApproval: true },
      updatedAt: new Date(NOW - APPROVAL_EXPIRY_MS - 1).toISOString(),
    };
    expect(isApprovalExpired(task)).toBe(true);
  });

  it('APPROVAL_EXPIRY_MS is 30 minutes in milliseconds', () => {
    expect(APPROVAL_EXPIRY_MS).toBe(30 * 60 * 1000);
  });
});
