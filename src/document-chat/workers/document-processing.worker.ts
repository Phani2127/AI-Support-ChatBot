import "dotenv/config";
import { Worker } from "bullmq";

import { pool } from "../../config/database.js";
import { createRedisConnection } from "../../config/redis.js";
import { registerShutdown } from "../../config/shutdown.js";
import { DOCUMENT_PROCESSING_QUEUE } from "../queues/queue-names.js";
import type { DocumentProcessingJob } from "../queues/document-processing.queue.js";
import { closeDocumentVectorStore } from "../services/document-vector-store.service.js";
import { processDocument, markDocumentFailed } from "../services/document-processing.service.js";

const connection = createRedisConnection();

const worker = new Worker<DocumentProcessingJob>(
  DOCUMENT_PROCESSING_QUEUE,
  async (job) => {
    const { documentId, filePath, fileType } = job.data;

    console.log(`Processing document ${documentId}`);
    await processDocument(documentId, filePath, fileType);
    console.log(`Document ${documentId} processed successfully`);
  },
  {
    connection,
    concurrency: 2,
  }
);

worker.on("failed", (job, error) => {
  console.error(
    `Document processing job ${job?.id} failed:`,
    error
  );

  if (!job) return;

  const maxAttempts = job.opts.attempts ?? 1;

  if (job.attemptsMade >= maxAttempts) {
    markDocumentFailed(job.data.documentId).catch((dbError) => {
      console.error("Failed to update document status:", dbError);
    });
  }
});

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

// worker.close() waits for in-flight jobs. If they outlast the timeout the process
// exits anyway and BullMQ re-queues the stalled job.
registerShutdown(
  "document worker",
  async () => {
    await worker.close(); // 1. stop taking jobs, finish active ones
    await connection.quit(); // 2. Redis
    await closeDocumentVectorStore(); // 3. LangChain vector store's own DB pool
    await pool.end(); // 4. database
  },
  60_000
);

console.log("Document processing worker started");
