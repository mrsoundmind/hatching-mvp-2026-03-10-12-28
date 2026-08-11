// Landing v3 · The problem.
//
// The missing beat that makes the visitor feel the pain first: a real project
// needs a whole team, and assembling one is slow and expensive. The card on the
// right is that team, drawn as real Hatch faces rather than word-chips: they
// assemble in, one is featured large and rotates through the roster, so the
// section that names the pain also shows the people you are missing.

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import { Reveal, EASE } from "./primitives";

// the team a real project needs — one real Hatch per discipline, so every tile
// is a distinct human face, not an icon.
const TEAM = [
  { name: "Alex", role: "Product Manager" },
  { name: "Cleo", role: "Product Designer" },
  { name: "Dev", role: "Engineer" },
  { name: "Juhi", role: "Finance Analyst" },
  { name: "Ira", role: "Legal Counsel" },
  { name: "Kai", role: "Growth Marketer" },
  { name: "Dana", role: "Sales Lead" },
  { name: "Tess", role: "Customer Success" },
];

function TeamUnit({ reduce }: { reduce: boolean | null }) {
  const ADD = TEAM.length; // sentinel index for the "any role" tile
  const [lit, setLit] = useState(0);
  const [held, setHeld] = useState<number | null>(null);

  // rotate the featured teammate through the real roster, until a tile is hovered
  useEffect(() => {
    if (reduce || held !== null) return;
    const id = setInterval(() => setLit((l) => (l + 1) % TEAM.length), 1600);
    return () => clearInterval(id);
  }, [reduce, held]);

  const active = held ?? lit;
  const isAdd = active === ADD;
  const featured = isAdd ? null : TEAM[active];
  const featKey = isAdd ? "add" : featured!.name;

  return (
    <div className="border bg-white p-6 sm:p-7" style={{ borderColor: "var(--lv3-border)" }}>
      <span className="lv3-label lv3-t-soft-55">The team you need</span>

      {/* the featured teammate — the enlarged photo, rotating through the roster */}
      <div className="mt-4 flex items-center gap-4">
        <AnimatePresence mode="wait">
          <motion.span
            key={`face-${featKey}`}
            className="inline-flex shrink-0"
            initial={reduce ? false : { opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {isAdd ? (
              <span
                className="flex size-[72px] items-center justify-center rounded-full border-2 border-dashed"
                style={{ borderColor: "var(--lv3-blue)", background: "rgba(66,87,232,0.06)" }}
              >
                <Plus className="lv3-t-blue size-7" />
              </span>
            ) : (
              <AgentAvatar characterName={featured!.name} role={featured!.role} size={72} state="working" />
            )}
          </motion.span>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.span
            key={`name-${featKey}`}
            className="min-w-0"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <span className="lv3-t-navy block text-[18px] font-semibold leading-tight">
              {isAdd ? "Any role" : featured!.name}
            </span>
            <span className="lv3-t-soft block text-[13px] leading-tight">
              {isAdd ? "whatever your project needs" : featured!.role}
            </span>
          </motion.span>
        </AnimatePresence>
      </div>

      {/* the unit assembles in; the dashed "+" says any role can be added */}
      <motion.div
        className="mt-5 flex flex-wrap gap-2"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
        initial={reduce ? false : "hidden"}
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
      >
        {TEAM.map((m, i) => (
          <motion.button
            key={m.name}
            type="button"
            onMouseEnter={() => setHeld(i)}
            onMouseLeave={() => setHeld(null)}
            onFocus={() => setHeld(i)}
            onBlur={() => setHeld(null)}
            aria-label={`${m.name}, ${m.role}`}
            className="rounded-full focus-visible:outline-none"
            variants={{ hidden: { opacity: 0, y: 10, scale: 0.8 }, show: { opacity: 1, y: 0, scale: 1 } }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <motion.span
              className="relative inline-flex rounded-full"
              animate={reduce ? {} : { y: i === active ? -3 : 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              style={{ boxShadow: i === active ? "0 0 0 2px var(--lv3-amber-fill)" : "none" }}
            >
              <AgentAvatar
                characterName={m.name}
                role={m.role}
                size={34}
                state={i === active ? "working" : "idle"}
                className={i === active ? "" : "opacity-70"}
              />
            </motion.span>
          </motion.button>
        ))}

        {/* add-any-role tile — the team is open-ended, not a fixed set */}
        <motion.button
          type="button"
          onMouseEnter={() => setHeld(ADD)}
          onMouseLeave={() => setHeld(null)}
          onFocus={() => setHeld(ADD)}
          onBlur={() => setHeld(null)}
          aria-label="Add any role your project needs"
          className="rounded-full focus-visible:outline-none"
          variants={{ hidden: { opacity: 0, y: 10, scale: 0.8 }, show: { opacity: 1, y: 0, scale: 1 } }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <motion.span
            className="flex size-[34px] items-center justify-center rounded-full border border-dashed"
            animate={reduce ? {} : { y: isAdd ? -3 : 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            style={{
              borderColor: isAdd ? "var(--lv3-blue)" : "var(--lv3-soft-55)",
              background: isAdd ? "rgba(66,87,232,0.06)" : "#fff",
              boxShadow: isAdd ? "0 0 0 2px var(--lv3-amber-fill)" : "none",
            }}
          >
            <Plus className="size-4" style={{ color: isAdd ? "var(--lv3-blue)" : "var(--lv3-soft-55)" }} />
          </motion.span>
        </motion.button>
      </motion.div>

      <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--lv3-border)" }}>
        <span className="lv3-t-navy text-[17px] font-bold">Any role a project needs.</span>{" "}
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
        </Reveal>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <TeamUnit reduce={reduce} />
        </motion.div>
      </div>
    </section>
  );
}

export default SectionProblem;
