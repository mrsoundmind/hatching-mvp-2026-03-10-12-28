import type { ReactNode } from "react";

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

/**
 * Standalone-page chrome for the /legal/privacy and /legal/terms deep-link
 * routes. NOT used by LegalModal — modal supplies its own DialogContent chrome.
 *
 * Light-mode by default (bg-white text-slate-900) so legal pages render the
 * same regardless of the user's theme preference — per CONTEXT.md D-02.
 */
export default function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header bar with brand mark + back-to-home link */}
      <header className="border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <a
            href="/"
            className="text-xl font-semibold tracking-tight text-slate-900 hover:text-slate-700 transition-colors"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Hatchin<span className="text-indigo-500">.</span>
          </a>
          <a
            href="/"
            className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            ← Back to home
          </a>
        </div>
      </header>

      {/* DRAFT banner — prominent, not collapsible (per D-04) */}
      <div className="max-w-3xl mx-auto px-6 pt-6">
        <div
          role="note"
          className="rounded-md bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 text-sm"
        >
          <strong className="font-semibold">DRAFT — for legal review.</strong>{" "}
          Final copy under attorney review.
        </div>
      </div>

      {/* Title + content */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Last updated: {lastUpdated}
        </p>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
