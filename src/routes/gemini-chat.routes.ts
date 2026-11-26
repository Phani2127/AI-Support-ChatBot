import { Router, Request, Response } from "express";
import { customerSupport } from "../services/customer-support.service.js";
import {
  conversationExists,
  createConversation,
  deleteSummarizedMessages,
  getConversationHistory,
  getConversationSummary,
  getMessagesToSummarize,
  saveConversationSummary,
  saveMessage,
  SUMMARY_MIN_MESSAGES,
} from "../services/conversation.service.js";
import { generateConversationSummary } from "../services/conversation-summary.service.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { message, conversationId } = req.body ?? {};

    // Validate the incoming message
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid message.",
      });
    }

    // Reuse an existing (PostgreSQL) conversation or start a new one
    let id: number;
    if (conversationId !== undefined && conversationId !== null) {
      id = Number(conversationId);
      if (!Number.isInteger(id) || !(await conversationExists(id))) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found.",
        });
      }
    } else {
      id = await createConversation();
    }
    const history = (await getConversationHistory(id)).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const summary = await getConversationSummary(id);
    // FAQ retrieval (RAG) + order lookup tool via Gemini, with history
    const answer = await customerSupport(message.trim(), history, summary);

    // Only store the turn once Gemini answered successfully
    await saveMessage(id, "user", message.trim());
    await saveMessage(id, "assistant", answer);
// Generate and store a summary of older messages
const messagesToSummarize = await getMessagesToSummarize(id);

if (messagesToSummarize.length >= SUMMARY_MIN_MESSAGES) {
  try {
  const previousSummary = await getConversationSummary(id);

  const newSummary = await generateConversationSummary(
    previousSummary,
    messagesToSummarize.map((m) => ({
      role: m.role,
      content: m.content,
    }))
  );

  // Save the summary before deleting the original messages
  await saveConversationSummary(id, newSummary);

  await deleteSummarizedMessages(
    id,
    messagesToSummarize.map((m) => m.id)
  );
  } catch (summaryError) {
    // Don't fail the chat response if summarization fails
    console.error("Conversation summary error:", summaryError);
  }
}
    return res.status(200).json({
      success: true,
      answer,
      conversationId: id,
    });
  } catch (error) {
    console.error("Gemini chat API error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while processing your message.",
    });
  }
});

export default router;
