// Landing v3 · vs a chatbot — one bot, or the team you hired.
//
// The old cut ("gives you an answer, not options") was a weak USP: a chatbot
// gives answers too. The real difference, and the feeling we want, is that you
// are the CEO and you have HIRED PEOPLE. So the same question you'd ask a chatbot
// gets one hedged voice on the left, and on the right a ROOM of named specialists
// who each answer from their own field, in turn, and don't always agree. The 1
// bubble vs 3 experts contrast is the point: you're not chatting, you're running
// a team.
//
// FAIRNESS NOTE: the left answer is deliberately NOT a strawman. It's the
// reasonable, correct-but-unowned reply a good general assistant gives. The
// difference on the right is not intelligence, it's specialists who commit,
// name their lens, and argue. The page says the left column is illustrative.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import { Reveal, EASE } from "./primitives";

type Voice = { who: string; role: string; line: string };
type Q = { q: string; generic: string; team: Voice[] };

const QUESTIONS: Q[] = [
  {
    q: "How should we price this?",
    generic:
      "Pricing depends on your market. Common approaches are value-based, competitor-based and cost-plus. Survey customers and test a few tiers.",
    team: [
      { who: "Juhi", role: "Finance Analyst", line: "What's your net revenue retention? Under 100% and pricing isn't the problem, retention is." },
      { who: "Blake", role: "Business Strategist", line: "Price on the value they get, not your costs. What's a saved hour worth to them?" },
      { who: "Alex", role: "Product Manager", line: "Then it's a packaging call. What do we gate behind Pro, and what stays free?" },
    ],
  },
  {
    q: "Why are people churning?",
    generic:
      "Churn can come from onboarding friction, missing features, pricing or support. Survey churned users and analyse usage patterns.",
    team: [
      { who: "Rio", role: "Data Analyst", line: "Segment by cohort first. 'Churn' is three different problems hiding in one number." },
      { who: "Lumi", role: "UX Designer", line: "I'd watch five onboarding sessions before we theorise. Usually one screen asks for something they don't have yet." },
      { who: "Tess", role: "Customer Success", line: "Did they get the outcome they paid for, or just enjoy it? Pull every account that never hit its first milestone." },
    ],
  },
  {
    q: "Should we build this feature?",
    generic:
      "Weigh it against user demand, business impact and engineering effort. A prioritisation framework helps you compare roadmap items.",
    team: [
      { who: "Alex", role: "Product Manager", line: "Score it with RICE, honestly. Most teams write 100% confidence where they mean 'we hope'." },
      { who: "Jordan", role: "Technical Lead", line: "It saves two days now and costs two weeks in three months. And what does it displace?" },
      { who: "Cleo", role: "Product Designer", line: "What job is the user hiring it for? If we can't name it, we're guessing." },
    ],
  },
];

export function SectionCompare() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px -20% 0px" });
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const [revealed, setRevealed] = useState<boolean>(!!reduce);

  // rotate through the questions so the room is never still; hover holds one
  useEffect(() => {
    if (reduce || !inView || held) return;
    const id = setInterval(() => setI((v) => (v + 1) % QUESTIONS.length), 7000);
    return () => clearInterval(id);
  }, [inView, reduce, held]);

  // the team answers land a beat after the chatbot, so the contrast reads
  useEffect(() => {
    if (reduce) { setRevealed(true); return; }
    if (!inView) return;
    setRevealed(false);
    const t = setTimeout(() => setRevealed(true), 850);
    return () => clearTimeout(t);
  }, [i, inView, reduce]);

  const q = QUESTIONS[i];

  return (
    <section ref={ref} id="knowledge" className="lv3-bg-candle py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <span className="lv3-label lv3-t-blue">You're the CEO now</span>
          <h2 className="lv3-display lv3-t-navy mt-4 text-balance">
            One bot answers.{" "}
            <span className="lv3-serif-em">Your team weighs in.</span>
          </h2>
          <p className="lv3-t-soft mt-4 text-lg leading-relaxed">
            One voice pretends to be every expert. A team gives you the real ones.
          </p>
        </Reveal>

        {/* the CEO picks a question to put to the room */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="lv3-label lv3-t-soft-55 mr-1">You ask:</span>
          {QUESTIONS.map((x, idx) => {
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
          className="mt-3 grid overflow-hidden border md:grid-cols-[0.85fr_1.15fr]"
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => setHeld(false)}
        >
          {/* ── one bot ──────────────────────────────────────────── */}
          <div className="flex flex-col border-b p-7 sm:p-9 md:border-b-0 md:border-r" style={{ background: "#fbfbfe" }}>
            <div className="flex items-center gap-2.5">
              <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full border" style={{ color: "var(--lv3-soft-55)" }}>
                <Sparkles className="size-3.5" />
              </span>
              <span className="lv3-label lv3-t-soft-55">A chatbot</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={q.q}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="lv3-t-soft mt-5 text-[15px] leading-relaxed"
              >
                {q.generic}
              </motion.p>
            </AnimatePresence>
            <p className="lv3-label lv3-t-soft-55 mt-auto pt-6">one voice, wearing every hat</p>
          </div>

          {/* ── the team you hired ───────────────────────────────── */}
          <div className="flex flex-col p-7 sm:p-9">
            <div className="flex items-center gap-2.5">
              <span className="flex -space-x-1.5">
                {q.team.map((v) => (
                  <span key={v.who} className="rounded-full ring-2 ring-white">
                    <AgentAvatar characterName={v.who} role={v.role} size={22} />
                  </span>
                ))}
              </span>
              <span className="lv3-label lv3-t-blue">Your team</span>
            </div>

            <motion.div
              key={i}
              className="mt-5 flex flex-col gap-3"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.55 } } }}
              initial={reduce ? false : "hidden"}
              animate={revealed ? "show" : "hidden"}
            >
              {q.team.map((v) => (
                <motion.div
                  key={v.who}
                  className="flex items-start gap-2.5"
                  variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  transition={{ duration: 0.4, ease: EASE }}
                >
                  <AgentAvatar characterName={v.who} role={v.role} size={26} className="mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="lv3-t-navy text-[12.5px] font-semibold">
                      {v.who}
                      <span className="lv3-t-soft-55 font-normal"> · {v.role}</span>
                    </span>
                    <p className="lv3-t-ink mt-0.5 text-[14px] leading-snug">{v.line}</p>
                  </span>
                </motion.div>
              ))}
            </motion.div>

            <p className="lv3-label lv3-t-soft-55 mt-auto pt-6">each an expert, and they don't always agree</p>
          </div>
        </div>

        <p className="lv3-label lv3-t-soft-55 mt-4">
          Left column illustrative · right is how these roles actually answer
        </p>
      </div>
    </section>
  );
}

export default SectionCompare;
