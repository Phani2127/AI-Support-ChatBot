export type Message = {
  role: "user" | "assistant" | "error";
  content: string;
};

export type DocumentStatus = "processing" | "completed" | "failed";

export type UploadedDocument = {
  id: number;
  file_name: string;
  status: DocumentStatus;
};

export type ConversationSummary = {
  id: number;
  title: string;
  file_names: string[];
};
