
import { randomUUID } from "node:crypto";
import { pool } from "../config/database.js";
import { generateEmbedding } from "./embedding.service.js";

interface FAQ {
  question: string;
  answer: string;
}

export async function ingestFAQs(faqs: FAQ[]): Promise<void> {
  for (const faq of faqs) {
    const text = `Question: ${faq.question}\nAnswer: ${faq.answer}`;

    // Generate an embedding using Gemini
    const embedding = await generateEmbedding(
      text,
      "RETRIEVAL_DOCUMENT"
    );

    // Save the FAQ and its embedding in PostgreSQL
    await pool.query(
      `INSERT INTO faqs (id, question, answer, embedding)
       VALUES ($1, $2, $3, $4)`,
      [
        randomUUID(),
        faq.question,
        faq.answer,
        JSON.stringify(embedding)
      ]
    );
  }

  console.log(`Successfully ingested ${faqs.length} FAQs`);
}
