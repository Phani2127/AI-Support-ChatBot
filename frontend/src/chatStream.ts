type StreamEvent = {
  conversationId?: unknown;
  token?: unknown;
  error?: unknown;
  done?: unknown;
};

const DISPLAY_DELAY_MS = 60;

function waitForDisplayDelay(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };

    timer = setTimeout(finish, DISPLAY_DELAY_MS);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

export async function streamBasicChat(
  message: string,
  conversationId: string | null,
  onConversationId: (id: string) => void,
  onToken: (token: string) => void,
  signal: AbortSignal
): Promise<void> {
  let response: Response;

  try {
    response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        conversationId: conversationId ?? undefined
      }),
      signal
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("Could not reach the server.");
  }

  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || body.error || "Something went wrong.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let hasDisplayedToken = false;

  async function handleEvent(raw: string): Promise<boolean> {
    const dataLine = raw.split(/\r?\n/).find((line) => line.startsWith("data: "));
    if (!dataLine) return false;

    const event = JSON.parse(dataLine.slice(6)) as StreamEvent;
    if (typeof event.error === "string") throw new Error(event.error);
    if (typeof event.conversationId === "string") {
      onConversationId(event.conversationId);
    }
    if (typeof event.token === "string") {
      const pieces = event.token.match(/\S+\s*|\s+/g) ?? [event.token];
      for (const piece of pieces) {
        if (hasDisplayedToken) await waitForDisplayDelay(signal);
        if (signal.aborted) {
          throw signal.reason ?? new DOMException("The request was aborted.", "AbortError");
        }
        onToken(piece);
        hasDisplayedToken = true;
      }
    }

    return event.done === true;
  }

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";

      for (const event of events) {
        if (await handleEvent(event)) return;
      }
    }

    buffer += decoder.decode();
    if (buffer.trim() && await handleEvent(buffer)) return;
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof Error && error.message !== "Failed to fetch") throw error;
    throw new Error("The connection was interrupted.");
  } finally {
    reader.cancel().catch(() => {});
  }

  throw new Error("The response was interrupted.");
}
