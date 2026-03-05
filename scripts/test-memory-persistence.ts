import 'dotenv/config';
import { storage, getStorageModeInfo } from '../server/storage.js';
import { promises as fs } from 'fs';
import path from 'path';

async function ensureProjectConversation(projectId: string): Promise<string> {
  const conversationId = `project:${projectId}`;
  const existing = await storage.getConversationsByProject(projectId);
  if (!existing.find((c) => c.id === conversationId)) {
    await storage.createConversation({
      id: conversationId,
      projectId,
      teamId: null,
      agentId: null,
      type: 'project',
      title: null,
    } as any);
  }
  return conversationId;
}

async function main() {
  const writeOnly = process.argv.includes('--write-only');
  const verifyOnly = process.argv.includes('--verify-only');
  const markerPath = path.join(process.cwd(), 'baseline', 'memory-restart-marker.json');

  if (verifyOnly) {
    const raw = await fs.readFile(markerPath, 'utf8');
    const markerState = JSON.parse(raw) as { conversationId: string; marker: string; projectId: string };
    const conversationMemory = await storage.getConversationMemory(markerState.conversationId);
    const found = conversationMemory.some((entry: any) => typeof entry?.content === 'string' && entry.content.includes(markerState.marker));
    if (!found) {
      throw new Error('restart persistence verification failed: marker not found after fresh process');
    }
    console.log(`[test:memory] RESTART_VERIFY PASS project=${markerState.projectId}`);
    return;
  }

  const projects = await storage.getProjects();
  if (projects.length === 0) {
    throw new Error('no projects available for memory test');
  }

  const projectId = projects[0].id;
  const conversationId = await ensureProjectConversation(projectId);

  const marker = `memory-marker-${Date.now()}`;
  await storage.addConversationMemory(conversationId, 'context', marker, 9);

  await fs.mkdir(path.dirname(markerPath), { recursive: true });
  await fs.writeFile(
    markerPath,
    JSON.stringify({ projectId, conversationId, marker, createdAt: new Date().toISOString() }, null, 2),
    'utf8'
  );

  if (writeOnly) {
    console.log(`[test:memory] RESTART_WRITE PASS project=${projectId}`);
    return;
  }

  const conversationMemory = await storage.getConversationMemory(conversationId);
  const foundConversationMemory = conversationMemory.some((entry: any) => typeof entry?.content === 'string' && entry.content.includes(marker));
  if (!foundConversationMemory) {
    throw new Error('conversation memory write/read failed');
  }

  const projectMemory = await storage.getProjectMemory(projectId);
  const foundProjectMemory = projectMemory.some((entry: any) => typeof entry?.content === 'string' && entry.content.includes(marker));
  if (!foundProjectMemory) {
    throw new Error('project memory aggregate read failed');
  }

  const scopeA = await storage.getConversationMemory(conversationId);
  const otherConversationId = `project:${projectId}-isolation-check`;
  await storage.createConversation({
    id: otherConversationId,
    projectId,
    teamId: null,
    agentId: null,
    type: 'project',
    title: null,
  } as any).catch(() => undefined);
  const scopeB = await storage.getConversationMemory(otherConversationId);
  const leaked = scopeB.some((entry: any) => typeof entry?.content === 'string' && entry.content.includes(marker));
  if (leaked) {
    throw new Error('memory isolation failed across conversations');
  }

  const storageMode = getStorageModeInfo();
  if (!storageMode.durable) {
    console.warn('[test:memory] PARTIAL: durable persistence is disabled in current storage mode');
  }

  console.log(`[test:memory] PASS project=${projectId} durable=${storageMode.durable} recordsA=${scopeA.length} recordsB=${scopeB.length}`);
}

main().catch((error) => {
  console.error('[test:memory] FAIL', error.message);
  process.exit(1);
});
