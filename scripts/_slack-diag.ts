/**
 * One-off Slack diagnostic (throwaway). Prints ONLY non-secret fields:
 *   - auth.test ok/team/user/bot_id
 *   - the token's granted OAuth scopes (x-oauth-scopes header) and whether `commands` is present
 *   - apps.connections.open ok (does the app token still open a socket)
 * Never prints the tokens themselves.
 * Run with SLACK_BOT_TOKEN + SLACK_APP_TOKEN in env.
 */
import nodeFetch from 'node-fetch';

const bot = process.env.SLACK_BOT_TOKEN || '';
const app = process.env.SLACK_APP_TOKEN || '';

(async () => {
  if (!bot) { console.log('NO SLACK_BOT_TOKEN in env'); process.exit(1); }

  // auth.test — identity + team, plus scope header
  const at = await nodeFetch('https://slack.com/api/auth.test', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bot}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: '',
  });
  const scopes = at.headers.get('x-oauth-scopes') || '(no x-oauth-scopes header)';
  const atBody = (await at.json().catch(() => null)) as any;
  console.log('auth.test ok:', atBody?.ok, '| team:', atBody?.team, '| user:', atBody?.user, '| bot_id:', atBody?.bot_id, '| team_id:', atBody?.team_id);
  console.log('bot token scopes:', scopes);
  console.log('has `commands` scope:', /(^|,)\s*commands\s*(,|$)/.test(scopes));

  // apps.connections.open — does the app token still open a socket?
  if (app) {
    const ao = await nodeFetch('https://slack.com/api/apps.connections.open', {
      method: 'POST',
      headers: { Authorization: `Bearer ${app}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: '',
    });
    const aoBody = (await ao.json().catch(() => null)) as any;
    console.log('apps.connections.open ok:', aoBody?.ok, aoBody?.ok ? '(socket URL issued)' : `error: ${aoBody?.error}`);
  } else {
    console.log('NO SLACK_APP_TOKEN in env — skipping apps.connections.open');
  }
})();
