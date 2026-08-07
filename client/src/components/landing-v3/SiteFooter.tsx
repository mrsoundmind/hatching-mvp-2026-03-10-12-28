// Landing v3 — the footer.
//
// Wraps the Ruixen gradient footer with Hatchin's content. The glow is pinned
// to the viewport floor and rises over the last screenful of scroll, so the
// page ends on the brand colours rather than just stopping.
//
// Every link goes somewhere that exists. No Careers, Blog or Press columns:
// those pages are not built, and a dead column is worse than a short one.

import { useState } from "react";
import { Link } from "wouter";

import LegalModal from "@/components/legal/LegalModal";
import { RuixenGradientFooter } from "@/components/ui/ruixen-gradient-footer";
import Wordmark from "./Wordmark";

// The glow now rises out of a WHITE floor rather than the dark page base, so
// the first stop is the footer's own background instead of #0A0C13. The rest of
// the ramp is unchanged.
const WHITE_FLOOR_STOPS = [
  { offset: 0, color: "#FFFFFF" },
  { offset: 0.1827, color: "#8FA0FF" },
  { offset: 0.2837, color: "#6C82FF" },
  { offset: 0.4135, color: "#E4E9FE" },
  { offset: 0.5866, color: "#F2B441" },
  { offset: 0.6827, color: "#E8734A" },
  { offset: 0.8029, color: "#9F7BFF" },
  { offset: 1, color: "#C0B5FD00" },
];

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Real jobs", href: "#jobs" },
      { label: "Two answers", href: "#knowledge" },
      { label: "Inside a project", href: "#inside" },
    ],
  },
  {
    title: "Get started",
    links: [
      { label: "Pricing", href: "#start" },
      { label: "Sign in", href: "/login" },
      { label: "Start free", href: "/login" },
    ],
  },
];

export function SiteFooter() {
  const [legal, setLegal] = useState<{ open: boolean; type: "privacy" | "terms" }>({
    open: false,
    type: "privacy",
  });

  return (
    <>
      {/* minReveal 0 keeps the glow completely off a white editorial page until
          the closing band, instead of leaving a strip of colour on screen for
          the whole scroll. */}
      <RuixenGradientFooter
        gradientHeight="46vh"
        minReveal={0}
        stops={WHITE_FLOOR_STOPS}
        className="lv3-bg-paper lv3-t-ink relative z-20 border-t"
      >
        <div className="mx-auto w-full max-w-6xl px-5 pt-16 sm:px-8">
          <div className="grid gap-10 pb-10 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-3">
              <Link href="/" className="inline-flex">
                <Wordmark tone="dark" />
              </Link>
              <p className="lv3-t-soft mt-4 max-w-xs text-sm leading-relaxed">
                AI colleagues who plan, push back, and ship.
              </p>
            </div>

            <nav className="grid grid-cols-2 gap-10 lg:col-span-3">
              {COLUMNS.map((col) => (
                <div key={col.title}>
                  <h3 className="lv3-label lv3-t-navy">{col.title}</h3>
                  <ul className="mt-4 flex flex-col gap-3">
                    {col.links.map((l) => (
                      <li key={l.label}>
                        {l.href.startsWith("/") ? (
                          <Link
                            href={l.href}
                            className="lv3-t-soft text-sm transition-colors hover:text-[#14182f]"
                          >
                            {l.label}
                          </Link>
                        ) : (
                          <a
                            href={l.href}
                            className="lv3-t-soft text-sm transition-colors hover:text-[#14182f]"
                          >
                            {l.label}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          <div className="lv3-label lv3-t-soft-55 flex flex-col items-center justify-between gap-3 border-t pb-4 pt-6 sm:flex-row">
            <span>Free to start</span>
            <span className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setLegal({ open: true, type: "privacy" })}
                className="uppercase tracking-[0.14em] transition-colors hover:text-[#14182f]"
              >
                Privacy
              </button>
              <button
                type="button"
                onClick={() => setLegal({ open: true, type: "terms" })}
                className="uppercase tracking-[0.14em] transition-colors hover:text-[#14182f]"
              >
                Terms
              </button>
              <a
                href="mailto:hello@hatchin.ai"
                className="uppercase tracking-[0.14em] transition-colors hover:text-[#14182f]"
              >
                Contact
              </a>
            </span>
          </div>
        </div>
      </RuixenGradientFooter>

      <LegalModal
        open={legal.open}
        onOpenChange={(open) => setLegal((p) => ({ ...p, open }))}
        type={legal.type}
      />
    </>
  );
}

export default SiteFooter;
