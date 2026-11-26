import { FormEvent, useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || loading) return;
    const chatEpoch = chatEpochRef.current;

    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId: conversationId ?? undefined })
      });
      const json = await res.json();
      if (chatEpoch !== chatEpochRef.current) return;

      if (!res.ok || !json.success) {
        setMessages((prev) => [
          ...prev,
          { role: "error", content: json.message || "Something went wrong." }
        ]);
      } else {
        setConversationId(json.data.conversationId);
        setMessages((prev) => [...prev, { role: "assistant", content: json.data.reply }]);
      }
    } catch {
      if (chatEpoch !== chatEpochRef.current) return;
      setMessages((prev) => [...prev, { role: "error", content: "Could not reach the server." }]);
    } finally {
      if (chatEpoch === chatEpochRef.current) {
        setLoading(false);
      }
    }
  }

  function newChat() {
    chatEpochRef.current += 1;
    setConversationId(null);
    setMessages([GREETING]);
    setInput("");
    setLoading(false);
  }

  return (
    <main className="chat">
      <header>
        <h1>AI Assistant</h1>
        <button type="button" onClick={newChat}>New chat</button>
      </header>

      <div className="messages" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>{m.content}</div>
        ))}
        {loading && <div className="msg assistant typing">Thinking...</div>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} autoComplete="off">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          autoFocus
        />
        <button type="submit" disabled={loading || !input.trim()}>Send</button>
      </form>
    </main>
  );
}
