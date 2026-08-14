// Landing v2 — PillsMarquee
//
// Ported from the reference's `marquee-section`. Their DOM:
//
//   section.marquee-section
//     h2
//     div.radial-mask
//       div.pills-wall
//         img.pill-guy
//         div.pills-row[data-row=0] > span.cu-pill * n
//         div.pills-row[data-row=1] ...
//
// Their CSS animates .pills-row with `marquee-left 120s linear infinite`, and
// :nth-child(2n) with `marquee-right`, so rows alternate direction for free.
// The keyframes translate 0 to -33.333%, which is why every row's content is
// repeated three times. Both keyframes are in clickup-ported.css unchanged.
//
// Ours: the verbs, and a character in the pill-guy slot.

import CharacterSlot from "./CharacterSlot";
import { useReveal } from "./useReveal";

const ROWS: string[][] = [
  [
    "WRITE THE SPEC",
    "KILL THE TIMELINE",
    "REVIEW THE PR",
    "DRAFT THE LAUNCH EMAIL",
    "AUDIT THE FUNNEL",
    "NAME THE TRADE-OFF",
    "SHIP THE ROADMAP",
    "QUESTION THE BRIEF",
  ],
  [
    "PUSH BACK ON SCOPE",
    "MAP THE EDGE CASES",
    "REWRITE THE HEADLINE",
    "FIND THE REGRESSION",
    "PICK THE STACK",
    "CHALLENGE THE DATA",
    "PLAN THE SPRINT",
    "FIX THE ONBOARDING",
  ],
  [
    "HAND IT TO THE ENGINEER",
    "REVIEW EACH OTHER'S WORK",
    "REMEMBER THE DECISION",
    "FLAG THE RISK",
    "SAY NO TO THE FEATURE",
    "KEEP GOING WHILE YOU SLEEP",
  ],
  [
    "BRIEF THE DESIGNER",
    "CUT THE WEAK PARAGRAPH",
    "SIZE THE WORK",
    "SPOT THE CONTRADICTION",
    "WRITE THE TEST",
    "CALL THE RISK EARLY",
  ],
];

export function PillsMarquee() {
  const { ref, className } = useReveal<HTMLElement>(0.05);

  return (
    <section ref={ref} className={`lv2-marquee-section ${className}`}>
      <h2>
        All the work you keep
        <br />
        meaning to get to.
      </h2>

      <div
        className="lv2-radial-mask"
        style={
          {
            "--radial-offset-y": "350px",
            "--radial-start": "10%",
            "--radial-end": "70%",
          } as React.CSSProperties
        }
      >
        <div className="lv2-pills-wall">
          {/* their pill_guy slot */}
          <CharacterSlot name="Maya" pose="neutral" className="lv2-pill-guy" />

          {ROWS.map((row, i) => {
            // tripled, because the keyframes translate -33.333%
            const tripled = [...row, ...row, ...row];
            return (
              <div className="lv2-pills-row" data-row={i} key={i} aria-hidden="true">
                {tripled.map((label, j) => (
                  <span className="lv2-cu-pill" key={`${label}-${j}`}>
                    {label}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default PillsMarquee;
