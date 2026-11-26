/**
 * Run `cleanup` once on SIGINT/SIGTERM, then exit.
 * - A second signal forces an immediate exit.
 * - If cleanup takes longer than `timeoutMs`, the process is force-exited with code 1.
 */
export function registerShutdown(
  label: string,
  cleanup: () => Promise<void>,
  timeoutMs = 15_000
): void {
  let shuttingDown = false;

  const run = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      console.warn(`${signal} received again. Forcing exit.`);
      process.exit(1);
    }
    shuttingDown = true;

    console.log(`${signal} received. Shutting down ${label} gracefully...`);

    const timer = setTimeout(() => {
      console.error(`${label} shutdown timed out after ${timeoutMs}ms. Forcing exit.`);
      process.exit(1);
    }, timeoutMs);
    timer.unref();

    try {
      await cleanup();
      console.log(`${label} shut down cleanly.`);
      process.exit(0);
    } catch (error) {
      console.error(`Error during ${label} shutdown:`, error);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void run("SIGINT"));
  process.on("SIGTERM", () => void run("SIGTERM"));
}
