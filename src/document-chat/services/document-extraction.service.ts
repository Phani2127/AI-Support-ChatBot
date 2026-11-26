import fs from "fs/promises";
import path from "path";
import { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import * as XLSX from "xlsx";

/** One Document per sheet. CSV is read as a single-sheet workbook. */
async function loadSpreadsheet(filePath: string): Promise<Document[]> {
  // XLSX.readFile isn't available in the ESM build of xlsx, so parse a buffer instead.
  const workbook = XLSX.read(await fs.readFile(filePath), { type: "buffer" });

  return workbook.SheetNames.map(
    (sheetName) =>
      new Document({
        pageContent: `Sheet: ${sheetName}\n\n${XLSX.utils.sheet_to_csv(
          workbook.Sheets[sheetName]
        )}`,
        metadata: { sheet: sheetName },
      })
  );
}

async function load(filePath: string, fileType: string): Promise<Document[]> {
  const extension = path.extname(filePath).toLowerCase();

  if (fileType === "application/pdf" || extension === ".pdf") {
    // One Document for the whole PDF so chunks can run across page breaks.
    return new PDFLoader(filePath, { splitPages: false }).load();
  }

  if (extension === ".docx") {
    return new DocxLoader(filePath).load();
  }

  if (extension === ".txt") {
    return new TextLoader(filePath).load();
  }

  // LangChain has no .xlsx loader, and its CSV loader makes one tiny Document per row,
  // which retrieves poorly. Sheets are kept whole instead.
  if ([".xlsx", ".xls", ".csv"].includes(extension)) {
    return loadSpreadsheet(filePath);
  }

  throw new Error(`Unsupported document format: ${extension}`);
}

/**
 * Read an uploaded file into LangChain Documents.
 * Throws if the format is unsupported or the file has no readable text.
 */
export async function extractDocuments(
  filePath: string,
  fileType: string
): Promise<Document[]> {
  const documents = (await load(filePath, fileType)).filter((doc) =>
    doc.pageContent.trim()
  );

  if (documents.length === 0) {
    throw new Error("No readable text found in the document.");
  }

  return documents;
}
