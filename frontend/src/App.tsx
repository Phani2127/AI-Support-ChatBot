import { FormEvent, useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { MessageBubble, TypingIndicator } from "./MessageBubble";
import { streamBasicChat } from "./chatStream";

type Message = {
  role: "user" | "assistant" | "error";
  content: string;
};

const GREETING: Message = { role: "assistant", content: "Hi! Ask me anything." };

export default function App() {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatEpochRef = useRef(0);
  const streamAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || loading) return;
    const chatEpoch = chatEpochRef.current;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: message },
      { role: "assistant", content: "" }
    ]);
    setInput("");
    setLoading(true);
    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      await streamBasicChat(
        message,
        conversationId,
        (id) => {
          if (chatEpoch === chatEpochRef.current) setConversationId(id);
        },
        (token) => {
          if (chatEpoch !== chatEpochRef.current) return;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            return [...prev.slice(0, -1), { ...last, content: last.content + token }];
          });
        },
        controller.signal
      );
    } catch (error) {
      if (chatEpoch !== chatEpochRef.current) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return last?.role === "assistant" && last.content === ""
          ? prev.slice(0, -1)
          : prev;
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "error",
          content: error instanceof Error ? error.message : "Something went wrong."
        }
      ]);
    } finally {
      if (streamAbortRef.current === controller) streamAbortRef.current = null;
      if (chatEpoch === chatEpochRef.current) {
        setLoading(false);
      }
    }
  }

  function newChat() {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    chatEpochRef.current += 1;
    setConversationId(null);
    setMessages([GREETING]);
    setInput("");
    setLoading(false);
  }

  return (
    <main className="chat">
      <header className="chat-header">
        <div className="chat-heading">
          <span className="chat-title-icon"><Icon name="chat" size={21} /></span>
          <div>
            <h1>AI Assistant</h1>
            <p>A simple conversational assistant</p>
          </div>
        </div>
        <button type="button" className="button button-secondary" onClick={newChat}>
          <Icon name="plus" size={17} />
          <span>New chat</span>
        </button>
      </header>

      <div className="messages" aria-live="polite">
        {messages.map((m, i) => (
          m.role === "assistant" && m.content === ""
            ? null
            : <MessageBubble key={i} role={m.role} content={m.content} />
        ))}
        {loading && messages[messages.length - 1]?.content === "" && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      <form className="chat-composer" onSubmit={handleSubmit} autoComplete="off">
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message your assistant..."
          autoFocus
          aria-label="Message your assistant"
        />
        <button
          type="submit"
          className="button button-primary send-button"
          disabled={loading || !input.trim()}
          aria-label="Send message"
        >
          <span>Send</span>
          <Icon name="send" size={17} />
        </button>
      </form>
    </main>
  );
}
