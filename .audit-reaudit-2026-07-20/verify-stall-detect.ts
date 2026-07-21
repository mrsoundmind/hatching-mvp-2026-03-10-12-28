import 'dotenv/config';
import { detectWorkerStall } from '../server/autonomy/execution/taskExecutionPipeline.js';
(async () => {
  const r = await detectWorkerStall();
  console.log('detectWorkerStall on the CURRENTLY-WEDGED server:', JSON.stringify(r));
  console.log(r.stalled && r.created >= 1
    ? 'PASS: detector sees the real stuck job'
    : 'NOTE: no stall detected right now (worker may have been restarted already)');
  process.exit(0);
})();
