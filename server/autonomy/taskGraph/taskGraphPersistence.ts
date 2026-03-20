/**
 * Thin persistence wrappers for the task graph.
 * Pure task graph logic stays in taskGraphEngine.ts unchanged.
 */

import type { IStorage } from '../../storage.js';

/**
 * Persists a task graph for a project by storing it in executionRules.taskGraph.
 */
export async function persistTaskGraph(
  projectId: string,
  graph: unknown,
  storage: IStorage,
): Promise<void> {
  const project = await storage.getProject(projectId);
  const existing = (project?.executionRules as any) ?? {};
  await storage.updateProject(projectId, { executionRules: { ...existing, taskGraph: graph } } as any);
}

/**
 * Loads the task graph for a project from executionRules.taskGraph.
 * Returns null if no graph has been stored yet.
 */
export async function loadTaskGraph(
  projectId: string,
  storage: IStorage,
): Promise<unknown | null> {
  const project = await storage.getProject(projectId);
  return (project?.executionRules as any)?.taskGraph ?? null;
}
