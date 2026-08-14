// Landing v2 — CounterBand  (reference: cta-vibe-section / CTAVibe)
//
// Their DOM: section.cta-vibe-section > div.cta-vibe > div.cta-content >
// div.cta-stats > span.stats-number + span.stats-label, over div.cta-bg >
// div.dot-grid-wrapper > div.dot-grid.
//
// ── About the number ──────────────────────────────────────────────────────
// Theirs reads 8,721,054 tasks automated. We have no equivalent figure, and
// inventing one is the same problem as a fabricated testimonial. So the
// counter is wired to something that is actually true and checkable: the
// number of role definitions in shared/roleRegistry.ts, counted at runtime.
// If that file gains a role, this number moves on its own.
//
// When a real usage metric exists, replace COUNTER below and nothing else.

import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ROLE_DEFINITIONS } from "@shared/roleRegistry";
import { useReveal } from "./useReveal";

/** Swap this for a live metric when one exists. Must stay verifiable. */
const COUNTER = {
  value: ROLE_DEFINITIONS.length,
  label: "specialists on your team from the first message",
};

function useCountUp(target: number, run: boolean, ms = 1100) {
  const [n, setN] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setN(target);
      return;
    }
    let start = 0;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / ms);
      // ease-out cubic, so it decelerates into the final value
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, run, ms]);
  return n;
}

export function CounterBand() {
  const { ref, visible, className } = useReveal<HTMLElement>(0.35);
  const n = useCountUp(COUNTER.value, visible);

  return (
    <section ref={ref} className={`lv2-cta-vibe-section ${className}`}>
      <div className="lv2-cta-vibe">
        <div className="lv2-cta-bg" aria-hidden="true">
          <div className="lv2-dot-grid-wrapper">
            <div className="lv2-dot-grid" />
          </div>
        </div>

        <div className="lv2-cta-content">
          <div className="lv2-cta-stats">
            <span className="lv2-stats-number">{n.toLocaleString()}</span>
            <span className="lv2-stats-label">{COUNTER.label}</span>
          </div>
          <Link href="/login">
            <button type="button" className="lv2-vibe-btn">
              Meet them
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default CounterBand;
