import { Document } from "@langchain/core/documents";
import { PGVectorStore } from "@langchain/pgvector";
import { getDatabaseConfig, pool } from "../../config/database.js";
import {
  EMBEDDING_DIMENSIONS,
  documentEmbeddings,
  queryEmbeddings,
} from "./langchain.models.js";

const TABLE_NAME = "document_vectors";
const RRF_RANK_CONSTANT = 60;

let storePromise: Promise<PGVectorStore> | null = null;

export interface SearchThresholds {
  vectorMaxDistance: number;
  keywordMinRank: number;
}

function readThreshold(
  name: string,
  defaultValue: number,
  maximum?: number
): number {
  const rawValue = process.env[name];
  if (rawValue === undefined) return defaultValue;

  const value = Number(rawValue);
  if (
    rawValue.trim() === "" ||
    !Number.isFinite(value) ||
    value < 0 ||
    (maximum !== undefined && value > maximum)
  ) {
    const range = maximum === undefined ? "non-negative" : `between 0 and ${maximum}`;
    throw new Error(`${name} must be a ${range} number.`);
  }

  return value;
}

function getSearchThresholds(): SearchThresholds {
  return {
    vectorMaxDistance: readThreshold("VECTOR_MAX_DISTANCE", 0.4, 2),
    keywordMinRank: readThreshold("KEYWORD_MIN_RANK", 0.01),
  };
}

/**
 * The LangChain pgvector store (created on first use, including the table).
 * It owns its own small connection pool, closed by closeDocumentVectorStore().
 * Search combines query embeddings with PostgreSQL full-text ranking;
 * document chunks are embedded separately with the document model.
 */
function getStore(): Promise<PGVectorStore> {
  storePromise ??= PGVectorStore.initialize(queryEmbeddings, {
    postgresConnectionOptions: { ...getDatabaseConfig(), max: 3 },
    tableName: TABLE_NAME,
    dimensions: EMBEDDING_DIMENSIONS,
    distanceStrategy: "cosine",
  }).then(async (store) => {
    try {
      await pool.query(
        `CREATE INDEX IF NOT EXISTS document_vectors_text_search_idx
         ON ${TABLE_NAME}
         USING GIN (to_tsvector('english', text))`
      );
      return store;
    } catch (error) {
      await store.end();
      throw error;
    }
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

/** Combine semantic and keyword rankings, limited to the given documents. */
export async function searchDocumentChunks(
  query: string,
  documentIds: number[],
  k: number
): Promise<Document[]> {
  if (documentIds.length === 0 || k <= 0) return [];

  const thresholds = getSearchThresholds();
  await getStore();
  console.log("Creating embedding for rewritten question:", query);
  const embedding = await queryEmbeddings.embedQuery(query);
  return searchDocumentChunksWithEmbedding(
    query,
    documentIds,
    k,
    embedding,
    thresholds
  );
}

/** Search with an already-created query vector, keeping threshold and RRF logic together. */
export async function searchDocumentChunksWithEmbedding(
  query: string,
  documentIds: number[],
  k: number,
  embedding: number[],
  thresholds: SearchThresholds = getSearchThresholds()
): Promise<Document[]> {
  if (documentIds.length === 0 || k <= 0) return [];
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error("Invalid query embedding dimensions");
  }

  await getStore();
  const candidateLimit = k * 3;

  const result = await pool.query<{
    vector_matches: Array<{
      id: string;
      text: string;
      metadata: Record<string, unknown>;
      distance: number;
      rank: number;
    }>;
    keyword_matches: Array<{
      id: string;
      text: string;
      metadata: Record<string, unknown>;
      relevance: number;
      rank: number;
    }>;
    keyword_matches_before_threshold: Array<{
      id: string;
      text: string;
      metadata: Record<string, unknown>;
      relevance: number;
      raw_rank: number;
    }>;
    combined_matches: Array<{
      id: string;
      text: string;
      metadata: Record<string, unknown>;
      vector_rank: number | null;
      keyword_rank: number | null;
      score: number;
    }>;
  }>(
    `WITH vector_scored AS (
       SELECT
         id,
         text,
         metadata,
         embedding <=> $1::vector AS distance
       FROM ${TABLE_NAME}
       WHERE metadata->>'document_id' = ANY($2::text[])
     ),
     vector_candidates AS (
       SELECT
         id,
         text,
         metadata,
         distance,
         ROW_NUMBER() OVER (ORDER BY distance ASC, id ASC) AS rank
       FROM vector_scored
       WHERE distance <= $4
       ORDER BY distance ASC, id ASC
       LIMIT $3
     ),
     keyword_query AS (
       SELECT CASE
         WHEN POSITION('!' IN parsed_query.query::text) > 0
           THEN parsed_query.query
         ELSE REGEXP_REPLACE(
           parsed_query.query::text,
           ' & ',
           ' | ',
           'g'
         )::tsquery
       END AS partial_query
       FROM (
         SELECT websearch_to_tsquery('english', $5) AS query
       ) parsed_query
     ),
     keyword_scored AS (
       SELECT
         id,
         text,
         metadata,
         ts_rank_cd(
           to_tsvector('english', text),
           keyword_query.partial_query
         ) AS relevance
       FROM ${TABLE_NAME}
       CROSS JOIN keyword_query
       WHERE metadata->>'document_id' = ANY($2::text[])
         AND to_tsvector('english', text)
           @@ keyword_query.partial_query
     ),
     keyword_before_threshold AS (
       SELECT
         id,
         text,
         metadata,
         relevance,
         ROW_NUMBER() OVER (ORDER BY relevance DESC, id ASC) AS raw_rank
       FROM keyword_scored
       ORDER BY relevance DESC, id ASC
       LIMIT $3
     ),
     keyword_candidates AS (
       SELECT
         id,
         text,
         metadata,
         relevance,
         ROW_NUMBER() OVER (ORDER BY relevance DESC, id ASC) AS rank
       FROM keyword_scored
       WHERE relevance >= $6
       ORDER BY relevance DESC, id ASC
       LIMIT $3
     ),
     fused_candidates AS (
       SELECT
         COALESCE(vector.id, keyword.id) AS id,
         COALESCE(vector.text, keyword.text) AS text,
         COALESCE(vector.metadata, keyword.metadata) AS metadata,
         vector.rank AS vector_rank,
         keyword.rank AS keyword_rank,
         COALESCE(
           1.0 / (${RRF_RANK_CONSTANT} + vector.rank),
           0.0
         ) + COALESCE(
           1.0 / (${RRF_RANK_CONSTANT} + keyword.rank),
           0.0
         ) AS score
       FROM vector_candidates vector
       FULL OUTER JOIN keyword_candidates keyword
         ON vector.id = keyword.id
     ),
     final_results AS (
       SELECT id, text, metadata, vector_rank, keyword_rank, score
       FROM fused_candidates
       ORDER BY score DESC, id
       LIMIT $7
     )
     SELECT
       COALESCE(
         (SELECT json_agg(
           json_build_object(
             'id', id,
             'text', text,
             'metadata', metadata,
             'distance', distance,
             'rank', rank
           ) ORDER BY rank
         ) FROM vector_candidates),
         '[]'::json
       ) AS vector_matches,
       COALESCE(
         (SELECT json_agg(
           json_build_object(
             'id', id,
             'text', text,
             'metadata', metadata,
             'relevance', relevance,
             'rank', rank
           ) ORDER BY rank
         ) FROM keyword_candidates),
         '[]'::json
       ) AS keyword_matches,
       COALESCE(
         (SELECT json_agg(
           json_build_object(
             'id', id,
             'text', text,
             'metadata', metadata,
             'relevance', relevance,
             'raw_rank', raw_rank
           ) ORDER BY raw_rank
         ) FROM keyword_before_threshold),
         '[]'::json
       ) AS keyword_matches_before_threshold,
       COALESCE(
         (SELECT json_agg(
           json_build_object(
             'id', id,
             'text', text,
             'metadata', metadata,
             'vector_rank', vector_rank,
             'keyword_rank', keyword_rank,
             'score', score
           ) ORDER BY score DESC, id
         ) FROM final_results),
         '[]'::json
       ) AS combined_matches`,
    [
      JSON.stringify(embedding),
      documentIds.map(String),
      candidateLimit,
      thresholds.vectorMaxDistance,
      query,
      thresholds.keywordMinRank,
      k,
    ]
  );

  const {
    vector_matches,
    keyword_matches_before_threshold,
    keyword_matches,
    combined_matches,
  } = result.rows[0];
  const preview = (text: string) => text.replace(/\s+/g, " ").slice(0, 180);

  console.log(
    "[hybrid-search] vector matches:",
    vector_matches.map((match) => ({
      id: match.id,
      documentId: match.metadata.document_id,
      chunkIndex: match.metadata.chunk_index,
      distance: match.distance,
      rank: match.rank,
      preview: preview(match.text),
    }))
  );
  console.log(
    `[hybrid-search] keyword matches before threshold (top ${candidateLimit}):`,
    keyword_matches_before_threshold.map((match) => ({
      id: match.id,
      documentId: match.metadata.document_id,
      chunkIndex: match.metadata.chunk_index,
      relevance: match.relevance,
      rawRank: match.raw_rank,
      preview: preview(match.text),
    }))
  );
  console.log(
    "[hybrid-search] keyword matches:",
    keyword_matches.map((match) => ({
      id: match.id,
      documentId: match.metadata.document_id,
      chunkIndex: match.metadata.chunk_index,
      relevance: match.relevance,
      rank: match.rank,
      preview: preview(match.text),
    }))
  );
  console.log(
    "[hybrid-search] RRF combined results:",
    combined_matches.map((match) => ({
      id: match.id,
      documentId: match.metadata.document_id,
      chunkIndex: match.metadata.chunk_index,
      vectorRank: match.vector_rank,
      keywordRank: match.keyword_rank,
      score: match.score,
      preview: preview(match.text),
    }))
  );

  return combined_matches.map(
    (row) =>
      new Document({
        pageContent: row.text,
        metadata: row.metadata,
      })
  );
}

/** Release the store's connections. Safe to call if it was never opened. */
export async function closeDocumentVectorStore(): Promise<void> {
  if (!storePromise) return;

  const store = await storePromise.catch(() => null);
  storePromise = null;
  await store?.end();
}
