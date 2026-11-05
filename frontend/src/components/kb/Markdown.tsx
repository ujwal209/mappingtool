"use client";

import React from "react";

/* ------------------------------------------------------------------
 * Markdown → React, safe and dependency-free.
 *
 * Supported block types:
 *   - ATX headings (#..######)
 *   - Fenced code blocks (```lang)
 *   - Blockquotes (>)
 *   - Horizontal rules (---, ***, ___)
 *   - Unordered lists (-, *, +)
 *   - Ordered lists (1.)
 *   - GFM tables (| a | b | with |---|---| separator)
 *   - Paragraphs
 *
 * Supported inline:
 *   - `inline code`
 *   - **bold**
 *   - *italic*
 *   - [text](url)
 *   - <br> / <br/> (passes through as a hard line break)
 *
 * Raw HTML is NEVER injected. Only <br> is honored.
 * ------------------------------------------------------------------ */

type TableAlignment = "left" | "center" | "right" | null;

type Token =
  | { type: "hr" }
  | { type: "code"; lang: string; content: string }
  | { type: "h"; level: 1 | 2 | 3 | 4 | 5 | 6; content: string }
  | { type: "quote"; content: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | {
      type: "table";
      headers: string[];
      aligns: TableAlignment[];
      rows: string[][];
    }
  | { type: "p"; content: string };

// ─────────────────────────────────────────────────────────────
// Block tokenizer
// ─────────────────────────────────────────────────────────────
function tokenize(md: string): Token[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: Token[] = [];
  let i = 0;

  const isTableSeparator = (line: string) =>
    /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(line);

  const isTableRow = (line: string) =>
    /\|/.test(line) && line.trim().length > 0;

  const splitRow = (line: string): string[] => {
    let s = line.trim();
    if (s.startsWith("|")) s = s.slice(1);
    if (s.endsWith("|")) s = s.slice(0, -1);
    // Split on unescaped pipes
    const cells: string[] = [];
    let buf = "";
    for (let k = 0; k < s.length; k++) {
      const ch = s[k];
      if (ch === "\\" && s[k + 1] === "|") {
        buf += "|";
        k++;
      } else if (ch === "|") {
        cells.push(buf.trim());
        buf = "";
      } else {
        buf += ch;
      }
    }
    cells.push(buf.trim());
    return cells;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1] || "";
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      out.push({ type: "code", lang, content: buf.join("\n") });
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push({ type: "hr" });
      i++;
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      out.push({
        type: "h",
        level: h[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        content: h[2].trim(),
      });
      i++;
      continue;
    }

    // Table — needs header line, separator line, then rows
    if (
      isTableRow(line) &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const headers = splitRow(line);
      const separatorCells = splitRow(lines[i + 1]);
      const aligns: TableAlignment[] = separatorCells.map((c) => {
        const left = c.startsWith(":");
        const right = c.endsWith(":");
        if (left && right) return "center";
        if (right) return "right";
        if (left) return "left";
        return null;
      });
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push({ type: "table", headers, aligns, rows });
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push({ type: "quote", content: buf.join(" ") });
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      out.push({ type: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push({ type: "ol", items });
      continue;
    }

    // Blank
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph — gather until a special block starts
    const buf: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      if (
        l.trim() === "" ||
        /^```/.test(l) ||
        /^#{1,6}\s+/.test(l) ||
        /^\s*>\s?/.test(l) ||
        /^\s*[-*+]\s+/.test(l) ||
        /^\s*\d+\.\s+/.test(l) ||
        /^(-{3,}|\*{3,}|_{3,})\s*$/.test(l) ||
        (isTableRow(l) &&
          i + 1 < lines.length &&
          isTableSeparator(lines[i + 1]))
      ) {
        break;
      }
      buf.push(l);
      i++;
    }
    out.push({ type: "p", content: buf.join(" ") });
  }

  return out;
}

// ─────────────────────────────────────────────────────────────
// Inline renderer
// ─────────────────────────────────────────────────────────────
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Order matters — code first, then bold, then italic, then link, then <br>
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))|(<br\s*\/?>)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${k++}`;

    if (tok.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="px-1.5 py-[1px] rounded-md bg-slate-100 text-[11px] font-mono text-slate-800"
        >
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-slate-900">
          {tok.slice(2, -2)}
        </strong>
      );
    } else if (tok.startsWith("*")) {
      nodes.push(
        <em key={key} className="italic">
          {tok.slice(1, -1)}
        </em>
      );
    } else if (tok.startsWith("[")) {
      const mm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (mm) {
        nodes.push(
          <a
            key={key}
            href={mm[2]}
            target="_blank"
            rel="noreferrer noopener"
            className="text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-900"
          >
            {mm[1]}
          </a>
        );
      } else {
        nodes.push(tok);
      }
    } else if (/^<br\s*\/?>$/i.test(tok)) {
      nodes.push(<br key={key} />);
    }

    last = pattern.lastIndex;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// ─────────────────────────────────────────────────────────────
// Table renderer
// ─────────────────────────────────────────────────────────────
function renderTable(
  headers: string[],
  aligns: TableAlignment[],
  rows: string[][],
  key: string
) {
  const alignClass = (idx: number) => {
    switch (aligns[idx]) {
      case "center":
        return "text-center";
      case "right":
        return "text-right";
      default:
        return "text-left";
    }
  };

  return (
    <div
      key={key}
      className="my-3 overflow-x-auto rounded-lg border border-slate-200"
    >
      <table className="w-full border-collapse text-[12px]">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((h, i) => (
              <th
                key={`${key}-th-${i}`}
                className={`px-3 py-2 font-semibold text-slate-900 border-b border-slate-200 whitespace-nowrap ${alignClass(
                  i
                )}`}
              >
                {renderInline(h, `${key}-th-${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={`${key}-tr-${ri}`}
              className="odd:bg-white even:bg-slate-50/50"
            >
              {headers.map((_, ci) => (
                <td
                  key={`${key}-td-${ri}-${ci}`}
                  className={`px-3 py-2 align-top text-slate-700 border-b border-slate-100 leading-[1.5] ${alignClass(
                    ci
                  )}`}
                >
                  {renderInline(row[ci] ?? "", `${key}-td-${ri}-${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────
export function Markdown({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  if (!content) return null;
  const tokens = tokenize(content);

  return (
    <div
      className={`text-[13px] leading-[1.65] text-slate-700 ${className}`}
      style={{ letterSpacing: "-0.003em" }}
    >
      {tokens.map((tok, idx) => {
        const key = `t-${idx}`;
        switch (tok.type) {
          case "hr":
            return <hr key={key} className="border-slate-200 my-4" />;

          case "h": {
            const Tag = (`h${tok.level}` as unknown) as keyof JSX.IntrinsicElements;
            const cls =
              tok.level === 1
                ? "text-[16px] font-semibold text-slate-900 mt-5 mb-2"
                : tok.level === 2
                ? "text-[14.5px] font-semibold text-slate-900 mt-5 mb-2"
                : tok.level === 3
                ? "text-[13px] font-semibold text-slate-900 mt-4 mb-1.5"
                : "text-[12.5px] font-semibold text-slate-900 mt-4 mb-1.5";
            return (
              <Tag key={key} className={`${cls} first:mt-0`}>
                {renderInline(tok.content, key)}
              </Tag>
            );
          }

          case "code":
            return (
              <pre
                key={key}
                className="my-3 bg-slate-950 text-slate-100 rounded-lg p-3.5 text-[11.5px] leading-[1.6] font-mono overflow-x-auto"
              >
                <code>{tok.content}</code>
              </pre>
            );

          case "quote":
            return (
              <blockquote
                key={key}
                className="my-3 border-l-2 border-slate-300 pl-3 text-slate-600 italic"
              >
                {renderInline(tok.content, key)}
              </blockquote>
            );

          case "ul":
            return (
              <ul key={key} className="my-2 list-disc pl-5 space-y-1">
                {tok.items.map((it, i) => (
                  <li key={`${key}-${i}`}>
                    {renderInline(it, `${key}-${i}`)}
                  </li>
                ))}
              </ul>
            );

          case "ol":
            return (
              <ol key={key} className="my-2 list-decimal pl-5 space-y-1">
                {tok.items.map((it, i) => (
                  <li key={`${key}-${i}`}>
                    {renderInline(it, `${key}-${i}`)}
                  </li>
                ))}
              </ol>
            );

          case "table":
            return renderTable(tok.headers, tok.aligns, tok.rows, key);

          case "p":
            return (
              <p key={key} className="my-2 first:mt-0 last:mb-0">
                {renderInline(tok.content, key)}
              </p>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}