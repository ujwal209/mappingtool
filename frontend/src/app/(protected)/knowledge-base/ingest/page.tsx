"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useKnowledgeBaseContext } from "../layout";
import { uploadDocument, UploadMetadata } from "@/lib/kb-api";
import { CustomSelect } from "@/components/ui/custom-select";
import { Label, Input, Textarea, SectionHeader } from "@/components/kb/shared";
import {
  Upload,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  X,
  FileText,
  AlertCircle,
  Building2,
  Tag,
  Link2,
  Info,
} from "lucide-react";

const DOC_TYPE_OPTIONS = [
  { value: "RULEBOOK", label: "Rulebook", description: "Transformation rules & validation constraints" },
  { value: "GLOSSARY", label: "Glossary", description: "Business terminology & definitions" },
  { value: "COMPLIANCE", label: "Compliance", description: "Data privacy, retention & PII rules" },
  { value: "SPECIFICATION", label: "Specification", description: "Physical column formats & layouts" },
  { value: "CONTRACT", label: "Contract", description: "Service / data contracts between systems" },
  { value: "POLICY", label: "Policy", description: "Organizational governance policies" },
  { value: "OTHER", label: "Other", description: "Anything else the ontology should know about" },
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "hi", label: "Hindi" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
];

const CONFIDENTIALITY_OPTIONS = [
  { value: "PUBLIC", label: "Public" },
  { value: "INTERNAL", label: "Internal" },
  { value: "CONFIDENTIAL", label: "Confidential" },
  { value: "RESTRICTED", label: "Restricted" },
];

const ACCEPTED_EXT = [".pdf", ".docx", ".txt", ".md", ".csv", ".json"];
const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
].join(",");

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}
function isAccepted(file: File): boolean {
  return ACCEPTED_EXT.includes(extOf(file.name));
}
function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function IngestPage() {
  const router = useRouter();
  const { selectedOntId, ontologies } = useKnowledgeBaseContext();
  const currentOntology = ontologies.find(
    (o) => o.ontology_version_id === selectedOntId
  );

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState(DOC_TYPE_OPTIONS[0].value);

  const [owner, setOwner] = useState("");
  const [department, setDepartment] = useState("");
  const [version, setVersion] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [relatedEntitiesInput, setRelatedEntitiesInput] = useState("");
  const [language, setLanguage] = useState("en");
  const [confidentiality, setConfidentiality] = useState("INTERNAL");
  const [sourceUrl, setSourceUrl] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = !!selectedOntId && !!file && !loading;

  const pickFile = (f: File | null) => {
    setError(null);
    setSuccess(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!isAccepted(f)) {
      setError(
        `Unsupported file type "${extOf(f.name) || "unknown"}". Accepted: ${ACCEPTED_EXT.join(", ")}`
      );
      setFile(null);
      return;
    }
    setFile(f);
    if (!title.trim()) {
      setTitle(
        f.name
          .replace(/\.[^.]+$/, "")
          .replace(/[_-]+/g, " ")
          .trim()
      );
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    pickFile(e.dataTransfer.files?.[0] ?? null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !file) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const metadata: UploadMetadata = {
      owner: owner.trim() || undefined,
      department: department.trim() || undefined,
      version: version.trim() || undefined,
      jurisdiction: jurisdiction.trim() || undefined,
      effective_date: effectiveDate || undefined,
      expiry_date: expiryDate || undefined,
      tags: tagsInput.split(",").map((s) => s.trim()).filter(Boolean),
      related_entities: relatedEntitiesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      language: language || undefined,
      confidentiality: (confidentiality as any) || undefined,
      source_url: sourceUrl.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    (Object.keys(metadata) as (keyof UploadMetadata)[]).forEach((k) => {
      const v = metadata[k];
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) {
        delete metadata[k];
      }
    });

    try {
      const res = await uploadDocument(selectedOntId, {
        file,
        title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
        document_type: docType,
        metadata,
      });
      setSuccess(
        `Uploaded "${res.title}" — ${res.chunk_count} chunk${
          res.chunk_count === 1 ? "" : "s"
        } indexed.`
      );
      setTimeout(() => {
        router.push(`/knowledge-base?ontology_id=${selectedOntId}`);
      }, 900);
    } catch (err: any) {
      setError(err.message || "Upload failed");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() =>
          router.push(`/knowledge-base?ontology_id=${selectedOntId}`)
        }
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to documents
      </button>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* File section */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Upload className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-slate-900">
                Upload document
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                {currentOntology
                  ? `Target ontology: ${currentOntology.name} · v${currentOntology.version_tag}`
                  : "No ontology selected"}
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-[11px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            {!file ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                className={`flex flex-col items-center justify-center gap-3 p-10 rounded-xl border-2 border-dashed cursor-pointer transition ${
                  dragActive
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-slate-600" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    Drop a file here, or click to browse
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {ACCEPTED_EXT.join(" · ")} · max 20 MB
                  </p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED_MIME + "," + ACCEPTED_EXT.join(",")}
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-slate-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-xs font-semibold text-slate-900 truncate"
                    title={file.name}
                  >
                    {file.name}
                  </p>
                  <p className="text-[10.5px] text-slate-500 font-mono">
                    {fmtSize(file.size)} · {extOf(file.name)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                  disabled={loading}
                  className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                  title="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Classification */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
            <SectionHeader
              title="Classification"
              description="How this document is identified and used in the knowledge base."
              icon={Tag}
            />
          </div>
          <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label required>Title</Label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Master Customer Governance & HIPAA Constraints"
                disabled={loading}
              />
            </div>
            <div>
              <Label>Document type</Label>
              <CustomSelect
                value={docType}
                onChange={setDocType}
                options={DOC_TYPE_OPTIONS}
              />
            </div>
            <div>
              <Label hint="e.g. v2.1, 2026-Q1">Version</Label>
              <Input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="v1.0"
                disabled={loading}
              />
            </div>
            <div>
              <Label>Language</Label>
              <CustomSelect
                value={language}
                onChange={setLanguage}
                options={LANGUAGE_OPTIONS}
              />
            </div>
            <div>
              <Label>Confidentiality</Label>
              <CustomSelect
                value={confidentiality}
                onChange={setConfidentiality}
                options={CONFIDENTIALITY_OPTIONS}
              />
            </div>
            <div className="sm:col-span-2">
              <Label hint="Comma-separated, e.g. pii, gdpr, customer, retention">
                Tags
              </Label>
              <Input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="pii, gdpr, retention, customer"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Ownership & scope */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
            <SectionHeader
              title="Ownership & Scope"
              description="Who owns this document, where it applies, and how it relates to entities."
              icon={Building2}
            />
          </div>
          <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Owner</Label>
              <Input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g. data-governance@acme.com"
                disabled={loading}
              />
            </div>
            <div>
              <Label>Department</Label>
              <Input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Compliance / Risk"
                disabled={loading}
              />
            </div>
            <div>
              <Label hint="Region or regulator">Jurisdiction</Label>
              <Input
                type="text"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                placeholder="e.g. EU, US-CA, Global"
                disabled={loading}
              />
            </div>
            <div>
              <Label hint="Comma-separated ontology entity names">
                Related entities
              </Label>
              <Input
                type="text"
                value={relatedEntitiesInput}
                onChange={(e) => setRelatedEntitiesInput(e.target.value)}
                placeholder="Customer, Account, Invoice"
                disabled={loading}
              />
            </div>
            <div>
              <Label>Effective date</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <Label>Expiry date</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Source & notes */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
            <SectionHeader
              title="Source & notes"
              description="Optional references and free-form context."
              icon={Link2}
            />
          </div>
          <div className="p-5 sm:p-6 space-y-4">
            <div>
              <Label hint="URL of the canonical source">Source URL</Label>
              <Input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://intranet.example.com/policies/customer-data"
                disabled={loading}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional context the retrieval step should be aware of..."
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            <span>
              File is parsed, chunked, and embedded. Metadata is stored on the
              document for filtering and citation.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                router.push(`/knowledge-base?ontology_id=${selectedOntId}`)
              }
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              {loading ? "Uploading & indexing..." : "Upload document"}
            </button>
          </div>
        </div>

        {loading && (
          <p className="text-[10.5px] text-slate-500 text-center">
            Parsing file → chunking → embedding with Gemini → persisting. This
            can take 10–30 seconds for large PDFs.
          </p>
        )}
      </form>
    </div>
  );
}