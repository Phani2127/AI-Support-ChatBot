import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import type { Document } from "@langchain/core/documents";
import type { Pool } from "pg";
import type { SearchThresholds } from "./document-vector-store.service.js";
import { EMBEDDING_DIMENSIONS } from "./langchain.models.js";

type SearchWithEmbedding =
  typeof import("./document-vector-store.service.js")["searchDocumentChunksWithEmbedding"];

const queryEmbedding = vectorWithSimilarity(1);
const fixtureDocumentIds: number[] = [];
let databasePool: Pool | undefined;
let closeVectorStore: (() => Promise<void>) | undefined;
let searchWithEmbedding: SearchWithEmbedding | undefined;
let ids: Record<string, number>;

function vectorWithSimilarity(similarity: number): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  vector[0] = similarity;
  vector[1] = Math.sqrt(1 - similarity * similarity);
  return vector;
}

function newDocumentId(): number {
  const id = 1_000_000_000 + Math.floor(Math.random() * 1_000_000_000);
  fixtureDocumentIds.push(id);
  return id;
}

async function insertChunk(
  documentId: number,
  chunkIndex: number,
  text: string,
  similarity: number
): Promise<void> {
  if (!databasePool) throw new Error("Test database pool was not initialized.");

  const id = randomUUID();
  await databasePool.query(
    `INSERT INTO document_vectors (id, text, metadata, embedding)
     VALUES ($1::uuid, $2, $3::jsonb, $4::vector)`,
    [
      id,
      text,
      JSON.stringify({ document_id: documentId, chunk_index: chunkIndex }),
      `[${vectorWithSimilarity(similarity).join(",")}]`,
    ]
  );
}

async function search(
  query: string,
  documentIds: number[],
  k: number,
  thresholds?: SearchThresholds
): Promise<Document[]> {
  if (!searchWithEmbedding) {
    throw new Error("Hybrid search was not initialized.");
  }

  return searchWithEmbedding(
    query,
    documentIds,
    k,
    queryEmbedding,
    thresholds
  );
}

function idsFor(...keys: string[]): number[] {
  return keys.map((key) => {
    const id = ids[key];
    if (id === undefined) throw new Error(`Missing test document ID: ${key}`);
    return id;
  });
}

describe("hybrid search relevance thresholds", { concurrency: false }, () => {
  before(async () => {
    const database = await import("../../config/database.js");
    const vectorStore = await import("./document-vector-store.service.js");
    databasePool = database.pool;
    closeVectorStore = vectorStore.closeDocumentVectorStore;
    searchWithEmbedding = vectorStore.searchDocumentChunksWithEmbedding;

    ids = {
      both: newDocumentId(),
      weakKeyword: newDocumentId(),
      strongKeyword: newDocumentId(),
      irrelevant: newDocumentId(),
      noResults: newDocumentId(),
      dedupe: newDocumentId(),
      allowed: newDocumentId(),
      excluded: newDocumentId(),
      topK: newDocumentId(),
      vectorThreshold: newDocumentId(),
      keywordThreshold: newDocumentId(),
      keywordPartialMatch: newDocumentId(),
    };

    await search("initialize hybrid search test", [ids.both], 1);
    await insertChunk(ids.both, 0, "orchid stipend grants", 0.95);
    await insertChunk(ids.weakKeyword, 0, "quasar", 0.95);
    await insertChunk(
      ids.strongKeyword,
      0,
      "nebula reimbursement nebula reimbursement",
      -1
    );
    await insertChunk(ids.irrelevant, 0, "tungsten", 0.2);
    await insertChunk(ids.noResults, 0, "silver", 0.2);
    await insertChunk(ids.dedupe, 0, "zircon benefit", 0.9);
    await insertChunk(ids.allowed, 0, "plain matter", 0.99);
    await insertChunk(ids.excluded, 0, "topaz policy", 0.95);

    for (let chunkIndex = 0; chunkIndex < 4; chunkIndex += 1) {
      await insertChunk(
        ids.topK,
        chunkIndex,
        `citrine award record ${chunkIndex}`,
        0.99 - chunkIndex * 0.01
      );
    }

    await insertChunk(
      ids.vectorThreshold,
      0,
      "plain matter",
      0.8
    );
    await insertChunk(
      ids.keywordThreshold,
      0,
      "opal travel opal travel",
      -1
    );
    await insertChunk(
      ids.keywordPartialMatch,
      0,
      "The application uses JWT for user authentication.",
      -1
    );
  });

  after(async () => {
    if (!databasePool) return;

    try {
      if (fixtureDocumentIds.length > 0) {
        await databasePool.query(
          `DELETE FROM document_vectors
           WHERE metadata->>'document_id' = ANY($1::text[])`,
          [fixtureDocumentIds.map(String)]
        );
      }
    } finally {
      try {
        await closeVectorStore?.();
      } finally {
        await databasePool.end();
      }
    }
  });

  it("keeps a candidate with both a strong vector and keyword match", async () => {
    const results = await search("orchid stipend", idsFor("both"), 5);
    assert.ok(
      results.some((result) => result.metadata.chunk_index === 0),
      "Expected the strong vector and keyword candidate."
    );
  });

  it("keeps a strong vector match when its keyword score is below threshold", async () => {
    const results = await search("quasar", idsFor("weakKeyword"), 5, {
      vectorMaxDistance: 0.4,
      keywordMinRank: 0.11,
    });
    assert.ok(
      results.some((result) => result.metadata.chunk_index === 0),
      "Expected the vector-qualified candidate."
    );
  });

  it("keeps a strong keyword match when its vector distance is above threshold", async () => {
    const results = await search("nebula reimbursement", idsFor("strongKeyword"), 5);
    assert.ok(
      results.some((result) => result.metadata.chunk_index === 0),
      "Expected the keyword-qualified candidate."
    );
  });

  it("matches useful keyword terms when other query words are absent from the chunk", async () => {
    const results = await search(
      "What authentication mechanism does the application use?",
      idsFor("keywordPartialMatch"),
      5
    );
    assert.equal(results.length, 1);
    assert.match(results[0].pageContent, /JWT/);
  });

  it("returns no candidate when both branches fail their relevance thresholds", async () => {
    const results = await search("tungsten", idsFor("irrelevant"), 5, {
      vectorMaxDistance: 0.4,
      keywordMinRank: 0.11,
    });
    assert.equal(results.length, 0, "Irrelevant candidates should be filtered out.");
  });

  it("returns an empty result when neither branch has a match", async () => {
    const results = await search("absent vocabulary", idsFor("noResults"), 5);
    assert.equal(results.length, 0, "Expected no qualifying retrieval results.");
  });

  it("deduplicates a chunk matched by both RRF branches", async () => {
    const results = await search("zircon benefit", idsFor("dedupe"), 5);
    assert.equal(results.length, 1, "The chunk should be deduplicated.");
  });

  it("respects document-level filtering", async () => {
    const bothDocuments = await search(
      "topaz policy",
      idsFor("allowed", "excluded"),
      5
    );
    assert.ok(
      bothDocuments.some((result) => result.metadata.document_id === ids.excluded),
      "The control search should find the excluded document."
    );

    const allowedOnly = await search("topaz policy", idsFor("allowed"), 5);
    assert.ok(
      allowedOnly.every((result) => result.metadata.document_id === ids.allowed),
      "Search must not return chunks outside the allowed documents."
    );
  });

  it("keeps results within Top-K with deterministic ordering", async () => {
    const documentIds = idsFor("topK");
    const first = await search("citrine award", documentIds, 2);
    const second = await search("citrine award", documentIds, 2);
    const firstOrder = first.map((result) => result.metadata.chunk_index);

    assert.ok(first.length <= 2 && second.length <= 2, "Search must respect Top-K.");
    assert.deepEqual(
      firstOrder,
      second.map((result) => result.metadata.chunk_index),
      "Search result ordering must be deterministic."
    );
    assert.equal(first.length, 2, "Expected two Top-K results.");
  });

  it("applies vector and keyword thresholds independently", async () => {
    const vectorDocumentIds = idsFor("vectorThreshold");
    const vectorIncluded = await search("rare lexeme", vectorDocumentIds, 5, {
      vectorMaxDistance: 0.4,
      keywordMinRank: 0.99,
    });
    const vectorExcluded = await search("rare lexeme", vectorDocumentIds, 5, {
      vectorMaxDistance: 0.1,
      keywordMinRank: 0.99,
    });
    assert.equal(vectorIncluded.length, 1);
    assert.equal(vectorExcluded.length, 0);

    const keywordDocumentIds = idsFor("keywordThreshold");
    const keywordIncluded = await search(
      "opal travel",
      keywordDocumentIds,
      5,
      { vectorMaxDistance: 0.4, keywordMinRank: 0.01 }
    );
    const keywordExcluded = await search(
      "opal travel",
      keywordDocumentIds,
      5,
      { vectorMaxDistance: 0.4, keywordMinRank: 0.6 }
    );
    assert.equal(keywordIncluded.length, 1);
    assert.equal(keywordExcluded.length, 0);
  });

  it("reads threshold settings from the environment", async () => {
    const previousVectorThreshold = process.env.VECTOR_MAX_DISTANCE;
    const previousKeywordThreshold = process.env.KEYWORD_MIN_RANK;
    process.env.VECTOR_MAX_DISTANCE = "0.1";
    process.env.KEYWORD_MIN_RANK = "0.99";

    try {
      const results = await search(
        "rare lexeme",
        idsFor("vectorThreshold"),
        5
      );
      assert.equal(results.length, 0);
    } finally {
      if (previousVectorThreshold === undefined) {
        delete process.env.VECTOR_MAX_DISTANCE;
      } else {
        process.env.VECTOR_MAX_DISTANCE = previousVectorThreshold;
      }

      if (previousKeywordThreshold === undefined) {
        delete process.env.KEYWORD_MIN_RANK;
      } else {
        process.env.KEYWORD_MIN_RANK = previousKeywordThreshold;
      }
    }
  });

  it("rejects query embeddings with invalid dimensions", async () => {
    assert.ok(searchWithEmbedding);
    await assert.rejects(
      searchWithEmbedding("dimension check", idsFor("both"), 5, [1], {
        vectorMaxDistance: 0.4,
        keywordMinRank: 0.01,
      }),
      /Invalid query embedding dimensions/
    );
  });
});
