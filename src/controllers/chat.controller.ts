import { Request, Response } from "express";
import { generateAIResponse } from "../services/ai.service.js";
import {
  createConversation,
  getConversation,
  saveMessage
} from "../services/memory-conversation.service.js";
import { ChatRequest, ChatResponse } from "../types/chat.types.js";

export async function chatController(
  req: Request,
  res: Response
): Promise<void> {

  try {
    const { conversationId, message } = (req.body ?? {}) as Partial<ChatRequest>;

    // Validate incoming message
    if (!message || typeof message !== "string") {
      res.status(400).json({
        success: false,
        message: "A valid message is required"
      });
      return;
    }

    if (message.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: "Message cannot be empty"
      });
      return;
    }

    // Reuse an existing conversation or start a new one
    let id = conversationId;
    if (id !== undefined) {
      if (typeof id !== "string" || !getConversation(id)) {
        res.status(404).json({
          success: false,
          message: "Conversation not found"
        });
        return;
      }
    } else {
      id = createConversation();
    }

    // Send the full history plus the new message to the AI
    const history = getConversation(id)!;
    const reply = await generateAIResponse([
      ...history,
      { role: "user", content: message }
    ]);

    // Only store the turn once the AI answered successfully
    saveMessage(id, { role: "user", content: message });
    saveMessage(id, { role: "assistant", content: reply });

    const data: ChatResponse = { conversationId: id, reply };

    res.status(200).json({ success: true, data });

  } catch (error) {
    console.error("Chat controller error:", error);

    res.status(500).json({
      success: false,
      message: "Something went wrong while processing your request"
    });
  }
}
