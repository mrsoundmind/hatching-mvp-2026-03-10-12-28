// Business-in-a-Box — pack routing + catalog endpoints (2026-08-10).
// These power the intent-first front door and the pack picker. Read-only + no
// mutation, additive, fail-safe. Behind the global /api auth guard like everything else.
import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { routeIdea } from '../starterPacks/packRouter.js';
import { packCatalog, packDetail } from '@shared/packBlueprints';

export function registerPackRoutes(app: Express) {
  // GET /api/packs/catalog — deep packs with tier + counts (picker cards + peek).
  app.get('/api/packs/catalog', (_req: Request, res: Response) => {
    res.json({ packs: packCatalog() });
  });

  // GET /api/packs/:packId — full "inside a pack" detail (team by department,
  // frameworks, documents, plan by stage). 404 for legacy/unknown packs.
  app.get('/api/packs/:packId', (req: Request, res: Response) => {
    const detail = packDetail(req.params.packId);
    if (!detail) return res.status(404).json({ error: 'no deep pack for that id' });
    res.json({ pack: detail });
  });

  // POST /api/packs/route — { idea } → recommend a curated pack, assemble a custom
  // team + plan when none fits, or ask to clarify. Never dead-ends.
  app.post('/api/packs/route', (req: Request, res: Response) => {
    const parsed = z.object({ idea: z.string().max(500).optional() }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid body' });
    }
    res.json(routeIdea(parsed.data.idea ?? ''));
  });
}
