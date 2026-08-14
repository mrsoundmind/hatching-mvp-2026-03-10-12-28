// Landing v3 · 01 — Overview, as the whole process.
//
// The one section that has to make a stranger understand what Hatchin IS, end to
// end. On desktop it is a pinned storyboard: the mock (AppMock) stays fixed on
// screen while six full-height "step" blocks scroll past behind it, and the
// heading + mock advance one stage per step — a one-line idea, a team assembling,
// the plan, the coordination, the review, the finished work.
//
// On MOBILE that pinned scroll-jack costs six full screens of forced snap stops,
// which reads as an endless page. There we swap it for a compact, self-playing
// storyboard: the same animated mock cycles through all six stages in place, the
// heading tracks it, and a tappable dot stepper lets the reader move at their own
// pace (a tap pauses the auto-advance). Same six steps, one screen instead of six.
//
// Each desktop step is a scroll-snap stop with `scroll-snap-stop: always`, so even
// a hard flick lands on the next step instead of skipping past it. Snapping is set
// to `proximity` and only these six blocks carry snap-align, so the rest of the
// page scrolls freely — it never traps the reader elsewhere.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";

import AppMock, { OVERVIEW_STAGES } from "./AppMock";
import { Reveal, EASE } from "./primitives";
import { useIsMobile } from "@/hooks/use-mobile";

interface Head { eyebrow: string; lead: string; em: string; sub: string }
const HEADS: Head[] = [
  {
    eyebrow: "Step 1 · Your idea",
    lead: "It starts with",
    em: "one line.",
    sub: "Tell them what you want to build. That is the whole ask.",
  },
  {
    eyebrow: "Step 2 · Your team",
    lead: "A whole team",
    em: "assembles.",
    sub: "An expert shows up for every part of the work, not one bot in many hats.",
  },
  {
    eyebrow: "Step 3 · The plan",
    lead: "They lay out",
    em: "the plan.",
    sub: "Every step from setup to growth, handed to the right person.",
  },
  {
    eyebrow: "Step 4 · They work as a team",
    lead: "They talk, hand off,",
    em: "supervise, push back.",
    sub: "They pass work along, check each other, and push back when something is off.",
  },
  {
    eyebrow: "Step 5 · Reviewed",
    lead: "They build, and",
    em: "check each other.",
    sub: "A second teammate reads every draft before it reaches you.",
  },
  {
    eyebrow: "Step 6 · Done",
    lead: "You come back to",
    em: "a finished project.",
    sub: "Real documents, written and checked, while you were away.",
  },
];

// ── mobile · a compact, self-playing storyboard ─────────────────────────────
// The same animated mock, cycling through the six stages in place, with the
// heading tracking it and a tappable dot stepper. No scroll-jack, ~one screen.
function OverviewMobile() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px -10% 0px" });
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);

  // auto-advance through the six steps while the section is on screen; a tap
  // hands control to the reader and stops the auto-advance for the session.
  useEffect(() => {
    if (!inView || paused) return;
    const id = setInterval(() => setStage((s) => (s + 1) % OVERVIEW_STAGES), 3200);
    return () => clearInterval(id);
  }, [inView, paused]);

  const h = HEADS[stage];
  return (
    <section id="overview" ref={ref} className="lv3-bg-paper px-5 py-20">
      <div className="mx-auto w-full max-w-6xl">
        {/* the active step's heading, crossfading as the stage changes; a fixed
            min-height keeps the mock from jumping as headings differ in length */}
        <div className="relative" style={{ minHeight: 148 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={stage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <span className="lv3-label lv3-t-blue">{h.eyebrow}</span>
              <h2 className="lv3-display lv3-t-navy mt-3">
                {h.lead} <span className="lv3-serif-em">{h.em}</span>
              </h2>
              <p className="lv3-t-soft mt-3 text-[15px] leading-relaxed">{h.sub}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-5">
          <AppMock stage={stage} />
        </div>

        {/* tappable stepper — the reader can jump to any step; a tap pauses the
            auto-play. The active step is the elongated dot; the words live above. */}
        <div className="mt-5 flex items-center justify-center gap-1">
          {HEADS.map((_, i) => {
            const on = i === stage;
            return (
              <button
                key={i}
                type="button"
                onClick={() => { setPaused(true); setStage(i); }}
                aria-label={`Go to step ${i + 1} of ${OVERVIEW_STAGES}`}
                aria-current={on}
                className="flex items-center justify-center"
                style={{ width: 44, height: 40 }}
              >
                <span
                  className="transition-all duration-300"
                  style={{
                    width: on ? 22 : 8,
                    height: 8,
                    borderRadius: 999,
                    background: on ? "var(--lv3-blue)" : "var(--lv3-border)",
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function SectionOverview() {
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();
  const sectionRef = useRef<HTMLElement>(null);
  const [stage, setStage] = useState(0);

  // drive the stage from scroll position: each step block is one viewport tall,
  // so the stage is simply how many viewport-heights we are into the section.
  // Desktop only — the mobile branch plays itself and never attaches this.
  useEffect(() => {
    if (reduce || isMobile) return;
    let raf = 0;
    const compute = () => {
      raf = 0;
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const s = Math.max(0, Math.min(OVERVIEW_STAGES - 1, Math.floor(-rect.top / window.innerHeight)));
      setStage(s);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(compute); };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduce, isMobile]);

  // turn on proximity snapping for the page while this section is mounted; only
  // the six step blocks below carry snap-align, so nothing else on the page snaps.
  // Desktop only — never snap the mobile page.
  useEffect(() => {
    if (reduce || isMobile) return;
    const root = document.documentElement;
    const prev = root.style.scrollSnapType;
    root.style.scrollSnapType = "y proximity";
    return () => { root.style.scrollSnapType = prev; };
  }, [reduce, isMobile]);

  const headings = (active: number) => (
    <div className="relative max-w-3xl" style={{ minHeight: 224 }}>
      {HEADS.map((h, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            opacity: i === active ? 1 : 0,
            transform: i === active ? "translateY(0)" : "translateY(12px)",
          }}
          aria-hidden={i !== active}
        >
          <span className="lv3-label lv3-t-blue">{h.eyebrow}</span>
          <h2 className="lv3-display lv3-t-navy mt-4">
            {h.lead} <span className="lv3-serif-em">{h.em}</span>
          </h2>
          <p className="lv3-t-soft mt-4 text-lg leading-relaxed">{h.sub}</p>
        </div>
      ))}
    </div>
  );

  // Reduced motion: no scrubbing — the finished state + the heading that names it.
  if (reduce) {
    return (
      <section id="overview" className="lv3-bg-paper relative">
        <div className="mx-auto max-w-6xl px-5 pb-24 pt-24 sm:px-8 sm:pb-28 sm:pt-28">
          <Reveal>{headings(OVERVIEW_STAGES - 1)}</Reveal>
          <div className="mt-10"><AppMock stage={OVERVIEW_STAGES - 1} /></div>
        </div>
      </section>
    );
  }

  // Mobile: a compact self-playing storyboard instead of the six-screen pin.
  if (isMobile) {
    return <OverviewMobile />;
  }

  return (
    <section id="overview" ref={sectionRef} className="lv3-bg-paper relative">
      {/* the pinned visual: heading + mock, fixed on screen for the whole section */}
      <div className="sticky top-0 z-10 flex h-screen items-center overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          {headings(stage)}
          <div className="mt-8"><AppMock stage={stage} /></div>
        </div>
      </div>

      {/* six full-height snap steps that scroll behind the pinned visual and
          advance the stage. scroll-snap-stop:always makes each one un-skippable. */}
      <div className="relative -mt-[100vh]" aria-hidden>
        {HEADS.map((_, i) => (
          <div key={i} className="h-screen" style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }} />
        ))}
      </div>
    </section>
  );
}

export default SectionOverview;
