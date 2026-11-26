import type { Request, Response } from "express";

import {
  validateUploadedFile,
  saveAndAttachDocument,
  type UploadedDocument,
} from "../services/document-upload.service.js";
import {
  deleteConversationDocument,
  discardFailedUpload,
  getConversationDocuments,
} from "../services/document-management.service.js";
import {
  createDocumentConversation,
  documentConversationExists,
  getDocumentMessages,
  listDocumentConversations,
} from "../services/document-conversation.service.js";
import { processDocument } from "../services/document-processing.service.js";
import {
  answerDocumentQuestion,
  streamDocumentAnswer,
} from "../services/document-chat.service.js";
import { documentProcessingQueue } from "../queues/document-processing.queue.js";
import { TokenLimitExceededError } from "../services/token-budget.service.js";

// Pause between streamed words, in ms. Raise to slow the stream down, 0 to disable.
const STREAM_DELAY_MS = Number(process.env.STREAM_DELAY_MS ?? 60);

/** Wait `ms`, ending early (without error) if the signal aborts. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/** Parse a positive integer route param; null if invalid. */
function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function createConversation(req: Request, res: Response) {
  try {
    const { title } = req.body ?? {};

    if (title !== undefined && typeof title !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation title.",
      });
    }

    const conversationId = await createDocumentConversation(
      title?.trim() || undefined,
    );

    return res.status(201).json({
      success: true,
      message: "Document conversation created successfully.",
      conversationId,
    });
  } catch (error) {
    console.error("Create document conversation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create document conversation.",
    });
  }
}

export async function listConversations(_req: Request, res: Response) {
  try {
    const conversations = await listDocumentConversations();
    return res.status(200).json({ conversations });
  } catch (error) {
    console.error("List conversations error:", error);
    return res.status(500).json({ error: "Failed to list conversations." });
  }
}

export async function uploadDocument(req: Request, res: Response) {
  let document: UploadedDocument | undefined;

  try {
    const conversationId = parseId(req.params.conversationId);

    if (conversationId === null) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a file.",
      });
    }

    await validateUploadedFile(req.file.path, req.file.originalname);
    document = await saveAndAttachDocument(req.file, conversationId);
    await documentProcessingQueue.add(
      "process-document",
      {
        documentId: document.id,
        filePath: document.file_path,
        fileType: document.file_type,
      },
      {
        jobId: `document-${document.id}`,
      },
    );
    return res.status(202).json({
      message: "Document uploaded successfully. Processing started.",
      document: {
        id: document.id,
        fileName: document.file_name,
        status: "processing",
      },
    });
  } catch (error) {
    console.error("Document upload failed:", error);
    await discardFailedUpload(req.file?.path, document?.id).catch(() => {});

    return res.status(500).json({
      error: "Failed to upload or process document.",
    });
  }
}

export async function listDocuments(req: Request, res: Response) {
  try {
    const conversationId = parseId(req.params.conversationId);

    if (conversationId === null) {
      return res.status(400).json({ error: "Invalid conversation ID." });
    }

    if (!(await documentConversationExists(conversationId))) {
      return res
        .status(404)
        .json({ error: "Document conversation not found." });
    }

    const documents = await getConversationDocuments(conversationId);

    return res.status(200).json({ conversationId, documents });
  } catch (error) {
    console.error("Document listing error:", error);
    return res.status(500).json({ error: "Failed to retrieve documents." });
  }
}

export async function deleteDocument(req: Request, res: Response) {
  try {
    const conversationId = parseId(req.params.conversationId);
    const documentId = parseId(req.params.documentId);

    if (conversationId === null || documentId === null) {
      return res.status(400).json({
        error: "Invalid conversation ID or document ID.",
      });
    }

    const deleted = await deleteConversationDocument(
      conversationId,
      documentId,
    );

    if (!deleted) {
      return res.status(404).json({
        error: "Document not found in this conversation.",
      });
    }

    return res.status(200).json({ message: "Document deleted successfully." });
  } catch (error) {
    console.error("Document deletion error:", error);
    return res.status(500).json({ error: "Failed to delete document." });
  }
}

/**
 * Validate a chat request. Sends the error response and returns null when invalid.
 */
async function parseQuestionRequest(
  req: Request,
  res: Response,
): Promise<{ conversationId: number; question: string } | null> {
  const conversationId = parseId(req.params.conversationId);
  const message = req.body?.message;

  if (conversationId === null) {
    res.status(400).json({ error: "Invalid conversation ID." });
    return null;
  }

  if (typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "Message is required." });
    return null;
  }

  if (!(await documentConversationExists(conversationId))) {
    res.status(404).json({ error: "Document conversation not found." });
    return null;
  }

  return { conversationId, question: message.trim() };
}

export async function askQuestion(req: Request, res: Response) {
  try {
    const parsed = await parseQuestionRequest(req, res);
    if (!parsed) return;

    const { conversationId, question } = parsed;
    const answer = await answerDocumentQuestion(conversationId, question);

    return res.status(200).json({ conversationId, question, answer });
  } catch (error) {
    if (error instanceof TokenLimitExceededError) {
      console.warn("Document chat token limit exceeded.");
      return res.status(413).json({ error: error.message });
    }

    console.error("Document chat error:", error);
    return res.status(500).json({
      error: "Failed to process your document question.",
    });
  }
}

/**
 * Streaming variant of askQuestion using Server-Sent Events.
 * Events: {"token": "..."} repeatedly, then {"done": true} or {"error": "..."}.
 */
export async function streamQuestion(req: Request, res: Response) {
  let parsed: Awaited<ReturnType<typeof parseQuestionRequest>>;

  try {
    parsed = await parseQuestionRequest(req, res);
  } catch (error) {
    console.error("Document chat error:", error);
    return res.status(500).json({
      error: "Failed to process your document question.",
    });
  }
  if (!parsed) return;

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // stop nginx-style proxies from buffering the stream
  });
  res.flushHeaders();

  // Stop generating if the client goes away before the stream finishes.
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  const send = (data: object) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Gemini sends large chunks quickly; emit them word by word with a short pause
  // so the text appears at a readable pace.
  const sendPaced = async (token: string) => {
    for (const piece of token.match(/\S+\s*|\s+/g) ?? [token]) {
      if (controller.signal.aborted) return;
      send({ token: piece });
      await sleep(STREAM_DELAY_MS, controller.signal);
    }
  };

  try {
    await streamDocumentAnswer(
      parsed.conversationId,
      parsed.question,
      sendPaced,
      controller.signal,
    );
    send({ done: true });
  } catch (error) {
    if (!controller.signal.aborted) {
      if (error instanceof TokenLimitExceededError) {
        console.warn("Document chat token limit exceeded.");
        send({ error: error.message });
      } else {
        console.error("Document chat stream error:", error);
        send({ error: "Failed to process your document question." });
      }
    }
  } finally {
    res.end();
  }
}

export async function getMessages(req: Request, res: Response) {
  try {
    const conversationId = parseId(req.params.conversationId);

    if (conversationId === null) {
      return res.status(400).json({ error: "Invalid conversation ID." });
    }

    if (!(await documentConversationExists(conversationId))) {
      return res
        .status(404)
        .json({ error: "Document conversation not found." });
    }

    const messages = await getDocumentMessages(conversationId, 50);

    return res.status(200).json({ conversationId, messages });
  } catch (error) {
    console.error("Message history error:", error);
    return res.status(500).json({
      error: "Failed to retrieve conversation messages.",
    });
  }
}
