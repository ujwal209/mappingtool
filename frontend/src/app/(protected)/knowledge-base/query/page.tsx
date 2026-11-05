"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useKnowledgeBaseContext } from "../layout";
import { KBQueryResult, queryOntology } from "@/lib/kb-api";
import { Markdown } from "@/components/kb/Markdown";
import {
  Plus,
  Trash2,
  Loader2,
  FileText,
  ArrowUp,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Archive,
  X,
  Search,
  ChevronLeft,
  ChevronsLeft,
  ChevronRight as ChevronRightIcon,
  ChevronsRight,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  result?: KBQueryResult;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  messages: ChatMessage[];
  is_archived?: boolean;
}

const SESSION_KEY_PREFIX = "kb_chat_sessions_v1";

function sessionsKey(projectId: string | null, ontId: string): string {
  return `${SESSION_KEY_PREFIX}_${projectId || "global"}_${ontId || "none"}`;
}

function loadSessions(projectId: string | null, ontId: string): ChatSession[] {
  if (typeof window === "undefined" || !ontId) return [];
  try {
    const raw = localStorage.getItem(sessionsKey(projectId, ontId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessions(
  projectId: string | null,
  ontId: string,
  sessions: ChatSession[]
) {
  if (typeof window === "undefined" || !ontId) return;
  try {
    localStorage.setItem(
      sessionsKey(projectId, ontId),
      JSON.stringify(sessions)
    );
  } catch {}
}

function makeSession(): ChatSession {
  return {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: "New conversation",
    created_at: Date.now(),
    updated_at: Date.now(),
    messages: [],
    is_archived: false,
  };
}

const SUGGESTIONS = [
  {
    title: "Retention and PII requirements",
    prompt: "What are the retention rules and PII handling requirements?",
  },
  {
    title: "Field format rules",
    prompt:
      "What are the required formats for customer email and phone fields?",
  },
  {
    title: "Applicable compliance frameworks",
    prompt:
      "Which compliance frameworks apply to the customer data in this ontology?",
  },
  {
    title: "Cross-entity validation",
    prompt:
      "How should relationships between Customer, Account, and Invoice be validated?",
  },
  {
    title: "Blocking run conditions",
    prompt:
      "What conditions would block a migration run according to the rulebooks?",
  },
  {
    title: "Field-level definitions",
    prompt: "Summarize the field-level definitions for the Order entity.",
  },
];

export default function QueryPage() {
  const { selectedOntId, ontologies } = useKnowledgeBaseContext();

  const projectId: string | null =
    (typeof window !== "undefined" &&
      (localStorage.getItem("active_project_id") ||
        localStorage.getItem("current_project_id"))) ||
    null;

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  // Desktop: sidebar is a persistent column
  // Mobile: sidebar is a drawer, hidden by default
  const [sidebarOpen, setSidebarOpen] = useState(true); // affects desktop only
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // ── Hydrate ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedOntId) return;
    const loaded = loadSessions(projectId, selectedOntId);
    if (loaded.length > 0) {
      const sorted = [...loaded].sort((a, b) => {
        if (!!a.is_archived !== !!b.is_archived) return a.is_archived ? 1 : -1;
        return b.updated_at - a.updated_at;
      });
      setSessions(sorted);
      const active = sorted.find((s) => !s.is_archived) || sorted[0];
      setCurrentSessionId(active.id);
    } else {
      const fresh = makeSession();
      setSessions([fresh]);
      setCurrentSessionId(fresh.id);
    }
    setHydrated(true);
  }, [selectedOntId, projectId]);

  useEffect(() => {
    if (!hydrated || !selectedOntId) return;
    if (sessions.length === 0) return;
    saveSessions(projectId, selectedOntId, sessions);
  }, [sessions, hydrated, selectedOntId, projectId]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === currentSessionId) || null,
    [sessions, currentSessionId]
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeSession?.messages.length, running]);

  // Close mobile drawer on session select
  const selectSession = (id: string) => {
    setCurrentSessionId(id);
    setMobileDrawerOpen(false);
  };

  const newChat = () => {
    const emptyExisting = sessions.find(
      (s) => !s.is_archived && s.messages.length === 0
    );
    if (emptyExisting) {
      setCurrentSessionId(emptyExisting.id);
      setPrompt("");
      setError(null);
      setSearchQuery("");
      setMobileDrawerOpen(false);
      setTimeout(() => composerRef.current?.focus(), 20);
      return;
    }
    const fresh = makeSession();
    setSessions((p) => [fresh, ...p]);
    setCurrentSessionId(fresh.id);
    setPrompt("");
    setError(null);
    setSearchQuery("");
    setMobileDrawerOpen(false);
    setTimeout(() => composerRef.current?.focus(), 20);
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const fresh = makeSession();
        setCurrentSessionId(fresh.id);
        return [fresh];
      }
      if (id === currentSessionId) {
        const active = next.find((s) => !s.is_archived) || next[0];
        setCurrentSessionId(active.id);
      }
      return next;
    });
  };

  const archiveSession = (id: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, is_archived: !s.is_archived, updated_at: Date.now() }
          : s
      )
    );
  };

  const sendMessage = async (text?: string) => {
    const q = (text ?? prompt).trim();
    if (!q || running || !activeSession || !selectedOntId) return;

    setError(null);
    setPrompt("");

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: q,
      timestamp: Date.now(),
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              updated_at: Date.now(),
              title:
                s.messages.length === 0
                  ? q.slice(0, 44) + (q.length > 44 ? "…" : "")
                  : s.title,
              messages: [...s.messages, userMsg],
            }
          : s
      )
    );

    setRunning(true);

    try {
      const result = await queryOntology(selectedOntId, q, 4, true);

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content:
          result.synthesized_guidance ||
          "No synthesis was produced for this query.",
        timestamp: Date.now(),
        result,
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? {
                ...s,
                updated_at: Date.now(),
                messages: [...s.messages, assistantMsg],
              }
            : s
        )
      );
    } catch (err: any) {
      setError(err.message || "Query failed");
    } finally {
      setRunning(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!running) sendMessage();
    }
  };

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      if ((s.title || "").toLowerCase().includes(q)) return true;
      return s.messages.some((m) =>
        m.content.toLowerCase().includes(q)
      );
    });
  }, [sessions, searchQuery]);

  const activeSessions = filteredSessions.filter((s) => !s.is_archived);
  const archivedSessions = filteredSessions.filter((s) => s.is_archived);

  return (
    <div className="h-full w-full flex overflow-hidden bg-white text-slate-900">
      {/* ── Mobile drawer backdrop ──────────────────────────── */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* ── Sidebar (desktop column + mobile drawer) ─────────── */}
      <aside
        className={[
          // Base
          "shrink-0 bg-slate-50/80 border-r border-slate-200 flex flex-col overflow-hidden",
          "transition-transform duration-200",
          // Mobile: fixed drawer, slides in from left
          "fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[300px]",
          mobileDrawerOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: back to static column
          "lg:static lg:translate-x-0 lg:z-auto",
          sidebarOpen ? "lg:w-64" : "lg:w-0",
          "lg:transition-[width]",
        ].join(" ")}
      >
        {/* Sidebar header */}
        <div className="p-2.5 space-y-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/knowledge-base${
                selectedOntId ? `?ontology_id=${selectedOntId}` : ""
              }`}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition shrink-0"
              title="Back to knowledge base"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
            </Link>
            <button
              onClick={newChat}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 transition"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
              New chat
            </button>
            {/* Close drawer button (mobile only) */}
            <button
              onClick={() => setMobileDrawerOpen(false)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition lg:hidden shrink-0"
              title="Close"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={1.75}
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats"
              className="w-full h-8 pl-7 pr-7 rounded-lg border border-slate-200 bg-white text-[11.5px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700"
                title="Clear search"
              >
                <X className="w-3 h-3" strokeWidth={1.75} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {activeSessions.length === 0 && archivedSessions.length === 0 ? (
            <div className="px-2.5 py-6 text-center text-[11px] text-slate-400">
              {searchQuery.trim()
                ? "No chats match your search"
                : "No chats yet"}
            </div>
          ) : (
            <>
              <SessionGroup
                label="Recent"
                sessions={activeSessions}
                currentId={currentSessionId}
                onSelect={selectSession}
                onDelete={deleteSession}
                onArchive={archiveSession}
              />
              {archivedSessions.length > 0 && (
                <SessionGroup
                  label="Archived"
                  sessions={archivedSessions}
                  currentId={currentSessionId}
                  onSelect={selectSession}
                  onDelete={deleteSession}
                  onArchive={archiveSession}
                  className="mt-4"
                />
              )}
            </>
          )}
        </div>

        <div className="border-t border-slate-200 px-3 py-2.5 text-[10.5px] text-slate-500 truncate">
          {ontologies.find((o) => o.ontology_version_id === selectedOntId)
            ?.name || "Ontology"}
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 flex flex-col bg-white">
        <div className="relative flex-1 min-h-0">
          {/* Floating sidebar toggle — mobile + desktop */}
          {/* Mobile: always visible, opens drawer */}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="lg:hidden absolute left-2.5 top-2.5 z-10 p-2 rounded-lg text-slate-600 hover:bg-slate-100 bg-white border border-slate-200 shadow-sm transition"
            title="Open sidebar"
          >
            <Menu className="w-4 h-4" strokeWidth={1.75} />
          </button>

          {/* Desktop: hidden when sidebar open, shown when collapsed */}
          {sidebarOpen ? (
            <button
              onClick={() => setSidebarOpen(false)}
              className="hidden lg:inline-flex absolute left-3 top-3 z-10 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition"
              title="Hide sidebar"
            >
              <PanelLeftClose className="w-4 h-4" strokeWidth={1.75} />
            </button>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="hidden lg:inline-flex absolute left-3 top-3 z-10 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 bg-white border border-slate-200 shadow-sm transition"
              title="Show sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}

          <div ref={scrollRef} className="h-full overflow-y-auto">
            {!activeSession || activeSession.messages.length === 0 ? (
              <EmptyState
                suggestions={SUGGESTIONS}
                onPick={(p) => {
                  setPrompt(p);
                  setTimeout(() => composerRef.current?.focus(), 20);
                }}
              />
            ) : (
              <div className="max-w-[760px] mx-auto px-3 sm:px-6 pt-14 sm:pt-12 pb-8 space-y-5 sm:space-y-6">
                {activeSession.messages.map((m) => (
                  <MessageRow key={m.id} msg={m} />
                ))}
                {running && (
                  <div className="flex gap-2.5 sm:gap-3">
                    <AssistantAvatar />
                    <div className="pt-0.5 flex items-center gap-2 text-[12.5px] sm:text-[13px] text-slate-500">
                      <Loader2
                        className="w-3.5 h-3.5 animate-spin"
                        strokeWidth={1.75}
                      />
                      Retrieving from knowledge base
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-800 text-[11.5px] flex items-center gap-2 shrink-0">
            <X className="w-3.5 h-3.5" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Composer */}
        <div className="border-t border-slate-200 bg-white shrink-0">
          <div className="max-w-[760px] mx-auto px-3 sm:px-6 py-3 sm:py-4">
            <div className="relative rounded-2xl border border-slate-200 focus-within:border-slate-400 bg-white shadow-sm transition">
              <textarea
                ref={composerRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask a question about the indexed documents"
                rows={2}
                disabled={running}
                className="w-full text-[13px] leading-relaxed px-3 sm:px-4 pt-3 pb-12 sm:pb-11 focus:outline-none resize-none bg-transparent text-slate-900 placeholder:text-slate-400 rounded-2xl"
              />
              <div className="absolute right-2 bottom-2">
                <button
                  onClick={() => sendMessage()}
                  disabled={running || !prompt.trim()}
                  className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-slate-900 text-white disabled:bg-slate-300 flex items-center justify-center hover:bg-slate-800 transition"
                  title="Send"
                >
                  {running ? (
                    <Loader2
                      className="w-4 h-4 animate-spin"
                      strokeWidth={1.75}
                    />
                  ) : (
                    <ArrowUp className="w-4 h-4" strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>
            <div className="text-[10px] sm:text-[10.5px] text-slate-400 text-center mt-2">
              Responses are grounded in indexed documents. Verify before use.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sidebar session group
// ─────────────────────────────────────────────────────────────
function SessionGroup({
  label,
  sessions,
  currentId,
  onSelect,
  onDelete,
  onArchive,
  className = "",
}: {
  label: string;
  sessions: ChatSession[];
  currentId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  className?: string;
}) {
  if (sessions.length === 0) return null;
  return (
    <div className={className}>
      <div className="px-2.5 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="space-y-0.5">
        {sessions.map((s) => {
          const active = s.id === currentId;
          return (
            <div
              key={s.id}
              className={`group flex items-center rounded-lg transition ${
                active
                  ? "bg-white shadow-sm border border-slate-200"
                  : "hover:bg-white"
              }`}
            >
              <button
                onClick={() => onSelect(s.id)}
                className="flex-1 text-left px-2.5 py-2 min-w-0"
              >
                <div
                  className={`text-[12px] leading-tight truncate ${
                    active
                      ? "text-slate-900 font-medium"
                      : "text-slate-700"
                  }`}
                >
                  {s.title || "Untitled"}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                  {s.messages.length} message
                  {s.messages.length === 1 ? "" : "s"}
                </div>
              </button>
              <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 pr-1 flex items-center gap-0.5">
                <button
                  onClick={() => onArchive(s.id)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  title={s.is_archived ? "Unarchive" : "Archive"}
                >
                  <Archive className="w-3 h-3" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => onDelete(s.id)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────
function EmptyState({
  suggestions,
  onPick,
}: {
  suggestions: { title: string; prompt: string }[];
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-4 sm:px-6 py-10 sm:py-12">
      <div className="w-full max-w-[720px] space-y-6 sm:space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-[20px] sm:text-[22px] font-semibold text-slate-900 tracking-tight">
            Ask the knowledge base
          </h1>
          <p className="text-[12.5px] sm:text-[13px] text-slate-500 leading-relaxed max-w-md mx-auto">
            Every answer is retrieved from the rulebooks, compliance specs, and
            glossaries indexed for this ontology.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
          {suggestions.map((s, i) => (
            <button
              key={s.title}
              onClick={() => onPick(s.prompt)}
              className="text-left p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition group flex flex-col gap-1.5"
            >
              <span className="text-[10px] font-mono text-slate-400">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[12.5px] font-medium text-slate-900 leading-tight">
                {s.title}
              </span>
              <span className="text-[11.5px] text-slate-500 leading-snug line-clamp-2">
                {s.prompt}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Assistant avatar
// ─────────────────────────────────────────────────────────────
function AssistantAvatar() {
  return (
    <div className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] sm:text-[11px] font-semibold tracking-tight mt-0.5">
      A
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Message rows
// ─────────────────────────────────────────────────────────────
function MessageRow({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[90%] sm:max-w-[85%] px-3.5 sm:px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-900 text-[12.5px] sm:text-[13px] leading-[1.6] whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 sm:gap-3">
      <AssistantAvatar />
      <div className="flex-1 min-w-0 space-y-2.5">
        <Markdown content={msg.content} />
        {msg.result && msg.result.retrieved_chunks.length > 0 && (
          <SourcesPanel
            chunks={msg.result.retrieved_chunks}
            meta={msg.result}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sources panel
// ─────────────────────────────────────────────────────────────
function SourcesPanel({
  chunks,
  meta,
}: {
  chunks: KBQueryResult["retrieved_chunks"];
  meta: KBQueryResult;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(3);

  const totalPages = Math.max(1, Math.ceil(chunks.length / pageSize));
  const visible = useMemo(
    () => chunks.slice(page * pageSize, (page + 1) * pageSize),
    [chunks, page, pageSize]
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 sm:px-3.5 h-10 text-[11.5px] text-slate-700 hover:bg-slate-50 rounded-xl"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {open ? (
            <ChevronDown
              className="w-3.5 h-3.5 shrink-0"
              strokeWidth={1.75}
            />
          ) : (
            <ChevronRight
              className="w-3.5 h-3.5 shrink-0"
              strokeWidth={1.75}
            />
          )}
          <FileText
            className="w-3.5 h-3.5 text-slate-400 shrink-0"
            strokeWidth={1.75}
          />
          <span className="font-medium">Sources</span>
          <span className="text-slate-400">({chunks.length})</span>
        </span>
        <span className="hidden sm:inline text-[10px] font-mono text-slate-400 truncate max-w-[180px]">
          {meta.model_used} · {meta.search_mode}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-2.5 sm:p-3 space-y-2">
          {visible.map((c, i) => {
            const globalIdx = page * pageSize + i;
            return (
              <div
                key={globalIdx}
                className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 sm:p-3"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {String(globalIdx + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[11px] sm:text-[11.5px] font-medium text-slate-900 truncate">
                      {c.chunk.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">
                    {(c.score * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-[11px] sm:text-[11.5px] text-slate-600 leading-[1.6] whitespace-pre-wrap line-clamp-6">
                  {c.chunk.content}
                </p>
              </div>
            );
          })}

          {chunks.length > pageSize && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10.5px] text-slate-500">
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline">Per page</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(0);
                  }}
                  className="text-[10.5px] px-1.5 py-0.5 border border-slate-200 rounded-md bg-white"
                >
                  {[3, 5, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span className="font-mono">
                  {page * pageSize + 1}–
                  {Math.min(chunks.length, (page + 1) * pageSize)} /{" "}
                  {chunks.length}
                </span>
              </div>
              <div className="flex items-center gap-0.5">
                <PagerBtn
                  disabled={page === 0}
                  onClick={() => setPage(0)}
                  title="First"
                >
                  <ChevronsLeft className="w-3 h-3" strokeWidth={1.75} />
                </PagerBtn>
                <PagerBtn
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  title="Previous"
                >
                  <ChevronLeft className="w-3 h-3" strokeWidth={1.75} />
                </PagerBtn>
                <span className="px-1.5 font-mono min-w-[36px] text-center">
                  {page + 1}/{totalPages}
                </span>
                <PagerBtn
                  disabled={page >= totalPages - 1}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  title="Next"
                >
                  <ChevronRightIcon
                    className="w-3 h-3"
                    strokeWidth={1.75}
                  />
                </PagerBtn>
                <PagerBtn
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(totalPages - 1)}
                  title="Last"
                >
                  <ChevronsRight className="w-3 h-3" strokeWidth={1.75} />
                </PagerBtn>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PagerBtn({
  children,
  disabled,
  onClick,
  title,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="p-1 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
    >
      {children}
    </button>
  );
}