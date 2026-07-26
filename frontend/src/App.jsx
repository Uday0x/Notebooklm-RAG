import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
import "./App.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      retry: 1,
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

  const notebook = useQuery({ queryKey: ["notebook", notebookId], queryFn: () => api.notebook(notebookId) });
  const config = useQuery({ queryKey: ["config"], queryFn: api.config });
  const stats = useQuery({ queryKey: ["notebookStats", notebookId], queryFn: () => api.notebookStats(notebookId) });
  const sources = useQuery({
    queryKey: ["sources", notebookId],
    queryFn: () => api.sources(notebookId),
    refetchInterval: (query) =>
      query.state.data?.some((source) => ["PENDING", "PROCESSING"].includes(source.status)) ? 3000 : false,
  });
  const conversations = useQuery({
    queryKey: ["conversations", notebookId],
    queryFn: () => api.conversations(notebookId),
  });

  useEffect(() => {
    if (!conversationId && conversations.data?.[0]) {
      setSearchParams({ conversation: conversations.data[0].id }, { replace: true });
    }
  }, [conversationId, conversations.data, setSearchParams]);

  const createConversation = useMutation({
    mutationFn: () => api.createConversation(notebookId),
    onSuccess: (conversation) => {
      qc.invalidateQueries({ queryKey: ["conversations", notebookId] });
      setSearchParams({ conversation: conversation.id });
    },
  });

  const readySources = useMemo(
    () => sources.data?.filter((source) => source.status === "READY") ?? [],
    [sources.data],
  );

  if (notebook.isLoading) return <main className="page"><LoadingRows label="Opening notebook" /></main>;
  if (notebook.error) return <main className="page"><ErrorState message={safeError(notebook.error)} /></main>;

  return (
    <main className={`workspace ${reference ? "has-reference" : ""}`}>
      <header className="workspace-top">
        <Link className="brand" to="/notebooks"><ChevronLeft size={20} /> MarginNote</Link>
        <div className="title-stack">
          <span>{notebook.data.title}</span>
          <small>{stats.data?.sources?.ready ?? 0} ready sources</small>
        </div>
        <button className="icon-button mobile-only" onClick={() => setSourcesOpen(true)} aria-label="Open sources">
          <Menu />
        </button>
        <button className="sketch-button small" onClick={() => createConversation.mutate()}>
          <MessageSquarePlus size={17} /> New chat
        </button>
      </header>

      <div className="workspace-grid">
        <SourcesPanel
          notebookId={notebookId}
          config={config.data}
          sources={sources.data ?? []}
          selectedSourceIds={selectedSourceIds}
          setSelectedSourceIds={setSelectedSourceIds}
          onOpen={(source) => setReference({ kind: "source", source })}
          drawerOpen={sourcesOpen}
          closeDrawer={() => setSourcesOpen(false)}
        />
        <ChatPanel
          notebookId={notebookId}
          conversationId={conversationId}
          conversations={conversations.data ?? []}
          readySources={readySources}
          selectedSourceIds={selectedSourceIds}
          setSelectedSourceIds={setSelectedSourceIds}
          onSelectConversation={(id) => setSearchParams({ conversation: id })}
          onCreateConversation={() => createConversation.mutate()}
          onReference={(citation) => setReference({ kind: "citation", citation })}
        />
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
            onSelect={(checked) =>
              setSelectedSourceIds((current) =>
                checked ? [...current, source.id] : current.filter((id) => id !== source.id),
              )
            }
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
      <button className="source-main" onClick={onOpen}>
        <Icon size={18} />
        <span>
          <strong>{source.title}</strong>
          <small>{source.type} - {formatDate(source.updatedAt)}</small>
        </span>
      </button>
      <StatusBadge status={source.status} />
      <label className="mini-check">
        <input type="checkbox" checked={selected} disabled={!canSelect} onChange={(event) => onSelect(event.target.checked)} />
        use
      </label>
      <button className="icon-button danger" aria-label={`Delete ${source.title}`} disabled={deleting} onClick={onDelete}>
        <Trash2 size={16} />
      </button>
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
  onReference,
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamCitations, setStreamCitations] = useState([]);
  const [error, setError] = useState("");
  const abortRef = useRef(null);
  const bottomRef = useRef(null);

  const messages = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => api.messages(conversationId, { limit: 100 }),
    enabled: Boolean(conversationId),
  });

  const activeConversation = conversations.find((item) => item.id === conversationId);
  const visibleMessages = messages.data?.messages ?? [];
  const allowedSelectedIds = selectedSourceIds.filter((id) => readySources.some((source) => source.id === id));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [visibleMessages.length, streamText]);

  async function send(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !conversationId || readySources.length === 0 || streaming) return;

    setDraft("");
    setError("");
    setStreaming(true);
    setStreamText("");
    setStreamCitations([]);
    abortRef.current = new AbortController();
    qc.setQueryData(["messages", conversationId], (old) => ({
      messages: [...(old?.messages ?? []), { id: `local-${Date.now()}`, role: "USER", content, createdAt: new Date().toISOString() }],
      nextCursor: old?.nextCursor ?? null,
    }));

    try {
      await streamMessage({
        conversationId,
        content,
        sourceIds: allowedSelectedIds,
        signal: abortRef.current.signal,
        onEvent: ({ event: name, data }) => {
          if (name === "metadata" && data?.conversationTitle) {
            qc.setQueryData(["conversations", notebookId], (old) =>
              old?.map((item) => (item.id === conversationId ? { ...item, title: data.conversationTitle } : item)),
            );
          }
          if (name === "token") setStreamText((current) => `${current}${data?.content ?? ""}`);
          if (name === "complete") {
            setStreamCitations(data?.citations ?? []);
            qc.invalidateQueries({ queryKey: ["messages", conversationId] });
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

  return (
    <section className="chat-panel">
      <div className="conversation-rail">
        <button className="sketch-button small" onClick={onCreateConversation}><Plus size={16} /> Chat</button>
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            className={conversation.id === conversationId ? "conversation active" : "conversation"}
            onClick={() => onSelectConversation(conversation.id)}
          >
            <strong>{conversation.title || "New conversation"}</strong>
            <small>{conversation.messageCount ?? 0} messages</small>
          </button>
        ))}
      </div>
      <div className="chat-main">
        <header className="chat-head">
          <div>
            <h2>{activeConversation?.title || "New conversation"}</h2>
            <small>{readySources.length} ready sources available</small>
          </div>
          <button
            className="ghost-button compact"
            onClick={() => setSelectedSourceIds(readySources.map((source) => source.id))}
          >
            Select ready
          </button>
        </header>
        <div className="message-list">
          {readySources.length === 0 && (
            <EmptyState title="Add and finish processing a source before asking questions." text="The backend only chats over READY sources." />
          )}
          {conversationId && visibleMessages.length === 0 && readySources.length > 0 && (
            <div className="prompt-grid">
              {["Summarise the main ideas", "Explain the most difficult concept", "Create revision questions"].map((prompt) => (
                <button key={prompt} onClick={() => setDraft(prompt)}>{prompt}</button>
              ))}
            </div>
          )}
          {visibleMessages.map((message) => (
            <MessageCard key={message.id} message={message} citations={[]} onReference={onReference} />
          ))}
          {streamText && (
            <MessageCard
              message={{ role: "ASSISTANT", content: streamText }}
              citations={streamCitations}
              onReference={onReference}
            />
          )}
          <div ref={bottomRef} />
        </div>
        {error && <p className="error-text">{error}</p>}
        <form className="composer" onSubmit={send}>
          <textarea
            value={draft}
            rows={1}
            placeholder={readySources.length ? "Ask a grounded question..." : "Waiting for READY sources"}
            disabled={!conversationId || readySources.length === 0}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) send(event);
            }}
          />
          {streaming ? (
            <button type="button" className="ghost-button compact" onClick={() => abortRef.current?.abort()}>Stop</button>
          ) : (
            <button className="sketch-button icon-send" disabled={!draft.trim() || readySources.length === 0}>
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
  return (
    <article className={`message-card ${isUser ? "user" : "assistant"}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      {!isUser && citations?.length > 0 && (
        <div className="citation-row">
          {citations.map((citation) => (
            <button className="citation-chip" key={`${citation.sourceId}-${citation.citationNumber}`} onClick={() => onReference(citation)}>
              [{citation.citationNumber}] {citation.sourceTitle}
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

function ReferencePanel({ reference, onClose }) {
  return (
    <aside className={`reference-panel ${reference ? "open" : ""}`}>
      <div className="panel-head">
        <div>
          <h2>Source reference</h2>
          <small>{reference ? "Selected evidence" : "Nothing selected"}</small>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close reference">
          {reference ? <PanelRightClose /> : <PanelRightOpen />}
        </button>
      </div>
      {!reference && <EmptyState title="Select a source or citation to inspect it here." text="The chat stays in place while references open on the right." />}
      {reference?.kind === "source" && (
        <div className="reference-body">
          <h3>{reference.source.title}</h3>
          <StatusBadge status={reference.source.status} />
          <dl>
            <dt>Type</dt><dd>{reference.source.type}</dd>
            <dt>Original file</dt><dd>{reference.source.originalFileName || "Not provided"}</dd>
            <dt>Updated</dt><dd>{formatDate(reference.source.updatedAt)}</dd>
          </dl>
          <p className="note-text">The backend does not expose a safe full-source file route yet. Citations will show retrieved excerpts here.</p>
        </div>
      )}
      {reference?.kind === "citation" && (
        <div className="reference-body">
          <h3>[{reference.citation.citationNumber}] {reference.citation.sourceTitle}</h3>
          <dl>
            <dt>Type</dt><dd>{reference.citation.sourceType}</dd>
            <dt>Chunk</dt><dd>{reference.citation.chunkIndex ?? "Not provided"}</dd>
            <dt>Score</dt><dd>{reference.citation.score?.toFixed?.(3) ?? "Not provided"}</dd>
            {Object.entries(reference.citation.location || {}).map(([key, value]) => (
              <Fragment key={key}>
                <dt>{key}</dt><dd>{String(value)}</dd>
              </Fragment>
            ))}
          </dl>
          <pre className="excerpt">{reference.citation.text || "Citation excerpt unavailable."}</pre>
          {domainFromUrl(reference.citation.location?.url) && (
            <a className="ghost-button" href={reference.citation.location.url} target="_blank" rel="noreferrer">
              Open {domainFromUrl(reference.citation.location.url)}
            </a>
          )}
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
