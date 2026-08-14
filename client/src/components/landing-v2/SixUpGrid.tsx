// Landing v2 — SixUpGrid  (reference: last-feature-section)
//
// Their DOM: div.last-feature-section > div.last-feature-left >
// div.feature-text > h3.last-feature-title + p.last-feature-desc, followed by
// five div.feature-col each holding a div.feature-stack-title.
//
// Closes the technology block. No imagery, six short claims, all cheap. Ours
// are all things that exist in the codebase, so the density does not turn
// into six vague adjectives.

import { useReveal } from "./useReveal";

const CLAIMS: { title: string; desc: string }[] = [
  {
    title: "Routed by intent",
    desc: "Simple turns go to a free model, hard ones to the strong one.",
  },
  {
    title: "Three memory tiers",
    desc: "Working, project and long term, read before every reply.",
  },
  {
    title: "Blind judging",
    desc: "The reviewer never learns who wrote the work.",
  },
  {
    title: "Hard spend caps",
    desc: "Per user, per day, plus a global brake that cannot be argued with.",
  },
  {
    title: "Progressive trust",
    desc: "Teammates earn autonomy by being right, not by asking.",
  },
  {
    title: "Fail-safe gates",
    desc: "If a check errors, work stops rather than shipping unchecked.",
  },
];

export function SixUpGrid() {
  const { ref, className } = useReveal<HTMLDivElement>(0.1);

  return (
    <div ref={ref} className={`lv2-last-feature-section ${className}`}>
      <div className="lv2-last-feature-left">
        <div className="lv2-feature-text">
          <h3 className="lv2-last-feature-title">Under it all</h3>
          <p className="lv2-last-feature-desc">
            The parts you never see, doing the work that makes the rest trustworthy.
          </p>
        </div>
      </div>

      {CLAIMS.map((c) => (
        <div className="lv2-feature-col" key={c.title}>
          <div className="lv2-feature-stack-title">{c.title}</div>
          <p className="lv2-feature-stack-desc">{c.desc}</p>
        </div>
      ))}
    </div>
  );
}

export default SixUpGrid;
