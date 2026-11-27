import { Fragment, type ReactNode } from "react";
import Icon from "./Icon";

export type MessageRole = "user" | "assistant" | "error";

type MessageProps = {
  role: MessageRole;
  content: string;
};

function renderInline(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g);

  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={index}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith("__") && token.endsWith("__")) {
      return <strong key={index}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return <code key={index}>{token.slice(1, -1)}</code>;
    }
    if (token.startsWith("*") && token.endsWith("*")) {
      return <em key={index}>{token.slice(1, -1)}</em>;
    }
    if (token.startsWith("_") && token.endsWith("_")) {
      return <em key={index}>{token.slice(1, -1)}</em>;
    }
    return token;
  });
}

function renderMarkdown(content: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listKind: "ul" | "ol" | null = null;

  function flushParagraph() {
    if (paragraph.length === 0) return;

    blocks.push(
      <p key={blocks.length}>
        {paragraph.map((line, index) => (
          <Fragment key={index}>
            {index > 0 && <br />}
            {renderInline(line)}
          </Fragment>
        ))}
      </p>
    );
    paragraph = [];
  }

  function flushList() {
    if (!listKind || listItems.length === 0) return;

    const items = listItems.map((item, index) => (
      <li key={index}>{renderInline(item)}</li>
    ));
    blocks.push(
      listKind === "ul"
        ? <ul key={blocks.length}>{items}</ul>
        : <ol key={blocks.length}>{items}</ol>
    );
    listItems = [];
    listKind = null;
  }

  for (const line of content.split(/\r?\n/)) {
    const unorderedItem = line.match(/^\s*[-*+]\s+(.+)$/);
    const orderedItem = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const nextListKind = unorderedItem ? "ul" : orderedItem ? "ol" : null;

    if (nextListKind) {
      flushParagraph();
      if (listKind !== nextListKind) flushList();
      listKind = nextListKind;
      listItems.push((unorderedItem ?? orderedItem)?.[1] ?? "");
      continue;
    }

    flushList();
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    paragraph.push(line);
  }

  flushList();
  flushParagraph();
  return blocks;
}

export function MessageBubble({ role, content }: MessageProps) {
  return (
    <div className={`message-row ${role}`}>
      {role !== "user" && (
        <span className={`message-avatar ${role}`}>
          <Icon name={role === "error" ? "alert" : "bot"} size={16} />
        </span>
      )}
      <div className={`msg ${role}`}>
        {role === "assistant"
          ? <div className="markdown-content">{renderMarkdown(content)}</div>
          : content}
      </div>
      {role === "user" && (
        <span className="message-avatar user">
          <Icon name="user" size={16} />
        </span>
      )}
    </div>
  );
}

export function TypingIndicator({ label = "Thinking..." }: { label?: string }) {
  return (
    <div className="message-row assistant typing-row" role="status" aria-live="polite">
      <span className="message-avatar assistant">
        <Icon name="bot" size={16} />
      </span>
      <div className="msg assistant typing">
        <span>{label}</span>
        <span className="typing-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  );
}
