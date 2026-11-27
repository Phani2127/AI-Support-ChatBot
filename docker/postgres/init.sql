CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS faqs (
  id UUID PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  embedding VECTOR(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  total_amount DECIMAL(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS summary TEXT;

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL
    REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_conversations (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  file_path TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_documents (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL
    REFERENCES document_conversations(id) ON DELETE CASCADE,
  document_id BIGINT NOT NULL
    REFERENCES documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_conversation_document
    UNIQUE (conversation_id, document_id)
);

CREATE TABLE IF NOT EXISTS document_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL
    REFERENCES document_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LangChain PGVectorStore uses these default column names and creates the table
-- itself if it is missing. Defining it here also allows indexes at bootstrap.
CREATE TABLE IF NOT EXISTS document_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  embedding VECTOR(1536) NOT NULL
);

CREATE INDEX IF NOT EXISTS faqs_embedding_hnsw_idx
  ON faqs USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS document_vectors_embedding_hnsw_idx
  ON document_vectors USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS document_vectors_text_search_idx
  ON document_vectors USING GIN (to_tsvector('english', text));

CREATE INDEX IF NOT EXISTS document_vectors_document_id_idx
  ON document_vectors ((metadata->>'document_id'));

CREATE INDEX IF NOT EXISTS messages_conversation_recent_idx
  ON messages (conversation_id, id DESC);

CREATE INDEX IF NOT EXISTS document_messages_conversation_recent_idx
  ON document_messages (conversation_id, id DESC);

CREATE INDEX IF NOT EXISTS conversation_documents_document_id_idx
  ON conversation_documents (document_id);

CREATE INDEX IF NOT EXISTS documents_status_idx
  ON documents (status);
