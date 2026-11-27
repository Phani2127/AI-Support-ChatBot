import fs from "node:fs/promises";
import path from "node:path";
import { fileTypeFromFile } from "file-type";
import { pool } from "../../config/database.js";

export interface UploadedDocument {
  id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  status: string;
  created_at: Date;
}

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".xlsx",
  ".xls",
  ".docx",
  ".txt",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
];

// Signature-checked formats: the detected MIME must match the extension.
const EXPECTED_MIME: Record<string, { mime: string; error: string }> = {
  ".pdf": { mime: "application/pdf", error: "Invalid PDF file." },
  ".xlsx": {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    error: "Invalid Excel file.",
  },
  ".xls": { mime: "application/vnd.ms-excel", error: "Invalid XLS file." },
  ".docx": {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    error: "Invalid Word document.",
  },
  ".png": { mime: "image/png", error: "Invalid PNG image." },
  ".jpg": { mime: "image/jpeg", error: "Invalid JPEG image." },
  ".jpeg": { mime: "image/jpeg", error: "Invalid JPEG image." },
  ".webp": { mime: "image/webp", error: "Invalid WebP image." },
};

/** Verify the stored file really is what its extension claims. Throws if not. */
export async function validateUploadedFile(
  filePath: string,
  originalName: string
): Promise<void> {
  const extension = path.extname(originalName).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new Error("Unsupported file extension.");
  }

  const buffer = await fs.readFile(filePath);

  if (buffer.length === 0) {
    throw new Error("Uploaded file is empty.");
  }

  const expected = EXPECTED_MIME[extension];
  if (expected) {
    const detected = await fileTypeFromFile(filePath);
    if (detected?.mime !== expected.mime) {
      throw new Error(expected.error);
    }
    return;
  }

  // TXT and CSV have no reliable signature; reject binary content instead.
  if (buffer.toString("utf8").includes("\u0000")) {
    throw new Error("Invalid text or CSV file.");
  }
}

/** Insert the document record and attach it to the conversation atomically. */
export async function saveAndAttachDocument(
  file: Express.Multer.File,
  conversationId: number
): Promise<UploadedDocument> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const conversation = await client.query(
      `SELECT id
       FROM document_conversations
       WHERE id = $1
       FOR UPDATE`,
      [conversationId]
    );

    if (conversation.rows.length === 0) {
      throw new Error("Document conversation not found.");
    }

    const documentResult = await client.query(
      `INSERT INTO documents (
        file_name,
        file_type,
        file_size,
        file_path,
        status
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [file.originalname, file.mimetype, file.size, file.path, "processing"]
    );

    const document = documentResult.rows[0] as UploadedDocument;

    await client.query(
      `INSERT INTO conversation_documents (conversation_id, document_id)
       VALUES ($1, $2)`,
      [conversationId, document.id]
    );

    await client.query("COMMIT");

    return document;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
