// Landing v3 · 04 — Ask a generic assistant. Then ask yours.
//
// Replaces the retrieval animation, which was pretty and explained plumbing:
// embeddings, a corpus grid, "sourced passages". Nobody buys a vector store.
//
// A side by side does the job with no jargon at all. Same question, two
// answers. You realise the difference in the time it takes to read them, which
// is the whole point of the section.
//
// FAIRNESS NOTE, and it matters: the left-hand answers are deliberately NOT
// strawmen. They are reasonable, the kind of correct-but-unowned reply a good
// general assistant gives. The difference on the right is not intelligence, it
// is a named specialist who commits to a position, names the framework, and
// asks the question the generic answer skipped. The section says on the page
// that the left column is illustrative.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import { Reveal } from "./primitives";

type Pair = {
  q: string;
  generic: string;
  who: string;
  role: string;
  answer: string;
  named: string;
};

const PAIRS: Pair[] = [
  {
    q: "How should we price this?",
    generic:
      "Pricing depends on your market. Common approaches include value-based, competitor-based and cost-plus. Survey customers and test a few tiers.",
    who: "Juhi",
    role: "Finance Analyst",
    answer:
      "What is your net revenue retention? Under 100% and pricing is not the problem, retention is. Over 110%, raise on new signups only.",
    named: "Net revenue retention",
  },
  {
    q: "Why are people churning?",
    generic:
      "Churn can stem from onboarding friction, missing features, pricing or support. Survey churned users and analyse usage patterns.",
    who: "Tess",
    role: "Customer Success Manager",
    answer:
      "Did they get the outcome they paid for, or were they just happy? Pull every account that never hit its first milestone.",
    named: "Success milestones",
  },
  {
    q: "Should we build this feature?",
    generic:
      "Evaluate it against user demand, business impact and engineering effort. A prioritisation framework helps you compare roadmap items.",
    who: "Alex",
    role: "Product Manager",
    answer:
      "Score it with RICE, honestly. Most teams write 100% confidence where they mean 'we hope'. And what does it displace?",
    named: "RICE prioritisation",
  },
];

export function SectionCompare() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px -20% 0px" });
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const [revealed, setRevealed] = useState(reduce);

  // it rotates through the questions on its own so the section is never still;
  // hovering the panel holds whichever one you are reading
  useEffect(() => {
    if (reduce || !inView || held) return;
    const id = setInterval(() => setI((v) => (v + 1) % PAIRS.length), 5200);
    return () => clearInterval(id);
  }, [inView, reduce, held]);

  // the right-hand answer lands a beat after the left, so the contrast reads
  useEffect(() => {
    if (reduce) {
      setRevealed(true);
      return;
    }
    if (!inView) return;
    setRevealed(false);
    const t = setTimeout(() => setRevealed(true), 900);
    return () => clearTimeout(t);
  }, [i, inView, reduce]);

  const p = PAIRS[i];

  return (
    <section ref={ref} id="knowledge" className="lv3-bg-paper py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <span className="lv3-label lv3-t-blue">The same question, asked twice</span>
          <h2 className="lv3-display lv3-t-navy mt-4">
            Most AI gives you options.{" "}
            <span className="lv3-serif-em">Yours gives you an answer.</span>
          </h2>
        </Reveal>

        {/* pick the question */}
        <div className="mt-8 flex flex-wrap gap-2">
          {PAIRS.map((x, idx) => {
            const on = idx === i;
            return (
              <button
                key={x.q}
                type="button"
                data-pair={idx}
                onClick={() => setI(idx)}
                aria-pressed={on}
                className="cursor-pointer border px-4 py-2 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  ["--tw-ring-color" as string]: "var(--lv3-blue)",
                  borderColor: on ? "var(--lv3-navy)" : "var(--lv3-border)",
                  background: on ? "var(--lv3-navy)" : "#fff",
                  color: on ? "#fff" : "var(--lv3-soft)",
                }}
              >
                {x.q}
              </button>
            );
          })}
        </div>

        <div
          className="mt-3 grid overflow-hidden border md:grid-cols-2"
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => setHeld(false)}
        >
          {/* ── the generic answer ───────────────────────────────── */}
          <div className="flex flex-col border-b p-7 sm:p-9 md:border-b-0 md:border-r" style={{ background: "#fbfbfe" }}>
            <div className="flex items-center gap-2.5">
              <span
                className="flex size-[30px] shrink-0 items-center justify-center rounded-full border"
                style={{ color: "var(--lv3-soft-55)" }}
              >
                <Sparkles className="size-3.5" />
              </span>
              <span className="lv3-label lv3-t-soft-55">A generic assistant</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={p.q}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="lv3-t-soft mt-5 text-[15px] leading-relaxed"
              >
                {p.generic}
              </motion.p>
            </AnimatePresence>
            <p className="lv3-label lv3-t-soft-55 mt-auto pt-6">
              correct, and nobody owns it
            </p>
          </div>

          {/* ── the teammate ─────────────────────────────────────── */}
          <motion.div
            className="flex flex-col p-7 sm:p-9"
            animate={{ opacity: revealed ? 1 : 0.2 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2.5">
              <AgentAvatar characterName={p.who} role={p.role} size={30} className="shrink-0" />
              <span className="lv3-t-navy text-[13px] font-semibold">
                {p.who}
                <span className="lv3-t-soft-55 font-normal"> · {p.role}</span>
              </span>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={p.q}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="lv3-t-ink mt-5 text-[15px] leading-relaxed"
              >
                {p.answer}
              </motion.p>
            </AnimatePresence>
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
              <span
                className="lv3-label border px-2 py-1"
                style={{ borderColor: "rgba(84,104,240,0.35)", color: "var(--lv3-blue)", background: "rgba(84,104,240,0.06)" }}
              >
                {p.named}
              </span>
              <span className="lv3-label lv3-t-soft-55">from their own reading, not the model's memory</span>
            </div>
          </motion.div>
        </div>

        <p className="lv3-label lv3-t-soft-55 mt-4">
          Left column illustrative · right is how the role answers
        </p>
      </div>
    </section>
  );
}

export default SectionCompare;
