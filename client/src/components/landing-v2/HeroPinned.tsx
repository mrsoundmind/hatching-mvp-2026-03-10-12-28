// Landing v2 — HeroPinned  (reference: AgentHeroPin)
//
// Their DOM: section.hero-container > div.hero-text (the oversized wordmark)
// + div.pinned-actor > div.actor-wrapper > img.actor, then div.cta-wrapper >
// h1.cta-text sitting low over the chest.
//
// Placed as a SECOND ACT here, not at the top. The video hero stays exactly
// as it is; this lands once you are already scrolling, so the character
// reveal has something to arrive after.
//
// Theirs pins for six viewport heights. Ours pins for one and a half. The
// audit on /landing found 45% of its scroll length went to a single hijacked
// section, and repeating that knowingly would be worse than deviating.

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import CharacterSlot from "./CharacterSlot";
import { characterHex } from "./characterAssets";

export function HeroPinned({ character = "Dev" }: { character?: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const hex = characterHex(character);

  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start start", "end start"],
  });
  const actorScale = useTransform(scrollYProgress, [0, 1], [1, 1.16]);
  const actorY = useTransform(scrollYProgress, [0, 1], [0, -36]);
  const wordScale = useTransform(scrollYProgress, [0, 1], [1, 1.28]);
  const wordOpacity = useTransform(scrollYProgress, [0, 0.72], [1, 0]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const still = (v: unknown) => (reduced ? undefined : (v as never));

  return (
    <div ref={wrapRef} className="lv2-pin-spacer" style={{ height: "150vh" }}>
      <section className="lv2-hero-container">
        <div
          className="lv2-radial-glow"
          aria-hidden="true"
          style={{
            background: `radial-gradient(64% 50% at 50% 60%, ${hex}33 0%, rgba(10,12,19,0) 70%)`,
          }}
        />

        <motion.div
          className="lv2-hero-text"
          aria-hidden="true"
          style={{ scale: still(wordScale), opacity: still(wordOpacity) }}
        >
          <span>Hatchin</span>
        </motion.div>

        <div className="lv2-pinned-actor">
          <motion.div
            className="lv2-actor-wrapper"
            style={{ scale: still(actorScale), y: still(actorY) }}
          >
            <CharacterSlot name={character} pose="neutral" className="lv2-actor" />
          </motion.div>

          <motion.div className="lv2-cta-wrapper" style={{ opacity: still(copyOpacity) }}>
            <h2 className="lv2-cta-text">
              Thirty of them.
              <br />
              Every one has an opinion.
            </h2>
            <p className="lv2-hero-sub">
              They are not personas painted over one model. Each carries its own reasoning pattern,
              its own output standard, and its own way of telling you that you are wrong.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

export default HeroPinned;
