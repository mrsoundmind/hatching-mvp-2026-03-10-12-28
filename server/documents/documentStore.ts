// Storage glue for the document round-trip editor. Original bytes live on conversation_documents
// (raw_bytes); edited outputs live on conversation_edited_documents so the in-chat Download button is
// durable. Raw SQL (these tables are outside Drizzle by design). All fail loudly to the caller — the
// route wraps them.
import { pool } from '../db.js';

export interface OriginalDocument {
  documentId: string;
  filename: string;
  mime: string | null;
  buffer: Buffer;
  projectId: string | null;
  conversationId: string | null;
}

// Fetch an uploaded document's ORIGINAL bytes (for editing). Returns null if missing or bytes weren't kept.
export async function getOriginalDocument(documentId: string): Promise<OriginalDocument | null> {
  const r = await pool.query(
    `SELECT id, filename, mime, raw_bytes, project_id, conversation_id
       FROM conversation_documents WHERE id = $1`,
    [documentId],
  );
  const row = r.rows[0];
  if (!row || !row.raw_bytes) return null;
  return {
    documentId: row.id,
    filename: row.filename,
    mime: row.mime ?? null,
    buffer: Buffer.from(row.raw_bytes),
    projectId: row.project_id ?? null,
    conversationId: row.conversation_id ?? null,
  };
}

export interface StoreEditedInput {
  projectId: string | null;
  conversationId: string | null;
  sourceDocumentId: string | null;
  filename: string;
  mime: string;
  bytes: Buffer;
  createdByUserId?: string | null;
}

export async function storeEditedDocument(input: StoreEditedInput): Promise<string> {
  const r = await pool.query(
    `INSERT INTO conversation_edited_documents
       (project_id, conversation_id, source_document_id, filename, mime, bytes, size_bytes, created_by_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [
      input.projectId,
      input.conversationId,
      input.sourceDocumentId,
      input.filename,
      input.mime,
      input.bytes,
      input.bytes.length,
      input.createdByUserId ?? null,
    ],
  );
  return r.rows[0].id as string;
}

export interface EditedDocument {
  id: string;
  filename: string;
  mime: string | null;
  buffer: Buffer;
  conversationId: string | null;
}

export async function getEditedDocument(editedId: string): Promise<EditedDocument | null> {
  const r = await pool.query(
    `SELECT id, filename, mime, bytes, conversation_id FROM conversation_edited_documents WHERE id = $1`,
    [editedId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    filename: row.filename,
    mime: row.mime ?? null,
    buffer: Buffer.from(row.bytes),
    conversationId: row.conversation_id ?? null,
  };
}
