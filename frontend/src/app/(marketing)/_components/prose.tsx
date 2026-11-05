import React from "react";

export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl space-y-6 text-[14px] text-slate-700 leading-[1.75]">
      {children}
    </div>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-slate-900 pt-6 first:pt-0">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[15px] font-semibold text-slate-900 pt-4">
      {children}
    </h3>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] text-slate-700 leading-[1.75]">{children}</p>;
}

export function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[14px] text-slate-700 leading-[1.7]">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-[9px] shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[12.5px] font-mono text-slate-800">
      {children}
    </code>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "success";
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-slate-50 border-slate-200 text-slate-800",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  }[tone];
  return (
    <div className={`my-6 rounded-xl border p-4 ${styles}`}>
      <p className="text-[12px] font-semibold uppercase tracking-wider mb-1.5">
        {title}
      </p>
      <div className="text-[13px] leading-relaxed">{children}</div>
    </div>
  );
}