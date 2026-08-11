// Landing v3 · 07 — The close.
//
// FIMI's ClosingCTA beat: one distinct action above the footer, deliberately
// not a repeat of the hero.
//
// It used to run the hero footage behind a scrim. The video is gone and the
// band is light, so the page ends bright and runs straight into the white
// footer instead of stacking two dark blocks at the bottom. The only video on
// the page is now the hero.

import { motion, useReducedMotion } from "framer-motion";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import { ROSTER } from "./RosterGrid";
import { CTA } from "./primitives";

/**
 * The close was the one section on the page that did not move. Rather than
 * decorate it, the motion says the thing the section is asking for: the whole
 * roster drifting past, so the last image before the button is the size of the
 * team you are about to meet.
 */
function DriftingRoster() {
  const reduce = useReducedMotion();
  // duplicated once so the loop has no visible seam
  const strip = [...ROSTER, ...ROSTER];
  return (
    <div
      aria-hidden
      className="pointer-events-none relative mx-auto mb-10 max-w-3xl overflow-hidden"
      style={{
        maskImage: "linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)",
        WebkitMaskImage: "linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)",
      }}
    >
      <motion.div
        className="flex w-max gap-3"
        animate={reduce ? {} : { x: ["0%", "-50%"] }}
        transition={{ duration: 46, repeat: Infinity, ease: "linear" }}
      >
        {strip.map((m, i) => (
          <AgentAvatar
            key={`${m.name}-${i}`}
            characterName={m.name}
            role={m.role}
            size={34}
            className="shrink-0 opacity-55"
          />
        ))}
      </motion.div>
    </div>
  );
}

export function ClosingBand() {
  return (
    <section id="close" className="lv3-bg-paper relative isolate overflow-hidden border-t">
      <div className="mx-auto max-w-4xl px-5 py-28 text-center sm:px-8 sm:py-32">
        <DriftingRoster />
        <span className="lv3-label lv3-t-blue">Start building</span>
        <h2 className="lv3-hero-type lv3-t-navy mt-5">
          Meet your team. <span className="lv3-serif-em">Ship what you imagine.</span>
        </h2>
        <p className="lv3-t-soft mx-auto mt-6 max-w-xl text-lg leading-relaxed">
          Describe what you are building. See who pushes back first.
        </p>
        {/* one action only. The secondary here used to point back up the page,
            which is a leak at the last conversion moment on the site. */}
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <CTA href="/login" variant="primary">
            Start free
          </CTA>
        </div>
        <p className="lv3-label lv3-t-soft-55 mx-auto mt-6 max-w-2xl">
          Free forever plan · no card needed
        </p>

        {/* The page asks people to upload contracts and specs. Saying nothing
            about where that goes leaves the objection standing. Only claims
            the build actually supports: per-account ownership checks and a
            real delete path. Anything beyond that belongs in the policy. */}
        <p className="lv3-t-soft mx-auto mt-8 max-w-xl text-[13.5px] leading-relaxed">
          Projects are private to your account. Delete one and everything in it goes with it.
        </p>
      </div>
    </section>
  );
}

export default ClosingBand;
