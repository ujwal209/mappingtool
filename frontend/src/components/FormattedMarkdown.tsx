"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function FormattedMarkdown({ content }: { content: string }) {
  if (!content) return null;

  return (
    <div className="prose prose-slate prose-sm max-w-none text-[12.5px] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // ── Headings ────────────────────────────────
          h1: ({ children }) => (
            <h1 className="text-[15px] font-bold text-slate-900 mt-3 mb-1.5 first:mt-0 pb-1 border-b border-slate-100">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[14px] font-bold text-slate-900 mt-3 mb-1.5 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[13px] font-semibold text-slate-900 mt-2.5 mb-1 first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-[12.5px] font-semibold text-slate-800 mt-2 mb-1 first:mt-0">
              {children}
            </h4>
          ),

          // ── Paragraphs ──────────────────────────────
          p: ({ children }) => (
            <p className="text-[12.5px] text-slate-700 leading-relaxed mb-2 last:mb-0">
              {children}
            </p>
          ),

          // ── Lists ───────────────────────────────────
          ul: ({ children }) => (
            <ul className="list-disc pl-4 space-y-0.5 mb-2 last:mb-0 text-[12.5px] text-slate-700">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-4 space-y-0.5 mb-2 last:mb-0 text-[12.5px] text-slate-700">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),

          // ── Tables (the big win) ────────────────────
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-[11.5px] border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-50 border-b border-slate-200">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-100">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-50/60">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-2.5 py-1.5 text-left font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-2.5 py-1.5 text-slate-700 align-top">
              {children}
            </td>
          ),

          // ── Code ────────────────────────────────────
          code: ({ className, children, ...props }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code
                  className="block p-2.5 bg-slate-950 text-slate-100 text-[11px] font-mono rounded-lg overflow-x-auto whitespace-pre"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="px-1 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px] border border-slate-200"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-2 rounded-lg overflow-hidden bg-slate-950">
              {children}
            </pre>
          ),

          // ── Blockquote ──────────────────────────────
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-slate-300 pl-3 my-2 text-slate-600 italic text-[12px]">
              {children}
            </blockquote>
          ),

          // ── Horizontal rule ─────────────────────────
          hr: () => <hr className="my-3 border-slate-100" />,

          // ── Links ───────────────────────────────────
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 underline underline-offset-2"
            >
              {children}
            </a>
          ),

          // ── Strong / em ─────────────────────────────
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-600">{children}</em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}