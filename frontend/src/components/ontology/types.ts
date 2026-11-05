export interface NodePosition {
  x: number;
  y: number;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  markdown?: string;
  timestamp: number;
  reasoning_steps?: Array<{ stage: string; summary: string }>;
  model?: string;
  is_plan?: boolean;
  plan_data?: any;
  plan_applied?: boolean;
}

export interface AgentSession {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  messages: AgentMessage[];
  model: string;
  is_archived?: boolean;
}

export const DEFAULT_MODEL = "openai/gpt-oss-120b";

export const AVAILABLE_MODELS = [
  { value: "openai/gpt-oss-120b", label: "GPT-OSS 120B (Enterprise)", badge: "Primary Architect", desc: "Flagship relational architecture, constraints & keys" },
  { value: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B (Schema Coder)", badge: "Precision Modeler", desc: "Strict ontological relationships, datatypes & indexing" },
  { value: "openai/gpt-oss-20b", label: "GPT-OSS 20B (Agile)", badge: "Low Latency", desc: "Fast incremental entity and relationship edits" },
  { value: "allam-2-7b", label: "Allam 2 7B (Lightweight)", badge: "Compact", desc: "Lightweight domain modeling and categorization" },
];

export const CATEGORY_STYLES: Record<
  string,
  { border: string; headerBg: string; headerText: string; badgeBg: string; badgeText: string; accentDot: string }
> = {
  "Master Data":   { border: "border-blue-300 hover:border-blue-500",       headerBg: "bg-blue-50/90 border-blue-200",       headerText: "text-blue-950",    badgeBg: "bg-blue-100",    badgeText: "text-blue-800",    accentDot: "bg-blue-500" },
  Transactional:   { border: "border-purple-300 hover:border-purple-500",   headerBg: "bg-purple-50/90 border-purple-200",   headerText: "text-purple-950",  badgeBg: "bg-purple-100",  badgeText: "text-purple-800",  accentDot: "bg-purple-500" },
  Reference:       { border: "border-emerald-300 hover:border-emerald-500", headerBg: "bg-emerald-50/90 border-emerald-200", headerText: "text-emerald-950", badgeBg: "bg-emerald-100", badgeText: "text-emerald-800", accentDot: "bg-emerald-500" },
  Associative:     { border: "border-amber-300 hover:border-amber-500",     headerBg: "bg-amber-50/90 border-amber-200",     headerText: "text-amber-950",   badgeBg: "bg-amber-100",   badgeText: "text-amber-800",   accentDot: "bg-amber-500" },
  Operational:     { border: "border-slate-300 hover:border-slate-500",     headerBg: "bg-slate-100 border-slate-200",       headerText: "text-slate-900",   badgeBg: "bg-slate-200",   badgeText: "text-slate-800",   accentDot: "bg-slate-500" },
};

export const getCategoryStyle = (category?: string) =>
  CATEGORY_STYLES[category || "Master Data"] || CATEGORY_STYLES["Master Data"];