import type { ConversationSummary, DocumentStatus, UploadedDocument } from "./types";

function toDocument(d: { id: number; file_name: string; status?: string }): UploadedDocument {
  return {
    id: d.id,
    file_name: d.file_name,
    // Anything not explicitly finished or failed is still being processed
    status: (d.status === "completed" || d.status === "failed" ? d.status : "processing") as DocumentStatus
  };
}

const BASE = "/api/document-chat";

/** Accepted upload types; keep in sync with the backend validation. */
export const ACCEPTED_FILES = ".pdf,.docx,.xlsx,.xls,.txt,.csv";
export const ACCEPTED_LABEL = "PDF, Word, Excel, TXT, CSV";

// Every function throws an Error whose message is safe to show the user.
async function request(url: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error("Could not reach the server.");
  }
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

function jsonPost(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const { res, json } = await request(`${BASE}/conversations`);
  return res.ok ? (json.conversations ?? []) : [];
}

export async function createConversation(title: string): Promise<number> {
  const { res, json } = await request(`${BASE}/conversations`, jsonPost({ title }));
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Could not start a conversation.");
  }
  return json.conversationId as number;
}

/** Documents of a conversation with their current processing status; null if unavailable. */
export async function listDocuments(id: number): Promise<UploadedDocument[] | null> {
  const { res, json } = await request(`${BASE}/conversations/${id}/documents`);
  if (!res.ok) return null;
  // The API returns newest first; the UI lists oldest first
  return ((json.documents ?? []) as Parameters<typeof toDocument>[0][]).map(toDocument).reverse();
}

export async function loadConversation(id: number) {
  const [documents, msgs] = await Promise.all([
    listDocuments(id),
    request(`${BASE}/conversations/${id}/messages`)
  ]);
  if (!documents || !msgs.res.ok) return null;

  return {
    documents,
    messages: (msgs.json.messages ?? []) as { role: string; content: string }[]
  };
}

export async function uploadDocument(
  conversationId: number,
  file: File
): Promise<UploadedDocument> {
  const body = new FormData();
  body.append("file", file);
  const { res, json } = await request(`${BASE}/conversations/${conversationId}/upload`, {
    method: "POST",
    body
  });
  // 202 Accepted: the file is stored and queued; processing finishes in the background
  if (!res.ok || !json.document) {
    throw new Error(`${file.name}: ${json.message || json.error || "Upload failed."}`);
  }
  return { id: json.document.id, file_name: json.document.fileName, status: "processing" };
}

export async function deleteDocument(conversationId: number, documentId: number): Promise<void> {
  const { res, json } = await request(
    `${BASE}/conversations/${conversationId}/documents/${documentId}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(json.error || "Could not delete the document.");
}

/**
 * Ask a question and receive the answer incrementally (Server-Sent Events over fetch).
 * Calls onToken for each piece of text. Resolves when the answer is complete; throws
 * with a user-safe message on failure. Aborting `signal` rejects with an AbortError.
 */
export async function streamMessage(
  conversationId: number,
  message: string,
  onToken: (token: string) => void,
  signal?: AbortSignal
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/conversations/${conversationId}/messages/stream`, {
      ...jsonPost({ message }),
      signal
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("Could not reach the server.");
  }

  if (!res.ok || !res.body) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || json.message || "Something went wrong.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // Returns true once the server signals the end of the answer
  function handleEvent(raw: string): boolean {
    const line = raw.split("\n").find((l) => l.startsWith("data: "));
    if (!line) return false;
    const event = JSON.parse(line.slice(6));
    if (event.error) throw new Error(event.error);
    if (typeof event.token === "string") onToken(event.token);
    return event.done === true;
  }

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? ""; // keep any incomplete trailing event

      for (const event of events) {
        if (handleEvent(event)) return;
      }
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof Error && error.message !== "Failed to fetch") throw error;
    throw new Error("The connection was interrupted.");
  } finally {
    reader.cancel().catch(() => {});
  }

  throw new Error("The response was interrupted.");
}

export async function sendMessage(conversationId: number, message: string): Promise<string> {
  const { res, json } = await request(
    `${BASE}/conversations/${conversationId}/messages`,
    jsonPost({ message })
  );
  if (!res.ok || typeof json.answer !== "string") {
    throw new Error(json.error || json.message || "Something went wrong.");
  }
  return json.answer;
}
