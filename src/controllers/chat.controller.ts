import { Request, Response } from "express";
import {
  generateAIResponse,
  streamAIResponse
} from "../services/ai.service.js";
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

export async function streamChatController(
  req: Request,
  res: Response
): Promise<void> {
  const { conversationId, message } = (req.body ?? {}) as Partial<ChatRequest>;

  if (typeof message !== "string" || !message.trim()) {
    res.status(400).json({
      success: false,
      message: "A valid message is required"
    });
    return;
  }

  let id: string;
  if (conversationId === undefined) {
    id = createConversation();
  } else if (typeof conversationId === "string" && getConversation(conversationId)) {
    id = conversationId;
  } else {
    res.status(404).json({
      success: false,
      message: "Conversation not found"
    });
    return;
  }

  const history = getConversation(id);
  if (!history) {
    res.status(404).json({
      success: false,
      message: "Conversation not found"
    });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.flushHeaders();

  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  const sendEvent = (data: object) => {
    if (!res.writableEnded && !controller.signal.aborted) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  sendEvent({ conversationId: id });
  const userMessage = message.trim();
  let reply = "";

  try {
    await streamAIResponse(
      [...history, { role: "user", content: userMessage }],
      (token) => {
        reply += token;
        sendEvent({ token });
      },
      controller.signal
    );

    if (controller.signal.aborted) return;

    if (!reply.trim()) {
      reply = "I couldn't generate a response.";
      sendEvent({ token: reply });
    }

    saveMessage(id, { role: "user", content: userMessage });
    saveMessage(id, { role: "assistant", content: reply });
    sendEvent({ done: true });
    res.end();
  } catch (error) {
    if (controller.signal.aborted) return;

    console.error("Streaming chat controller error:", error);
    sendEvent({ error: "Something went wrong while processing your request." });
    res.end();
  }
}
