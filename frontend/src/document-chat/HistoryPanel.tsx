import type { ConversationSummary } from "./types";
import Icon from "../Icon";

type Props = {
  conversations: ConversationSummary[];
  activeId: number | null;
  onOpen: (id: number) => void;
};

export default function HistoryPanel({ conversations, activeId, onOpen }: Props) {
  return (
    <div className="history-panel">
      {conversations.length === 0 && (
        <div className="history-empty">
          <Icon name="history" size={18} />
          <span>No previous document conversations yet.</span>
        </div>
      )}
      {conversations.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`history-item${c.id === activeId ? " active" : ""}`}
          onClick={() => onOpen(c.id)}
        >
          <span className="history-item-icon"><Icon name="file" size={16} /></span>
          <strong>{c.file_names.join(", ") || c.title}</strong>
          <span className="history-item-meta">Chat #{c.id}<Icon name="activity" size={13} /></span>
        </button>
      ))}
    </div>
  );
}
