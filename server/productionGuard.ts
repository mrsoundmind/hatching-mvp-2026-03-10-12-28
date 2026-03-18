/**
 * Production safety guard for storage mode.
 *
 * Prevents silent data loss when the server runs with in-memory storage
 * in a production environment. Exported separately for testability.
 */
export function assertProductionStorageMode(nodeEnv?: string, storageMode?: string): void {
  if (nodeEnv === 'production' && storageMode !== 'db') {
    throw new Error(
      'FATAL: Production requires STORAGE_MODE=db to prevent silent in-memory data loss. ' +
      'Set STORAGE_MODE=db in your environment variables.'
    );
  }
}
