"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import { api } from "@/lib/api-client";
import { useProject } from "@/context/ProjectContext";
import { CustomSelect } from "@/components/ui/custom-select";

// ─────────────────────────────────────────────────────────────
// Inline icons — minimal, 1.5px stroke, square caps.
// No Lucide — keeps the page visually neutral.
// ─────────────────────────────────────────────────────────────

function ArrowLeftIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <path d="M10 3L5 8l5 5" />
      <path d="M5 8h9" />
    </svg>
  );
}

function ArrowRightIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <path d="M6 3l5 5-5 5" />
      <path d="M11 8H2" />
    </svg>
  );
}

function ChevronDownIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <path d="M3 6l5 5 5-5" />
    </svg>
  );
}

function SearchIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M13.5 13.5L10.3 10.3" />
    </svg>
  );
}

function CheckIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <path d="M3 8.5l3.5 3.5L13 4.5" />
    </svg>
  );
}

function PlusIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function AlertIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <path d="M8 1.5L15 14H1L8 1.5z" />
      <path d="M8 6v3.5" />
      <path d="M8 11.5v.5" />
    </svg>
  );
}

function SpinnerIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={`${className} animate-spin`}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Suggestion catalogs
// ─────────────────────────────────────────────────────────────
const DOMAIN_SUGGESTIONS: string[] = [
  "Customer & Commerce",
  "Retail & eCommerce",
  "Banking & Financial Services",
  "Payments & Settlement",
  "Insurance",
  "Capital Markets",
  "Healthcare",
  "Pharmaceuticals & Life Sciences",
  "Clinical Trials",
  "Supply Chain",
  "Logistics & Delivery",
  "Warehousing & Fulfillment",
  "Manufacturing",
  "Automotive",
  "Aerospace & Defense",
  "Telecommunications",
  "Media & Entertainment",
  "Energy & Utilities",
  "Oil & Gas",
  "Mining & Metals",
  "Construction & Engineering",
  "Real Estate & Property",
  "Hospitality & Travel",
  "Airlines",
  "SaaS Product",
  "Developer Tools",
  "Public Sector & Government",
  "Education",
  "Nonprofit & NGO",
  "Legal Services",
  "Professional Services",
  "Agriculture & Food",
];

const NAME_HINTS_BY_DOMAIN: Record<string, string[]> = {
  "Customer & Commerce": ["Omnichannel Commerce Graph", "Customer 360 Model", "Retail Product Catalog"],
  "Retail & eCommerce": ["Retail Commerce Ontology", "Store & Inventory Graph", "Basket & Checkout Model"],
  "Banking & Financial Services": ["Core Banking Ledger", "Payments & Settlement Model", "Retail Credit Reference"],
  "Payments & Settlement": ["Card & Payments Ontology", "Settlement Network Graph", "Merchant Acquiring Model"],
  "Insurance": ["Policy Administration Model", "Claims & Coverage Ontology", "Underwriting Reference Model"],
  "Capital Markets": ["Trade Lifecycle Ontology", "Order & Execution Graph", "Reference Data Model"],
  "Healthcare": ["Patient Care Ontology", "Payer-Provider Claims Graph", "Clinical Encounter Model"],
  "Pharmaceuticals & Life Sciences": ["Drug Development Ontology", "Trial & Protocol Graph", "Manufacturing Batch Model"],
  "Clinical Trials": ["Trial Protocol Ontology", "Site & Subject Graph", "Adverse Event Model"],
  "Supply Chain": ["Global Supply Chain Model", "Supplier Network Ontology", "Warehouse & Fulfillment Model"],
  "Logistics & Delivery": ["Last-Mile Delivery Model", "Fleet & Route Ontology", "Shipment Tracking Graph"],
  "Warehousing & Fulfillment": ["Warehouse Operations Model", "Stock & Slotting Graph", "Fulfillment Center Ontology"],
  "Manufacturing": ["Plant Production Ontology", "BOM & Component Graph", "Machine & WorkOrder Model"],
  "Automotive": ["Vehicle Master Ontology", "Parts & Service Graph", "Dealer Network Model"],
  "Aerospace & Defense": ["Fleet & Asset Model", "Mission & Sortie Graph", "MRO Ontology"],
  "Telecommunications": ["Subscriber & Plan Ontology", "Network & Session Graph", "Billing & Usage Model"],
  "Media & Entertainment": ["Content Catalog Ontology", "Rights & Distribution Graph", "Viewer Engagement Model"],
  "Energy & Utilities": ["Grid & Metering Ontology", "Customer & Tariff Graph", "Asset Lifecycle Model"],
  "Oil & Gas": ["Well & Reservoir Model", "Upstream & Midstream Graph", "Asset Integrity Ontology"],
  "Mining & Metals": ["Mine & Extraction Model", "Ore & Processing Graph", "Asset & Safety Ontology"],
  "Construction & Engineering": ["Project & Contract Ontology", "Site & Resource Graph", "BOM & Schedule Model"],
  "Real Estate & Property": ["Property & Lease Ontology", "Tenant & Unit Graph", "Portfolio Management Model"],
  "Hospitality & Travel": ["Booking & Itinerary Model", "Guest & Loyalty Graph", "Property & Rate Ontology"],
  "Airlines": ["Flight & Network Ontology", "Crew & Roster Graph", "Revenue & Ancillary Model"],
  "SaaS Product": ["Multi-Tenant SaaS Model", "Subscription & Billing Ontology", "Feature Entitlement Graph"],
  "Developer Tools": ["Developer Platform Ontology", "API & Service Graph", "Usage & Quota Model"],
  "Public Sector & Government": ["Citizen Services Ontology", "Case & Agency Graph", "Permit & License Model"],
  "Education": ["Student Lifecycle Ontology", "Course & Enrollment Graph", "Assessment & Outcome Model"],
  "Nonprofit & NGO": ["Donor & Program Ontology", "Grant & Impact Graph", "Volunteer & Engagement Model"],
  "Legal Services": ["Matter & Case Ontology", "Client & Counsel Graph", "Document & Clause Model"],
  "Professional Services": ["Engagement Ontology", "Client & Project Graph", "Timesheet & Billing Model"],
  "Agriculture & Food": ["Farm & Crop Ontology", "Supply & Traceability Graph", "Harvest & Yield Model"],
};

const DEFAULT_NAME_HINTS = [
  "Enterprise Business Model",
  "Domain Reference Ontology",
  "Customer & Operations Graph",
];

const VERSION_SUGGESTIONS = ["0.1.0", "1.0.0", "1.1.0", "2.0.0"];

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function NewOntologyPage() {
  const router = useRouter();
  const { activeProject, activeProjectId } = useProject();

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProjectId || "");
  const [name, setName] = useState("Enterprise Business Model");
  const [domain, setDomain] = useState<string>(activeProject?.domain || "Customer & Commerce");
  const [versionTag, setVersionTag] = useState("1.0.0");
  const [description, setDescription] = useState(
    "Canonical domain ontology specifying core business entities, relationships, attributes, and semantic governance rules."
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getProjects()
      .then((projs) => {
        setProjects(projs);
        if (projs.length > 0 && !selectedProjectId) {
          setSelectedProjectId(activeProjectId || projs[0].project_id);
        }
      })
      .catch(() => {});
  }, [activeProjectId, selectedProjectId]);

  const nameSuggestions = useMemo(() => {
    const perDomain = NAME_HINTS_BY_DOMAIN[domain] || [];
    const combined = [...perDomain, ...DEFAULT_NAME_HINTS];
    return Array.from(new Set(combined));
  }, [domain]);

  const canSubmit = name.trim().length > 0 && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please specify an ontology name.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.createOntology({
        project_id: selectedProjectId || activeProjectId || "proj-default",
        name: name.trim(),
        domain: domain.trim(),
        version_tag: versionTag.trim() || "1.0.0",
        description: description.trim(),
        entities: [],
        relationships: [],
      });
      router.push(`/ontology?version_id=${res.ontology_version_id || ""}`);
    } catch (err: any) {
      setError(err.message || "Failed to initialize business ontology");
      setLoading(false);
    }
  };

  const handleDomainPick = (v: string) => {
    setDomain(v);
    if (
      !name.trim() ||
      name === "Enterprise Business Model" ||
      DEFAULT_NAME_HINTS.includes(name)
    ) {
      const hints = NAME_HINTS_BY_DOMAIN[v] || DEFAULT_NAME_HINTS;
      setName(hints[0]);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

          {/* ── Back link ─────────────────────────────── */}
          <Link
            href="/ontology"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition"
          >
            <ArrowLeftIcon />
            <span>Ontology Studio</span>
          </Link>

          {/* ── Title row ─────────────────────────────── */}
          <div className="mt-4 mb-8 flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
                New ontology
              </h1>
              <p className="text-xs text-slate-500 mt-1 max-w-lg leading-relaxed">
                Set up an empty semantic model. Add entities and relationships
                manually in the builder, or let the AI Copilot synthesize them.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 shrink-0 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
              <span>Step 1 / 3</span>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs flex items-center gap-2">
              <AlertIcon />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* ═══════════════════════════════════════════
                Card — single white surface
            ═══════════════════════════════════════════ */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">

              {/* Inline preview header — no icon tile, just typography */}
              <div className="px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h2 className="font-semibold text-sm text-slate-900 truncate">
                        {name.trim() || "Untitled Ontology"}
                      </h2>
                      <span className="text-[10px] font-mono text-slate-500">
                        v{versionTag || "1.0.0"}
                      </span>
                    </div>
                    {domain.trim() && (
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {domain}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                      Scope
                    </div>
                    <div className="text-[11px] text-slate-700 max-w-[160px] truncate">
                      {projects.find((p) => p.project_id === selectedProjectId)?.name ||
                        activeProject?.name ||
                        "Global"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form body */}
              <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5 text-xs">
                {/* Project */}
                <div className="md:col-span-2">
                  <Label>Target project</Label>
                  <CustomSelect
                    value={selectedProjectId}
                    onChange={setSelectedProjectId}
                    placeholder="Select target project..."
                    options={
                      projects.length > 0
                        ? projects.map((p) => ({
                            value: p.project_id,
                            label: p.name,
                            description: p.project_id,
                          }))
                        : [{ value: "proj-default", label: "Default Enterprise Project" }]
                    }
                  />
                </div>

                {/* Name */}
                <div className="md:col-span-2">
                  <Label required>Name</Label>
                  <SuggestionCombobox
                    value={name}
                    onChange={setName}
                    options={nameSuggestions}
                    placeholder="e.g. Omnichannel Commerce Graph"
                    allowCustom
                    customHint="Use custom name"
                  />
                </div>

                {/* Domain */}
                <div className="md:col-span-2">
                  <Label>Domain</Label>
                  <SuggestionCombobox
                    value={domain}
                    onChange={handleDomainPick}
                    options={DOMAIN_SUGGESTIONS}
                    placeholder="Search or type a domain..."
                    allowCustom
                    customHint="Use custom domain"
                  />
                </div>

                {/* Version */}
                <div>
                  <Label required>Version</Label>
                  <SuggestionCombobox
                    value={versionTag}
                    onChange={setVersionTag}
                    options={VERSION_SUGGESTIONS}
                    placeholder="1.0.0"
                    allowCustom
                    customHint="Use custom version"
                    mono
                    compact
                  />
                </div>

                {/* Status */}
                <div>
                  <Label>Status</Label>
                  <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-[11px] h-[34px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Draft · editable after creation
                  </div>
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <Label>Description</Label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Functional scope, business rules, downstream dependencies..."
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>

              {/* Action bar */}
              <div className="border-t border-slate-100 px-5 sm:px-6 py-3 bg-slate-50/50 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 min-w-0">
                  <PlusIcon />
                  <span className="truncate">
                    Creates an empty ontology and opens the Visual Builder.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href="/ontology"
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <SpinnerIcon /> : <ArrowRightIcon />}
                    <span>{loading ? "Creating..." : "Create ontology"}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>

          <p className="mt-6 text-[10px] text-slate-400 text-center">
            Ontologies are versioned. You can branch a new version later without
            affecting running migrations.
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}

// ─────────────────────────────────────────────────────────────
// SuggestionCombobox — searchable dropdown with custom entry
// No icons on the trigger; only a chevron. Search icon inside the panel.
// ─────────────────────────────────────────────────────────────
function SuggestionCombobox({
  value,
  onChange,
  options,
  placeholder,
  allowCustom,
  customHint,
  mono,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  allowCustom?: boolean;
  customHint?: string;
  mono?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (activeIdx !== 0) setActiveIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    const scored: Array<{ item: string; score: number }> = [];
    for (const item of options) {
      const t = item.toLowerCase();
      let score = -1;
      if (t === q) score = 1000;
      else if (t.startsWith(q)) score = 500;
      else if (t.includes(q)) score = 200;
      if (score >= 0) scored.push({ item, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.item);
  }, [options, query]);

  const showCustomOption =
    allowCustom &&
    query.trim().length > 0 &&
    !options.some((o) => o.toLowerCase() === query.trim().toLowerCase());

  const openDropdown = () => {
    setQuery("");
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const commit = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) =>
        Math.min(filtered.length - 1 + (showCustomOption ? 1 : 0), i + 1)
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showCustomOption && activeIdx === filtered.length) {
        commit(query.trim());
      } else if (filtered[activeIdx]) {
        commit(filtered[activeIdx]);
      } else if (allowCustom && query.trim()) {
        commit(query.trim());
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger — value + chevron only, no decorative icons */}
      <button
        type="button"
        onClick={openDropdown}
        className={`w-full ${compact ? "h-[34px]" : "h-[36px]"} px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 text-left flex items-center justify-between gap-2 hover:border-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition ${
          mono ? "font-mono" : ""
        }`}
      >
        <span className={`truncate ${!value ? "text-slate-400" : ""}`}>
          {value || placeholder}
        </span>
        <ChevronDownIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-40 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-72">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
            <SearchIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || "Search..."}
              className="flex-1 text-xs bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-slate-400 hover:text-slate-700 text-[10px] font-medium"
                type="button"
              >
                Clear
              </button>
            )}
          </div>

          <div className="overflow-y-auto">
            {filtered.length === 0 && !showCustomOption ? (
              <div className="p-3 text-center text-[11px] text-slate-400">
                No matches
              </div>
            ) : (
              <>
                {filtered.map((item, i) => {
                  const active = i === activeIdx;
                  const isSelected = item === value;
                  return (
                    <button
                      key={item}
                      type="button"
                      onMouseEnter={() => setActiveIdx(i)}
                      onClick={() => commit(item)}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2 text-[12px] ${
                        active ? "bg-slate-100" : "hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex-1 min-w-0 truncate">{item}</span>
                      {isSelected && (
                        <CheckIcon className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                      )}
                    </button>
                  );
                })}
                {showCustomOption && (
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIdx(filtered.length)}
                    onClick={() => commit(query.trim())}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 text-[12px] border-t border-slate-100 ${
                      activeIdx === filtered.length
                        ? "bg-slate-100"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <PlusIcon className="w-3 h-3 text-slate-600 shrink-0" />
                    <span className="flex-1 min-w-0 truncate">
                      {customHint || "Use"}{" "}
                      <span className="font-semibold">"{query.trim()}"</span>
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Misc
// ─────────────────────────────────────────────────────────────
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="font-medium text-slate-700 text-[11px] block mb-1.5">
      {children}
      {required && <span className="text-slate-400 ml-0.5">*</span>}
    </label>
  );
}

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition";