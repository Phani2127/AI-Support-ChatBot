
import { pool } from "../config/database.js";
import { generateEmbedding } from "./embedding.service.js";

interface RetrievedFAQ {
  question: string;
  answer: string;
  similarity: number;
}

export async function retrieveFAQs(
  query: string
): Promise<RetrievedFAQ[]> {
  const embedding = await generateEmbedding(
    query,
    "RETRIEVAL_QUERY"
  );

  const result = await pool.query(
    `SELECT
       question,
       answer,
       1 - (embedding <=> $1::vector) AS similarity
     FROM faqs
     ORDER BY embedding <=> $1::vector
     LIMIT 3`,
    [JSON.stringify(embedding)]
  );

  return result.rows;
}
