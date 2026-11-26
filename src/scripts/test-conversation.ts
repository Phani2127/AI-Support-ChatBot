import "dotenv/config";
import {
  createConversation,
  saveMessage,
  getConversationHistory,
} from "../services/conversation.service.js";

import { pool } from "../config/database.js";

async function main() {
  try {
    // 1. Create a conversation
    const conversationId = await createConversation();

    console.log("Conversation created:", conversationId);

    // 2. Save customer message
    await saveMessage(
      conversationId,
      "user",
      "Where is my order 12345?"
    );

    // 3. Save chatbot response
    await saveMessage(
      conversationId,
      "assistant",
      "Your order 12345 has been shipped."
    );

    // 4. Retrieve conversation history
    const history = await getConversationHistory(conversationId);

    console.log("Conversation history:", history);
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await pool.end();
  }
}

main();
