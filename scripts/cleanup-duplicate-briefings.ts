/**
 * One-off + reusable maintenance: remove duplicate "return briefing" messages that
 * were created by the pre-fix concurrent-join race (server/routes/chat.ts, fixed
 * with an in-flight guard). Within each project conversation, keeps the FIRST
 * briefing of each absence event and deletes any briefing created within 30s of a
 * kept one — that window only ever contains a race-duplicate, never a genuinely
 * separate 15-min-absence briefing.
 *
 * Run: ./node_modules/.bin/tsx -r dotenv/config scripts/cleanup-duplicate-briefings.ts
 */
import 'dotenv/config';
import { db, pool } from '../server/db.js';
import { messages, messageReactions } from '../shared/schema.js';
import { sql, inArray } from 'drizzle-orm';

const DEDUP_WINDOW_MS = 30_000;

async function main() {
  const rows = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(sql`${messages.metadata}->>'isReturnBriefing' = 'true'`)
    .orderBy(messages.conversationId, messages.createdAt);

  const toDelete: string[] = [];
  const lastKeptByConv = new Map<string, number>();
  let kept = 0;

  for (const r of rows) {
    const t = new Date(r.createdAt as unknown as string).getTime();
    const lastKept = lastKeptByConv.get(r.conversationId);
    if (lastKept !== undefined && t - lastKept < DEDUP_WINDOW_MS) {
      toDelete.push(r.id); // within 30s of a kept briefing → race-duplicate
    } else {
      lastKeptByConv.set(r.conversationId, t);
      kept++;
    }
  }

  console.log(
    `[cleanup-briefings] found ${rows.length} briefing message(s) across ${lastKeptByConv.size} conversation(s); keeping ${kept}, deleting ${toDelete.length} race-duplicate(s).`
  );

  if (toDelete.length > 0) {
    console.log('[cleanup-briefings] deleting:', toDelete);
    // Clear any reactions first (defensive — briefings almost never have them, but
    // message_reactions FKs messageId, so a stray reaction would block the delete).
    await db.delete(messageReactions).where(inArray(messageReactions.messageId, toDelete));
    const res = await db.delete(messages).where(inArray(messages.id, toDelete));
    console.log('[cleanup-briefings] deleted rows:', (res as any).rowCount ?? '(ok)');
  }

  console.log('[cleanup-briefings] done.');
  await pool.end();
}

main().catch((e) => {
  console.error('[cleanup-briefings] FAILED:', e);
  process.exit(1);
});
