// Landing v3 · Not a chatbot — one agreeable bot, or the real team.
//
// This is the two-panel animation the section has always used: a chatbot's reply
// on the left, the team of named specialists cascading in on the right a beat
// later, with pick-able chips, slow auto-rotation, and hover-to-hold. Only the
// framing changed, not the motion: it drops the "you're the CEO / they don't
// always agree" cut (which promised the visitor more to manage and a team that
// argues) for the honest difference, a chatbot agrees with you, the real
// specialists tell you the truth and take the work.
//
// FAIRNESS NOTE: the left reply is not a strawman. It's the eager, agreeable,
// surface-level answer a general assistant gives. The difference on the right is
// specialists who push back and commit. The page says the left column is
// illustrative.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import { Reveal, EASE } from "./primitives";

type Voice = { who: string; role: string; line: string };
type Scene = { say: string; bot: string; team: Voice[] };

const SCENES: Scene[] = [
  {
    say: "Let's put the calendar connect first, it'll boost activation.",
    bot: "Great instinct! Asking for calendar access early can drive engagement. Here's a rollout you could try...",
    team: [
      { who: "Sam", role: "QA Lead", line: "Three of five test users stalled right there. That's your drop-off, not a feature." },
      { who: "Alex", role: "Product Manager", line: "Activation lifts when the ask comes after first value, not before. Move it one step." },
      { who: "Cleo", role: "Product Designer", line: "I'll redraw the flow so value lands first, and put it in front of you to approve." },
    ],
  },
  {
    say: "We should raise prices 20% across the board.",
    bot: "Sure! A 20% lift can grow revenue. Just be sure to communicate the added value to customers...",
    team: [
      { who: "Juhi", role: "Finance Analyst", line: "What's your net revenue retention? Under 100% and pricing isn't the problem, retention is." },
      { who: "Blake", role: "Business Strategist", line: "Price on the value each tier gets, not a flat percent. Some can take more, some can't." },
      { who: "Alex", role: "Product Manager", line: "I'll model it tier by tier and bring you the packaging call." },
    ],
  },
  {
    say: "Let's launch on Product Hunt next week.",
    bot: "Exciting! Product Hunt is great for visibility. Line up your assets and rally the community...",
    team: [
      { who: "Kai", role: "Growth Marketer", line: "Launching to a cold audience burns your one shot. Warm a list first." },
      { who: "Wren", role: "Copywriter", line: "The tagline buries the hook. One promise, up top, in plain words." },
      { who: "Nova", role: "Marketing Specialist", line: "I'll build the two-week warm-up and the launch-day runbook." },
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

  // rotate through the scenes so the room is never still; hover holds one
  useEffect(() => {
    if (reduce || !inView || held) return;
    const id = setInterval(() => setI((v) => (v + 1) % SCENES.length), 7000);
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

  const scene = SCENES[i];

  return (
    <section ref={ref} id="knowledge" className="lv3-bg-candle py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <span className="lv3-label lv3-t-blue">Not a chatbot</span>
          <h2 className="lv3-display lv3-t-navy mt-4 text-balance">
            A chatbot agrees with you.{" "}
            <span className="lv3-serif-em">Your team gets to work.</span>
          </h2>
          <p className="lv3-t-soft mt-4 text-lg leading-relaxed">
            One bot plays every role. Your team is the real expert for each.
          </p>
        </Reveal>

        {/* you put something to the room */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="lv3-label lv3-t-soft-55 mr-1">You say:</span>
          {SCENES.map((s, idx) => {
            const on = idx === i;
            return (
              <button
                key={s.say}
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
                {s.say.length > 40 ? s.say.slice(0, 38) + "…" : s.say}
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
                key={scene.say}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="lv3-t-soft mt-5 text-[15px] leading-relaxed"
              >
                {scene.bot}
              </motion.p>
            </AnimatePresence>
            <p className="lv3-label lv3-t-soft-55 mt-auto pt-6">one voice, agrees with everything</p>
          </div>

          {/* ── the real team ────────────────────────────────────── */}
          <div className="flex flex-col p-7 sm:p-9">
            <div className="flex items-center gap-2.5">
              <span className="flex -space-x-1.5">
                {scene.team.map((v) => (
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
              {scene.team.map((v) => (
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

            <p className="lv3-label lv3-t-soft-55 mt-auto pt-6">real specialists, and they take it on</p>
          </div>
        </div>

        <p className="lv3-label lv3-t-soft-55 mt-4">
          The chatbot line is illustrative · the specialists answer the way these roles actually do
        </p>
      </div>
    </section>
  );
}

export default SectionCompare;
