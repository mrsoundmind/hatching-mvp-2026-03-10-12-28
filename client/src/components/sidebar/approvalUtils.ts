/**
 * Approval utility constants and pure functions for the Approvals tab.
 *
 * These are pure, side-effect-free functions that can be tested in isolation
 * without JSX or browser APIs.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How long an approval remains actionable before it is considered expired. */
export const APPROVAL_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// Expiry logic
// ---------------------------------------------------------------------------

/**
 * Returns true when an approval task has passed the 30-minute expiry window
 * without being approved or rejected.
 *
 * Logic:
 * - If the task does not have awaitingApproval === true, it is not an approval
 *   task at all → return false.
 * - If the task has already been actioned (approvedAt or rejectedAt present)
 *   → return false (it is gone, not expired).
 * - Otherwise compare Date.now() against updatedAt + APPROVAL_EXPIRY_MS.
 */
export function isApprovalExpired(task: {
  metadata: unknown;
  updatedAt: string | Date;
}): boolean {
  const meta = task.metadata as Record<string, unknown> | null;

  // Not an approval task
  if (!meta?.awaitingApproval) return false;

  // Already actioned — not expired, just resolved
  if (meta.approvedAt || meta.rejectedAt) return false;

  const updatedAtMs = new Date(task.updatedAt).getTime();
  return Date.now() - updatedAtMs > APPROVAL_EXPIRY_MS;
}

// ---------------------------------------------------------------------------
// Pipeline stage mapping
// ---------------------------------------------------------------------------

/**
 * Maps the DB task status enum to human-readable pipeline stage labels.
 *
 * Important: "blocked" maps to the display label "Review" — the DB has no
 * native "review" status. A blocked task is one awaiting feedback/sign-off,
 * which corresponds to the Review stage in the UI pipeline.
 */
export const PIPELINE_STAGES = [
  {
    id: 'queued' as const,
    label: 'Queued',
    dot: 'bg-gray-400',
    filter: (t: { status: string; assignee: string | null | undefined }) =>
      t.status === 'todo' && !t.assignee,
  },
  {
    id: 'assigned' as const,
    label: 'Assigned',
    dot: 'bg-[var(--hatchin-blue)]',
    filter: (t: { status: string; assignee: string | null | undefined }) =>
      t.status === 'todo' && !!t.assignee,
  },
  {
    id: 'inprogress' as const,
    label: 'In Progress',
    dot: 'bg-[var(--hatchin-orange)] animate-pulse',
    filter: (t: { status: string; assignee: string | null | undefined }) =>
      t.status === 'in_progress',
  },
  {
    id: 'review' as const,
    label: 'Review', // "blocked" status maps to "Review" — intentional rename
    dot: 'bg-amber-400',
    filter: (t: { status: string; assignee: string | null | undefined }) =>
      t.status === 'blocked',
  },
  {
    id: 'done' as const,
    label: 'Done',
    dot: 'bg-[var(--hatchin-green)]',
    filter: (t: { status: string; assignee: string | null | undefined }) =>
      t.status === 'completed',
  },
] as const;
