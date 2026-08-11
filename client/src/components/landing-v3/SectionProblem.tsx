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
      <span className="lv3-label lv3-t-soft-55">Today, you are</span>
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
        <span className="lv3-t-navy text-[22px] font-bold">{HATS.length} hats.</span>
        <span className="lv3-t-soft text-[15px]">One head. All at once.</span>
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
          <span className="lv3-label lv3-t-blue">If this is you</span>
          <h2 className="lv3-display lv3-t-navy mt-4 text-balance">
            You're the founder.{" "}
            <span className="lv3-serif-em">And the whole team.</span>
          </h2>
          <p className="lv3-t-soft mt-4 text-lg leading-relaxed">
            Product, design, finance, legal, marketing, all you, at the same time. A chatbot hands you
            generic answers. Hiring a specialist for each costs more than you have. So the good ideas
            sit and wait.
          </p>
          <p className="lv3-t-navy mt-6 text-[16px] font-medium leading-snug">
            Hatchin is for founders and small teams who need a whole department, and are a team of one.
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
