/**
 * Approve/Reject buttons for Slack — channel bridge, Slack adapter.
 *
 * Unlike Mattermost (a public HTTP callback that needs our own HMAC), Slack delivers the button click
 * over the Socket Mode WebSocket, which is ALREADY authenticated by the app-level token used to open
 * it. So there is no signature to carry: the button `value` holds the taskId and the `action_id` says
 * approve vs reject. The listener still re-checks the task is awaiting approval to close races.
 *
 * Buttons are only attached when Socket Mode is configured (appToken present); otherwise a click would
 * have no listener behind it, so the card degrades to text + deep link.
 */

import type { AutonomyEvent } from '../../autonomy/events/eventTypes.js';
import type { SlackConfig } from './config.js';

export const ACTION_APPROVE = 'hatchin_approve';
export const ACTION_REJECT = 'hatchin_reject';
export const APPROVAL_BLOCK_ID = 'hatchin_approval';

/**
 * The Block Kit `actions` block with Approve/Reject buttons, or null when buttons don't apply
 * (wrong event, no Socket Mode listener, or no taskId).
 */
export function buildApprovalActionsBlock(event: AutonomyEvent, config: SlackConfig): Record<string, unknown> | null {
  if (event.eventType !== 'approval_required') return null;
  if (!config.appToken) return null; // no inbound listener → don't render dead buttons

  const rawTaskId = (event.payload as Record<string, unknown> | undefined)?.taskId;
  const taskId = typeof rawTaskId === 'string' && rawTaskId ? rawTaskId : null;
  if (!taskId) return null;

  return {
    type: 'actions',
    block_id: APPROVAL_BLOCK_ID,
    elements: [
      { type: 'button', action_id: ACTION_APPROVE, style: 'primary', text: { type: 'plain_text', text: 'Approve' }, value: taskId },
      {
        type: 'button',
        action_id: ACTION_REJECT,
        style: 'danger',
        text: { type: 'plain_text', text: 'Reject' },
        value: taskId,
        confirm: {
          title: { type: 'plain_text', text: 'Reject this?' },
          text: { type: 'plain_text', text: 'The Hatch will drop the draft and reset the task.' },
          confirm: { type: 'plain_text', text: 'Reject' },
          deny: { type: 'plain_text', text: 'Keep it' },
        },
      },
    ],
  };
}

export interface ParsedApprovalAction {
  taskId: string;
  action: 'approve' | 'reject';
  /** Channel + message ts so the handler can edit the card in place. */
  channelId: string | null;
  messageTs: string | null;
}

/**
 * Pull the approval decision out of a Slack `block_actions` interactive payload.
 * Returns null if it isn't one of our approval buttons or is malformed.
 */
export function parseApprovalAction(payload: unknown): ParsedApprovalAction | null {
  const p = (payload || {}) as Record<string, any>;
  if (p.type !== 'block_actions' || !Array.isArray(p.actions)) return null;

  const hit = p.actions.find((a: any) => a?.action_id === ACTION_APPROVE || a?.action_id === ACTION_REJECT);
  if (!hit) return null;

  const action: 'approve' | 'reject' = hit.action_id === ACTION_APPROVE ? 'approve' : 'reject';
  const taskId = typeof hit.value === 'string' && hit.value ? hit.value : null;
  if (!taskId) return null;

  const channelId = typeof p.channel?.id === 'string' ? p.channel.id : null;
  const messageTs = typeof p.message?.ts === 'string' ? p.message.ts : null;
  return { taskId, action, channelId, messageTs };
}
