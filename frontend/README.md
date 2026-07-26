# MarginNote Frontend

React + Vite frontend for the NotebookLM-style RAG backend in this repository.

## Visual Approach

The UI uses a warm notebook-paper surface, subtle grid texture, hand-drawn borders, taped cards, pastel accents, and sketch-like controls. Long reading surfaces use the system sans-serif stack for readability; the handwriting-style fallback is limited to headings, labels, and buttons.

## Stack

- React 19
- Vite
- React Router
- TanStack Query
- Lucide React
- React Markdown with GitHub-flavored Markdown
- Vitest and React Testing Library

## Routes

- `/` landing page
- `/notebooks` notebook dashboard
- `/notebooks/:notebookId?conversation=:conversationId` workspace
- unknown routes render a styled 404 state

## Environment

Create `.env` from `.env.example`:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

Use `npm.cmd` in PowerShell if local script execution blocks `npm.ps1`.

## Running

Start backend dependencies and services from `../backend` first:

```bash
npm.cmd run dev
npm.cmd run worker:dev
```

Then run the frontend:

```bash
npm.cmd run dev
```

Build:

```bash
npm.cmd run build
```

Test:

```bash
npm.cmd run test
```

Lint:

```bash
npm.cmd run lint
```

## Backend Integration

The API client is centralized in `src/api/client.js` and unwraps the backend `{ success, data, message }` response format.

Integrated endpoints:

- `GET /health`
- `GET /api/config`
- notebook CRUD and stats under `/api/notebooks`
- source list/create/upload/delete/status under `/api/notebooks/:notebookId/sources` and `/api/sources/:sourceId`
- conversation list/create/update/delete under `/api/notebooks/:notebookId/conversations` and `/api/conversations/:conversationId`
- message history and chat creation under `/api/conversations/:conversationId/messages`

Upload uses Multer field name `file`. Supported source types and file extensions are read from `/api/config` where available.

## SSE Streaming

Chat streaming uses `fetch` with `Accept: text/event-stream` because the backend expects a POST body. `src/lib/sse.js` parses SSE safely across arbitrary network chunks and handles multiple events in one chunk. Supported events are:

- `metadata`
- `token`
- `complete`
- `error`

## Source And Citation Flow

The left panel lists sources and polls the notebook source list while any source is `PENDING` or `PROCESSING`. Clicking a source opens the right reference viewer. Clicking a citation chip opens the same viewer with citation metadata and retrieved excerpt text.

The backend currently does not expose a safe route for rendering full original uploaded files or full extracted source text. The reference panel therefore shows source metadata for source clicks and exact citation excerpts for citation clicks.

## Responsive Behaviour

Desktop uses the required three-panel layout: sources left, chat center, reference viewer right. The right panel opens only when a source or citation is selected. Tablet and mobile collapse the sources panel into a drawer and use a side-sheet style reference viewer.

## Known Limitations

- No authentication, matching the backend.
- Full source document preview depends on future backend file/text routes.
- Source retry is not shown because no retry endpoint exists.
- Citation persistence is limited by the current message history shape; saved assistant messages do not include stored citation arrays.
- Automated tests cover parser and core shell behavior, not a live RAG run.
