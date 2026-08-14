// Landing v2 — CtaFinal
//
// Ported from the reference's `cta-final`. Their DOM, verbatim in structure:
//
//   section.cta-final
//     div.cta-final-card
//       div.cta-gradient-bg   > img + div.noise-overlay
//       div.cta-final-content > h2.cta-final-title + desktop button
//       div.characters-container
//         img.character.character-1 / -2 / -center / -4 / -5
//       div.btn-container      > mobile button
//
// The arc is pure CSS and it is theirs: character-center is 718x850 pinned
// bottom -160px at z-index 5, the inner pair sit at 13% inset and about
// -56/-71px, the outer pair at -2% and z-index 1, and the outer two are
// display:none below their breakpoint. Card is 800px tall, 32px radius.
//
// Ours: the gradient is drawn in CSS rather than loading their
// gradient-bg.webp, and the five slots hold our characters.

import { Link } from "wouter";
import CharacterSlot from "./CharacterSlot";
import { GROUP_SHOT } from "./characterAssets";
import { useReveal } from "./useReveal";

// left to right, matching their class order
const SLOTS = [
  { cls: "lv2-character-1", name: "Kai" },
  { cls: "lv2-character-2", name: "Alex" },
  { cls: "lv2-character-center", name: "Dev" },
  { cls: "lv2-character-4", name: "Cleo" },
  { cls: "lv2-character-5", name: "Zara" },
];

export function CtaFinal() {
  const { ref, className } = useReveal<HTMLElement>(0.1);

  return (
    <section ref={ref} className={`lv2-cta-final ${className}`}>
      <div className="lv2-cta-final-card">
        <div className="lv2-cta-gradient-bg">
          {/* their gradient-bg.webp is a ClickUp asset; drawn in CSS instead */}
          <div className="lv2-cta-gradient-paint" />
          <div className="lv2-noise-overlay" />
        </div>

        <div className="lv2-cta-final-content">
          <h2 className="lv2-cta-final-title">
            Meet your
            <br />
            team today
          </h2>
          <Link href="/login">
            <button type="button" className="lv2-cta-desktop-button">
              Start free
            </button>
          </Link>
        </div>

        <div className="lv2-characters-container">
          {GROUP_SHOT ? (
            <img src={GROUP_SHOT} alt="The Hatchin team" className="lv2-character lv2-group-shot" />
          ) : (
            SLOTS.map((slot) => (
              <CharacterSlot
                key={slot.cls}
                name={slot.name}
                pose="neutral"
                className={`lv2-character ${slot.cls}`}
              />
            ))
          )}
        </div>

        <div className="lv2-btn-container">
          <Link href="/login">
            <button type="button" className="lv2-cta-mobile-button">
              Start free
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default CtaFinal;
