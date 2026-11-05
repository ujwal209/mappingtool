"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Plus,
  Trash2,
  PanelRightClose,
  History,
  Archive,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Layers,
  FileText,
  Check,
  X,
  MessageSquare,
} from "lucide-react";
import { FormattedMarkdown } from "@/components/FormattedMarkdown";
import { OntologyState } from "./useOntologyState";

export function CopilotPanel({ s }: { s: OntologyState }) {
  const [sessionOpen, setSessionOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const activeSessions = s.sessions.filter((x) => !x.is_archived);
  const archivedSessions = s.sessions.filter((x) => x.is_archived);
  const visibleSessions = showArchived ? archivedSessions : activeSessions;

  const handleDeleteCurrent = () => {
    if (s.sessions.length <= 1) {
      // Deleting the last session — reset instead
      s.handleDeleteSession(s.currentSessionId);
    } else {
      s.handleDeleteSession(s.currentSessionId);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/20 z-30"
        onClick={() => {
          s.setIsAgentOpen(false);
          setSessionOpen(false);
        }}
      />

      <aside className="fixed top-3 right-3 bottom-3 z-40 w-[520px] xl:w-[600px] max-w-[96vw] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* ─────────────────────────────────────────────────────
            Header
        ───────────────────────────────────────────────────── */}
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Image
              src="/logo.png"
              alt="Logo"
              width={110}
              height={28}
              className="h-6 w-auto object-contain"
            />
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono shrink-0">
              Copilot
            </span>
            {s.sessions.length > 1 && (
              <span className="text-[10px] text-slate-400 font-mono truncate">
                {activeSessions.length} chats
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={s.handleNewChat}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11.5px] font-semibold hover:bg-slate-50 transition"
              title="New Chat"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>

            {/* Sessions dropdown toggle */}
            <div className="relative">
              <button
                onClick={() => setSessionOpen((v) => !v)}
                className={`p-1.5 rounded-lg transition ${
                  sessionOpen
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                }`}
                title="Chat History"
              >
                <History className="w-4 h-4" />
              </button>

              {/* Sessions dropdown */}
              {sessionOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setSessionOpen(false)}
                  />
                  <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-2">
                    {/* Tabs */}
                    <div className="flex items-center gap-1 p-0.5 mb-2 rounded-lg bg-slate-100 border border-slate-200">
                      <button
                        onClick={() => setShowArchived(false)}
                        className={`flex-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition ${
                          !showArchived
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Active ({activeSessions.length})
                      </button>
                      <button
                        onClick={() => setShowArchived(true)}
                        className={`flex-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition flex items-center justify-center gap-1 ${
                          showArchived
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <Archive className="w-3 h-3" />
                        Archived ({archivedSessions.length})
                      </button>
                    </div>

                    {/* Session list */}
                    <div className="max-h-72 overflow-y-auto space-y-1">
                      {visibleSessions.length === 0 ? (
                        <div className="p-4 text-center text-[11px] text-slate-400">
                          {showArchived
                            ? "No archived conversations."
                            : "No active conversations. Start a new chat."}
                        </div>
                      ) : (
                        visibleSessions
                          .sort((a, b) => b.updated_at - a.updated_at)
                          .map((session) => {
                            const isCurrent = session.id === s.currentSessionId;
                            return (
                              <div
                                key={session.id}
                                className={`group flex items-center gap-1 rounded-lg transition ${
                                  isCurrent
                                    ? "bg-slate-100 border border-slate-200"
                                    : "hover:bg-slate-50"
                                }`}
                              >
                                <button
                                  onClick={() => {
                                    s.handleSelectSession(session.id);
                                    setSessionOpen(false);
                                  }}
                                  className="flex-1 text-left px-2.5 py-2 min-w-0"
                                >
                                  <div className="flex items-center gap-1.5">
                                    {isCurrent && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-900 shrink-0" />
                                    )}
                                    <span
                                      className={`truncate text-[11.5px] ${
                                        isCurrent
                                          ? "font-semibold text-slate-900"
                                          : "font-medium text-slate-700"
                                      }`}
                                    >
                                      {session.title || "Untitled Chat"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                                    <MessageSquare className="w-2.5 h-2.5" />
                                    <span>{session.messages.length} msgs</span>
                                    <span>·</span>
                                    <span>
                                      {new Date(session.updated_at).toLocaleDateString([], {
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </span>
                                  </div>
                                </button>

                                <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      s.handleArchiveSession(session.id);
                                    }}
                                    className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                    title={
                                      session.is_archived
                                        ? "Unarchive"
                                        : "Archive"
                                    }
                                  >
                                    <Archive className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      s.handleDeleteSession(session.id);
                                    }}
                                    className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Delete current chat */}
            <button
              onClick={handleDeleteCurrent}
              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
              title="Delete Current Chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* Close panel */}
            <button
              onClick={() => s.setIsAgentOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              title="Close Copilot"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────
            Context Strip
        ───────────────────────────────────────────────────── */}
        <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 text-[11px] shrink-0 min-w-0">
          <div className="flex items-center gap-2 text-slate-600 min-w-0">
            <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-medium text-slate-800 truncate">
              {s.selectedOntology?.name || "No ontology selected"}
            </span>
            {s.selectedOntology && (
              <>
                <span className="text-slate-400 shrink-0">·</span>
                <span className="text-slate-500 shrink-0">
                  {s.selectedOntology.entities?.length || 0} entities
                </span>
                <span className="text-slate-400 shrink-0">·</span>
                <span className="text-slate-500 shrink-0">
                  {s.selectedOntology.relationships?.length || 0} relationships
                </span>
              </>
            )}
          </div>
          {s.activeSession && (
            <span className="text-[10px] text-slate-400 font-mono truncate shrink-0">
              {s.activeSession.messages.length} msgs
            </span>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────
            Messages
        ───────────────────────────────────────────────────── */}
        <div
          ref={s.chatScrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 text-xs bg-slate-50/40"
        >
          {!s.activeSession?.messages || s.activeSession.messages.length === 0 ? (
            <EmptyState onPrompt={(p) => s.handleSendMessage(p)} />
          ) : (
            s.activeSession.messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} s={s} />
            ))
          )}

          {s.agentRunning && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-white border border-slate-200 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
              <span className="text-slate-700">Synthesizing...</span>
            </div>
          )}

          {s.agentError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-[11.5px] flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{s.agentError}</span>
            </div>
          )}

          {s.agentSuccessMsg && !s.agentRunning && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11.5px] flex gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{s.agentSuccessMsg}</span>
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────
            Input
        ───────────────────────────────────────────────────── */}
        <div className="p-3.5 border-t border-slate-200 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-slate-700">
              Execution Mode
            </span>
            <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200 text-xs">
              <button
                onClick={() => s.setExecutionMode("action")}
                className={`px-3 py-1 rounded-md font-semibold transition ${
                  s.executionMode === "action"
                    ? "bg-slate-900 text-white shadow"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Action mode — applies changes immediately"
              >
                Action
              </button>
              <button
                onClick={() => s.setExecutionMode("plan")}
                className={`px-3 py-1 rounded-md font-semibold transition ${
                  s.executionMode === "plan"
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Plan mode — you review before applying"
              >
                Plan
              </button>
            </div>
          </div>

          <div className="relative rounded-xl border border-slate-300 focus-within:border-slate-900 bg-white">
            <textarea
              rows={3}
              value={s.agentPrompt}
              onChange={(e) => s.setAgentPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  s.handleSendMessage();
                }
              }}
              placeholder={
                s.executionMode === "plan"
                  ? "Describe changes. Copilot drafts a blueprint you approve before applying."
                  : "Prompt the AI to synthesize or edit your ontology directly..."
              }
              className="w-full text-[12.5px] p-3 pr-12 rounded-xl focus:outline-none resize-none bg-transparent text-slate-900"
              disabled={s.agentRunning}
            />
            <button
              disabled={s.agentRunning || !s.agentPrompt.trim()}
              onClick={() => s.handleSendMessage()}
              className="absolute right-2.5 bottom-2.5 p-2 rounded-lg bg-slate-900 text-white disabled:opacity-40 hover:bg-slate-800 transition"
              title="Send (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ============================================================
// Empty State
// ============================================================
function EmptyState({ onPrompt }: { onPrompt: (p: string) => void }) {
  const presets = [
    {
      title: "Omnichannel Retail",
      desc: "Customer, Order, Product, Inventory.",
      prompt:
        "Synthesize an Omnichannel Retail ontology with Customer, Order, OrderItem, Product, Inventory, and Payment tracking.",
    },
    {
      title: "Core Banking",
      desc: "Customer, Account, Transaction, Branch.",
      prompt:
        "Synthesize a Core Banking ledger ontology with Customer, Account, Transaction, LedgerEntry, and Branch.",
    },
    {
      title: "Healthcare Claims",
      desc: "Patient, Encounter, Provider, Claim.",
      prompt:
        "Synthesize a Healthcare Claims ontology with Patient, Encounter, Provider, DiagnosisCode, and InsuranceClaim.",
    },
    {
      title: "Supply Chain",
      desc: "Supplier, Warehouse, PurchaseOrder.",
      prompt:
        "Synthesize a Global Supply Chain ontology with Supplier, Warehouse, PurchaseOrder, InventoryStock, and FreightConsignment.",
    },
  ];

  return (
    <div className="py-6 space-y-5 text-center">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
        <Image
          src="/logo.png"
          alt="Logo"
          width={36}
          height={36}
          className="w-8 h-8 object-contain"
        />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-slate-900">Architecture Copilot</h3>
        <p className="text-[12px] text-slate-500 max-w-sm mx-auto">
          Synthesize a business ontology, extend the model, or ask what's on the canvas.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left max-w-md mx-auto">
        {presets.map((p) => (
          <button
            key={p.title}
            onClick={() => onPrompt(p.prompt)}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition text-left"
          >
            <span className="font-semibold text-[11.5px] text-slate-900 block">
              {p.title}
            </span>
            <span className="text-[10.5px] text-slate-500 block mt-0.5 leading-snug">
              {p.desc}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Message Bubble
// ============================================================
function MessageBubble({ msg, s }: { msg: any; s: OntologyState }) {
  const isUser = msg.role === "user";
  const showPlanApproval =
    !isUser && msg.is_plan && msg.plan_data && !msg.plan_applied;
  const planAlreadyApplied = !isUser && msg.is_plan && msg.plan_applied;

  const hasOps = msg.plan_data?.operations && msg.plan_data.operations.length > 0;
  const hasEntities = msg.plan_data?.entities && msg.plan_data.entities.length > 0;
  const hasRels =
    msg.plan_data?.relationships && msg.plan_data.relationships.length > 0;

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div className="flex items-center gap-2 mb-1.5 px-1">
        <span className="text-[10.5px] font-semibold text-slate-500">
          {isUser ? "You" : "Copilot"}
        </span>
        <span className="text-[9.5px] text-slate-400">
          {new Date(msg.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <div
        className={`p-3.5 rounded-2xl max-w-[94%] ${
          isUser
            ? "bg-slate-900 text-white rounded-tr-sm"
            : "bg-white border border-slate-200 rounded-tl-sm shadow-sm"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed">
            {msg.content}
          </p>
        ) : (
          <FormattedMarkdown content={msg.markdown || msg.content} />
        )}

        {/* Plan approval card */}
        {showPlanApproval && (
          <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/60 overflow-hidden">
            <div className="px-3 py-2 border-b border-blue-100 bg-blue-100/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider truncate">
                  Blueprint Ready
                </span>
              </div>
              <span className="text-[9.5px] font-mono text-blue-700 bg-white/60 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                Awaiting Approval
              </span>
            </div>

            <div className="p-3 space-y-3">
              {/* Operations */}
              {hasOps && (
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Operations ({msg.plan_data.operations.length})
                  </span>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {msg.plan_data.operations.map((op: any, i: number) => {
                      const opLabel =
                        op.op === "DELETE_ENTITY"
                          ? "Delete"
                          : op.op === "RENAME_ENTITY"
                          ? "Rename"
                          : op.op === "UPDATE_ENTITY"
                          ? "Update"
                          : op.op === "ADD_ATTRIBUTE"
                          ? "Add Attribute"
                          : op.op === "DELETE_ATTRIBUTE"
                          ? "Remove Attribute"
                          : op.op === "DELETE_RELATIONSHIP"
                          ? "Remove Relationship"
                          : op.op === "CREATE_ENTITY"
                          ? "Create"
                          : op.op;
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-2 py-1 rounded bg-white border border-blue-100 text-[10.5px]"
                        >
                          <span className="font-mono font-semibold text-slate-900 shrink-0">
                            {opLabel}
                          </span>
                          <span className="text-slate-600 truncate">
                            {op.entity_name}
                            {op.new_name && ` → ${op.new_name}`}
                            {op.attribute_spec && ` (${op.attribute_spec.name})`}
                            {op.attribute_name && ` (${op.attribute_name})`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Counts */}
              {(hasEntities || hasRels) && (
                <div className="grid grid-cols-2 gap-2">
                  {hasEntities && (
                    <div className="bg-white border border-blue-100 rounded-lg p-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">
                        New Entities
                      </span>
                      <span className="text-base font-bold text-slate-900 block">
                        {msg.plan_data.entities.length}
                      </span>
                    </div>
                  )}
                  {hasRels && (
                    <div className="bg-white border border-blue-100 rounded-lg p-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">
                        Relationships
                      </span>
                      <span className="text-base font-bold text-slate-900 block">
                        {msg.plan_data.relationships.length}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Approve button */}
              <button
                onClick={() => s.handleApplyPlan(msg)}
                disabled={s.applyingPlanId === msg.id}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11.5px] font-bold shadow-sm disabled:opacity-50 transition"
              >
                {s.applyingPlanId === msg.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Applying...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve & Apply to Graph</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Already applied badge */}
        {planAlreadyApplied && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10.5px] font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            Applied to Graph
          </div>
        )}

        {/* Reasoning steps (collapsible) */}
        {!isUser && msg.reasoning_steps?.length > 0 && (
          <details className="mt-3 pt-2.5 border-t border-slate-100 text-[11px]">
            <summary className="cursor-pointer font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 select-none">
              <Layers className="w-3 h-3" />
              Reasoning Trail ({msg.reasoning_steps.length} stages)
            </summary>
            <div className="space-y-1.5 mt-2 pl-2 border-l-2 border-slate-200">
              {msg.reasoning_steps.map((step: any, i: number) => (
                <div key={i} className="bg-slate-50 p-2 rounded text-[10.5px]">
                  <span className="font-semibold text-slate-800 block">
                    {step.stage}
                  </span>
                  <span className="text-slate-600 block mt-0.5 leading-relaxed">
                    {step.summary}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}