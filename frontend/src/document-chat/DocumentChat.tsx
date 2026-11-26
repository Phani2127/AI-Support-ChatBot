import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import * as api from "./api";
import HistoryPanel from "./HistoryPanel";
import UploadZone from "./UploadZone";
import type { ConversationSummary, Message, UploadedDocument } from "./types";

const STORAGE_KEY = "documentChat.conversationId";

const GREETING: Message = {
  role: "assistant",
  content: `Upload one or more documents (${api.ACCEPTED_LABEL}), then ask questions about them.`
};

function readSavedConversationId(): number | null {
  try {
    const id = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function saveConversationId(id: number | null) {
  try {
    if (id === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
  } catch { /* ignore */ }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

// Upload documents and chat with them. Talks to /api/document-chat/*.
export default function DocumentChat() {
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [history, setHistory] = useState<ConversationSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null); // in-flight answer stream
  const epochRef = useRef(0); // bumps when the chat is switched/reset to drop stale responses
  const convRef = useRef<number | null>(null); // synchronous copy of conversationId for batch uploads

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, uploading]);

  // Restore the previous conversation (documents + history) after a refresh
  useEffect(() => {
    const saved = readSavedConversationId();
    if (saved !== null) void openConversation(saved, true);
    void refreshHistory();
  }, []);

  function push(m: Message) {
    setMessages((prev) => [...prev, m]);
  }

  // While any document is still processing, poll its status and announce the result
  const documentsRef = useRef<UploadedDocument[]>([]);
  documentsRef.current = documents;
  const hasProcessing = documents.some((d) => d.status === "processing");

  useEffect(() => {
    if (conversationId === null || !hasProcessing) return;
    const epoch = epochRef.current;

    const timer = setInterval(async () => {
      try {
        const latest = await api.listDocuments(conversationId);
        if (!latest || epoch !== epochRef.current) return;

        const previous = documentsRef.current;
        for (const doc of latest) {
          const before = previous.find((d) => d.id === doc.id);
          if (before?.status !== "processing" || doc.status === "processing") continue;
          push(
            doc.status === "completed"
              ? { role: "assistant", content: `"${doc.file_name}" is ready. Ask me anything about it.` }
              : { role: "error", content: `"${doc.file_name}" could not be processed. Please delete it and try again.` }
          );
        }
        // Keep local state authoritative, but don't resurrect documents deleted meanwhile
        setDocuments((cur) =>
          cur.map((d) => latest.find((l) => l.id === d.id) ?? d)
        );
      } catch { /* try again on the next tick */ }
    }, 2000);

    return () => clearInterval(timer);
  }, [conversationId, hasProcessing]);

  function selectConversation(id: number | null) {
    convRef.current = id;
    setConversationId(id);
    saveConversationId(id);
  }

  async function refreshHistory() {
    try {
      setHistory(await api.listConversations());
    } catch { /* ignore */ }
  }

  // Load a past conversation's documents and messages so the chat continues
  async function openConversation(id: number, silent = false) {
    streamAbortRef.current?.abort();
    epochRef.current += 1;
    const epoch = epochRef.current;
    try {
      const data = await api.loadConversation(id);
      if (!data) {
        saveConversationId(null);
        if (!silent) push({ role: "error", content: "Could not open that conversation." });
        return;
      }
      if (epoch !== epochRef.current) return;

      selectConversation(id);
      setDocuments(data.documents);
      const past: Message[] = data.messages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content
      }));
      setMessages(
        past.length > 0
          ? past
          : [{ role: "assistant", content: "Conversation reopened. Ask me anything about these documents." }]
      );
      setInput("");
      setLoading(false);
      setShowHistory(false);
    } catch (error) {
      if (!silent) push({ role: "error", content: errorText(error) });
    }
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0 || uploading) return;
    setUploading(true);
    try {
      for (const file of files) {
        if (!(await uploadOne(file))) break;
      }
    } finally {
      setUploading(false);
    }
  }

  // Returns true on success so a batch can stop at the first failure
  async function uploadOne(file: File): Promise<boolean> {
    try {
      // Create the conversation on first upload
      let id = convRef.current;
      if (id === null) {
        id = await api.createConversation(file.name);
        selectConversation(id);
      }

      const document = await api.uploadDocument(id, file);
      setDocuments((prev) => [...prev, document]);
      void refreshHistory();
      push({
        role: "assistant",
        content: `"${document.file_name}" uploaded. Processing it now... I'll let you know when it's ready.`
      });
      return true;
    } catch (error) {
      push({ role: "error", content: errorText(error) });
      return false;
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || conversationId === null || loading) return;
    const epoch = epochRef.current;

    push({ role: "user", content: question });
    setInput("");
    setLoading(true);

    // Empty assistant bubble that fills up as tokens arrive
    push({ role: "assistant", content: "" });
    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      await api.streamMessage(
        conversationId,
        question,
        (token) => {
          if (epoch !== epochRef.current) return;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            return [...prev.slice(0, -1), { ...last, content: last.content + token }];
          });
        },
        controller.signal
      );
    } catch (error) {
      if (epoch !== epochRef.current) return;
      // Keep any partial answer; just drop the bubble if nothing arrived
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return last?.role === "assistant" && last.content === "" ? prev.slice(0, -1) : prev;
      });
      push({ role: "error", content: errorText(error) });
    } finally {
      if (streamAbortRef.current === controller) streamAbortRef.current = null;
      if (epoch === epochRef.current) setLoading(false);
    }
  }

  function newChat() {
    streamAbortRef.current?.abort();
    epochRef.current += 1;
    selectConversation(null);
    setDocuments([]);
    setMessages([GREETING]);
    setInput("");
    setLoading(false);
  }

  async function handleDelete(documentId: number) {
    if (conversationId === null || deletingId !== null) return;
    const document = documents.find((item) => item.id === documentId);
    if (!document) return;
    if (!window.confirm(`Delete "${document.file_name}"?`)) return;

    setDeletingId(documentId);
    try {
      await api.deleteDocument(conversationId, documentId);
      setDocuments((prev) => prev.filter((item) => item.id !== documentId));
      push({ role: "assistant", content: `"${document.file_name}" was deleted.` });
      await refreshHistory();
    } catch (error) {
      push({ role: "error", content: errorText(error) });
    } finally {
      setDeletingId(null);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <main className="chat">
      <header>
        <h1>
          Document Chat
          {conversationId !== null ? ` (#${conversationId})` : ""}
        </h1>
        <div className="header-actions">
          <button
            type="button"
            onClick={() => { void refreshHistory(); setShowHistory((s) => !s); }}
          >
            History
          </button>
          <button type="button" onClick={newChat}>New chat</button>
        </div>
      </header>

      {showHistory && (
        <HistoryPanel
          conversations={history}
          activeId={conversationId}
          onOpen={(id) => void openConversation(id)}
        />
      )}

      <UploadZone
        documents={documents}
        uploading={uploading}
        deletingId={deletingId}
        onFiles={(files) => void handleFiles(files)}
        onDelete={(id) => void handleDelete(id)}
      />

      <div className="messages" aria-live="polite">
        {messages.map((m, i) =>
          m.content === "" ? null : (
            <div key={i} className={`msg ${m.role}`}>{m.content}</div>
          )
        )}
        {uploading && <div className="msg assistant typing">Processing document...</div>}
        {/* Shown until the first token arrives */}
        {loading && messages[messages.length - 1]?.content === "" && (
          <div className="msg assistant typing">Thinking...</div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} autoComplete="off">
        <textarea
          rows={1}
          value={input}
          onKeyDown={onKeyDown}
          onChange={(e) => setInput(e.target.value)}
          placeholder={conversationId !== null ? "Ask about your documents... (Enter to send)" : "Upload a document first"}
          disabled={conversationId === null}
        />
        <button type="submit" disabled={loading || conversationId === null || !input.trim()}>
          Send
        </button>
      </form>
    </main>
  );
}
