import 'dotenv/config';
import '../server/storage.js';
import { startSlackSocketMode } from '../server/integrations/slack/socketMode.js';

startSlackSocketMode({ broadcastToConversation: () => {}, broadcastToProject: () => {} });
console.log('Socket Mode listener UP — /hatchin ask ... is now answered (and approvals still work).');
setInterval(() => {}, 1 << 30); // stay alive
