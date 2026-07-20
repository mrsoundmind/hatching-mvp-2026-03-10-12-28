/**
 * Checks describeAutonomyEvent against the REAL handoff payload shape stored by handoffOrchestrator,
 * rather than a hand-written fixture that could quietly encode the same wrong assumption the bug did.
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { describeAutonomyEvent } from '../shared/activityLabels.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let failures = 0;
const check = (l: string, c: boolean, d = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${d ? ' : ' + d : ''}`); if (!c) failures++; };

async function main() {
  const { rows } = await pool.query(
    `SELECT payload FROM autonomy_events WHERE event_type = 'handoff_initiated' ORDER BY timestamp DESC LIMIT 1`
  );
  if (!rows.length) throw new Error('no handoff_initiated event stored');
  const real = rows[0].payload;
  console.log('real stored payload:', JSON.stringify(real).slice(0, 160), '\n');

  const selfLabel = describeAutonomyEvent('handoff_initiated', real);
  console.log('label for the real (self) handoff:', JSON.stringify(selfLabel));
  check('self-handoff is not described as handing off', !/Handed the work to/.test(selfLabel));
  check('self-handoff says what actually happened', /Carried straight on/.test(selfLabel));
  check('no anonymous "a teammate" fallback', !/a teammate/.test(selfLabel));

  // Same nested shape, different receiving agent.
  const cross = { ...real, toAgent: { id: 'x', name: 'Coda' } };
  const crossLabel = describeAutonomyEvent('handoff_initiated', cross);
  console.log('label for a cross-agent handoff:', JSON.stringify(crossLabel));
  check('cross-agent handoff names the receiver', crossLabel === 'Handed the work to Coda', crossLabel);

  // Flat shape used by handoff_announced must still work.
  const flat = describeAutonomyEvent('handoff_announced', { fromAgentName: 'Alex', toAgentName: 'Arlo' });
  check('flat payload shape still resolves', flat === 'Handed the work to Arlo', flat);

  await pool.end();
  console.log(failures === 0 ? '\nALL CHECKS PASS' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
