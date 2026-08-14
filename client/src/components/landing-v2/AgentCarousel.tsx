// Landing v2 — AgentCarousel
//
// Ported from the reference's AgentCarousel. Markup follows their hydrated
// DOM: a cu-section-header with the nav arrows in its right column, then a
// horizontal .carousel-track of .carousel-card elements.
//
// All geometry comes from clickup-ported.css and is theirs untouched:
//   card 320x480 (230x380 under 768px), 24px radius, 16px gap,
//   :nth-child(2n) pulled up 60px for the wave, 48px round nav buttons,
//   `transition: all .2s ease`, grab cursor on the track,
//   background: var(--card-bg) set per card.
//
// Their cards ship opacity:0 and are faded in by GSAP ScrollTrigger. We did
// not port their JS, so useReveal drives that instead (see the fixups block
// at the bottom of clickup-ported.css).
//
// Ours: the content. Roles, colours and thinking phrases come from
// shared/roleRegistry.ts so the cards match the app.

import { useCallback, useEffect, useRef, useState } from "react";
import { getRoleDefinition } from "@shared/roleRegistry";
import CharacterSlot from "./CharacterSlot";
import { CHARACTERS, characterHex } from "./characterAssets";
import CuSectionHeader from "./CuSectionHeader";
import { useReveal } from "./useReveal";

const CARD_STEP = 336; // 320 card + 16 gap, their values

function NavArrows({
  atStart,
  atEnd,
  onPrev,
  onNext,
}: {
  atStart: boolean;
  atEnd: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="lv2-nav-buttons">
      <button
        type="button"
        className={`lv2-nav-btn ${atStart ? "lv2-disabled" : ""}`}
        disabled={atStart}
        onClick={onPrev}
        aria-label="Previous teammates"
      >
        {/* their arrow paths, verbatim */}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M12.5 15l-5-5 5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        className={`lv2-nav-btn ${atEnd ? "lv2-disabled" : ""}`}
        disabled={atEnd}
        onClick={onNext}
        aria-label="More teammates"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M7.5 5l5 5-5 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

export function AgentCarousel() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const { ref: revealRef, className: revealClass } = useReveal<HTMLDivElement>(0.08);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const syncEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    syncEdges();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", syncEdges, { passive: true });
    window.addEventListener("resize", syncEdges);
    return () => {
      el.removeEventListener("scroll", syncEdges);
      window.removeEventListener("resize", syncEdges);
    };
  }, [syncEdges]);

  const nudge = (dir: -1 | 1) =>
    trackRef.current?.scrollBy({ left: dir * CARD_STEP, behavior: "smooth" });

  return (
    <section className="lv2-agent-carousel">
      {/* no wrapper: their .cu-section-header carries its own
          max-inline-size and padding, and the track is full-bleed right */}
      <CuSectionHeader
          eyebrow="THE TEAM"
          title={
            <>
              Thirty specialists.
              <br />
              Already hired.
            </>
          }
          description="A product manager who kills your timeline, an engineer who refuses to skip tests, a creative director who argues about the palette. Each one has their own expertise and their own opinion about your project."
          right={
            <NavArrows
              atStart={atStart}
              atEnd={atEnd}
              onPrev={() => nudge(-1)}
              onNext={() => nudge(1)}
            />
          }
        />

        <div ref={revealRef} className={revealClass}>
          <div ref={trackRef} className="lv2-carousel-track lv2-scroller">
            {CHARACTERS.map((character, i) => {
              const hex = characterHex(character.name);
              const def = getRoleDefinition(character.role);
              return (
                <article
                  key={character.name}
                  className="lv2-carousel-card"
                  data-clickable="true"
                  style={
                    {
                      // their cards read the tint from --card-bg
                      "--card-bg": `linear-gradient(170deg, ${hex}24 0%, ${hex}0c 46%, rgba(10,12,19,0) 100%)`,
                      "--i": i,
                    } as React.CSSProperties
                  }
                >
                  <div className="lv2-card-top">
                    <span className="lv2-card-icon" style={{ background: `${hex}2e` }}>
                      {def?.emoji ?? "✦"}
                    </span>
                    <span className="lv2-card-title">{character.role}</span>
                    <span className="lv2-card-sub">
                      {character.name}
                      {def?.thinkingPhrase ? ` · ${def.thinkingPhrase.replace(/\.+$/, "")}` : ""}
                    </span>
                  </div>

                  <CharacterSlot
                    name={character.name}
                    pose="neutral"
                    className="lv2-card-character"
                  />

                  <button
                    type="button"
                    className="lv2-card-plus"
                    aria-label={`Meet ${character.name}`}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path
                        d="M10 4v12M4 10h12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </article>
              );
            })}
          </div>
        </div>

      <div className="lv2-mobile-nav">
        <NavArrows
          atStart={atStart}
          atEnd={atEnd}
          onPrev={() => nudge(-1)}
          onNext={() => nudge(1)}
        />
      </div>
    </section>
  );
}

export default AgentCarousel;
