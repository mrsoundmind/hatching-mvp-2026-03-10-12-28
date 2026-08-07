// Landing v3 · 01 — Overview.
//
// FIMI's ProjectOverview beat (plain-language "what this is"), rebuilt to lead
// with the product rather than a paragraph. The product is DRAWN, not
// screenshotted: AppMock runs the three-pane layout as a live loop. Real
// screenshots were tried here and rejected as unreadable dark boxes on a light
// page. The long paragraph this section used to carry is gone; the picture
// It carries the whole product on its own. A feature grid was tried under it
// and removed: a list of thirteen capabilities is the exact noise the rest of
// the page spent so long cutting. Everything the product does is shown in the
// mock's loop instead.
//
// It also carries the seam: the hero above ends on #0A0C13, so this section
// opens with a gradient band that lands on white before the copy starts.

import { motion, useReducedMotion } from "framer-motion";

import AppMock from "./AppMock";
import { Reveal, EASE, VIEWPORT } from "./primitives";

export function SectionOverview() {
  const reduce = useReducedMotion();

  return (
    // No seam gradient: the hero already fades to #0A0C13 behind the sparkles,
    // so white starts on a clean edge. Gradients were pulled from the page.
    <section id="overview" className="lv3-bg-paper relative">
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-24 sm:px-8 sm:pb-28 sm:pt-28">
        <Reveal className="max-w-3xl">
          <span className="lv3-label lv3-t-blue">What you get</span>
          <h2 className="lv3-display lv3-t-navy mt-4">
            Here is the whole thing.
          </h2>
          <p className="lv3-t-soft mt-4 text-lg leading-relaxed">
            Your team on the left. The work in the middle.
          </p>
        </Reveal>

        <motion.div
          className="mt-10"
          initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <AppMock />
        </motion.div>

      </div>
    </section>
  );
}

export default SectionOverview;
