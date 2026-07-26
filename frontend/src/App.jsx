import { Children, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Copy,
  FileText,
  Globe2,
  Menu,
  MessageSquarePlus,
  NotebookPen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Send,
  Trash2,
  Upload,
  X,
  Video,
} from "lucide-react";
import { api } from "./api/client";
import { streamMessage } from "./lib/sse";
import { bytesLabel, domainFromUrl, formatDate, safeError } from "./lib/format";
import {
  formatLocationLabel,
  formatSourceLocation,
  sourceTypeLabel,
} from "./lib/formatSourceLocation";
import {
  shouldRetryQuery,
  sourceRefetchInterval,
} from "./lib/sourcePolling";
import "./App.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      retry: shouldRetryQuery,
    },
  },
});

const sourceIcons = {
  PDF: FileText,
  DOCX: FileText,
  TEXT: FileText,
  VTT: FileText,
  WEBSITE: Globe2,
  YOUTUBE: Video,
};

const emptyMessagesPage = { messages: [], nextCursor: null };
const suggestionPrompts = [
  "Summarise the main ideas",
  "Explain the most difficult concept",
  "Create revision questions",
  "List the important points",
];
const LEFT_PANEL_MIN = 240;
const LEFT_PANEL_MAX = 560;
const RIGHT_PANEL_MIN = 280;
const RIGHT_PANEL_MAX = 620;
const CHAT_PANEL_MIN = 420;

function sortConversations(conversations) {
  return [...conversations].sort(
    (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
  );
}

function dedupeMessages(messages = []) {
  const seen = new Set();
  return messages.filter((message) => {
    const key = message.id ?? `${message.role}-${message.createdAt}-${message.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeMessageCitations(previous = [], incoming = []) {
  const citationById = new Map(
    previous
      .filter((message) => message.citations?.length > 0)
      .map((message) => [message.id, message.citations]),
  );

  return incoming.map((message) => ({
    ...message,
    citations: message.citations?.length
      ? message.citations
      : citationById.get(message.id) ?? [],
  }));
}

function fallbackCitationsFromContent(content, existingCitations = []) {
  if (existingCitations.length > 0) return existingCitations;

  const numbers = new Set(
    [...String(content ?? "").matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1])),
  );

  return [...numbers].sort((a, b) => a - b).map((citationNumber) => ({
    citationNumber,
    sourceTitle: "Source",
    sourceType: "UNKNOWN",
    location: {},
    text: "Citation details are unavailable for this saved message.",
  }));
}

function conversationStorageKey(notebookId) {
  return `marginnote.activeConversation.${notebookId}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/notebooks" element={<NotebooksPage />} />
          <Route path="/notebooks/:notebookId" element={<WorkspacePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function LandingPage() {
  return (
    <main className="page">
      <header className="site-header">
        <Link className="brand" to="/">
          <NotebookPen size={24} />
          MarginNote
        </Link>
        <nav>
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <Link className="sketch-button small" to="/notebooks">Open notebooks</Link>
        </nav>
      </header>

      <section className="hero-page">
        <div className="hero-copy">
          <p className="scribble-label">source-grounded research</p>
          <h1>Turn your sources into conversations</h1>
          <p>
            Build notebooks from papers, webpages, transcripts, and notes. Ask questions,
            follow the citations, and keep the source trail visible.
          </p>
          <div className="button-row">
            <Link className="sketch-button" to="/notebooks">
              Start a notebook <ArrowRight size={18} />
            </Link>
            <a className="ghost-button" href="#how">See how it works</a>
          </div>
        </div>
        <div className="hero-sketch" aria-hidden="true">
          <div className="mini-source one">PDF</div>
          <div className="mini-source two">URL</div>
          <div className="mini-source three">VTT</div>
          <div className="arrow-line">upload - understand - ask</div>
          <div className="chat-bubble">What changed in section 3? <span>[1]</span></div>
          <div className="reference-note">citation opens here</div>
        </div>
      </section>

      <section id="how" className="paper-section">
        <h2>How It Works</h2>
        <div className="steps-grid">
          {["Add sources", "Let them process", "Ask grounded questions", "Open citations"].map(
            (item, index) => (
              <article className="sketch-card taped" key={item}>
                <span className="step-number">{index + 1}</span>
                <h3>{item}</h3>
                <p>
                  {index === 0 && "Upload files or add supported web and text sources."}
                  {index === 1 && "The backend parses, chunks, embeds, and indexes your material."}
                  {index === 2 && "Answers are generated from READY sources in the notebook."}
                  {index === 3 && "Citation chips open the right-hand reference viewer."}
                </p>
              </article>
            ),
          )}
        </div>
      </section>

      <section id="features" className="paper-section">
        <h2>Supported Sources</h2>
        <div className="badge-row">
          {["PDF", "DOCX", "Website", "YouTube", "Text", "VTT"].map((type) => (
            <span className="badge pastel" key={type}>{type}</span>
          ))}
        </div>
        <div className="preview-layout" aria-hidden="true">
          <div>Sources</div>
          <div>Chat with citations</div>
          <div>Reference viewer</div>
        </div>
      </section>

      <footer className="footer">
        <strong>MarginNote</strong>
        <span>Answers stay tied to your provided sources.</span>
      </footer>
    </main>
  );
}

function NotebooksPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const notebooks = useQuery({ queryKey: ["notebooks"], queryFn: api.notebooks });
  const health = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 30000 });

  const createNotebook = useMutation({
    mutationFn: () => api.createNotebook({ title, description }),
    onSuccess: (notebook) => {
      qc.invalidateQueries({ queryKey: ["notebooks"] });
      navigate(`/notebooks/${notebook.id}`);
    },
  });
  const deleteNotebook = useMutation({
    mutationFn: (id) => api.deleteNotebook(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notebooks"] });
      setDeleteTarget(null);
    },
  });

  function submit(event) {
    event.preventDefault();
    if (title.trim()) createNotebook.mutate();
  }

  return (
    <main className="page library-page">
      <AppNav status={health.data?.status} />
      <section className="library-head">
        <div>
          <p className="scribble-label">notebook library</p>
          <h1>Your research notebooks</h1>
        </div>
        <form className="create-card" onSubmit={submit}>
          <label>
            Notebook title
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label>
            Description
            <input value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <button className="sketch-button" disabled={!title.trim() || createNotebook.isPending}>
            <Plus size={18} /> Create notebook
          </button>
          {createNotebook.error && <p className="error-text">{safeError(createNotebook.error)}</p>}
        </form>
      </section>

      {notebooks.isLoading && <LoadingRows label="Loading notebooks" />}
      {notebooks.error && <ErrorState message={safeError(notebooks.error)} />}
      {notebooks.data?.length === 0 && (
        <EmptyState title="No notebooks yet" text="Create one, then add a PDF, webpage, transcript or note." />
      )}
      <section className="notebook-grid">
        {notebooks.data?.map((notebook) => (
          <article className="sketch-card notebook-card taped" key={notebook.id}>
            <Link to={`/notebooks/${notebook.id}`}>
              <BookOpen />
              <h2>{notebook.title}</h2>
              <p>{notebook.description || "A fresh notebook waiting for sources."}</p>
              <div className="meta-row">
                <span>{notebook._count?.sources ?? 0} sources</span>
                <span>{notebook._count?.conversations ?? 0} chats</span>
              </div>
              <small>Updated {formatDate(notebook.updatedAt)}</small>
            </Link>
            <button
              className="icon-button danger"
              aria-label={`Delete ${notebook.title}`}
              onClick={() => setDeleteTarget(notebook)}
            >
              <Trash2 size={17} />
            </button>
          </article>
        ))}
      </section>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete notebook?"
        text="This removes the notebook, all sources, conversations, messages and indexed vectors."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteNotebook.mutate(deleteTarget.id)}
        pending={deleteNotebook.isPending}
      />
    </main>
  );
}

function WorkspacePage() {
  const { notebookId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get("conversation");
  const qc = useQueryClient();
  const [reference, setReference] = useState(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState([]);
  const [sourceSelectionMode, setSourceSelectionMode] = useState("auto");
  const [leftPanelWidth, setLeftPanelWidth] = useState(300);
  const [rightPanelWidth, setRightPanelWidth] = useState(410);
  const autoConversationRequestedRef = useRef(false);

  const notebook = useQuery({ queryKey: ["notebook", notebookId], queryFn: () => api.notebook(notebookId) });
  const config = useQuery({ queryKey: ["config"], queryFn: api.config });
  const stats = useQuery({ queryKey: ["notebookStats", notebookId], queryFn: () => api.notebookStats(notebookId) });
  const sources = useQuery({
    queryKey: ["sources", notebookId],
    queryFn: () => api.sources(notebookId),
    enabled: Boolean(notebookId),
    retry: shouldRetryQuery,
    refetchInterval: sourceRefetchInterval,
  });
  const conversations = useQuery({
    queryKey: ["conversations", notebookId],
    queryFn: () => api.conversations(notebookId),
    enabled: Boolean(notebookId),
  });

  const selectConversation = useCallback((id, { replace = false } = {}) => {
    if (id) {
      localStorage.setItem(conversationStorageKey(notebookId), id);
      setSearchParams({ conversation: id }, { replace });
    } else {
      localStorage.removeItem(conversationStorageKey(notebookId));
      setSearchParams({}, { replace });
    }
  }, [notebookId, setSearchParams]);

  const createConversation = useMutation({
    mutationFn: () => api.createConversation(notebookId),
    onSuccess: (conversation) => {
      qc.setQueryData(["conversations", notebookId], (old = []) =>
        sortConversations([conversation, ...old.filter((item) => item.id !== conversation.id)]),
      );
      selectConversation(conversation.id, { replace: autoConversationRequestedRef.current });
    },
    onSettled: () => {
      autoConversationRequestedRef.current = false;
    },
  });

  const deleteConversation = useMutation({
    mutationFn: api.deleteConversation,
    onSuccess: (_, deletedId) => {
      const remaining = sortConversations(
        (qc.getQueryData(["conversations", notebookId]) ?? conversations.data ?? []).filter(
          (item) => item.id !== deletedId,
        ),
      );
      qc.setQueryData(["conversations", notebookId], remaining);
      qc.removeQueries({ queryKey: ["messages", deletedId] });
      if (deletedId === conversationId) {
        setReference(null);
        selectConversation(remaining[0]?.id ?? "", { replace: true });
      }
      qc.invalidateQueries({ queryKey: ["conversations", notebookId] });
    },
  });

  const readySources = useMemo(
    () => sources.data?.filter((source) => source.status === "READY") ?? [],
    [sources.data],
  );
  const automaticSourceIds = useMemo(
    () => readySources.map((source) => source.id),
    [readySources],
  );
  const effectiveSelectedSourceIds =
    sourceSelectionMode === "auto" ? automaticSourceIds : selectedSourceIds;
  const sortedConversations = useMemo(
    () => sortConversations(conversations.data ?? []),
    [conversations.data],
  );
  const validConversationIds = useMemo(
    () => new Set(sortedConversations.map((conversation) => conversation.id)),
    [sortedConversations],
  );

  function setSourceSelection(ids, mode = "manual") {
    setSourceSelectionMode(mode);
    setSelectedSourceIds(ids);
  }

  function startNewConversation() {
    if (createConversation.isPending) return;
    const previousId = conversationId;
    setReference(null);
    if (previousId) {
      qc.cancelQueries({ queryKey: ["messages", previousId] });
    }
    createConversation.mutate(undefined, {
      onSuccess: (conversation) => {
        qc.setQueryData(["messages", conversation.id], emptyMessagesPage);
      },
    });
  }

  function startPaneResize(pane, event) {
    event.preventDefault();
    const rightWidth = reference ? rightPanelWidth : 0;
    const leftWidth = leftPanelWidth;

    function handlePointerMove(moveEvent) {
      const viewportWidth = window.innerWidth;

      if (pane === "left") {
        const maxLeft = Math.min(
          LEFT_PANEL_MAX,
          viewportWidth - rightWidth - CHAT_PANEL_MIN - 24,
        );
        setLeftPanelWidth(clamp(moveEvent.clientX, LEFT_PANEL_MIN, maxLeft));
      }

      if (pane === "right") {
        const maxRight = Math.min(
          RIGHT_PANEL_MAX,
          viewportWidth - leftWidth - CHAT_PANEL_MIN - 24,
        );
        setRightPanelWidth(
          clamp(viewportWidth - moveEvent.clientX, RIGHT_PANEL_MIN, maxRight),
        );
      }
    }

    function stopResize() {
      document.body.classList.remove("pane-resizing");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    }

    document.body.classList.add("pane-resizing");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  }

  function resizeWithKeyboard(pane, event) {
    const deltaByKey = {
      ArrowLeft: -24,
      ArrowRight: 24,
    };
    const delta = deltaByKey[event.key];
    if (!delta) return;

    event.preventDefault();
    if (pane === "left") {
      setLeftPanelWidth((width) => clamp(width + delta, LEFT_PANEL_MIN, LEFT_PANEL_MAX));
    }
    if (pane === "right") {
      setRightPanelWidth((width) => clamp(width - delta, RIGHT_PANEL_MIN, RIGHT_PANEL_MAX));
    }
  }

  useEffect(() => {
    if (conversations.isLoading || conversations.isFetching || createConversation.isPending) return;

    const conversationsList = sortedConversations;
    const urlConversationIsValid = conversationId && validConversationIds.has(conversationId);
    if (urlConversationIsValid) {
      localStorage.setItem(conversationStorageKey(notebookId), conversationId);
      return;
    }

    const storedConversationId = localStorage.getItem(conversationStorageKey(notebookId));
    const fallbackId =
      (storedConversationId && validConversationIds.has(storedConversationId) && storedConversationId) ||
      conversationsList[0]?.id;

    if (fallbackId) {
      selectConversation(fallbackId, { replace: true });
      return;
    }

    if (!autoConversationRequestedRef.current && conversationsList.length === 0) {
      autoConversationRequestedRef.current = true;
      createConversation.mutate();
    }
  }, [
    conversationId,
    conversations.isFetching,
    conversations.isLoading,
    createConversation,
    notebookId,
    selectConversation,
    sortedConversations,
    validConversationIds,
  ]);

  if (notebook.isLoading) return <main className="page"><LoadingRows label="Opening notebook" /></main>;
  if (notebook.error) return <main className="page"><ErrorState message={safeError(notebook.error)} /></main>;

  return (
    <main className={`workspace ${reference ? "has-reference" : ""}`}>
      <header className="workspace-top">
        <Link className="brand" to="/notebooks"><ChevronLeft size={20} /> MarginNote</Link>
        <div className="title-stack">
          <small>Notebook</small>
          <span>{notebook.data.title}</span>
          <small>{stats.data?.sources?.ready ?? 0} ready sources</small>
        </div>
        <button className="icon-button mobile-only" onClick={() => setSourcesOpen(true)} aria-label="Open sources">
          <Menu />
        </button>
        <button className="sketch-button small" onClick={startNewConversation} disabled={createConversation.isPending}>
          <MessageSquarePlus size={17} /> New chat
        </button>
      </header>

      <div
        className="workspace-grid"
        style={{
          "--left-panel-width": `${leftPanelWidth}px`,
          "--right-panel-width": reference ? `${rightPanelWidth}px` : "0px",
        }}
      >
        <SourcesPanel
          notebookId={notebookId}
          config={config.data}
          sources={sources.data ?? []}
          selectedSourceIds={effectiveSelectedSourceIds}
          setSelectedSourceIds={setSourceSelection}
          onOpen={(source) => setReference({ kind: "source", source })}
          drawerOpen={sourcesOpen}
          closeDrawer={() => setSourcesOpen(false)}
        />
        <PaneResizeHandle
          label="Resize sources panel"
          onPointerDown={(event) => startPaneResize("left", event)}
          onKeyDown={(event) => resizeWithKeyboard("left", event)}
        />
        <ChatPanel
          notebookId={notebookId}
          conversationId={conversationId}
          conversations={sortedConversations}
          readySources={readySources}
          selectedSourceIds={effectiveSelectedSourceIds}
          setSelectedSourceIds={setSourceSelection}
          onSelectConversation={(id) => selectConversation(id)}
          onCreateConversation={startNewConversation}
          onDeleteConversation={(id) => deleteConversation.mutate(id)}
          deletingConversationId={deleteConversation.variables}
          creatingConversation={createConversation.isPending}
          onReference={(citation) => setReference({ kind: "citation", citation })}
          onConversationChange={() => setReference(null)}
        />
        {reference && (
          <PaneResizeHandle
            label="Resize reference panel"
            onPointerDown={(event) => startPaneResize("right", event)}
            onKeyDown={(event) => resizeWithKeyboard("right", event)}
          />
        )}
        <ReferencePanel reference={reference} onClose={() => setReference(null)} />
      </div>
    </main>
  );
}

function SourcesPanel({
  notebookId,
  config,
  sources,
  selectedSourceIds,
  setSelectedSourceIds,
  onOpen,
  drawerOpen,
  closeDrawer,
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState("upload");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);

  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("file", file);
      if (title.trim()) form.append("title", title.trim());
      return api.uploadSource(notebookId, form);
    },
    onSuccess: () => resetAfterAdd(qc, notebookId, setTitle, setUrl, setText, setFile),
  });
  const create = useMutation({
    mutationFn: () =>
      api.createSource(notebookId, {
        title,
        type: mode === "text" ? "TEXT" : mode.toUpperCase(),
        content: mode === "text" ? text : undefined,
        url: mode !== "text" ? url : undefined,
      }),
    onSuccess: () => resetAfterAdd(qc, notebookId, setTitle, setUrl, setText, setFile),
  });
  const remove = useMutation({
    mutationFn: api.deleteSource,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sources", notebookId] });
      qc.invalidateQueries({ queryKey: ["notebookStats", notebookId] });
    },
  });

  function addSource(event) {
    event.preventDefault();
    if (mode === "upload" && file) upload.mutate();
    if (mode !== "upload" && title.trim()) create.mutate();
  }

  const panel = (
    <aside className="sources-panel">
      <div className="panel-head">
        <h2>Sources</h2>
        <span className="badge">{sources.length}</span>
        <button className="icon-button mobile-only" onClick={closeDrawer} aria-label="Close sources"><X /></button>
      </div>
      <form className="add-source sketch-card" onSubmit={addSource}>
        <div className="segmented">
          {["upload", "website", "youtube", "text"].map((item) => (
            <button type="button" className={mode === item ? "active" : ""} key={item} onClick={() => setMode(item)}>
              {item}
            </button>
          ))}
        </div>
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Source title" />
        </label>
        {mode === "upload" ? (
          <label className="drop-zone">
            <Upload size={20} />
            <span>{file?.name || "Choose PDF, DOCX, TXT or VTT"}</span>
            <small>Max {bytesLabel(config?.maxUploadBytes)}</small>
            <input
              type="file"
              accept={config?.supportedFileExtensions?.join(",") || ".pdf,.docx,.txt,.vtt"}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
        ) : mode === "text" ? (
          <label>
            Pasted text
            <textarea value={text} onChange={(event) => setText(event.target.value)} rows={5} />
          </label>
        ) : (
          <label>
            URL
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." />
          </label>
        )}
        <button className="sketch-button small" disabled={upload.isPending || create.isPending}>
          <Plus size={16} /> Add source
        </button>
        {(upload.error || create.error) && <p className="error-text">{safeError(upload.error || create.error)}</p>}
      </form>
      <div className="source-list">
        {sources.length === 0 && <EmptyState title="No sources yet" text="Add a file, webpage, video transcript or note." />}
        {sources.map((source) => (
          <SourceItem
            key={source.id}
            source={source}
            selected={selectedSourceIds.includes(source.id)}
            onSelect={(checked) => {
              const nextIds = checked
                ? [...new Set([...selectedSourceIds, source.id])]
                : selectedSourceIds.filter((id) => id !== source.id);
              setSelectedSourceIds(nextIds, "manual");
            }}
            onOpen={() => onOpen(source)}
            onDelete={() => remove.mutate(source.id)}
            deleting={remove.isPending}
          />
        ))}
      </div>
    </aside>
  );

  return (
    <>
      <div className="desktop-panel">{panel}</div>
      {drawerOpen && <div className="drawer">{panel}</div>}
    </>
  );
}

function PaneResizeHandle({ label, onPointerDown, onKeyDown }) {
  return (
    <div
      className="pane-resize-handle"
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <span />
    </div>
  );
}

function resetAfterAdd(qc, notebookId, setTitle, setUrl, setText, setFile) {
  setTitle("");
  setUrl("");
  setText("");
  setFile(null);
  qc.invalidateQueries({ queryKey: ["sources", notebookId] });
  qc.invalidateQueries({ queryKey: ["notebookStats", notebookId] });
}

function SourceItem({ source, selected, onSelect, onOpen, onDelete, deleting }) {
  const Icon = sourceIcons[source.type] || FileText;
  const canSelect = source.status === "READY";
  return (
    <article className="source-item">
      <div className="source-item-top">
        <button className="source-main" onClick={onOpen}>
          <Icon size={18} />
          <span>
            <strong>{source.title}</strong>
            <small>{source.type} - {formatDate(source.updatedAt)}</small>
          </span>
        </button>
        <StatusBadge status={source.status} />
      </div>
      {source.errorMessage && <p className="source-error">{source.errorMessage}</p>}
      <div className="source-actions">
        <label className="mini-check">
          <input type="checkbox" checked={selected} disabled={!canSelect} onChange={(event) => onSelect(event.target.checked)} />
          Use in chat
        </label>
        <button className="icon-button danger" aria-label={`Delete ${source.title}`} disabled={deleting} onClick={onDelete} title="Delete source">
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

function ChatPanel({
  notebookId,
  conversationId,
  conversations,
  readySources,
  selectedSourceIds,
  setSelectedSourceIds,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  deletingConversationId,
  creatingConversation,
  onReference,
  onConversationChange,
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [temporaryMessage, setTemporaryMessage] = useState(null);
  const [error, setError] = useState("");
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const composerRef = useRef(null);
  const activeConversationRef = useRef(conversationId);

  const messages = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      const page = await api.messages(conversationId, { limit: 100 });
      const previous = qc.getQueryData(["messages", conversationId]);
      return {
        ...page,
        messages: mergeMessageCitations(previous?.messages, page.messages),
      };
    },
    enabled: Boolean(conversationId),
  });

  const activeConversation = conversations.find((item) => item.id === conversationId);
  const temporaryVisible =
    temporaryMessage?.conversationId === conversationId ? [temporaryMessage] : [];
  const visibleMessages = dedupeMessages([
    ...(messages.data?.messages ?? []),
    ...temporaryVisible,
  ]);
  const allowedSelectedIds = selectedSourceIds.filter((id) => readySources.some((source) => source.id === id));
  const selectedReadyCount = allowedSelectedIds.length;
  const hasReadySources = readySources.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [visibleMessages.length, temporaryMessage?.content]);

  useEffect(() => {
    if (activeConversationRef.current === conversationId) return;
    abortRef.current?.abort();
    activeConversationRef.current = conversationId;
    setTemporaryMessage(null);
    setStreaming(false);
    setError("");
    setConversationMenuOpen(false);
    onConversationChange?.();
    if (conversationId && !messages.data) {
      qc.setQueryData(["messages", conversationId], emptyMessagesPage);
    }
  }, [conversationId, messages.data, onConversationChange, qc]);

  async function send(eventOrPrompt) {
    const content =
      typeof eventOrPrompt === "string"
        ? eventOrPrompt.trim()
        : draft.trim();
    if (typeof eventOrPrompt !== "string") {
      eventOrPrompt.preventDefault();
    }
    if (!content || !conversationId || !hasReadySources || streaming) return;

    const targetConversationId = conversationId;
    setDraft("");
    setError("");
    setStreaming(true);
    setTemporaryMessage({
      id: `temporary-assistant-${targetConversationId}`,
      conversationId: targetConversationId,
      role: "ASSISTANT",
      content: "",
      citations: [],
      createdAt: new Date().toISOString(),
      pending: true,
    });
    abortRef.current = new AbortController();
    qc.setQueryData(["messages", targetConversationId], (old) => ({
      messages: dedupeMessages([
        ...(old?.messages ?? []),
        {
          id: `local-user-${targetConversationId}-${Date.now()}`,
          conversationId: targetConversationId,
          role: "USER",
          content,
          createdAt: new Date().toISOString(),
        },
      ]),
      nextCursor: old?.nextCursor ?? null,
    }));

    try {
      await streamMessage({
        conversationId: targetConversationId,
        content,
        sourceIds: allowedSelectedIds,
        signal: abortRef.current.signal,
        onEvent: ({ event: name, data }) => {
          if (name === "metadata" && data?.conversationTitle) {
            qc.setQueryData(["conversations", notebookId], (old) =>
              sortConversations(
                old?.map((item) =>
                  item.id === targetConversationId ? { ...item, title: data.conversationTitle } : item,
                ) ?? [],
              ),
            );
          }
          if (name === "token") {
            setTemporaryMessage((current) => ({
              id: `temporary-assistant-${targetConversationId}`,
              conversationId: targetConversationId,
              role: "ASSISTANT",
              content: `${current?.content ?? ""}${data?.content ?? ""}`,
              citations: current?.citations ?? [],
              createdAt: new Date().toISOString(),
              pending: false,
            }));
          }
          if (name === "complete") {
            setTemporaryMessage(null);
            if (data?.assistantMessage) {
              qc.setQueryData(["messages", targetConversationId], (old) => ({
                messages: dedupeMessages([
                  ...(old?.messages ?? []),
                  {
                    ...data.assistantMessage,
                    conversationId: targetConversationId,
                    citations: data?.citations ?? [],
                  },
                ]),
                nextCursor: old?.nextCursor ?? null,
              }));
            }
            qc.invalidateQueries({ queryKey: ["messages", targetConversationId] });
            qc.invalidateQueries({ queryKey: ["conversations", notebookId] });
          }
          if (name === "error") setError(data?.message || "Streaming failed");
        },
      });
    } catch (caught) {
      if (caught.name !== "AbortError") {
        setDraft(content);
        setError(safeError(caught));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function sendSuggestion(prompt) {
    send(prompt);
  }

  function selectReadySources() {
    setSelectedSourceIds(readySources.map((source) => source.id), "manual");
  }

  return (
    <section className="chat-panel">
      <div className="chat-main">
        <header className="chat-head">
          <div className="conversation-switcher">
            <button
              className="conversation-trigger"
              onClick={() => setConversationMenuOpen((open) => !open)}
              aria-expanded={conversationMenuOpen}
            >
              <span>
                <strong>{activeConversation?.title || "New conversation"}</strong>
                <small>
                  {selectedReadyCount} of {readySources.length} ready sources selected
                </small>
              </span>
              <ChevronDown size={18} />
            </button>
            {conversationMenuOpen && (
              <div className="conversation-menu">
                <div className="conversation-menu-head">
                  <strong>Conversations</strong>
                  <button className="sketch-button small" onClick={onCreateConversation} disabled={creatingConversation}>
                    <Plus size={16} /> New chat
                  </button>
                </div>
                <div className="conversation-list">
                  {conversations.map((conversation) => (
                    <div
                      className={conversation.id === conversationId ? "conversation-row active" : "conversation-row"}
                      key={conversation.id}
                    >
                      <button onClick={() => onSelectConversation(conversation.id)}>
                        <strong>{conversation.title || "New conversation"}</strong>
                        <small>{conversation.lastMessagePreview?.content || `${conversation.messageCount ?? 0} messages`}</small>
                      </button>
                      <button
                        className="icon-button danger"
                        aria-label={`Delete ${conversation.title || "New conversation"}`}
                        disabled={deletingConversationId === conversation.id}
                        onClick={() => onDeleteConversation(conversation.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {conversations.length === 0 && <p className="note-text">No conversations yet.</p>}
                </div>
              </div>
            )}
          </div>
          <button
            className="ghost-button compact"
            onClick={selectReadySources}
            disabled={!hasReadySources}
          >
            Sources: {selectedReadyCount} selected
          </button>
        </header>
        <div className="message-list">
          {messages.isFetching && !messages.data && conversationId && <LoadingRows label="Loading conversation" />}
          {messages.error && <ErrorState message={safeError(messages.error)} />}
          {!hasReadySources && (
            <EmptyState title="Add and finish processing a source before asking questions." text="The backend only chats over READY sources." />
          )}
          {conversationId && visibleMessages.length === 0 && hasReadySources && !messages.isFetching && (
            <div className="prompt-grid">
              {suggestionPrompts.map((prompt) => (
                <button key={prompt} onClick={() => sendSuggestion(prompt)}>{prompt}</button>
              ))}
            </div>
          )}
          {visibleMessages.map((message) => (
            <MessageCard key={message.id} message={message} citations={message.citations ?? []} onReference={onReference} />
          ))}
          <div ref={bottomRef} />
        </div>
        {error && <p className="error-text">{error}</p>}
        <form className="composer" ref={composerRef} onSubmit={send}>
          <textarea
            value={draft}
            rows={1}
            placeholder={hasReadySources ? "Ask a grounded question..." : "Waiting for READY sources"}
            disabled={!conversationId || !hasReadySources}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) send(event);
            }}
          />
          {streaming ? (
            <button type="button" className="ghost-button compact" onClick={() => abortRef.current?.abort()}>Stop</button>
          ) : (
            <button className="sketch-button icon-send" disabled={!draft.trim() || !hasReadySources}>
              <Send size={18} />
            </button>
          )}
        </form>
      </div>
    </section>
  );
}

function MessageCard({ message, citations, onReference }) {
  const isUser = message.role === "USER";
  const hasInlineCitationMarkers = /\[\d+\]/.test(message.content ?? "");
  const resolvedCitations = isUser
    ? []
    : fallbackCitationsFromContent(message.content, citations);
  return (
    <article className={`message-card ${isUser ? "user" : "assistant"} ${message.pending ? "thinking" : ""}`}>
      {message.pending && !message.content ? (
        <div className="thinking-line" aria-live="polite">
          <span className="thinking-pencil" aria-hidden="true" />
          <span>Thinking through your sources</span>
          <i aria-hidden="true" />
          <i aria-hidden="true" />
          <i aria-hidden="true" />
        </div>
      ) : (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => (
              <p>{renderCitationChildren(children, resolvedCitations, onReference)}</p>
            ),
            li: ({ children }) => (
              <li>{renderCitationChildren(children, resolvedCitations, onReference)}</li>
            ),
          }}
        >
          {message.content}
        </ReactMarkdown>
      )}
      {!isUser && !hasInlineCitationMarkers && resolvedCitations.length > 0 && (
        <div className="citation-row">
          {resolvedCitations.map((citation) => (
            <button
              className="citation-chip"
              key={`${citation.sourceId ?? "missing"}-${citation.citationNumber}`}
              title={`${sourceTypeLabel(citation.sourceType)} - ${formatLocationLabel(citation.location, citation.sourceType)}`}
              onClick={() => onReference(citation)}
            >
              [{citation.citationNumber}] {citation.sourceTitle || "Source"}
            </button>
          ))}
        </div>
      )}
      {!isUser && (
        <button className="icon-button copy" aria-label="Copy answer" onClick={() => navigator.clipboard?.writeText(message.content)}>
          <Copy size={15} />
        </button>
      )}
    </article>
  );
}

function renderCitationChildren(children, citations, onReference) {
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      return renderCitationText(child, citations, onReference);
    }

    return child;
  });
}

function renderCitationText(text, citations, onReference) {
  const parts = [];
  const pattern = /\[(\d+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const citationNumber = Number(match[1]);
    const citation = citations.find((item) => item.citationNumber === citationNumber);

    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    parts.push(
      <button
        className="inline-citation"
        key={`${match.index}-${citationNumber}`}
        type="button"
        title={
          citation
            ? `${sourceTypeLabel(citation.sourceType)} - ${formatLocationLabel(citation.location, citation.sourceType)}`
            : "Open reference"
        }
        onClick={() => citation && onReference(citation)}
      >
        [{citationNumber}]
      </button>,
    );
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length ? parts : text;
}

function isMarkerOnlyCitationText(value = "") {
  const text = String(value ?? "").trim();
  if (!text) return false;

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return false;

  return lines.every((line) =>
    [
      /^[-\s]*\d+\s+of\s+\d+[-\s]*$/i,
      /^[-\s]*page\s+\d+[-\s]*$/i,
      /^[-\s]*\d+[-\s]*$/i,
      /^[-\s]*unit\s+\d+[-\s]*$/i,
    ].some((pattern) => pattern.test(line)),
  );
}

function ReferencePanel({ reference, onClose }) {
  const citation = reference?.kind === "citation" ? reference.citation : null;
  const citationLocation = citation
    ? formatSourceLocation(citation.location, citation.sourceType)
    : [];
  const citationUrl = citation?.location?.url || citation?.location?.sourceUrl;
  const source = reference?.kind === "source" ? reference.source : null;
  const sourceDomain = source ? domainFromUrl(source.url) : null;
  const citationText = isMarkerOnlyCitationText(citation?.text)
    ? "The indexed excerpt is unavailable. Reprocess this source."
    : citation?.text || "Citation excerpt unavailable.";

  return (
    <aside className={`reference-panel ${reference ? "open" : ""}`}>
      <div className="panel-head">
        <div>
          <h2>{citation ? `Reference ${citation.citationNumber}` : "Source reference"}</h2>
          <small>{reference ? "Selected evidence" : "Nothing selected"}</small>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close reference">
          {reference ? <PanelRightClose /> : <PanelRightOpen />}
        </button>
      </div>
      {!reference && <EmptyState title="Select a source or citation to inspect it here." text="The chat stays in place while references open on the right." />}
      {source && (
        <div className="reference-body">
          <div className="reference-title-row">
            <h3>{source.title}</h3>
            <StatusBadge status={source.status} />
          </div>
          <dl>
            <dt>Type</dt><dd>{sourceTypeLabel(source.type)}</dd>
            {sourceDomain && <><dt>Domain</dt><dd>{sourceDomain}</dd></>}
            {source.originalFileName && <><dt>File</dt><dd>{source.originalFileName}</dd></>}
            <dt>Updated</dt><dd>{formatDate(source.updatedAt)}</dd>
            {source.errorMessage && <><dt>Issue</dt><dd>{source.errorMessage}</dd></>}
          </dl>
          <p className="note-text">Open a citation from an answer to inspect the exact retrieved passage.</p>
        </div>
      )}
      {citation && (
        <div className="reference-body">
          <div className="reference-title-row">
            <h3>{citation.sourceTitle || "Source"}</h3>
            <span className="badge">{sourceTypeLabel(citation.sourceType)}</span>
          </div>
          <dl>
            <dt>Type</dt><dd>{sourceTypeLabel(citation.sourceType)}</dd>
            {citationLocation.map((line) => (
              <Fragment key={line}>
                <dt>Location</dt><dd>{line}</dd>
              </Fragment>
            ))}
            {domainFromUrl(citationUrl) && <><dt>Domain</dt><dd>{domainFromUrl(citationUrl)}</dd></>}
          </dl>
          <h4>Relevant passage</h4>
          <pre className="excerpt">{citationText}</pre>
          {domainFromUrl(citationUrl) && (
            <a className="ghost-button" href={citationUrl} target="_blank" rel="noreferrer">
              Open source
            </a>
          )}
          <details className="technical-details">
            <summary>Technical details</summary>
            <dl>
              {citation.chunkIndex !== undefined && <><dt>Chunk</dt><dd>{citation.chunkIndex}</dd></>}
              {Number.isFinite(citation.score) && <><dt>Score</dt><dd>{citation.score.toFixed(3)}</dd></>}
            </dl>
          </details>
        </div>
      )}
    </aside>
  );
}

function StatusBadge({ status }) {
  const Icon = status === "READY" ? Check : Clock3;
  return <span className={`status ${status?.toLowerCase()}`}><Icon size={14} /> {status}</span>;
}

function AppNav({ status }) {
  return (
    <header className="site-header">
      <Link className="brand" to="/"><NotebookPen size={24} /> MarginNote</Link>
      <span className={`health ${status === "ok" ? "ok" : ""}`}>API {status || "checking"}</span>
    </header>
  );
}

function EmptyState({ title, text }) {
  return <div className="empty-state"><NotebookPen /><h3>{title}</h3><p>{text}</p></div>;
}

function ErrorState({ message }) {
  return <div className="empty-state error"><h2>Backend unavailable</h2><p>{message}</p></div>;
}

function LoadingRows({ label }) {
  return <div className="loading"><span>{label}</span><i /><i /><i /></div>;
}

function ConfirmDialog({ open, title, text, onCancel, onConfirm, pending }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="dialog sketch-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">{title}</h2>
        <p>{text}</p>
        <div className="button-row">
          <button className="ghost-button" onClick={onCancel}>Cancel</button>
          <button className="sketch-button danger" onClick={onConfirm} disabled={pending}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <main className="page not-found">
      <EmptyState title="Page not found" text="This notebook page is not in the margin." />
      <Link className="sketch-button" to="/notebooks">Open notebooks</Link>
    </main>
  );
}

export default App;
