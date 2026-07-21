/**
 * Regression guard for the pg-boss worker-recovery fix.
 *
 * The intermittent-autonomy bug was pg-boss's fetch loop hanging forever on a half-open Supabase
 * socket, because pg-boss forwards its config straight to `new pg.Pool()` and the bare connection
 * string gave that pool no timeouts. The load-bearing line is `query_timeout`: without it, a wedged
 * query never rejects and the worker loop (which otherwise retries on error) freezes.
 *
 * These assertions lock in the config so a future refactor cannot silently drop the timeout and
 * reintroduce the wedge. No DB or network needed.
 */
import { buildBossConfig } from '../server/autonomy/execution/jobQueue.js';

let failures = 0;
function check(label: string, cond: boolean, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? ' : ' + detail : ''}`);
  if (!cond) failures++;
}

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://u:p@localhost:5432/x';
const cfg = buildBossConfig();

// The fix itself.
check('query_timeout is set (the anti-hang line)', typeof cfg.query_timeout === 'number' && cfg.query_timeout! > 0, String(cfg.query_timeout));
check('query_timeout is bounded, not absurd', (cfg.query_timeout as number) <= 120_000, String(cfg.query_timeout));

// The supporting resilience, mirroring db.ts so idle Supavisor drops are handled the same way.
check('connectionTimeoutMillis fails fast on connect', typeof cfg.connectionTimeoutMillis === 'number' && cfg.connectionTimeoutMillis! > 0);
check('keepAlive detects dead sockets', cfg.keepAlive === true);
check('idleTimeoutMillis recycles before the pooler kills', typeof cfg.idleTimeoutMillis === 'number' && cfg.idleTimeoutMillis! > 0);
check('ssl preserved for Supabase', typeof cfg.ssl === 'object' && cfg.ssl !== null);
check('application_name is distinguishable', cfg.application_name === 'hatchin-pgboss', String(cfg.application_name));
check('dedicated pool is small (headroom under connection caps)', typeof cfg.max === 'number' && (cfg.max as number) <= 6, String(cfg.max));
check('connection string still carried', typeof cfg.connectionString === 'string' && (cfg.connectionString as string).length > 0);

console.log(failures === 0 ? '\nALL CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
