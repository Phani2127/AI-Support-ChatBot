# AI Customer Support and Document Q&A

This project is a TypeScript customer-support application with two conversational
workflows:

1. **Customer support chat** retrieves relevant FAQ entries and can look up an
   order through a Gemini function call.
2. **Document Q&A** lets a user upload documents, extracts and indexes their
   contents, then answers questions using only relevant chunks from the
   documents attached to that conversation.

The document workflow is a Retrieval-Augmented Generation (RAG) system. It
combines vector similarity search with PostgreSQL full-text search, filters
each result set independently for relevance, and fuses their rankings with
Reciprocal Rank Fusion (RRF) before passing context to the language model.

## Features

- Express API written in TypeScript, with a React/Vite frontend.
- Gemini-powered chat, question rewriting, conversation summaries, and
  embeddings.
- FAQ retrieval for customer-support chat and an order-status tool.
- Document conversations with upload, processing status, history, deletion,
  and streamed answers.
- Background document processing with Redis and BullMQ.
- PDF, DOCX, spreadsheet, CSV, text, and image extraction.
- Tesseract OCR for standalone images, supported images embedded in DOCX files,
  and PDFs that contain no selectable text.
- PostgreSQL storage with pgvector embeddings and PostgreSQL full-text search.

## Frontend workspace

The root page (`/`) is a dashboard introducing the application, its RAG workflow,
and shortcuts to each workspace. The navigation includes basic chat
(`/basic-chat`), FAQ and order support (`/gemini-chat`), and document chat
(`/document-chat`). A theme toggle switches between light and dark appearance.

## Technology

| Area | Technology in this project |
| --- | --- |
| Backend/API | Node.js, TypeScript, Express 5 |
| Frontend | React 19, Vite |
| Chat and generation | Google Gemini API; default chat model `gemini-2.5-flash` |
| Embeddings | Google `gemini-embedding-001`, configured for 1536 dimensions |
| RAG integration | LangChain documents, text splitters, prompts, output parser, and PGVectorStore |
| Database | PostgreSQL, `pg` connection pool, pgvector |
| Keyword search | PostgreSQL `websearch_to_tsquery`, `to_tsvector`, and `ts_rank_cd` |
| Background jobs | Redis and BullMQ |
| OCR and file parsing | Tesseract.js, PDF.js, `@napi-rs/canvas`, Mammoth, LangChain loaders, and `xlsx` |

## How the project works

### Document Q&A: ingestion

1. The frontend creates a document conversation and uploads a file to the
   document-chat API.
2. The API validates the file, records it in PostgreSQL, attaches it to the
   conversation, and enqueues a BullMQ job. The upload response means
   **processing has started**, not that indexing is complete.
3. The separate document worker extracts readable text:
   - Text-based PDFs use PDF text extraction. If the PDF has no selectable text,
     its pages are rendered and OCRed.
   - DOCX text is extracted, and supported embedded raster images are OCRed.
   - PNG, JPEG, and WebP files are OCRed directly.
   - TXT, CSV, XLS, and XLSX contents are loaded as text.
4. The text is split into chunks using `RecursiveCharacterTextSplitter`:
   **1000 characters per chunk** with **150 characters of overlap**. Overlap
   helps preserve context across chunk boundaries.
5. Each chunk is embedded with Gemini using the
   `RETRIEVAL_DOCUMENT` task type and stored in the `document_vectors` table
   through LangChain's PGVectorStore. Chunk metadata includes the owning
   `document_id` and `chunk_index`.
6. The document is marked completed only after chunks have been stored. Search
   is limited to completed documents attached to the current conversation.

### Document Q&A: question and answer

1. The service loads recent conversation messages and asks Gemini to rewrite
   the latest question as a standalone search query. This helps follow-up
   questions resolve references while preserving the original intent.
2. The rewritten query is embedded using the `RETRIEVAL_QUERY` task type. The
   query embedding must have the configured 1536 dimensions.
3. Two retrieval branches run against the conversation's documents:
   - **Vector search** uses pgvector cosine distance (`<=>`). A candidate is
     retained when its distance is at most `VECTOR_MAX_DISTANCE`; lower
     distances indicate closer matches.
   - **Keyword search** uses PostgreSQL English full-text search with
     `websearch_to_tsquery` and `ts_rank_cd`. A candidate is retained when its
     rank is at least `KEYWORD_MIN_RANK`. For ordinary unquoted terms, the
     search converts the default conjunction to an OR query, so a useful chunk
     can match some query terms even if it does not contain every word.
     Explicit negation is preserved.
4. Each branch is filtered independently, then ranks its remaining candidates.
   The service considers up to `3 * k` candidates per branch. It combines the
   branches by chunk ID with Reciprocal Rank Fusion:

   ```text
   RRF score = 1 / (60 + vector rank) + 1 / (60 + keyword rank)
   ```

   A missing branch contributes zero. This fuses **ranks**, not raw cosine
   distances and keyword scores. Matching chunk IDs are deduplicated and ties
   are ordered deterministically; the result never exceeds `k` (the document
   retrieval service currently requests `k = 5`).
5. The selected chunks, filenames, recent conversation history, and question
   are sent to Gemini. The system prompt instructs the model to answer only
   from the supplied document content, not to follow instructions found inside
   a document, and to use this fallback when there is no relevant context or
   insufficient evidence:

   > I couldn't find sufficient information to answer this question from the uploaded documents.

6. The answer is returned as a normal response or streamed using
   Server-Sent Events. Document-chat history is persisted in PostgreSQL and
   recent messages are included in follow-up prompts.

### Customer-support chat and FAQ RAG

The `/api/gemini-chat` workflow is separate from document Q&A:

1. It embeds the incoming question as `RETRIEVAL_QUERY`.
2. It retrieves the top three FAQ rows from the `faqs` table by cosine
   similarity. This FAQ path is vector-only; it does not use the document
   workflow's hybrid search or its independent thresholds.
3. Gemini receives the retrieved FAQ context, conversation history, and any
   saved conversation summary. It is instructed not to invent an answer when
   the FAQ context is insufficient.
4. For order-specific requests, Gemini may call the declared
   `getOrderStatus` function. The backend validates the order number, queries
   the `orders` table, and returns the result to Gemini to formulate the final
   response.
5. Older messages can be summarized and removed while recent messages remain
   available as conversation history.

The separate `/api/chat` route is a basic chat flow with in-memory conversation
history; it does not use the FAQ retrieval and order-tool flow.

## RAG concepts used here

- **Retrieval-Augmented Generation (RAG):** the model is given relevant
  passages retrieved from project data at question time. The document answer
  is therefore grounded in retrieved chunks rather than relying only on model
  training knowledge.
- **Chunking and overlap:** documents are split into smaller passages so
  retrieval can select focused evidence. Overlap reduces the chance of losing
  meaning at chunk boundaries.
- **Embeddings:** text is converted into fixed-size numeric vectors. Document
  and query embeddings use Gemini's retrieval-specific task types and the same
  1536-dimensional space.
- **Vector retrieval:** cosine distance finds semantically similar chunks,
  including passages with related meaning but different wording.
- **Keyword retrieval:** PostgreSQL full-text search finds lexical matches
  using tokenization, English stemming, and ranking. This can surface exact
  terms that vector similarity might rank lower.
- **Hybrid retrieval:** the vector and keyword branches provide complementary
  signals. They are thresholded independently so a strong result from either
  branch can still be returned.
- **Relevance thresholds:** `VECTOR_MAX_DISTANCE` is a maximum distance
  (smaller is stricter); `KEYWORD_MIN_RANK` is a minimum rank (larger is
  stricter). Keyword rank values depend on the corpus and query, so calibrate
  them with retrieval evaluation examples rather than assuming one value is
  universally best.
- **Reciprocal Rank Fusion:** RRF combines candidate orderings without
  comparing unlike raw score scales. The current rank constant is 60.
- **Grounding and fallback:** the document-answer prompt limits factual
  answers to retrieved content and uses a fixed fallback when the evidence is
  missing or insufficient.
- **OCR:** scanned pages and embedded images are converted to machine-readable
  text before chunking and embedding, allowing their contents to participate
  in the same retrieval pipeline.

This project does **not** currently add a cross-encoder or other reranker after
RRF. It uses thresholded retrieval and rank fusion, then sends the selected
chunks to the language model.

## Configuration

Copy `.env.example` to `.env` and set your own Gemini API key and local
configuration. Do not commit `.env` or API keys.

| Variable | Purpose | Example/default |
| --- | --- | --- |
| `GEMINI_API_KEY` | Google Gemini API credential; required for generation and embeddings | Set your own key |
| `GEMINI_CHAT_MODEL` | Chat, rewrite, and summary model | `gemini-2.5-flash` |
| `GEMINI_MODEL` | Fallback model name used by some support routes | `gemini-2.5-flash` |
| `GEMINI_EMBEDDING_MODEL` | Embedding model | `gemini-embedding-001` |
| `GEMINI_TEMPERATURE` | LangChain chat-model temperature | `0.3` |
| `VECTOR_MAX_DISTANCE` | Maximum vector cosine distance | `.env.example`: `0.40`; code default: `0.4` |
| `KEYWORD_MIN_RANK` | Minimum PostgreSQL keyword rank | `.env.example`: `0.001`; code default: `0.01` |
| `DOCUMENT_CHAT_MAX_INPUT_TOKENS` | Prompt token budget for document chat | `10000` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | PostgreSQL connection settings | `.env.example` uses port `5433` |
| `REDIS_HOST`, `REDIS_PORT` | Redis connection settings for BullMQ | `127.0.0.1:6379` |
| `PORT` | Backend HTTP port | `.env.example`: `3003` |
| `KEEP_RECENT_MESSAGES` | Recent customer-support messages retained verbatim | `10` |
| `SUMMARY_MIN_MESSAGES` | Older messages needed to trigger a support-chat summary | `10` |
| `STREAM_DELAY_MS` | Delay between emitted pieces in streamed document answers | `60` |

The `.env.example` threshold values are starting points, not production
guarantees. In particular, keyword rank depends on the terms and contents in
your documents. Evaluate representative questions and inspect retrieval logs
before tuning either threshold.

## Local development

Prerequisites:

- Node.js and npm compatible with the versions in `package.json`.
- Docker Desktop with Docker Compose.
- A Google Gemini API key.

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env`, set `GEMINI_API_KEY`, and review the database,
   Redis, and port values. The provided Compose configuration maps PostgreSQL
   host port `5433` to container port `5432`.

3. Start PostgreSQL and Redis:

   ```powershell
   docker compose up -d postgres redis
   ```

   On a new PostgreSQL data volume, Compose runs `docker/postgres/init.sql`
   automatically. It creates the application tables and indexes. For the
   example order lookups, optionally load sample orders:

   ```powershell
   Get-Content .\docker\postgres\seed.sql | docker compose exec -T postgres psql -U admin -d support_db
   ```

   Replace the database user and name with your `.env` values if you changed
   the defaults. Docker does not rerun initialization scripts for an existing
   data volume. To apply the idempotent schema script to an existing local
   container, run:

   ```powershell
   Get-Content .\docker\postgres\init.sql | docker compose exec -T postgres psql -U admin -d support_db
   ```

4. Start the API, document worker, and frontend in separate terminals:

   ```powershell
   npm run dev
   ```

   ```powershell
   npm run worker:documents
   ```

   ```powershell
   npm run dev:frontend
   ```

   The example configuration uses backend port `3003`, which matches the Vite
   API proxy. The frontend is served at `http://localhost:5173`. If you change
   the backend port, update the proxy in `vite.config.ts` as well.

5. Check backend availability at `http://localhost:3003/health`.

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run build` | Compile TypeScript into `dist/` |
| `npm test` | Run hybrid-search integration tests; requires a PostgreSQL database with pgvector |
| `npm run ingest:faqs` | Insert the sample FAQ set into the `faqs` table |
| `npm run test:search` | Run the repository's search test script |

`npm run ingest:faqs` inserts new rows with generated IDs. It is not an
idempotent upsert, so repeated runs can add duplicate sample FAQs.

## Database schema and indexes

`docker/postgres/init.sql` is the project schema bootstrap. It enables pgvector
and creates:

- `faqs` for FAQ questions, answers, and 1536-dimensional embeddings.
- `orders` for order-status tool lookups.
- `conversations` and `messages` for the basic and Gemini customer-support
  chats. `conversations.summary` stores compacted chat history.
- `document_conversations`, `documents`, `conversation_documents`, and
  `document_messages` for document-chat sessions, uploads, attachments, and
  history.
- `document_vectors` for LangChain PGVectorStore content, metadata, and
  embeddings.

The application does **not** use the sample `document_chunks` table from some
manual setups. Document chunks are stored in `document_vectors`, with
`document_id` and `chunk_index` in its JSON metadata.

The bootstrap adds HNSW cosine indexes for `faqs.embedding` and
`document_vectors.embedding`, a GIN expression index for
`to_tsvector('english', text)`, and a B-tree expression index for the
`document_id` metadata filter. It also adds the conversation/message and
document relationship indexes used by the API. The full SQL is in
`docker/postgres/init.sql`; optional sample order rows are in
`docker/postgres/seed.sql`. FAQ samples are inserted separately by
`npm run ingest:faqs`.

The schema script uses `IF NOT EXISTS` for repeatable setup, but it is not a
general-purpose migration system: that clause will not update the definition of
an already-existing table. Review existing schemas before applying changes to
databases with custom table definitions. On large, actively used databases,
build new indexes with `CREATE INDEX CONCURRENTLY` in a separate, non-transactional
operation to reduce write blocking.

HNSW is approximate nearest-neighbor search. It can reduce vector-search
latency, but recall and index size/build time depend on the corpus and
parameters. Verify retrieval quality and query plans on your own data. The
full-text branch continues to use its GIN index independently.

## API overview

All document endpoints are under `/api/document-chat`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | API health check |
| `POST` | `/api/chat` | Basic in-memory chat |
| `POST` | `/api/chat/stream` | Stream a basic-chat answer as Server-Sent Events |
| `POST` | `/api/gemini-chat` | FAQ-grounded support chat and order lookup |
| `GET` | `/api/document-chat/conversations` | List document conversations |
| `POST` | `/api/document-chat/conversations` | Create a document conversation |
| `POST` | `/api/document-chat/conversations/:conversationId/upload` | Upload a file as multipart field `file` |
| `GET` | `/api/document-chat/conversations/:conversationId/documents` | List conversation documents and processing status |
| `DELETE` | `/api/document-chat/conversations/:conversationId/documents/:documentId` | Delete a document and its vectors |
| `GET` | `/api/document-chat/conversations/:conversationId/messages` | Load document-chat history |
| `POST` | `/api/document-chat/conversations/:conversationId/messages` | Ask a document question and receive a complete answer |
| `POST` | `/api/document-chat/conversations/:conversationId/messages/stream` | Ask a question and receive Server-Sent Events |

Document uploads are limited to 10 MB. Supported upload extensions are PDF,
DOCX, XLSX, XLS, TXT, CSV, PNG, JPG/JPEG, and WebP. The server checks file
signatures for formats that support reliable signature detection.

## Processing and retrieval limitations

- OCR is configured for English (`eng`). OCR accuracy depends on scan quality,
  page layout, and image resolution.
- A PDF with no selectable text is OCRed page by page. A mixed PDF containing
  some selectable text and some image-only pages currently follows the text
  extraction path if any text is found; its scanned pages are not separately
  OCRed.
- DOCX image OCR supports embedded PNG, JPEG, WebP, BMP, and TIFF images. The
  upload endpoint itself accepts PNG, JPEG, and WebP as standalone image files.
- Existing uploads are not automatically reprocessed when extraction or
  embedding code changes. Re-upload or reprocess a document to replace its
  stored chunks and embeddings.
- The FAQ workflow uses top-three vector similarity without the document-chat
  threshold or RRF logic.
- Thresholds trade recall for precision and should be evaluated on the target
  content, not copied blindly from the example environment file.

