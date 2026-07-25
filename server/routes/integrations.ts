/**
 * Inbound integration callbacks — Mattermost bridge, Release 1 Phase 2.
 *
 * The Mattermost Approve/Reject button callback. This route is session-EXEMPT (see the exempt path
 * in server/routes.ts) because there is no browser session behind a button click; it is authenticated
 * instead by the HMAC signature carried in the button context. It reuses the shared approve/reject
 * service so the outcome is identical to the in-app buttons.
 */

import type { Express, Request, Response } from 'express';
import { getMattermostConfig } from '../integrations/config.js';
import { verifyActionSignature } from '../integrations/mattermost/approvalButtons.js';
import { resolveTaskApproval } from '../services/taskApprovalService.js';

export interface RegisterIntegrationDeps {
  broadcastToConversation: (conversationId: string, data: unknown) => void;
  broadcastToProject: (projectId: string, data: unknown) => void;
}

export function registerIntegrationRoutes(app: Express, deps: RegisterIntegrationDeps): void {
  app.post('/api/integrations/mattermost/action', async (req: Request, res: Response) => {
    try {
      const config = getMattermostConfig();
      if (!config || !config.signingSecret) {
        return res.status(404).json({ ephemeral_text: 'Mattermost integration is not configured.' });
      }

      const context = (req.body?.context ?? {}) as Record<string, unknown>;
      const action = String(context.action ?? '');
      const taskId = String(context.taskId ?? '');
      const sig = String(context.sig ?? '');

      if ((action !== 'approve' && action !== 'reject') || !taskId) {
        return res.status(400).json({ ephemeral_text: 'Malformed action request.' });
      }
      if (!verifyActionSignature(taskId, action, sig, config.signingSecret)) {
        return res.status(401).json({ ephemeral_text: 'This action could not be verified.' });
      }

      // requireAwaiting closes the draft-state race: if it was already resolved in the web UI,
      // the click no-ops gracefully instead of re-acting on a done task.
      const result = await resolveTaskApproval(taskId, action, deps, { requireAwaiting: true });
      if (!result.ok) {
        return res.json({ ephemeral_text: 'This request is no longer awaiting approval.' });
      }

      const approved = action === 'approve';
      const emoji = approved ? ':white_check_mark:' : ':x:';
      const verb = approved ? 'Approved' : 'Rejected';
      const title = result.taskTitle ? `: ${result.taskTitle}` : '';
      return res.json({
        // Rewrites the original card in place, dropping the buttons.
        update: { message: `${emoji} **${verb}**${title}`, props: {} },
        ephemeral_text: `You ${approved ? 'approved' : 'rejected'} this.`,
      });
    } catch (err) {
      console.error('[integrations/mattermost/action] error:', (err as Error).message);
      return res.status(500).json({ ephemeral_text: 'Something went wrong handling that action.' });
    }
  });
}
