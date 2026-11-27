import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";

export const UPLOAD_DIR = "uploads/documents/";
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const allowedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/webp",
];

// Saves uploads to disk under a random name so files never overwrite each other.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${extension}`);
  },
});

// First-pass check on the client-declared MIME type only.
// Real content validation happens in document-upload.service.ts.
const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type."));
  }
};

export const documentUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});
