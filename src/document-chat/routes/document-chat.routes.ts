import { Router } from "express";
import { documentUpload } from "../middleware/document-upload.middleware.js";
import {
  askQuestion,
  createConversation,
  deleteDocument,
  getMessages,
  listConversations,
  listDocuments,
  streamQuestion,
  uploadDocument,
} from "../controllers/document-chat.controller.js";

const router = Router();

// Conversations
router.get("/conversations", listConversations);
router.post("/conversations", createConversation);

// Documents in a conversation
router.post(
  "/conversations/:conversationId/upload",
  documentUpload.single("file"),
  uploadDocument
);
router.get("/conversations/:conversationId/documents", listDocuments);
router.delete(
  "/conversations/:conversationId/documents/:documentId",
  deleteDocument
);

// Chat
router.get("/conversations/:conversationId/messages", getMessages);
router.post("/conversations/:conversationId/messages", askQuestion);
router.post("/conversations/:conversationId/messages/stream", streamQuestion);

export default router;
