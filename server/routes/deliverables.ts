import type { Express, Request } from 'express';
import { storage } from '../storage.js';
import { z } from 'zod';

export interface RegisterDeliverableDeps {
  broadcastToConversation: (conversationId: string, data: unknown) => void;
}

const createDeliverableSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  type: z.enum([
    "prd", "tech-spec", "design-brief", "gtm-plan", "user-stories",
    "blog-post", "landing-copy", "content-calendar", "email-sequence",
    "seo-brief", "project-plan", "competitive-analysis", "market-research",
    "process-doc", "data-report", "custom"
  ]),
  content: z.string().default(""),
  agentId: z.string().optional(),
  agentName: z.string().optional(),
  agentRole: z.string().optional(),
  parentDeliverableId: z.string().optional(),
  packageId: z.string().optional(),
  handoffNotes: z.string().optional(),
  conversationId: z.string().optional(),
});

const updateDeliverableSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  content: z.string().optional(),
  status: z.enum(["draft", "in_review", "complete"]).optional(),
  handoffNotes: z.string().optional(),
});

export function registerDeliverableRoutes(app: Express, deps: RegisterDeliverableDeps): void {
  const getSessionUserId = (req: Request): string => (req.session as any).userId as string;

  const getOwnedProject = async (projectId: string, userId: string) => {
    const project = await storage.getProject(projectId);
    if (!project) return null;
    return (project as any).userId === userId ? project : null;
  };

  // GET /api/projects/:projectId/deliverables
  app.get('/api/projects/:projectId/deliverables', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const project = await getOwnedProject(req.params.projectId, userId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const deliverables = await storage.getDeliverablesByProject(project.id);
    return res.json({ deliverables });
  });

  // GET /api/deliverables/:id
  app.get('/api/deliverables/:id', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const deliverable = await storage.getDeliverable(req.params.id);
    if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });

    const project = await getOwnedProject(deliverable.projectId, userId);
    if (!project) return res.status(404).json({ error: 'Deliverable not found' });

    return res.json({ deliverable });
  });

  // POST /api/deliverables
  app.post('/api/deliverables', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parsed = createDeliverableSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });

    const project = await getOwnedProject(parsed.data.projectId, userId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const deliverable = await storage.createDeliverable(parsed.data);
    return res.status(201).json({ deliverable });
  });

  // PATCH /api/deliverables/:id
  app.patch('/api/deliverables/:id', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const deliverable = await storage.getDeliverable(req.params.id);
    if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });

    const project = await getOwnedProject(deliverable.projectId, userId);
    if (!project) return res.status(404).json({ error: 'Deliverable not found' });

    const parsed = updateDeliverableSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });

    // If content changed, create a new version
    if (parsed.data.content && parsed.data.content !== deliverable.content) {
      const versions = await storage.getDeliverableVersions(deliverable.id);
      const nextVersion = versions.length + 1;
      await storage.createDeliverableVersion({
        deliverableId: deliverable.id,
        versionNumber: nextVersion,
        content: parsed.data.content,
        changeDescription: `Updated to v${nextVersion}`,
        createdByAgentId: deliverable.agentId,
      });
      parsed.data.content = parsed.data.content;
      (parsed.data as any).currentVersion = nextVersion;
    }

    const updated = await storage.updateDeliverable(req.params.id, parsed.data);
    return res.json({ deliverable: updated });
  });

  // DELETE /api/deliverables/:id
  app.delete('/api/deliverables/:id', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const deliverable = await storage.getDeliverable(req.params.id);
    if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });

    const project = await getOwnedProject(deliverable.projectId, userId);
    if (!project) return res.status(404).json({ error: 'Deliverable not found' });

    await storage.deleteDeliverable(req.params.id);
    return res.status(204).send();
  });

  // GET /api/deliverables/:id/versions
  app.get('/api/deliverables/:id/versions', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const deliverable = await storage.getDeliverable(req.params.id);
    if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });

    const project = await getOwnedProject(deliverable.projectId, userId);
    if (!project) return res.status(404).json({ error: 'Deliverable not found' });

    const versions = await storage.getDeliverableVersions(req.params.id);
    return res.json({ versions });
  });

  // POST /api/deliverables/:id/restore
  app.post('/api/deliverables/:id/restore', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const deliverable = await storage.getDeliverable(req.params.id);
    if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });

    const project = await getOwnedProject(deliverable.projectId, userId);
    if (!project) return res.status(404).json({ error: 'Deliverable not found' });

    const { versionNumber } = z.object({ versionNumber: z.number().int().min(1) }).parse(req.body);

    const restored = await storage.restoreDeliverableVersion(req.params.id, versionNumber);
    if (!restored) return res.status(404).json({ error: 'Version not found' });

    return res.json({ deliverable: restored });
  });

  // GET /api/deliverables/:id/download
  app.get('/api/deliverables/:id/download', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const deliverable = await storage.getDeliverable(req.params.id);
    if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });

    const project = await getOwnedProject(deliverable.projectId, userId);
    if (!project) return res.status(404).json({ error: 'Deliverable not found' });

    const filename = `${deliverable.title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-')}.md`;
    const header = `# ${deliverable.title}\n\n*Written by ${deliverable.agentName || 'Agent'} (${deliverable.agentRole || 'Team Member'})* | *Status: ${deliverable.status}*\n\n---\n\n`;
    const content = header + deliverable.content;

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(content);
  });

  // GET /api/deliverables/:id/download/pdf — branded PDF export
  app.get('/api/deliverables/:id/download/pdf', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const deliverable = await storage.getDeliverable(req.params.id);
    if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });

    const project = await getOwnedProject(deliverable.projectId, userId);
    if (!project) return res.status(404).json({ error: 'Deliverable not found' });

    try {
      const { generateDeliverablePDF } = await import('../ai/pdfExport.js');
      const pdfBuffer = await generateDeliverablePDF(deliverable);
      const filename = `${deliverable.title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-')}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      return res.send(pdfBuffer);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'PDF generation failed' });
    }
  });

  // POST /api/deliverables/generate — create a deliverable via LLM
  app.post('/api/deliverables/generate', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parsed = z.object({
      projectId: z.string().min(1),
      agentId: z.string().min(1),
      type: z.string().min(1),
      title: z.string().min(1).max(500),
      description: z.string().max(2000).optional(),
      context: z.string().max(10000).optional(),
      parentDeliverableId: z.string().optional(),
      packageId: z.string().optional(),
      conversationId: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });

    const project = await getOwnedProject(parsed.data.projectId, userId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Look up agent
    const agent = await storage.getAgent(parsed.data.agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    try {
      const { generateDeliverable } = await import('../ai/deliverableGenerator.js');
      const result = await generateDeliverable({
        ...parsed.data,
        agentName: agent.name,
        agentRole: agent.role,
      });

      // Broadcast to conversation if available
      if (parsed.data.conversationId) {
        deps.broadcastToConversation(parsed.data.conversationId, {
          type: 'deliverable_created',
          deliverable: result.deliverable,
          generationTimeMs: result.generationTimeMs,
        });
      }

      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Generation failed' });
    }
  });

  // POST /api/deliverables/:id/iterate — update deliverable based on user feedback
  app.post('/api/deliverables/:id/iterate', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const deliverable = await storage.getDeliverable(req.params.id);
    if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });

    const project = await getOwnedProject(deliverable.projectId, userId);
    if (!project) return res.status(404).json({ error: 'Deliverable not found' });

    const { instruction } = z.object({ instruction: z.string().min(1).max(2000) }).parse(req.body);

    try {
      const { iterateDeliverable } = await import('../ai/deliverableGenerator.js');
      const result = await iterateDeliverable(
        req.params.id,
        instruction,
        deliverable.agentName || 'Agent',
        deliverable.agentRole || 'Team Member',
      );
      // Phase 36 — response shape grows to include the rubric verdict so the
      // client (ArtifactPanel in 36-03) can render the AutoRevertBanner without
      // a second round-trip. Schema in shared/dto/apiSchemas.ts.
      return res.json({
        deliverable: result.deliverable,
        reverted: result.reverted,
        oldScore: result.oldScore,
        newScore: result.newScore,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Iteration failed' });
    }
  });

  // POST /api/deliverables/:id/reader-test — Phase 39 (READ-01/03/04) manual fresh-reader re-run.
  // Reviews the CURRENT version through a context-blind reviewer and persists annotations onto it.
  // Used after a revision to check the fix landed (the auto-run already covers first generation).
  app.post('/api/deliverables/:id/reader-test', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const deliverable = await storage.getDeliverable(req.params.id);
    if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });

    const project = await getOwnedProject(deliverable.projectId, userId);
    if (!project) return res.status(404).json({ error: 'Deliverable not found' });

    try {
      const { reviewDeliverableForReaderTest } = await import('../ai/deliverableGenerator.js');
      const outcome = await reviewDeliverableForReaderTest(req.params.id);
      // 200 with reviewed:false when the type isn't reader-facing or the reviewer was unavailable —
      // this is a normal, non-error outcome the client renders as "reader test not available".
      return res.json({
        reviewed: outcome.reviewed,
        readerTest: outcome.result
          ? {
              annotations: outcome.result.annotations,
              readableWithoutContext: outcome.result.readableWithoutContext,
              summary: outcome.result.summary,
              reviewerModel: outcome.result.reviewerModel,
            }
          : null,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Reader test failed' });
    }
  });

  // === Phase 36 — Feedback endpoints (FBK-02, FBK-03) ===
  // All three follow the existing getSessionUserId + getOwnedProject pattern.
  // 404 (not 403) on ownership mismatch so the user can't infer the existence
  // of a deliverable they don't own (T-36-14).

  // POST /api/deliverables/:id/accept (FBK-02 / D-18)
  app.post('/api/deliverables/:id/accept', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const deliverable = await storage.getDeliverable(req.params.id);
    if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });

    const project = await getOwnedProject(deliverable.projectId, userId);
    if (!project) return res.status(404).json({ error: 'Deliverable not found' });

    // Idempotent: re-accepting an already-accepted deliverable just refreshes
    // the timestamp. Mutually exclusive: clears dismissedAt per D-18.
    const updated = await storage.acceptDeliverable(req.params.id);
    return res.json({ deliverable: updated });
  });

  // POST /api/deliverables/:id/dismiss (FBK-02 / D-18)
  app.post('/api/deliverables/:id/dismiss', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const deliverable = await storage.getDeliverable(req.params.id);
    if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });

    const project = await getOwnedProject(deliverable.projectId, userId);
    if (!project) return res.status(404).json({ error: 'Deliverable not found' });

    const updated = await storage.dismissDeliverable(req.params.id);
    return res.json({ deliverable: updated });
  });

  // POST /api/deliverables/:id/impression (FBK-03 / D-20)
  // 5s server-side dedupe per (id, userId) lives in storage.recordImpression
  // — protects against React StrictMode double-mount in dev (Pitfall 4) and
  // multi-tab DoS (T-36-15). Always returns 200 with `deduped` flag so client
  // treats idempotent semantics identically.
  app.post('/api/deliverables/:id/impression', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const deliverable = await storage.getDeliverable(req.params.id);
    if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });

    const project = await getOwnedProject(deliverable.projectId, userId);
    if (!project) return res.status(404).json({ error: 'Deliverable not found' });

    const result = await storage.recordImpression(req.params.id, userId);
    return res.json({ deliverable: result.deliverable, deduped: result.deduped });
  });

  // === Packages ===

  // GET /api/projects/:projectId/packages
  app.get('/api/projects/:projectId/packages', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const project = await getOwnedProject(req.params.projectId, userId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const packages = await storage.getPackagesByProject(project.id);
    return res.json({ packages });
  });

  // POST /api/packages
  app.post('/api/packages', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parsed = z.object({
      projectId: z.string().min(1),
      name: z.string().min(1).max(200),
      template: z.enum(["launch", "content-sprint", "research", "custom"]),
      description: z.string().max(1000).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });

    const project = await getOwnedProject(parsed.data.projectId, userId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const pkg = await storage.createPackage(parsed.data);

    // If template is not custom, start chain execution in background
    if (parsed.data.template !== 'custom') {
      // Fire and forget — chain runs async, results stream via WS
      (async () => {
        try {
          const { executeDeliverableChain } = await import('../ai/deliverableChainOrchestrator.js');
          // Find project conversation for progress broadcasts
          const convs = await storage.getConversationsByProject(project.id);
          const projectConvId = convs.find(c => c.type === 'project')?.id;
          const result = await executeDeliverableChain(
            project.id,
            pkg.id,
            parsed.data.template,
            project.description || project.name,
            undefined,
            (progress) => {
              // Broadcast per-step progress to the project conversation
              if (projectConvId) {
                deps.broadcastToConversation(projectConvId, {
                  type: progress.status === 'started' ? 'background_execution_started' : 'background_execution_completed',
                  packageId: pkg.id,
                  step: progress.step,
                  totalSteps: progress.totalSteps,
                  agentName: progress.agentName,
                  agentRole: progress.agentRole,
                  deliverableType: progress.type,
                  deliverableTitle: progress.title,
                  deliverableId: progress.deliverableId,
                  status: progress.status,
                  reason: progress.reason,
                });
              }
            },
          );
          // Broadcast completion
          if (projectConvId) {
            deps.broadcastToConversation(projectConvId, {
              type: 'package_complete',
              packageId: pkg.id,
              packageName: parsed.data.name,
              deliverableCount: result.deliverables.length,
              skippedSteps: result.skippedSteps,
              totalTimeMs: result.totalTimeMs,
            });
          }
        } catch (err) {
          console.error('[Chain] Package chain execution failed:', err);
        }
      })();
    }

    return res.status(201).json({ package: pkg });
  });

  // GET /api/deliverables/:id/downstream — get linked downstream deliverables
  app.get('/api/deliverables/:id/downstream', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const deliverable = await storage.getDeliverable(req.params.id);
    if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });

    const project = await getOwnedProject(deliverable.projectId, userId);
    if (!project) return res.status(404).json({ error: 'Deliverable not found' });

    const { getDownstreamDeliverables } = await import('../ai/deliverableChainOrchestrator.js');
    const downstream = await getDownstreamDeliverables(req.params.id);
    return res.json({ downstream });
  });
}
