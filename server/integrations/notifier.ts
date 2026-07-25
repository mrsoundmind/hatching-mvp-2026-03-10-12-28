/**
 * Channel-agnostic outbound notifier — Mattermost bridge, Release 1 Phase 1.
 *
 * `dispatchAutonomyEvent` is the single seam called (best-effort, fire-and-forget) from
 * `logAutonomyEvent`. Today there is one channel (Mattermost); Slack and Teams become sibling
 * `NotifierChannel`s later with NO change to this dispatch or to the event path.
 *
 * Best-effort by contract: a channel failure is logged and swallowed so an outbound integration
 * hiccup can never affect the autonomy event pipeline.
 */

import type { AutonomyEvent } from '../autonomy/events/eventTypes.js';
import { getMattermostConfig, type MattermostConfig } from './config.js';
import { formatAutonomyEvent } from './mattermost/formatter.js';
import { postToMattermost } from './mattermost/mattermostAdapter.js';
import { buildApprovalAttachments } from './mattermost/approvalButtons.js';

export interface NotifierChannel {
  readonly name: string;
  shouldNotify(event: AutonomyEvent): boolean;
  notify(event: AutonomyEvent): Promise<void>;
}

/** Pure gate: notify only for the mapped project and an enabled event type. Exported for tests. */
export function shouldNotifyMattermost(event: AutonomyEvent, config: MattermostConfig | null): boolean {
  if (!config) return false;
  if (!event.projectId || event.projectId !== config.projectId) return false;
  return config.enabledEvents.has(event.eventType);
}

class MattermostNotifierChannel implements NotifierChannel {
  readonly name = 'mattermost';

  shouldNotify(event: AutonomyEvent): boolean {
    return shouldNotifyMattermost(event, getMattermostConfig());
  }

  async notify(event: AutonomyEvent): Promise<void> {
    const config = getMattermostConfig();
    if (!config) return;
    const formatted = formatAutonomyEvent(event, config.appBaseUrl);
    if (!formatted) return;
    // Approval events get interactive Approve/Reject buttons when a signing secret is configured
    // (Phase 2). Everything else, and the fallback when inbound isn't set up, is text + deep link.
    const props = buildApprovalAttachments(event, config) ?? undefined;
    await postToMattermost(config, { channelId: config.channelId, message: formatted.text, props });
  }
}

const channels: NotifierChannel[] = [new MattermostNotifierChannel()];

/**
 * Fan out an autonomy event to every configured channel. Never throws.
 */
export async function dispatchAutonomyEvent(event: AutonomyEvent): Promise<void> {
  for (const channel of channels) {
    try {
      if (channel.shouldNotify(event)) {
        await channel.notify(event);
      }
    } catch (err) {
      console.warn(`[notifier:${channel.name}] notify failed for ${event.eventType}:`, (err as Error).message);
    }
  }
}
