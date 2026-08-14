// Landing v2 — CtaCallout  (reference: cta-callout-section)
//
// Their DOM: section.cta-callout-section > div.cta-callout > div.cta-content,
// over a field of .ascii-line rows that resolve into a face.
//
// Theirs is a portrait. Ours is an egg with a crack running through it, which
// is the brand and matches the Shell Visor the characters wear. The rows are
// generated from a signed-distance field rather than hand-authored, so the
// shape can be tuned by changing numbers instead of retyping art.

import { useMemo } from "react";
import { Link } from "wouter";
import { useReveal } from "./useReveal";

const COLS = 96;
const ROWS = 34;
const RAMP = " .·:-=+*#%@";

/** Egg outline with a fracture, rendered as character density. */
function buildAscii(): string[] {
  const lines: string[] = [];
  for (let y = 0; y < ROWS; y++) {
    let line = "";
    for (let x = 0; x < COLS; x++) {
      // normalise to -1..1, correcting for character cell aspect (~0.5)
      const nx = (x / (COLS - 1)) * 2 - 1;
      const ny = (y / (ROWS - 1)) * 2 - 1;
      // egg: narrower at the top, rounder at the base
      const taper = 1 + ny * 0.22;
      const d = Math.sqrt((nx / (0.42 * taper)) ** 2 + (ny / 0.92) ** 2);
      // shell density: bright at the rim, hollow inside
      let v = Math.max(0, 1 - Math.abs(d - 0.86) * 7);
      // the fracture: a jagged diagonal that erases the shell
      const crackX = -0.06 + ny * 0.3 + Math.sin(ny * 9) * 0.05;
      const crack = Math.max(0, 1 - Math.abs(nx - crackX) * 26);
      if (d < 1) v = Math.max(v, crack * (1 - d * 0.55));
      line += RAMP[Math.min(RAMP.length - 1, Math.round(v * (RAMP.length - 1)))];
    }
    lines.push(line);
  }
  return lines;
}

export function CtaCallout() {
  const ascii = useMemo(buildAscii, []);
  const { ref, className } = useReveal<HTMLElement>(0.08);

  return (
    <section ref={ref} className={`lv2-cta-callout-section ${className}`}>
      <div className="lv2-cta-callout">
        <div className="lv2-ascii-art" aria-hidden="true">
          {ascii.map((line, i) => (
            <div className="lv2-ascii-line" key={i}>
              {line}
            </div>
          ))}
        </div>

        <div className="lv2-cta-content">
          <h2 className="lv2-cta-heading">Something is already in there.</h2>
          <p className="lv2-cta-description">
            Start a project and the team assembles around it in under a minute. No setup, no
            configuration, no picking models.
          </p>
          <div className="lv2-cta-button-wrapper">
            <Link href="/login">
              <button type="button" className="lv2-callout-btn">
                Start free
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CtaCallout;
