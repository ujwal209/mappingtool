"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { ProjectGuard } from "@/components/ProjectGuard";
import { OntologyPicker } from "@/components/kb/OntologyPicker";
import { KBOntology, listOntologies } from "@/lib/kb-api";

interface KnowledgeBaseContextValue {
  ontologies: KBOntology[];
  selectedOntId: string;
  setSelectedOntId: (id: string) => void;
  loading: boolean;
  refreshOntologies: () => Promise<void>;
}

const KnowledgeBaseContext =
  createContext<KnowledgeBaseContextValue | null>(null);

export function useKnowledgeBaseContext(): KnowledgeBaseContextValue {
  const ctx = useContext(KnowledgeBaseContext);
  if (!ctx)
    throw new Error(
      "useKnowledgeBaseContext must be used inside <KnowledgeBaseLayout />"
    );
  return ctx;
}

const TABS = [
  { href: "/knowledge-base", label: "Documents" },
  { href: "/knowledge-base/ingest", label: "Upload" },
  { href: "/knowledge-base/query", label: "Query" },
];

export default function KnowledgeBaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [ontologies, setOntologies] = useState<KBOntology[]>([]);
  const [selectedOntId, setSelectedOntIdState] = useState<string>(
    () => params.get("ontology_id") || ""
  );
  const [loading, setLoading] = useState(true);

  const refreshOntologies = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listOntologies().catch(() => [] as KBOntology[]);
      setOntologies(list);
      if (list.length > 0 && !selectedOntId) {
        const first = list[0].ontology_version_id;
        setSelectedOntIdState(first);
        const sp = new URLSearchParams(Array.from(params.entries()));
        sp.set("ontology_id", first);
        router.replace(`${pathname}?${sp.toString()}`);
      }
    } finally {
      setLoading(false);
    }
  }, [pathname, params, router, selectedOntId]);

  useEffect(() => {
    refreshOntologies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSelectedOntId = (id: string) => {
    setSelectedOntIdState(id);
    const sp = new URLSearchParams(Array.from(params.entries()));
    sp.set("ontology_id", id);
    sp.delete("page");
    sp.delete("q");
    router.replace(`${pathname}?${sp.toString()}`);
  };

  useEffect(() => {
    if (ontologies.length > 0 && !selectedOntId) {
      setSelectedOntId(ontologies[0].ontology_version_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ontologies.length]);

  const activeTab = useMemo(() => {
    const matches = TABS.filter(
      (t) => pathname === t.href || pathname.startsWith(t.href + "/")
    );
    matches.sort((a, b) => b.href.length - a.href.length);
    return matches[0]?.href ?? "/knowledge-base";
  }, [pathname]);

  const isQueryTab = activeTab === "/knowledge-base/query";

  return (
    <ProtectedRoute>
      <ProjectGuard featureName="Knowledge Base & Rules">
        <KnowledgeBaseContext.Provider
          value={{
            ontologies,
            selectedOntId,
            setSelectedOntId,
            loading,
            refreshOntologies,
          }}
        >
          {isQueryTab ? (
            // FULL-BLEED — main already has no padding via AppShell.
            // Fill the height that <main> gives us.
            <div className="h-full w-full flex flex-col bg-white">
              {children}
            </div>
          ) : (
            // Padded for other KB tabs
            <div className="min-h-full bg-[#F8FAFC]">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 uppercase tracking-wider">
                      Knowledge Base
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                    <div className="min-w-0">
                      <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
                        Rulebooks & Governance Specs
                      </h1>
                      <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
                        Upload PDFs, Word docs, or text files. They are parsed,
                        chunked, and embedded for semantic retrieval during
                        mapping.
                      </p>
                    </div>
                    {ontologies.length > 0 && (
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-[340px]">
                        <span className="text-[11px] text-slate-600 font-medium whitespace-nowrap">
                          Ontology:
                        </span>
                        <div className="flex-1 min-w-0">
                          <OntologyPicker
                            value={selectedOntId}
                            onChange={setSelectedOntId}
                            disabled={loading}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {!loading && ontologies.length === 0 && (
                  <div className="p-6 bg-white border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                    No ontologies yet. Create one in the{" "}
                    <Link href="/ontology" className="underline text-slate-900">
                      Ontology Studio
                    </Link>{" "}
                    first — the knowledge base is scoped per-ontology.
                  </div>
                )}

                {ontologies.length > 0 && (
                  <>
                    <div className="flex items-center gap-1 border-b border-slate-200">
                      {TABS.map((t) => {
                        const active = t.href === activeTab;
                        return (
                          <Link
                            key={t.href}
                            href={`${t.href}${
                              selectedOntId
                                ? `?ontology_id=${selectedOntId}`
                                : ""
                            }`}
                            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition ${
                              active
                                ? "border-slate-900 text-slate-900"
                                : "border-transparent text-slate-500 hover:text-slate-900"
                            }`}
                          >
                            {t.label}
                          </Link>
                        );
                      })}
                    </div>
                    {children}
                  </>
                )}
              </div>
            </div>
          )}
        </KnowledgeBaseContext.Provider>
      </ProjectGuard>
    </ProtectedRoute>
  );
}