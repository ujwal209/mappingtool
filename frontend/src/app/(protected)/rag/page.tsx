"use client";

import React, { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { ProjectGuard } from "@/components/ProjectGuard";
import { CustomSelect } from "@/components/ui/custom-select";
import { api, OntologyVersionItem, RAGDocumentItem, RAGQueryResult } from "@/lib/api-client";
import {
  FileText,
  Upload,
  Search,
  BookOpen,
  RefreshCw,
  CheckCircle2,
  HelpCircle,
  Check,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function VectorRAGPage() {
  const [ontologies, setOntologies] = useState<OntologyVersionItem[]>([]);
  const [selectedOntId, setSelectedOntId] = useState<string>("");
  const [documents, setDocuments] = useState<RAGDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Ingestion form state
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docType, setDocType] = useState("RULEBOOK");
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);

  // Search state
  const [query, setQuery] = useState("");
  const [ragResult, setRagResult] = useState<RAGQueryResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const loadOntologiesAndDocs = async () => {
    setLoading(true);
    try {
      const ontList = await api.getOntologies();
      setOntologies(ontList);
      if (ontList.length > 0) {
        const ontId = selectedOntId || ontList[0].ontology_version_id;
        setSelectedOntId(ontId);
        const docList = await api.listRAGDocuments(ontId).catch(() => []);
        setDocuments(docList);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOntologiesAndDocs();
  }, []);

  const handleOntologyChange = async (ontId: string) => {
    setSelectedOntId(ontId);
    setLoading(true);
    try {
      const docList = await api.listRAGDocuments(ontId).catch(() => []);
      setDocuments(docList);
    } finally {
      setLoading(false);
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOntId || !docContent.trim()) return;
    setIngestLoading(true);
    setIngestSuccess(null);
    try {
      await api.ingestRAGDocument(selectedOntId, {
        title: docTitle || "Enterprise Governance Specification",
        content: docContent,
        document_type: docType,
        chunk_size: 400,
        chunk_overlap: 50,
      });
      setIngestSuccess("Document chunked and stored in the central database knowledge base.");
      setDocTitle("");
      setDocContent("");
      const docList = await api.listRAGDocuments(selectedOntId).catch(() => []);
      setDocuments(docList);
    } catch (err: any) {
      alert(`Ingestion failed: ${err.message}`);
    } finally {
      setIngestLoading(false);
    }
  };

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOntId || !query.trim()) return;
    setSearchLoading(true);
    try {
      const res = await api.queryOntologyRAG(selectedOntId, query, 3);
      setRagResult(res);
    } catch (err: any) {
      alert(`Search failed: ${err.message}`);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <ProjectGuard featureName="Knowledge Base & Rules">
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                KNOWLEDGE BASE
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Business Rulebooks & Governance Specs
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Ingest corporate rulebooks, compliance glossaries, and format requirements for semantic guidance during mapping.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {ontologies.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-600 font-medium min-w-[200px]">
                <span>Ontology:</span>
                <CustomSelect
                  value={selectedOntId}
                  onChange={handleOntologyChange}
                  options={ontologies.map((ont) => ({
                    value: ont.ontology_version_id,
                    label: `v${ont.version_tag} (${ont.ontology_version_id})`,
                  }))}
                />
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={loadOntologiesAndDocs}
              className="text-xs h-9 border-slate-200 text-slate-700 bg-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* How To Use Guide */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">How To Use The Knowledge Base</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-900 block mb-1">1. Ingest Documents</span>
              Paste rulebooks, compliance policies, or field specifications on the left to index them for the selected ontology.
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-900 block mb-1">2. Semantic Guidance</span>
              Use the semantic search on the right to query policy constraints, mandatory formats, or validation formulas.
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-900 block mb-1">3. Automated Grounding</span>
              During schema mapping, the platform automatically retrieves indexed rules to guide and justify proposed transformations.
            </div>
          </div>
        </div>

        {/* Ingestion & Search Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Document Ingestion Form */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-slate-700" />
                Ingest Governance Document
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Rulebooks are split into semantic chunks and stored in the central database.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5">
              <form onSubmit={handleIngest} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Master Customer Governance & HIPAA Constraints"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Document Classification
                  </label>
                  <CustomSelect
                    value={docType}
                    onChange={setDocType}
                    options={[
                      { value: "RULEBOOK", label: "RULEBOOK (Transformation Rules & Validation)" },
                      { value: "GLOSSARY", label: "GLOSSARY (Business Terminology & Definitions)" },
                      { value: "COMPLIANCE", label: "COMPLIANCE (Data Privacy, Retention & PII)" },
                      { value: "SPECIFICATION", label: "SPECIFICATION (Physical Column Formats)" },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rulebook Content *
                  </label>
                  <textarea
                    rows={8}
                    required
                    placeholder="Paste corporate rulebook, naming conventions, or validation constraints here..."
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 font-mono text-slate-800"
                  />
                </div>

                {ingestSuccess && (
                  <div className="p-3 bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-slate-900 shrink-0" />
                    <span>{ingestSuccess}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={ingestLoading || !docContent.trim() || !selectedOntId}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs h-9"
                >
                  {ingestLoading ? "Processing & Storing..." : "Ingest Document"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Semantic Search Studio */}
          <div className="space-y-6">
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-700" />
                  Semantic Rule Query
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Search indexed rulebooks to find relevant governance constraints.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                <form onSubmit={handleQuery} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. What are the rules for customer email formatting?"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                  <Button
                    type="submit"
                    disabled={searchLoading || !query.trim() || !selectedOntId}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-9 shrink-0"
                  >
                    {searchLoading ? "Searching..." : "Search"}
                  </Button>
                </form>

                {ragResult && (
                  <div className="space-y-4 pt-2">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                      <span className="text-xs font-bold text-slate-900 block">Synthesized Guidance</span>
                      <p className="text-xs text-slate-700 leading-relaxed font-sans">
                        {ragResult.synthesized_guidance}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-slate-800 block">
                        Retrieved Rule Segments ({ragResult.retrieved_chunks?.length || 0})
                      </span>
                      {ragResult.retrieved_chunks?.map((c, i) => (
                        <div key={i} className="p-3 bg-white border border-slate-200 rounded-lg space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900">{c.chunk.title}</span>
                            <span className="font-mono text-[10px] text-slate-500">Score: {(c.score * 100).toFixed(0)}%</span>
                          </div>
                          <p className="text-slate-600 text-[11px] leading-relaxed">
                            {c.chunk.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Indexed Documents Table */}
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-900">
                  Indexed Rulebooks ({documents.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {documents.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No documents indexed for this ontology yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {documents.map((d) => (
                      <div key={d.document_id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <span className="font-semibold text-slate-900 block">{d.title}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Type: {d.document_type} • {d.chunk_count} segments
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-700">
                          INDEXED
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      </ProjectGuard>
    </ProtectedRoute>
  );
}
