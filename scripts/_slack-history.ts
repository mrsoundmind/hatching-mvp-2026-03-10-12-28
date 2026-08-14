/** Throwaway: read the last few messages from the demo channel to confirm the /hatchin reply posted. */
import nodeFetch from 'node-fetch';
const bot = process.env.SLACK_BOT_TOKEN || '';
const channel = process.env.SLACK_CHANNEL_ID || '';
(async () => {
  const res = await nodeFetch(`https://slack.com/api/conversations.history?channel=${channel}&limit=6`, {
    headers: { Authorization: `Bearer ${bot}` },
  });
  const body = (await res.json().catch(() => null)) as any;
  if (!body?.ok) { console.log('conversations.history error:', body?.error); return; }
  for (const m of (body.messages || []).reverse()) {
    const who = m.bot_id ? '[APP]' : '[user]';
    const text = String(m.text || '').replace(/\s+/g, ' ').slice(0, 400);
    console.log(who, text);
  }
})();
