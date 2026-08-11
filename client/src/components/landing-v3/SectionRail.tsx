// Landing v3 — the scroll-synced section rail.
//
// Port of FIMI's ProjectRail. It is not a section: it rides alongside the page,
// pinned to the left on lg+, and the current section lights up beside it as you
// scroll. The active label always shows, the rest reveal on hover, and each
// entry jumps to its section.
//
// It appears only once the hero has scrolled away and hides again when the
// closing band arrives, so it never overlaps the full-bleed dark bands.

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Order + labels mirror the actual scroll order in LandingPageV4's <main>.
const ITEMS = [
  { id: "problem", n: "01", label: "The problem" },
  { id: "overview", n: "02", label: "How it works" },
  { id: "knowledge", n: "03", label: "vs a chatbot" },
  { id: "jobs", n: "04", label: "Real jobs" },
  { id: "how-it-works", n: "05", label: "Overnight" },
  { id: "control", n: "06", label: "In your control" },
  { id: "packs", n: "07", label: "Start from a pack" },
  { id: "proof", n: "08", label: "The work" },
  { id: "start", n: "09", label: "Pricing" },
];

export function SectionRail() {
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const line = window.innerHeight * 0.4;
      let current = 0;
      ITEMS.forEach((it, i) => {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top <= line) current = i;
      });
      setActive(current);

      const first = document.getElementById("problem");
      const heroGone = !!first && first.getBoundingClientRect().top <= window.innerHeight * 0.35;
      const closing = document.getElementById("close");
      const closingReached =
        !!closing && closing.getBoundingClientRect().top <= window.innerHeight * 0.9;
      setShown(heroGone && !closingReached);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <nav
      aria-label="Page sections"
      className={cn(
        // .lv3-rail gates visibility on >=1440px, where the centred max-w-6xl
        // column finally leaves a gutter wide enough for the labels
        "lv3-rail group fixed left-5 top-1/2 z-30 -translate-y-1/2 transition-opacity duration-500 xl:left-8",
        shown ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <ol className="relative flex flex-col gap-7">
        <span
          aria-hidden
          className="absolute bottom-3 left-[11px] top-3 w-px"
          style={{ background: "var(--lv3-border)" }}
        />
        <span
          aria-hidden
          className="absolute left-[11px] top-3 w-px transition-all duration-500 ease-out"
          style={{
            height: `${(active / (ITEMS.length - 1)) * 100}%`,
            background: "linear-gradient(to bottom, var(--lv3-blue), var(--lv3-purple))",
          }}
        />

        {ITEMS.map((it, i) => {
          const isActive = i === active;
          const passed = i <= active;
          return (
            <li key={it.id} className="relative flex items-center">
              <a href={`#${it.id}`} className="flex items-center gap-3">
                <span
                  className="relative z-10 flex size-6 items-center justify-center border bg-white text-[10px] transition-colors duration-300"
                  style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    borderColor: passed ? "var(--lv3-blue)" : "var(--lv3-border)",
                    color: isActive ? "#fff" : passed ? "var(--lv3-blue)" : "var(--lv3-soft-55)",
                    background: isActive ? "var(--lv3-blue)" : "#fff",
                  }}
                >
                  {it.n}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap border px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur-sm transition-all duration-300",
                    isActive
                      ? "opacity-100"
                      : "-translate-x-1 border-transparent opacity-0 group-hover:translate-x-0 group-hover:border-[#e4e6f0] group-hover:opacity-100",
                  )}
                  style={{
                    background: "rgba(255,255,255,0.92)",
                    color: isActive ? "var(--lv3-navy)" : "var(--lv3-soft)",
                    borderColor: isActive ? "var(--lv3-border)" : undefined,
                  }}
                >
                  {it.label}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default SectionRail;
