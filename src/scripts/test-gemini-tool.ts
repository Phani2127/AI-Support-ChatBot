import "dotenv/config";
import { askGeminiWithTools } from "../services/gemini-tool.service.js";

async function main() {
  try {
    const answer = await askGeminiWithTools(
      "Can you check the status of my order 12345?"
    );

    console.log("Gemini:", answer);
  } catch (error) {
    console.error("Test failed:", error);
  }
}

main();
