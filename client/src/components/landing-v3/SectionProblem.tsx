// Landing v3 · The problem, and who this is for.
//
// The page used to open straight on the solution. This is the missing beat that
// makes the visitor feel the pain first (you're one person doing every job) and
// names who it's for, so the sections that follow land as relief, not as a nice
// product. It sits right after the hero, before the Overview.
//
// It's also deliberately CALM and scannable: a breather between the dark hero
// and the interactive-heavy sections that follow. The only motion is the role
// chips arriving and a "context-switch" highlight hopping between them, the
// exhausting feeling of wearing every hat at once.

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { Reveal, EASE } from "./primitives";

const HATS = ["Product", "Design", "Engineering", "Finance", "Legal", "Marketing", "Sales", "Support"];

function EveryHat({ reduce }: { reduce: boolean | null }) {
  const [lit, setLit] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setLit((l) => (l + 1) % HATS.length), 700);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div className="border bg-white p-6 sm:p-7" style={{ borderColor: "var(--lv3-border)" }}>
      <span className="lv3-label lv3-t-soft-55">The team you need</span>
      <motion.div
        className="mt-4 flex flex-wrap gap-2"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
        initial={reduce ? false : "hidden"}
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
      >
        {HATS.map((h, i) => (
          <motion.span
            key={h}
            className="rounded-full border px-3 py-1.5 text-[13px] font-semibold"
            variants={{ hidden: { opacity: 0, y: 10, scale: 0.85 }, show: { opacity: 1, y: 0, scale: 1 } }}
            transition={{ duration: 0.35, ease: EASE }}
            animate={{
              borderColor: i === lit ? "var(--lv3-amber-fill)" : "var(--lv3-border)",
              color: i === lit ? "var(--lv3-navy)" : "var(--lv3-soft)",
              backgroundColor: i === lit ? "rgba(242,180,65,0.08)" : "#fff",
            }}
          >
            {h}
          </motion.span>
        ))}
      </motion.div>
      <div className="mt-5 flex items-baseline gap-2 border-t pt-4" style={{ borderColor: "var(--lv3-border)" }}>
        <span className="lv3-t-navy text-[22px] font-bold">{HATS.length} specialists.</span>
        <span className="lv3-t-soft text-[15px]">Assembling them is the hard part.</span>
      </div>
    </div>
  );
}

export function SectionProblem() {
  const reduce = useReducedMotion();
  return (
    <section id="problem" className="lv3-bg-candle px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_0.92fr]">
        <Reveal>
          <span className="lv3-label lv3-t-blue">The hard part</span>
          <h2 className="lv3-display lv3-t-navy mt-4 text-balance">
            The idea is easy.{" "}
            <span className="lv3-serif-em">The team is the hard part.</span>
          </h2>
          <p className="lv3-t-soft mt-4 text-lg leading-relaxed">
            Hiring a whole team is slow and expensive.
          </p>
          <p className="lv3-t-navy mt-5 text-[16px] font-medium leading-snug">
            Whether you're one person, or a company missing a whole department.
          </p>
        </Reveal>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <EveryHat reduce={reduce} />
        </motion.div>
      </div>
    </section>
  );
}

export default SectionProblem;
