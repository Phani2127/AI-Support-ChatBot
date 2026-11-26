import { randomUUID } from "node:crypto";
import { ChatMessage } from "../types/chat.types.js";

// In-memory conversation store used by the basic chat (/api/chat).
// History is lost when the server restarts.
const conversations = new Map<string, ChatMessage[]>();

export function createConversation(): string {
  const conversationId = randomUUID();

  conversations.set(conversationId, []);

  return conversationId;
}

export function getConversation(
  conversationId: string
): ChatMessage[] | undefined {
  return conversations.get(conversationId);
}

export function saveMessage(
  conversationId: string,
  message: ChatMessage
): void {
  const history = conversations.get(conversationId);

  if (!history) {
    throw new Error("Conversation not found");
  }

  history.push(message);
}
