import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  AIMessage,
  HumanMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { pool } from "../../config/database.js";
import {
  getDocumentMessages,
  saveDocumentMessage,
} from "./document-conversation.service.js";

/**
 * LangChain chat history backed by the document_messages table, so a conversation's
 * messages persist and feed back into the prompt on follow-up questions.
 */
export class DocumentChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "document_chat"];

  constructor(
    private readonly conversationId: number,
    private readonly limit = 10
  ) {
    super();
  }

  /** The most recent messages, oldest first. */
  async getMessages(): Promise<BaseMessage[]> {
    const rows = await getDocumentMessages(this.conversationId, this.limit);

    return rows.map((row) =>
      row.role === "assistant"
        ? new AIMessage(row.content)
        : new HumanMessage(row.content)
    );
  }

  async addMessage(message: BaseMessage): Promise<void> {
    const role = message.type === "ai" ? "assistant" : "user";

    await saveDocumentMessage(this.conversationId, role, message.text);
  }

  async clear(): Promise<void> {
    await pool.query(
      `DELETE FROM document_messages WHERE conversation_id = $1`,
      [this.conversationId]
    );
  }
}
