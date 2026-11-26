
import { GoogleGenAI, type FunctionDeclaration } from "@google/genai";
import { getOrderStatus } from "./order.service.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Describe the function Gemini is allowed to request.
const getOrderStatusTool: FunctionDeclaration = {
  name: "getOrderStatus",
  description: "Look up the current status of an order using its order number.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      orderNumber: {
        type: "string",
        description: "The order number provided by the customer.",
      },
    },
    required: ["orderNumber"],
  },
};

export async function askGeminiWithTools(message: string): Promise<string> {
  // 1. Send the customer's message and available tool to Gemini.
  const response = await ai.models.generateContent({
    model,
    contents: message,
    config: {
      tools: [{ functionDeclarations: [getOrderStatusTool] }],
    },
  });

  // 2. Check whether Gemini requested a function call.
  const functionCall = response.functionCalls?.[0];

  // No function call: return Gemini's normal response.
  if (!functionCall) {
    return response.text || "I couldn't generate a response.";
  }

  // 3. Execute only the function we explicitly allow.
  if (functionCall.name !== "getOrderStatus") {
    throw new Error("Unsupported function requested by Gemini");
  }

  const args = functionCall.args;

  if (
    !args ||
    typeof args.orderNumber !== "string" ||
    args.orderNumber.trim().length === 0 ||
    args.orderNumber.length > 50
  ) {
    throw new Error("Invalid order number supplied by Gemini");
  }

  const order = await getOrderStatus(args.orderNumber.trim());

  const toolResult = order
    ? {
        found: true,
        orderNumber: order.order_number,
        status: order.status,
        totalAmount: order.total_amount,
      }
    : {
        found: false,
        message: "No order was found with that order number.",
      };

  // 4. Send the function result back to Gemini.
  const modelContent = response.candidates?.[0]?.content;

  if (!modelContent) {
    throw new Error("Gemini did not return the function-call conversation");
  }

  const finalResponse = await ai.models.generateContent({
    model,
    contents: [
      { role: "user", parts: [{ text: message }] },
      modelContent,
      {
        role: "user",
        parts: [
          {
            functionResponse: {
              name: functionCall.name,
              response: { result: toolResult },
            },
          },
        ],
      },
    ],
  });

  return finalResponse.text || "I couldn't generate a response.";
}
