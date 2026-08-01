/**
 * Slack connection config — channel bridge, Slack adapter (sibling of the Mattermost adapter).
 *
 * WALKING SKELETON: config comes from env for now, same as the Mattermost adapter, so the loop can
 * be proven end to end without a DB migration or settings UI. A later increment folds both into the
 * per-project `integration_connections` table (see .planning/milestones/mattermost-bridge-BRIEF.md).
 *
 * Two tokens, two jobs:
 *   botToken  (xoxb-...)  Web API calls — chat.postMessage / chat.update (OUTBOUND). Required.
 *   appToken  (xapp-...)  Socket Mode — receive button clicks over an outbound WebSocket (INBOUND).
 *                         Optional: without it we post a text + deep-link card and skip the buttons,
 *                         because a button with no listener behind it would be a dead end.
 *
 * The whole feature is a NO-OP unless botToken, channelId and projectId are all set, so an
 * unconfigured deploy behaves exactly as before.
 */

export interface SlackConfig {
  /** Bot user OAuth token (xoxb-...), Bearer for Web API. Needs chat:write. */
  botToken: string;
  /**
   * App-level token (xapp-...) with connections:write. Enables Socket Mode inbound.
   * When absent, Approve/Reject buttons are NOT attached (no listener to receive the click);
   * the card degrades to text + an "Open in Hatchin" deep link.
   */
  appToken?: string;
  /** Channel this project posts into (C...). The bot must be a member. */
  channelId: string;
  /** The one Hatchin project this channel maps to (personal, single-tenant v1). */
  projectId: string;
  /** Which autonomy event types to notify on. Defaults to approvals only, to avoid channel noise. */
  enabledEvents: Set<string>;
  /** App base URL for "Open in Hatchin" deep links. */
  appBaseUrl: string;
}

const DEFAULT_EVENTS = ['approval_required'];

const trimSlash = (s: string): string => s.replace(/\/+$/, '');

/**
 * Reads the Slack connection from env. `env` is injectable for tests.
 * Returns null (feature off) unless botToken, channelId and projectId are all present.
 */
export function getSlackConfig(env: NodeJS.ProcessEnv = process.env): SlackConfig | null {
  const botToken = (env.SLACK_BOT_TOKEN || '').trim();
  const channelId = (env.SLACK_CHANNEL_ID || '').trim();
  const projectId = (env.SLACK_PROJECT_ID || '').trim();
  if (!botToken || !channelId || !projectId) return null;

  const appToken = (env.SLACK_APP_TOKEN || '').trim() || undefined;

  const raw = (env.SLACK_NOTIFY_EVENTS || '').trim();
  const events = raw
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_EVENTS;

  const appBaseUrl = trimSlash((env.APP_BASE_URL || 'http://localhost:5001').trim());

  return { botToken, appToken, channelId, projectId, enabledEvents: new Set(events), appBaseUrl };
}
