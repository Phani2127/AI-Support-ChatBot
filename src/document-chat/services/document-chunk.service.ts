import type { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// Splits on paragraphs, then lines, then spaces, then characters (in that order of
// preference), so chunks end at natural boundaries instead of mid-sentence.
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 150,
});

/** Split loaded documents into overlapping chunks (metadata is carried over). */
export async function splitDocumentsIntoChunks(
  documents: Document[]
): Promise<Document[]> {
  const chunks = await splitter.splitDocuments(documents);

  return chunks.filter((chunk) => chunk.pageContent.trim());
}
