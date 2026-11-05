"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useKnowledgeBaseContext } from "./layout";
import { KBDocument, listDocuments, deleteDocument } from "@/lib/kb-api";
import {
  FileText,
  Search,
  RefreshCw,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  X,
  User,
  Building2,
  Tag,
  Calendar,
} from "lucide-react";
import { inputClass } from "@/components/kb/shared";

const DOC_TYPE_LABELS: Record<string, string> = {
  RULEBOOK: "Rulebook",
  GLOSSARY: "Glossary",
  COMPLIANCE: "Compliance",
  SPECIFICATION: "Specification",
  CONTRACT: "Contract",
  POLICY: "Policy",
  OTHER: "Other",
};
function docTypeLabel(t: string): string {
  return DOC_TYPE_LABELS[t] ?? t;
}

const PAGE_SIZES = [10, 25, 50, 100] as const;

type SortMode = "title-asc" | "title-desc" | "chunks-desc" | "chunks-asc";

export default function DocumentsPage() {
  const { selectedOntId, loading: ontLoading, refreshOntologies } =
    useKnowledgeBaseContext();

  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("title-asc");

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [debounced, sortMode, pageSize]);

  const loadDocs = async () => {
    if (!selectedOntId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listDocuments(selectedOntId);
      setDocuments(list);
    } catch (e: any) {
      setError(e.message || "Failed to load documents");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOntId]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    let list = documents;
    if (q) {
      list = list.filter((d) => {
        const meta = d.extra_metadata || {};
        const tags = Array.isArray(meta.tags) ? meta.tags.join(" ") : "";
        return (
          d.title.toLowerCase().includes(q) ||
          (d.document_type || "").toLowerCase().includes(q) ||
          (meta.owner || "").toLowerCase().includes(q) ||
          (meta.department || "").toLowerCase().includes(q) ||
          (meta.jurisdiction || "").toLowerCase().includes(q) ||
          tags.toLowerCase().includes(q)
        );
      });
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortMode) {
        case "title-asc":
          return a.title.localeCompare(b.title);
        case "title-desc":
          return b.title.localeCompare(a.title);
        case "chunks-desc":
          return (b.chunk_count || 0) - (a.chunk_count || 0);
        case "chunks-asc":
          return (a.chunk_count || 0) - (b.chunk_count || 0);
        default:
          return 0;
      }
    });
    return sorted;
  }, [documents, debounced, sortMode]);

  const matchCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(matchCount / pageSize));
  const visible = useMemo(() => {
    const start = page * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const handleDelete = async (docId: string, docTitle: string) => {
    if (!selectedOntId) return;
    if (!confirm(`Delete "${docTitle}" and all its indexed chunks?`)) return;
    try {
      await deleteDocument(selectedOntId, docId);
      await loadDocs();
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`);
    }
  };

  const hasActiveFilter = debounced.trim().length > 0;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, type, owner, tags..."
            className={`${inputClass} pl-8 pr-8`}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-slate-700 rounded"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="relative shrink-0">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="text-xs pl-8 pr-6 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="title-asc">Title (A → Z)</option>
            <option value="title-desc">Title (Z → A)</option>
            <option value="chunks-desc">Most chunks</option>
            <option value="chunks-asc">Fewest chunks</option>
          </select>
        </div>
        <button
          onClick={() => {
            refreshOntologies();
            loadDocs();
          }}
          disabled={loading || ontLoading}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 shrink-0"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
        <Link
          href={`/knowledge-base/ingest${
            selectedOntId ? `?ontology_id=${selectedOntId}` : ""
          }`}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Upload
        </Link>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-[11px]">
          {error}
        </div>
      )}

      <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
        <span className="font-mono font-semibold text-slate-700">
          {documents.length}
        </span>
        <span>document{documents.length === 1 ? "" : "s"} indexed</span>
        {hasActiveFilter && (
          <>
            <span className="text-slate-300">·</span>
            <span className="font-mono font-semibold text-blue-700">
              {matchCount}
            </span>
            <span>match</span>
            <button
              onClick={() => setQuery("")}
              className="ml-1 text-blue-700 hover:underline font-semibold"
            >
              Clear
            </button>
          </>
        )}
      </div>

      <div ref={scrollRef}>
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin" />
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="py-16 px-6 bg-white border border-slate-200 rounded-2xl text-center max-w-lg mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                No documents indexed
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Upload a PDF, DOCX, or TXT rulebook to ground semantic reasoning.
              </p>
            </div>
            <Link
              href={`/knowledge-base/ingest${
                selectedOntId ? `?ontology_id=${selectedOntId}` : ""
              }`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" /> Upload first document
            </Link>
          </div>
        ) : matchCount === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No documents match “{debounced}”.
          </div>
        ) : (
          <>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100">
              {visible.map((d) => (
                <DocumentRow
                  key={d.document_id}
                  doc={d}
                  onDelete={() => handleDelete(d.document_id, d.title)}
                />
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline">Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="text-xs px-2 py-1 border border-slate-200 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span className="text-slate-500 font-mono text-[11px]">
                  {page * pageSize + 1}–
                  {Math.min(matchCount, (page + 1) * pageSize)} of {matchCount}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <PagerBtn
                  disabled={page === 0}
                  onClick={() => setPage(0)}
                  title="First page"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </PagerBtn>
                <PagerBtn
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  title="Previous"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </PagerBtn>
                <span className="px-3 text-xs font-semibold text-slate-700 font-mono min-w-[70px] text-center">
                  {page + 1} / {totalPages}
                </span>
                <PagerBtn
                  disabled={page >= totalPages - 1}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  title="Next"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </PagerBtn>
                <PagerBtn
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(totalPages - 1)}
                  title="Last page"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </PagerBtn>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DocumentRow({
  doc,
  onDelete,
}: {
  doc: KBDocument;
  onDelete: () => void;
}) {
  const meta = doc.extra_metadata || {};
  const tags: string[] = Array.isArray(meta.tags) ? meta.tags : [];
  const entities: string[] = Array.isArray(meta.related_entities)
    ? meta.related_entities
    : [];

  return (
    <div className="flex items-start gap-3 px-3 sm:px-4 py-3 hover:bg-slate-50 transition">
      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
        <FileText className="w-4 h-4 text-slate-600" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {/* Line 1: title + type badge + chunks */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-slate-900 truncate">
            {doc.title}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
            {docTypeLabel(doc.document_type)}
          </span>
          {meta.version && (
            <span className="text-[10px] font-mono text-slate-500">
              {meta.version}
            </span>
          )}
          <span className="text-[10px] font-mono text-slate-500">
            {doc.chunk_count} chunk{doc.chunk_count === 1 ? "" : "s"}
          </span>
          {meta.confidentiality && (
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
              {meta.confidentiality}
            </span>
          )}
        </div>

        {/* Line 2: metadata chips */}
        {(meta.owner ||
          meta.department ||
          meta.jurisdiction ||
          meta.effective_date) && (
          <div className="flex items-center gap-3 flex-wrap text-[10.5px] text-slate-500">
            {meta.owner && (
              <span className="flex items-center gap-1 truncate max-w-[220px]">
                <User className="w-3 h-3 text-slate-400" />
                <span className="truncate">{meta.owner}</span>
              </span>
            )}
            {meta.department && (
              <span className="flex items-center gap-1 truncate max-w-[180px]">
                <Building2 className="w-3 h-3 text-slate-400" />
                <span className="truncate">{meta.department}</span>
              </span>
            )}
            {meta.jurisdiction && (
              <span className="flex items-center gap-1">
                <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">
                  {meta.jurisdiction}
                </span>
              </span>
            )}
            {meta.effective_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span className="font-mono text-[10px]">
                  {meta.effective_date}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Line 3: tags + related entities */}
        {(tags.length > 0 || entities.length > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
            {tags.length > 0 && (
              <Tag className="w-3 h-3 text-slate-400" />
            )}
            {tags.slice(0, 8).map((t) => (
              <span
                key={t}
                className="px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600"
              >
                {t}
              </span>
            ))}
            {tags.length > 8 && (
              <span className="text-slate-400">+{tags.length - 8}</span>
            )}
            {entities.length > 0 && (
              <span className="ml-2 text-slate-500">
                ·{" "}
                <span className="font-mono text-slate-600">
                  {entities.slice(0, 4).join(", ")}
                  {entities.length > 4 ? ` +${entities.length - 4}` : ""}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Line 4: document_id */}
        <div className="text-[10px] text-slate-400 font-mono truncate">
          {doc.document_id}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
        title="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
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
      className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}