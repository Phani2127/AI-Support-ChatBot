import fs from "node:fs/promises";
import { pool } from "../../config/database.js";
import { deleteDocumentVectors } from "./document-vector-store.service.js";

async function removeFile(filePath: string | null): Promise<void> {
  if (!filePath) return;

  await fs.unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") {
      console.error("Failed to delete uploaded file:", error);
    }
  });
}

export async function getConversationDocuments(conversationId: number) {
  const result = await pool.query(
    `SELECT
       d.id,
       d.file_name,
       d.file_type,
       d.file_size,
       d.status,
       d.created_at
     FROM documents d
     JOIN conversation_documents cd
       ON cd.document_id = d.id
     WHERE cd.conversation_id = $1
     ORDER BY d.created_at DESC`,
    [conversationId]
  );

  return result.rows;
}

/** Delete a document (chunks cascade) and its stored file. False if not in this conversation. */
export async function deleteConversationDocument(
  conversationId: number,
  documentId: number
): Promise<boolean> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT d.file_path
       FROM documents d
       JOIN conversation_documents cd
         ON cd.document_id = d.id
       WHERE cd.conversation_id = $1
         AND d.id = $2
       FOR UPDATE OF d`,
      [conversationId, documentId]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    const filePath: string | null = result.rows[0].file_path;

    await client.query(`DELETE FROM documents WHERE id = $1`, [documentId]);
    await client.query("COMMIT");

    // Vectors live in LangChain's table (no foreign key), so remove them explicitly.
    await deleteDocumentVectors(documentId).catch((error) =>
      console.error("Failed to delete document vectors:", error)
    );

    // Remove the physical file only after the database commit.
    await removeFile(filePath);

    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Clean up after a failed upload: drop the record (if created) and the stored file. */
export async function discardFailedUpload(
  filePath: string | undefined,
  documentId: number | undefined
): Promise<void> {
  await removeFile(filePath ?? null);

  if (documentId !== undefined) {
    await pool.query(`DELETE FROM documents WHERE id = $1`, [documentId]);
    await deleteDocumentVectors(documentId).catch(() => {});
  }
}
