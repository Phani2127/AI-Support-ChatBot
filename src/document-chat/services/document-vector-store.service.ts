import { Document } from "@langchain/core/documents";
import { PGVectorStore } from "@langchain/pgvector";
import { getDatabaseConfig } from "../../config/database.js";
import {
  EMBEDDING_DIMENSIONS,
  documentEmbeddings,
  queryEmbeddings,
} from "./langchain.models.js";

const TABLE_NAME = "document_vectors";

let storePromise: Promise<PGVectorStore> | null = null;

/**
 * The LangChain pgvector store (created on first use, including the table).
 * It owns its own small connection pool, closed by closeDocumentVectorStore().
 * It embeds search queries with the query model; documents are embedded
 * separately with the document model (see addDocumentChunks).
 */
function getStore(): Promise<PGVectorStore> {
  storePromise ??= PGVectorStore.initialize(queryEmbeddings, {
    postgresConnectionOptions: { ...getDatabaseConfig(), max: 3 },
    tableName: TABLE_NAME,
    dimensions: EMBEDDING_DIMENSIONS,
    distanceStrategy: "cosine",
  }).catch((error) => {
    storePromise = null; // allow a retry on the next call
    throw error;
  });

  return storePromise;
}

/** Embed and store a document's chunks, replacing any previous vectors for it. */
export async function addDocumentChunks(
  documentId: number,
  chunks: Document[]
): Promise<void> {
  const store = await getStore();

  // A retried job must not leave duplicates behind.
  await store.delete({ filter: { document_id: documentId } });

  const vectors = await documentEmbeddings.embedDocuments(
    chunks.map((chunk) => chunk.pageContent)
  );

  await store.addVectors(
    vectors,
    chunks.map(
      (chunk, chunkIndex) =>
        new Document({
          pageContent: chunk.pageContent,
          // Keep metadata small: loaders attach large per-file info blocks we don't need.
          metadata: {
            document_id: documentId,
            chunk_index: chunkIndex,
            ...(chunk.metadata.sheet ? { sheet: chunk.metadata.sheet } : {}),
          },
        })
    )
  );
}

export async function deleteDocumentVectors(documentId: number): Promise<void> {
  const store = await getStore();
  await store.delete({ filter: { document_id: documentId } });
}

/** The chunks most similar to the query, limited to the given documents. */
export async function searchDocumentChunks(
  query: string,
  documentIds: number[],
  k: number
): Promise<Document[]> {
  if (documentIds.length === 0) return [];

  const store = await getStore();
  console.log("Creating embedding for rewritten question:", query);
  return store.similaritySearch(query, k, { document_id: { in: documentIds } });
}

/** Release the store's connections. Safe to call if it was never opened. */
export async function closeDocumentVectorStore(): Promise<void> {
  if (!storePromise) return;

  const store = await storePromise.catch(() => null);
  storePromise = null;
  await store?.end();
}
