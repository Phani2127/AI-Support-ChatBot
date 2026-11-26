import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
  type GoogleGenerativeAIEmbeddingsParams,
} from "@langchain/google-genai";

type TaskType = NonNullable<GoogleGenerativeAIEmbeddingsParams["taskType"]>;

/** Must match the vector size of the document_vectors table. */
export const EMBEDDING_DIMENSIONS = 1536;

const apiKey = process.env.GEMINI_API_KEY;
const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";

export const chatModelName =
  process.env.GEMINI_CHAT_MODEL ||
  process.env.GEMINI_MODEL ||
  "gemini-2.5-flash";

const temperatureValue = process.env.GEMINI_TEMPERATURE;
export const chatModelTemperature =
  temperatureValue === undefined ? 0.3 : Number(temperatureValue);

if (
  temperatureValue?.trim() === "" ||
  !Number.isFinite(chatModelTemperature) ||
  chatModelTemperature < 0 ||
  chatModelTemperature > 2
) {
  throw new Error("GEMINI_TEMPERATURE must be a number between 0 and 2.");
}

// Gemini embeds documents and queries differently, so each gets its own instance.
export const documentEmbeddings = new GoogleGenerativeAIEmbeddings({
  apiKey,
  model: embeddingModel,
  taskType: "RETRIEVAL_DOCUMENT" as TaskType,
  outputDimensionality: EMBEDDING_DIMENSIONS,
});

export const queryEmbeddings = new GoogleGenerativeAIEmbeddings({
  apiKey,
  model: embeddingModel,
  taskType: "RETRIEVAL_QUERY" as TaskType,
  outputDimensionality: EMBEDDING_DIMENSIONS,
});

export const chatModel = new ChatGoogleGenerativeAI({
  apiKey,
  model: chatModelName,
  temperature: chatModelTemperature,
});
