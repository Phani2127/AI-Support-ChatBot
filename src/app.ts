import express from "express";
import cors from "cors";
import helmet from "helmet";

import chatRoutes from "./routes/chat.routes.js";
import geminiChatRoutes from "./routes/gemini-chat.routes.js";
import documentChatRoutes from "./document-chat/routes/document-chat.routes.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "AI Customer Support API is running"
  });
});

// Chat API
app.use("/api/chat", chatRoutes);

// Gemini chat API (with order lookup tool)
app.use("/api/gemini-chat", geminiChatRoutes);

// Document chat API (upload a document, ask questions about it)
app.use("/api/document-chat", documentChatRoutes);

export default app;
