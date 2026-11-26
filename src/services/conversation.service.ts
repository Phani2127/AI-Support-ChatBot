import { pool } from "../config/database.js";

export interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "assistant";
  content: string;
  created_at: Date;
}

// Create a new conversation
export async function createConversation(): Promise<number> {
  const result = await pool.query(
    `INSERT INTO conversations DEFAULT VALUES
     RETURNING id`
  );

  return result.rows[0].id;
}

// Check whether a conversation exists
export async function conversationExists(
  conversationId: number
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM conversations WHERE id = $1`,
    [conversationId]
  );

  return (result.rowCount ?? 0) > 0;
}

// Save a message in an existing conversation
export async function saveMessage(
  conversationId: number,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  await pool.query(
    `INSERT INTO messages (conversation_id, role, content)
     VALUES ($1, $2, $3)`,
    [conversationId, role, content]
  );

  // Update the conversation's last activity time
  await pool.query(
    `UPDATE conversations
     SET updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [conversationId]
  );
}

// Retrieve last 10 messages in a conversation
export async function getConversationHistory(
  conversationId: number
): Promise<Message[]> {
  const result = await pool.query(
    `SELECT
       id,
       conversation_id,
       role,
       content,
       created_at
     FROM (
       SELECT
         id,
         conversation_id,
         role,
         content,
         created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY id DESC
       LIMIT 10
     ) recent_messages
     ORDER BY id ASC`,
    [conversationId]
  );

  return result.rows as Message[];
}

// Save or update a conversation summary
export async function saveConversationSummary(
  conversationId: number,
  summary: string
): Promise<void> {
  await pool.query(
    `UPDATE conversations
     SET summary = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [summary, conversationId]
  );
}

// Retrieve a conversation summary
export async function getConversationSummary(
  conversationId: number
): Promise<string | null> {
  const result = await pool.query(
    `SELECT summary
     FROM conversations
     WHERE id = $1`,
    [conversationId]
  );

  return result.rows[0]?.summary ?? null;
}
// Number of most recent messages kept verbatim (never summarized/deleted)
export const KEEP_RECENT_MESSAGES = Number(process.env.KEEP_RECENT_MESSAGES ?? 10);
// Minimum number of older messages needed before a summary is generated
export const SUMMARY_MIN_MESSAGES = Number(process.env.SUMMARY_MIN_MESSAGES ?? 10);

export async function getMessagesToSummarize(
  conversationId: number
): Promise<Message[]> {
  const result = await pool.query(
    `SELECT id, conversation_id, role, content, created_at
     FROM messages
     WHERE conversation_id = $1
       AND id NOT IN (
         SELECT id
         FROM messages
         WHERE conversation_id = $1
         ORDER BY id DESC
         LIMIT $2
       )
     ORDER BY id ASC`,
    [conversationId, KEEP_RECENT_MESSAGES]
  );

  return result.rows as Message[];
}
export async function deleteSummarizedMessages(
  conversationId: number,
  messageIds: number[]
): Promise<void> {
  if (messageIds.length === 0) return;

  await pool.query(
    `DELETE FROM messages
     WHERE conversation_id = $1
       AND id = ANY($2::bigint[])`,
    [conversationId, messageIds]
  );
}