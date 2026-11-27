import fs from "fs/promises";
import path from "path";
import { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { createCanvas } from "@napi-rs/canvas";
import mammoth from "mammoth";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createWorker } from "tesseract.js";
import * as XLSX from "xlsx";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const OCR_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/bmp",
  "image/tiff",
]);

async function recognizeImages(
  images: Array<string | Buffer>,
  source: string
): Promise<Document[]> {
  if (images.length === 0) return [];

  const worker = await createWorker("eng");
  const documents: Document[] = [];
  let extractedCharacters = 0;

  try {
    for (const [index, image] of images.entries()) {
      const {
        data: { text },
      } = await worker.recognize(image);
      const extractedText = text.trim();

      if (extractedText) {
        extractedCharacters += extractedText.length;
        documents.push(
          new Document({
            pageContent: extractedText,
            metadata: {
              source,
              image_index: index + 1,
              extraction_method: "ocr",
            },
          })
        );
      }
    }
  } finally {
    await worker.terminate();
  }

  console.log(
    `[document-ocr] Extracted ${extractedCharacters} characters from ${images.length} image(s) in ${source}`
  );
  return documents;
}

async function loadImage(filePath: string): Promise<Document[]> {
  return recognizeImages([filePath], path.basename(filePath));
}

async function loadDocx(filePath: string): Promise<Document[]> {
  const embeddedImages: Buffer[] = [];
  await mammoth.convertToHtml(
    { path: filePath },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        if (OCR_IMAGE_MIME_TYPES.has(image.contentType)) {
          embeddedImages.push(await image.readAsBuffer());
        }
        return { src: "" };
      }),
    }
  );

  const documents = await new DocxLoader(filePath).load();
  const imageDocuments = await recognizeImages(
    embeddedImages,
    path.basename(filePath)
  );
  return [...documents, ...imageDocuments];
}

async function loadScannedPdf(filePath: string): Promise<Document[]> {
  const pdf = await getDocument({
    data: new Uint8Array(await fs.readFile(filePath)),
  }).promise;
  console.log(
    `[document-ocr] No selectable text found; OCRing ${pdf.numPages} pages in ${path.basename(filePath)}`
  );
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  const documents: Document[] = [];
  let extractedCharacters = 0;

  try {
    worker = await createWorker("eng");

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const initialViewport = page.getViewport({ scale: 2 });
      const pixelLimit = 16_000_000;
      const scale =
        2 *
        Math.min(
          1,
          Math.sqrt(
            pixelLimit / (initialViewport.width * initialViewport.height)
          )
        );
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height)
      );

      try {
        await page.render({
          canvas: null,
          canvasContext: canvas.getContext("2d") as unknown as CanvasRenderingContext2D,
          viewport,
        }).promise;
        const result = await worker.recognize(canvas.toBuffer("image/png"));
        console.log("[OCR]", {
          page: pageNumber,
          confidence: result.data.confidence,
          characters: result.data.text.trim().length,
        });
        const text = result.data.text;
        const pageText = text.trim();

        if (pageText) {
          extractedCharacters += pageText.length;
          documents.push(
            new Document({
              pageContent: pageText,
              metadata: {
                source: path.basename(filePath),
                page: pageNumber,
                extraction_method: "ocr",
              },
            })
          );
        }
      } finally {
        page.cleanup();
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  } finally {
    try {
      await worker?.terminate();
    } finally {
      await pdf.destroy();
    }
  }

  console.log(
    `[document-ocr] Extracted ${extractedCharacters} characters from ${path.basename(filePath)} (${pdf.numPages} pages)`
  );
  return documents;
}

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

  if (IMAGE_EXTENSIONS.has(extension)) {
    return loadImage(filePath);
  }

  if (fileType === "application/pdf" || extension === ".pdf") {
    // Keep text-based PDFs in one document so chunks can run across page breaks.
    const documents = await new PDFLoader(filePath, {
      splitPages: false,
    }).load();
    return documents.some((document) => document.pageContent.trim())
      ? documents
      : loadScannedPdf(filePath);
  }

  if (extension === ".docx") {
    return loadDocx(filePath);
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
