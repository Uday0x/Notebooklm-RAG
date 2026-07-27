# MarginNote
deployment link:https://notebooklm-1qtp1nc1o-udays-projects-68de3756.vercel.app
A NotebookLM-inspired AI research assistant that lets users upload multiple knowledge sources, index them using vector embeddings, and chat with grounded answers backed by citations.

The project is built with a production-oriented architecture using Express, PostgreSQL, Redis, BullMQ, Qdrant, OpenAI, and React.

---

# Features

- 📄 Upload PDF documents
- 🌐 Index websites
- 🎥 Import YouTube videos (captions + audio fallback)
- 📝 Add plain text notes
- 📑 Support DOCX files
- 📺 Support VTT transcripts

---

# AI Features

- Retrieval-Augmented Generation (RAG)
- Semantic search using OpenAI embeddings
- Qdrant vector database
- Multi-source retrieval
- Grounded answers
- Source citations
- Conversation history
- Query rewriting for follow-up questions
- Automatic conversation title generation
- Streaming AI responses
- Reference panel for retrieved chunks

---

# Architecture

```
                   Upload Source
                         │
                         ▼
                  Source Parser
                         │
                         ▼
                 Text Segmentation
                         │
                         ▼
                    Chunking
                         │
                         ▼
              OpenAI Embeddings
                         │
                         ▼
                Qdrant Vector DB
                         │
                         ▼
                  Semantic Search
                         │
                         ▼
                  Prompt Builder
                         │
                         ▼
                     GPT Model
                         │
                         ▼
           Grounded Response + Citations
```

---

# Tech Stack

## Frontend

- React
- Vite
- TanStack Query
- React Router
- TailwindCSS
- Streaming Chat UI

---

## Backend

- Express
- Prisma ORM
- PostgreSQL
- Redis
- BullMQ
- OpenAI SDK
- Qdrant
- Multer
- Playwright
- yt-dlp
- FFmpeg

---

# Folder Structure

```
backend
│
├── api
│
├── parser
│   ├── pdf
│   ├── website
│   ├── youtube
│   ├── docx
│   ├── text
│   └── vtt
│
├── chunking
│
├── embeddings
│
├── indexing
│
├── retrieval
│
├── generation
│
├── query-rewrite
│
├── worker
│
├── storage
│
├── uploads
│
└── prisma

frontend
│
├── components
├── pages
├── hooks
├── services
├── features
└── layouts
```

---

# RAG Pipeline

```
Source Upload

↓

Parse Source

↓

Extract Text

↓

Chunk Text

↓

Generate Embeddings

↓

Store Vectors in Qdrant

↓

User Question

↓

Rewrite Query

↓

Semantic Retrieval

↓

Prompt Construction

↓

LLM Response

↓

Grounded Answer + Citations
```

---

# Supported Sources

| Source | Status |
|---------|--------|
| PDF | ✅ |
| Website | ✅ |
| YouTube | ✅ |
| DOCX | ✅ |
| TXT | ✅ |
| VTT | ✅ |

---

# Current Capabilities

## Source Management

- Create notebooks
- Upload multiple sources
- Background processing
- Processing progress
- Automatic indexing
- Delete sources
- Re-index support

---

## Chat

- Multiple conversations
- Streaming responses
- Conversation history
- Query rewriting
- Automatic titles
- Grounded answers
- Citations
- Source selection

---

## Retrieval

- Semantic search
- Multiple source retrieval
- Notebook filtering
- Source filtering
- Similarity search
- Citation generation

---

# Processing Pipeline

## PDF

```
Upload

↓

Extract text

↓

Create segments

↓

Chunk

↓

Embed

↓

Store in Qdrant
```

---

## Website

```
Fetch HTML

↓

Readability

↓

Fallback extraction

↓

Playwright (JS websites)

↓

Chunk

↓

Embed
```

---

## YouTube

```
Captions Available

↓

Transcript

↓

Chunk

↓

Embed
```

or

```
No Captions

↓

Download Audio

↓

FFmpeg

↓

Whisper

↓

Chunk

↓

Embed
```

---

# Conversation Flow

```
Question

↓

Conversation History

↓

Query Rewrite

↓

Vector Search

↓

Prompt Builder

↓

GPT

↓

Grounded Response

↓

Save Messages
```

---

# Backend Services

| Service | Purpose |
|----------|----------|
| PostgreSQL | Metadata |
| Redis | Queue |
| BullMQ | Background processing |
| Qdrant | Vector storage |
| OpenAI | Embeddings + Generation |

---

# Environment Variables

```env
DATABASE_URL=

REDIS_URL=

OPENAI_API_KEY=

QDRANT_URL=
QDRANT_API_KEY=
QDRANT_COLLECTION=rag_chunks

UPLOAD_DIR=uploads

EMBEDDING_MODEL=text-embedding-3-small
GENERATION_MODEL=gpt-4.1-mini

QUERY_REWRITE_MODEL=gpt-4.1-mini
CONVERSATION_TITLE_MODEL=gpt-4.1-mini

YOUTUBE_AUDIO_FALLBACK_ENABLED=true

WEBSITE_BROWSER_FALLBACK_ENABLED=true
```

---

# Local Development

## Clone

```bash
git clone <repo-url>

cd MarginNote
```

---

## Install

Backend

```bash
cd backend

npm install
```

Frontend

```bash
cd frontend

npm install
```

---

## Start Infrastructure

- PostgreSQL
- Redis
- Qdrant

or

```bash
docker compose up
```

---

## Run Prisma

```bash
npx prisma migrate dev

npx prisma generate
```

---

## Start Backend

```bash
npm run dev
```

---

## Start Worker

```bash
node worker/source.worker.js
```

---

## Start Frontend

```bash
npm run dev
```

---

# Deployment

Frontend

- Vercel

Backend

- Railway

Storage

- Railway Volume (current)
- Object Storage (future)

Database

- PostgreSQL

Queue

- Redis

Vector DB

- Qdrant Cloud

---

# Roadmap

- Authentication
- Team Workspaces
- Shared Notebooks
- OCR Support
- Image Retrieval
- Audio Upload
- PowerPoint Support
- Excel Support
- Markdown Support
- Hybrid Search
- Reranking
- Web Search Integration
- Better Source Highlighting

---

# Screenshots

(Add screenshots here)

---

# Acknowledgements

Inspired by:

- Google NotebookLM
- Retrieval-Augmented Generation (RAG)
- OpenAI
- Qdrant

---

# License

MIT

---

# Author

**Uday K**

If you found this project useful, consider giving it a ⭐ on GitHub!