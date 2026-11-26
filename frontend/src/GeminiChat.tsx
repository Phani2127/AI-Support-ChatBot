import { FormEvent, useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant" | "error";
  content: string;
};

const GREETING: Message = {
  role: "assistant",
  content:
    "Hi! Ask about our policies (FAQ search) or an order, e.g. \"Where is my order 12345?\"",
};

const SAMPLES = [
  // Order lookups
  "Where is my order 12345?",
  "How do I return my order 12345?",
  // FAQs (match src/scripts/ingest-faqs.ts)
  "How can I reset my password?",
  "How can I contact customer support?",
  "Can I get a refund?",
  "How do I update my email address?",
  "What payment methods do you accept?",
  "How do I create an account?",
  "How do I change my password?",
  "How do I delete my account?",
  "Why am I not receiving the verification email?",
  "How do I update my phone number?",
  "How do I enable two-factor authentication?",
  "My account is locked. What should I do?",
  "How do I track my order?",
  "How long does shipping take?",
  "How much does shipping cost?",
  "Do you ship internationally?",
  "Can I change my shipping address after placing an order?",
  "Can I cancel my order?",
  "Can I modify my order after placing it?",
  "My order has not arrived. What should I do?",
  "I received a damaged item. What should I do?",
  "I received the wrong item. What should I do?",
  "What is your return policy?",
  "How do I return an item?",
  "How long does a refund take?",
  "Will I get my shipping fee refunded?",
  "Can I exchange an item instead of returning it?",
  "Which credit cards do you accept?",
  "Is it safe to enter my payment information?",
  "Why was my payment declined?",
  "I was charged twice. What should I do?",
  "Where can I find my invoice?",
  "How do I apply a promo code?",
  "Why is my promo code not working?",
  "Do you offer gift cards?",
  "How do I redeem a gift card?",
  "Do you offer discounts for students or bulk orders?",
  "What are your customer support hours?",
  "How quickly will support respond to my email?",
  "Is there a phone number for support?",
  "How do I report a bug or technical problem?",
  "Which browsers do you support?",
  "Do you have a mobile app?",
  "How do I unsubscribe from marketing emails?",
  "How do I manage my notification preferences?",
  "How is my personal data used?",
  "Can I download a copy of my data?",
  "How do I cancel my subscription?",
  "Will my subscription renew automatically?",
  "How do I leave a product review?"
];

// Combined RAG + function-calling chat. Calls POST /api/gemini-chat.
export default function GeminiChat() {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatEpochRef = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    const chatEpoch = chatEpochRef.current;

    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/gemini-chat", {
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
        setConversationId(json.conversationId);
        setMessages((prev) => [...prev, { role: "assistant", content: json.answer }]);
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
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
        <h1>Gemini Support (FAQ + Orders)</h1>
        <button type="button" onClick={newChat}>
          New chat{conversationId ? ` (#${conversationId})` : ""}
        </button>
      </header>

      <div className="samples">
        {SAMPLES.map((s) => (
          <button key={s} type="button" disabled={loading} onClick={() => void send(s)}>
            {s}
          </button>
        ))}
      </div>

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
