/**
 * Integration connection config — Mattermost bridge, Release 1 Phase 1.
 *
 * WALKING SKELETON: config comes from env for now so the outbound path can be proven end to end
 * without a DB migration or a settings UI. A later increment replaces this with a per-project
 * `integration_connections` table lookup (see .planning/milestones/mattermost-bridge-BRIEF.md).
 *
 * The whole feature is a NO-OP unless all four required vars are set, so an unconfigured deploy
 * behaves exactly as before.
 */

export interface MattermostConfig {
  /** Mattermost base URL, trailing slash trimmed, e.g. https://mm.example.com */
  baseUrl: string;
  /** Bot access token (Bearer). */
  botToken: string;
  /** Channel this project posts into. */
  channelId: string;
  /** The one Hatchin project this channel maps to (personal, single-tenant v1). */
  projectId: string;
  /** Which autonomy event types to notify on. Defaults to approvals only, to avoid channel noise. */
  enabledEvents: Set<string>;
  /** App base URL for "Open in Hatchin" deep links, and the base for the inbound callback URL. */
  appBaseUrl: string;
  /**
   * Secret for verifying inbound button/slash callbacks (HMAC over the button context).
   * Interactive Approve/Reject buttons are only attached when this is set; inbound is off without it.
   */
  signingSecret?: string;
}

const DEFAULT_EVENTS = ['approval_required'];

const trimSlash = (s: string): string => s.replace(/\/+$/, '');

/**
 * Reads the Mattermost connection from env. `env` is injectable for tests.
 * Returns null (feature off) unless baseUrl, botToken, channelId and projectId are all present.
 */
export function getMattermostConfig(env: NodeJS.ProcessEnv = process.env): MattermostConfig | null {
  const baseUrl = trimSlash((env.MATTERMOST_BASE_URL || '').trim());
  const botToken = (env.MATTERMOST_BOT_TOKEN || '').trim();
  const channelId = (env.MATTERMOST_CHANNEL_ID || '').trim();
  const projectId = (env.MATTERMOST_PROJECT_ID || '').trim();
  if (!baseUrl || !botToken || !channelId || !projectId) return null;

  const raw = (env.MATTERMOST_NOTIFY_EVENTS || '').trim();
  const events = raw
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_EVENTS;

  const appBaseUrl = trimSlash((env.APP_BASE_URL || 'http://localhost:5001').trim());
  const signingSecret = (env.MATTERMOST_SIGNING_SECRET || '').trim() || undefined;

  return { baseUrl, botToken, channelId, projectId, enabledEvents: new Set(events), appBaseUrl, signingSecret };
}
