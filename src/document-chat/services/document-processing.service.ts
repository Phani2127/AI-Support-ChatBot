import { pool } from "../../config/database.js";
import { extractDocuments } from "./document-extraction.service.js";
import { splitDocumentsIntoChunks } from "./document-chunk.service.js";
import {
  addDocumentChunks,
  deleteDocumentVectors,
} from "./document-vector-store.service.js";

export async function processDocument(
  documentId: number,
  filePath: string,
  fileType: string,
): Promise<void> {
  try {
    await pool.query(
      `UPDATE documents
       SET status = 'processing'
       WHERE id = $1`,
      [documentId],
    );

    const documents = await extractDocuments(filePath, fileType);
    const chunks = await splitDocumentsIntoChunks(documents);

    if (chunks.length === 0) {
      throw new Error("No text chunks were generated.");
    }

    // console.log("documents", documents);
    // console.log("chunks", chunks);
    await addDocumentChunks(documentId, chunks);

    await pool.query(
      `UPDATE documents
       SET status = 'completed'
       WHERE id = $1`,
      [documentId],
    );
  } catch (error) {
    console.error("Document processing failed:", error);

    // Drop partial chunks. The status stays 'processing' here: the queue may
    // retry, and the worker calls markDocumentFailed() after the last attempt.
    await deleteDocumentVectors(documentId).catch((cleanupError) =>
      console.error("Failed to clean up vectors:", cleanupError),
    );

    throw error;
  }
}

/** Final failure (no more retries): lets the UI show the document as failed. */
export async function markDocumentFailed(documentId: number): Promise<void> {
  await pool.query(
    `UPDATE documents
     SET status = 'failed'
     WHERE id = $1`,
    [documentId],
  );
}
