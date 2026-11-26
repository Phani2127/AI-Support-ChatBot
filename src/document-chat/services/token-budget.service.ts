import { GoogleGenAI } from "@google/genai";
import { chatModelName } from "./langchain.models.js";

export interface TokenCountMessage {
  role: "user" | "model";
  content: string;
}

export class TokenLimitExceededError extends Error {
  constructor() {
    super(
      "Token limit exceeded. Please shorten your question, start a new chat, or increase DOCUMENT_CHAT_MAX_INPUT_TOKENS."
    );
    this.name = "TokenLimitExceededError";
  }
}

const configuredBudget = Number(
  process.env.DOCUMENT_CHAT_MAX_INPUT_TOKENS ?? 10_000
);

if (!Number.isSafeInteger(configuredBudget) || configuredBudget < 1) {
  throw new Error("DOCUMENT_CHAT_MAX_INPUT_TOKENS must be a positive integer.");
}

export const maxDocumentChatInputTokens = configuredBudget;

const tokenCounter = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function countDocumentChatInputTokens(
  systemInstruction: string,
  messages: TokenCountMessage[]
): Promise<number> {
  const result = await tokenCounter.models.countTokens({
    model: chatModelName,
    contents: [
      { role: "user", parts: [{ text: systemInstruction }] },
      ...messages.map(({ role, content }) => ({
        role,
        parts: [{ text: content }],
      })),
    ],
  });

  if (typeof result.totalTokens !== "number") {
    throw new Error("Gemini did not return a prompt token count.");
  }

  return result.totalTokens;
}
