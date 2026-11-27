import { GoogleGenAI } from "@google/genai";
import { ASSISTANT_PROMPT } from "../config/prompts.js";
import { ChatMessage } from "../types/chat.types.js";

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
// Tried in order if the primary model is overloaded (503) or rate limited (429)
const FALLBACK_MODELS = ["gemini-3.7-flash", "gemini-3.5-flash-lite"];
const REQUEST_TIMEOUT_MS = 20_000;

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  return status === 503 || status === 429 || (error as Error)?.name === "AbortError";
}

export async function generateAIResponse(
  history: ChatMessage[]
): Promise<string> {
  // Gemini calls the assistant role "model"
  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  let lastError: unknown;

  for (const model of [PRIMARY_MODEL, ...FALLBACK_MODELS]) {
    try {
      const response = await client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: ASSISTANT_PROMPT,
          abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        }
      });

      return response.text ?? "";
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) throw error;
      console.warn(`Model ${model} unavailable, trying next model...`);
    }
  }

  throw lastError;
}

export async function streamAIResponse(
  history: ChatMessage[],
  onToken: (token: string) => void | Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  const contents = history.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }]
  }));

  let lastError: unknown;

  for (const model of [PRIMARY_MODEL, ...FALLBACK_MODELS]) {
    const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const abortSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;
    let emittedText = false;

    try {
      const stream = await client.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction: ASSISTANT_PROMPT,
          abortSignal
        }
      });

      for await (const chunk of stream) {
        if (signal?.aborted) {
          throw signal.reason ?? new DOMException("The request was aborted.", "AbortError");
        }

        const token = chunk.text ?? "";
        if (!token) continue;

        emittedText = true;
        await onToken(token);
      }

      return;
    } catch (error) {
      if (signal?.aborted) throw error;

      lastError = error;
      if (emittedText) throw error;
      if (!isRetryable(error) && !timeoutSignal.aborted) throw error;

      console.warn(`Model ${model} unavailable, trying next model...`);
    }
  }

  throw lastError;
}
