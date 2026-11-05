import React from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "text-center max-w-2xl mx-auto" : "max-w-2xl"}>
      <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-slate-400 mb-3">
        {eyebrow}
      </p>
      <h1 className="text-[36px] sm:text-[48px] font-semibold tracking-[-0.025em] leading-[1.05] text-slate-900">
        {title}
      </h1>
      {description && (
        <p className="mt-4 text-[15px] sm:text-[16px] text-slate-600 leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-slate-400 mb-3">
      {children}
    </p>
  );
}