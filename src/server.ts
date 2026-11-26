import "dotenv/config";
import type { Server } from "node:http";
import app from "./app.js";
import { connectDatabase, pool } from "./config/database.js";
import { registerShutdown } from "./config/shutdown.js";
import { closeDocumentVectorStore } from "./document-chat/services/document-vector-store.service.js";
import { closeDocumentProcessingQueue } from "./document-chat/queues/document-processing.queue.js";

const PORT = process.env.PORT || 3000;

// How long in-flight requests (e.g. streaming answers) get to finish before sockets are cut.
const DRAIN_TIMEOUT_MS = 10_000;

/** Stop accepting connections and wait for in-flight requests to finish. */
function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));

    // Idle keep-alive sockets would otherwise hold close() open.
    server.closeIdleConnections();

    // Cut anything still running (long streams) after the drain window.
    setTimeout(() => server.closeAllConnections(), DRAIN_TIMEOUT_MS).unref();
  });
}

async function startServer(): Promise<void> {
  try {
    await connectDatabase();

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    registerShutdown("API", async () => {
      await closeServer(server); // 1. no new requests, finish current ones
      await closeDocumentProcessingQueue(); // 2. queue + its Redis connection
      await closeDocumentVectorStore(); // 3. LangChain vector store's own DB pool
      await pool.end(); // 4. database last, after nothing can query it
    });
  } catch (error) {
    console.error("Failed to start the server:", error);
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

void startServer();
