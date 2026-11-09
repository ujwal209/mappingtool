import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";

export default function Page() {
  return (
    <main className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16">
      <Link
        href="/docs"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </Link>
      <div className="rounded-xl border border-zinc-200 bg-white p-8">
        <div className="inline-flex p-2.5 rounded-lg bg-zinc-100 text-zinc-700 mb-4">
          <BookOpen className="w-5 h-5" />
        </div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-2">
          Docs
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em] text-zinc-900 mb-3">
          Auto Suggest
        </h1>
        <p className="text-[14px] text-zinc-600 leading-relaxed max-w-xl">
          Documentation and guides for Auto Suggest are currently being published.
        </p>
      </div>
    </main>
  );
}
