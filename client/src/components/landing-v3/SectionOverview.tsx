// Landing v3 · 01 — Overview, as the whole process.
//
// The one section that has to make a stranger understand what Hatchin IS, end to
// end. It is a pinned storyboard: the mock (AppMock) stays fixed on screen while
// six full-height "step" blocks scroll past behind it, and the heading + mock
// advance one stage per step — a one-line idea, a team assembling, the plan, the
// coordination, the review, the finished work.
//
// Each step is a scroll-snap stop with `scroll-snap-stop: always`, so even a hard
// flick lands on the next step instead of skipping past it. Snapping is set to
// `proximity` and only these six blocks carry snap-align, so the rest of the page
// scrolls freely — it never traps the reader elsewhere.

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

import AppMock, { OVERVIEW_STAGES } from "./AppMock";
import { Reveal } from "./primitives";

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

export function SectionOverview() {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const [stage, setStage] = useState(0);

  // drive the stage from scroll position: each step block is one viewport tall,
  // so the stage is simply how many viewport-heights we are into the section.
  useEffect(() => {
    if (reduce) return;
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
  }, [reduce]);

  // turn on proximity snapping for the page while this section is mounted; only
  // the six step blocks below carry snap-align, so nothing else on the page snaps.
  useEffect(() => {
    if (reduce) return;
    const root = document.documentElement;
    const prev = root.style.scrollSnapType;
    root.style.scrollSnapType = "y proximity";
    return () => { root.style.scrollSnapType = prev; };
  }, [reduce]);

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
