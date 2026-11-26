import type { ConversationSummary } from "./types";

type Props = {
  conversations: ConversationSummary[];
  activeId: number | null;
  onOpen: (id: number) => void;
};

export default function HistoryPanel({ conversations, activeId, onOpen }: Props) {
  return (
    <div className="history-panel">
      {conversations.length === 0 && (
        <div className="history-empty">No previous documents yet.</div>
      )}
      {conversations.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`history-item${c.id === activeId ? " active" : ""}`}
          onClick={() => onOpen(c.id)}
        >
          <strong>{c.file_names.join(", ") || c.title}</strong>
          <span>Chat #{c.id}</span>
        </button>
      ))}
    </div>
  );
}
