/**
 * Signed Approve/Reject buttons for Mattermost — Mattermost bridge, Release 1 Phase 2.
 *
 * Mattermost interactive-message callbacks carry no built-in HMAC, so we put a per-(task,action)
 * signature in the button `context` (which is server-side only, never shown to users) and verify it
 * on the callback with a constant-time compare. The signature binds to BOTH the task id and the
 * action, so a leaked context for one button can never approve a different task or flip the action.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AutonomyEvent } from '../../autonomy/events/eventTypes.js';
import type { MattermostConfig } from '../config.js';

const CALLBACK_PATH = '/api/integrations/mattermost/action';

export function actionCallbackUrl(config: MattermostConfig): string {
  return `${config.appBaseUrl}${CALLBACK_PATH}`;
}

export function signAction(taskId: string, action: string, secret: string): string {
  return createHmac('sha256', secret).update(`${taskId}:${action}`).digest('hex');
}

export function verifyActionSignature(taskId: string, action: string, sig: string, secret: string): boolean {
  if (!sig) return false;
  const expected = Buffer.from(signAction(taskId, action, secret));
  const provided = Buffer.from(sig);
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

/**
 * Mattermost message `props` with Approve/Reject buttons for an approval_required event.
 * Returns null when buttons don't apply (wrong event, no signing secret, or no taskId).
 */
export function buildApprovalAttachments(event: AutonomyEvent, config: MattermostConfig): Record<string, unknown> | null {
  if (event.eventType !== 'approval_required') return null;
  if (!config.signingSecret) return null;

  const rawTaskId = (event.payload as Record<string, unknown> | undefined)?.taskId;
  const taskId = typeof rawTaskId === 'string' && rawTaskId ? rawTaskId : null;
  if (!taskId) return null;

  const url = actionCallbackUrl(config);
  const secret = config.signingSecret;

  const mkAction = (action: 'approve' | 'reject', name: string, style: 'primary' | 'danger') => ({
    id: action,
    name,
    style,
    integration: {
      url,
      context: { action, taskId, sig: signAction(taskId, action, secret) },
    },
  });

  return {
    attachments: [
      {
        actions: [mkAction('approve', 'Approve', 'primary'), mkAction('reject', 'Reject', 'danger')],
      },
    ],
  };
}
