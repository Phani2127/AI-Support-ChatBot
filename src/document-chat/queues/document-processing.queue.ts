import { Queue } from "bullmq";
import { createRedisConnection } from "../../config/redis.js";
import { DOCUMENT_PROCESSING_QUEUE } from "./queue-names.js";

export interface DocumentProcessingJob {
  documentId: number;
  filePath: string;
  fileType: string;
}

const connection = createRedisConnection();

export const documentProcessingQueue = new Queue<DocumentProcessingJob>(
  DOCUMENT_PROCESSING_QUEUE,
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  }
);

/** Close the queue and the Redis connection we created for it. */
export async function closeDocumentProcessingQueue(): Promise<void> {
  await documentProcessingQueue.close();
  await connection.quit();
}
