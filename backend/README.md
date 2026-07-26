# NotebookLM RAG Backend

Express.js backend for notebook-based retrieval augmented generation. It stores notebooks, sources, conversations, and messages in PostgreSQL through Prisma; processes sources through BullMQ/Redis; indexes chunks in Qdrant; and uses OpenAI for embeddings, query rewriting, title generation, and grounded answers.

## Architecture

- `app.js`: Express app, health/readiness/config endpoints, route mounting, graceful shutdown.
- `api/notebooks`: notebook CRUD and stats.
- `api/sources`: source creation, upload, status, cleanup.
- `api/conversations`: conversation CRUD.
- `api/messages`: chat pipeline, message history, JSON and SSE responses.
- `parser`, `chunking`, `embeddings`, `indexing`, `retrieval`, `generation`: RAG pipeline modules.
- `queues`, `worker`: BullMQ source processing.
- `storage`: local upload storage and cleanup helpers.
- `database`, `db`: readiness clients and Prisma client.

## Environment

Copy `.env.example` to `.env` and fill in secrets:

```bash
cp .env.example .env
```

Required for a live RAG run: `DATABASE_URL`, Redis connection, `QDRANT_URL`, and `OPENAI_API_KEY`. Safe frontend-facing config is available at `GET /api/config`; secrets are never returned there.

## Local Setup

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Start the worker separately:

```bash
npm run worker:dev
```

For YouTube sources, captions are attempted first. When captions are disabled
or unavailable, the worker can fall back to audio transcription if
`YOUTUBE_AUDIO_FALLBACK_ENABLED=true`. Install `yt-dlp` and `ffmpeg` on the
host PATH before starting the API/worker. The fallback downloads audio into a
unique temporary directory, transcribes it with OpenAI's audio transcription
API, preserves segment timestamps, and removes temporary files in cleanup.

Useful fallback settings:

- `YOUTUBE_AUDIO_FALLBACK_ENABLED`
- `YOUTUBE_MAX_DURATION_SECONDS`
- `YOUTUBE_MAX_AUDIO_BYTES`
- `AUDIO_TRANSCRIPTION_MODEL`

## Docker Setup

```bash
docker compose up -d postgres redis qdrant
npm run prisma:deploy
npm run dev
npm run worker:dev
```

To run API and worker in containers too:

```bash
docker compose up --build
docker compose exec api npm run prisma:deploy
```

The API and worker share the `uploads_data` volume. Container service URLs use `postgres`, `redis`, and `qdrant`.

## Source Processing Flow

1. Create or upload a source.
2. A BullMQ job is queued with `sourceId`.
3. Worker marks the source `PROCESSING`.
4. Parser extracts segments.
5. Chunker creates chunks.
6. OpenAI creates embeddings.
7. Qdrant stores vectors.
8. Worker marks source `READY`, or `FAILED` with a concise error.

Statuses: `PENDING`, `PROCESSING`, `READY`, `FAILED`.

## Chat Flow

1. Validate conversation and ready sources.
2. Load recent conversation history.
3. Generate a title for the first message when needed.
4. Rewrite follow-up question into a standalone search query.
5. Save the original user message.
6. Retrieve chunks from Qdrant.
7. Generate a grounded answer with citations.
8. Save assistant message and touch the conversation.

## Streaming

Use POST with `Accept: text/event-stream`:

```bash
curl -N \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"content":"Explain the main concept simply"}' \
  http://localhost:8000/api/conversations/CONVERSATION_ID/messages
```

Events: `metadata`, `token`, `complete`, `error`. Browser `EventSource` cannot directly POST, so use `fetch` plus stream parsing.

## Endpoints

- `GET /health`
- `GET /ready`
- `GET /api/config`
- `POST /api/notebooks`
- `GET /api/notebooks`
- `GET /api/notebooks/:notebookId`
- `PATCH /api/notebooks/:notebookId`
- `DELETE /api/notebooks/:notebookId`
- `GET /api/notebooks/:notebookId/stats`
- `POST /api/notebooks/:notebookId/sources`
- `POST /api/notebooks/:notebookId/sources/upload`
- `GET /api/notebooks/:notebookId/sources`
- `GET /api/sources/:sourceId`
- `GET /api/sources/:sourceId/status`
- `PATCH /api/sources/:sourceId`
- `DELETE /api/sources/:sourceId`
- `POST /api/notebooks/:notebookId/conversations`
- `GET /api/notebooks/:notebookId/conversations`
- `GET /api/conversations/:conversationId`
- `PATCH /api/conversations/:conversationId`
- `DELETE /api/conversations/:conversationId`
- `GET /api/conversations/:conversationId/messages`
- `POST /api/conversations/:conversationId/messages`

## Examples

Create a text source:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"title":"Notes","type":"TEXT","content":"RAG combines retrieval with generation."}' \
  http://localhost:8000/api/notebooks/NOTEBOOK_ID/sources
```

Upload a PDF:

```bash
curl -X POST \
  -F "title=Paper" \
  -F "file=@paper.pdf" \
  http://localhost:8000/api/notebooks/NOTEBOOK_ID/sources/upload
```

Load message history:

```bash
curl "http://localhost:8000/api/conversations/CONVERSATION_ID/messages?limit=20"
```

## Cleanup

Deleting a source removes matching Qdrant vectors, deletes the stored local file when present, and then deletes the database row. Deleting a notebook removes notebook vectors, source files, and the notebook row; Prisma cascades sources, conversations, and messages.

## Testing

```bash
npm test
npm run test:smoke
```

`npm test` covers lightweight API behavior without calling OpenAI. `npm run test:smoke` prints the full manual curl flow for a live stack.

## Troubleshooting

- `/health` only proves the HTTP process is running.
- `/ready` checks PostgreSQL, Redis, and Qdrant and returns `503` when any are unavailable.
- If source processing stays `PENDING`, make sure the worker is running.
- If sources fail during embedding or chat fails during retrieval/generation, verify `OPENAI_API_KEY`.
- If uploads fail, check file extension, MIME type, and `MAX_UPLOAD_BYTES`.
- If YouTube audio fallback fails immediately, verify `yt-dlp` and `ffmpeg`
  are installed and the video is public, accessible, and within configured
  duration and audio-size limits.

## Known Limitations

- No authentication or multi-user isolation.
- Local file storage only.
- Semantic-only retrieval.
- External website/YouTube parsing depends on remote content availability.
- No OCR or image sources.
- No rate limiting, RBAC, billing, or frontend.
