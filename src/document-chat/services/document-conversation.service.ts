import { pool } from "../../config/database.js";

export interface DocumentMessage {
  role: "user" | "assistant";
  content: string;
}

export async function createDocumentConversation(
  title?: string
): Promise<number> {
  const result = await pool.query(
    `INSERT INTO document_conversations (title)
     VALUES ($1)
     RETURNING id`,
    [title || "New document conversation"]
  );

  return result.rows[0].id;
}

export async function documentConversationExists(
  conversationId: number
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM document_conversations
     WHERE id = $1`,
    [conversationId]
  );

  return (result.rowCount ?? 0) > 0;
}

/** Past conversations (newest first) that have documents, with their file names. */
export async function listDocumentConversations(limit: number = 30) {
  const result = await pool.query(
    `SELECT
       c.id,
       c.title,
       COALESCE(
         (SELECT json_agg(d.file_name ORDER BY d.id)
          FROM conversation_documents cd
          JOIN documents d ON d.id = cd.document_id
          WHERE cd.conversation_id = c.id),
         '[]'::json
       ) AS file_names
     FROM document_conversations c
     WHERE EXISTS (SELECT 1 FROM conversation_documents cd WHERE cd.conversation_id = c.id)
     ORDER BY c.id DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows as { id: number; title: string; file_names: string[] }[];
}

export async function saveDocumentMessage(
  conversationId: number,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  await pool.query(
    `INSERT INTO document_messages (conversation_id, role, content)
     VALUES ($1, $2, $3)`,
    [conversationId, role, content]
  );

  await pool.query(
    `UPDATE document_conversations
     SET updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [conversationId]
  );
}

/** The most recent `limit` messages, oldest first. */
export async function getDocumentMessages(
  conversationId: number,
  limit: number = 50
): Promise<DocumentMessage[]> {
  const result = await pool.query(
    `SELECT role, content
     FROM (
       SELECT id, role, content
       FROM document_messages
       WHERE conversation_id = $1
       ORDER BY id DESC
       LIMIT $2
     ) recent_messages
     ORDER BY id ASC`,
    [conversationId, limit]
  );

  return result.rows as DocumentMessage[];
}
