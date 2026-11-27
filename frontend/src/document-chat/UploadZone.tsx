import { DragEvent, useRef, useState } from "react";
import { ACCEPTED_FILES, ACCEPTED_LABEL } from "./api";
import type { DocumentStatus, UploadedDocument } from "./types";
import Icon, { type IconName } from "../Icon";

const STATUS_ICON: Record<DocumentStatus, IconName> = {
  processing: "clock",
  completed: "check",
  failed: "alert"
};
const STATUS_LABEL: Record<DocumentStatus, string> = {
  processing: "Processing...",
  completed: "Ready",
  failed: "Failed"
};

type Props = {
  documents: UploadedDocument[];
  uploading: boolean;
  deletingId: number | null;
  onFiles: (files: File[]) => void;
  onDelete: (documentId: number) => void;
};

// Drag-and-drop / click-to-upload area plus the list of attached documents.
export default function UploadZone({ documents, uploading, deletingId, onFiles, onDelete }: Props) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(files: File[]) {
    onFiles(files);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pick(Array.from(e.dataTransfer.files));
  }

  return (
    <div
      className={`upload-bar${dragging ? " dragging" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <label className="drop-zone">
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept={ACCEPTED_FILES}
          disabled={uploading}
          onChange={(e) => pick(Array.from(e.target.files ?? []))}
        />
        <span className="upload-icon"><Icon name="upload" size={21} /></span>
        <span className="upload-copy">
          <strong>{uploading ? "Uploading your documents..." : "Add documents to your conversation"}</strong>
          <span>{uploading ? "Your files will be searchable when processing finishes" : `Drop files here or click to browse · ${ACCEPTED_LABEL}`}</span>
        </span>
        <span className="upload-action">
          <Icon name="plus" size={16} />
          Browse files
        </span>
      </label>

      {documents.length > 0 && (
        <div className="doc-list">
          {documents.map((document) => (
            <span
              key={document.id}
              className={`doc-chip ${document.status}`}
              title={`${document.file_name} — ${STATUS_LABEL[document.status]}`}
            >
              <span className="doc-status"><Icon name={STATUS_ICON[document.status]} size={14} /></span>
              <span className="doc-name">{document.file_name}</span>
              <button
                type="button"
                className="doc-delete"
                aria-label={`Delete ${document.file_name}`}
                title={`Delete ${document.file_name}`}
                disabled={deletingId !== null}
                onClick={() => onDelete(document.id)}
              >
                {deletingId === document.id ? <span className="delete-loading" /> : <Icon name="trash" size={13} />}
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
