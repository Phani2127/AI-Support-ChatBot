
import "dotenv/config";
import { retrieveFAQs } from "../services/faq-retrieval.service.js";

async function main(): Promise<void> {
  const query = "I forgot my password. How can I log in?";

  console.log("Customer question:", query);

  const results = await retrieveFAQs(query);

  console.log("\nRelevant FAQs:");

  results.forEach((faq, index) => {
    console.log(`\n${index + 1}. ${faq.question}`);
    console.log(`Answer: ${faq.answer}`);
    console.log(`Similarity: ${faq.similarity}`);
  });
}

main().catch((error: unknown) => {
  console.error("Search failed:", error);
  process.exitCode = 1;
});
