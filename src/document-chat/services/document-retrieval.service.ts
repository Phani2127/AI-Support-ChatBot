import { pool } from "../../config/database.js";
import { searchDocumentChunks } from "./document-vector-store.service.js";

export interface RetrievedChunk {
  document_id: number;
  file_name: string;
  chunk_index: number;
  content: string;
}

const TOP_K = 5;

/** Completed documents attached to the conversation (id → original file name). */
async function getSearchableDocuments(
  conversationId: number
): Promise<Map<number, string>> {
  const result = await pool.query(
    `SELECT d.id, d.file_name
     FROM documents d
     JOIN conversation_documents cd
       ON cd.document_id = d.id
     WHERE cd.conversation_id = $1
       AND d.status = 'completed'`,
    [conversationId]
  );

  return new Map(result.rows.map((row) => [Number(row.id), row.file_name as string]));
}

/** The chunks most similar to the question, across the conversation's completed documents. */
export async function retrieveDocumentChunks(
  conversationId: number,
  question: string
): Promise<RetrievedChunk[]> {
  const documents = await getSearchableDocuments(conversationId);

  const matches = await searchDocumentChunks(
    question,
    [...documents.keys()],
    TOP_K
  );

  return matches.map((match) => {
    const documentId = Number(match.metadata.document_id);

    return {
      document_id: documentId,
      file_name: documents.get(documentId) ?? "document",
      chunk_index: Number(match.metadata.chunk_index),
      content: match.pageContent,
    };
  });
}
