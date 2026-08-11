// Landing v3 · Not a chatbot — a living team.
//
// The "why not just use ChatGPT?" beat. The old cut framed it as "you're the CEO,
// your team weighs in / they don't always agree", which fought the whole page:
// it promised the visitor MORE to manage and a team that argues, when the product
// promises relief and finished work.
//
// This reframes it as one alive conversation that answers the objection three
// ways at once: you say something, a chatbot cheerfully agrees, and then the team
// comes in one specialist at a time, each typing then speaking, showing the three
// things a single bot can't do:
//   · the honest read  (it tells you the truth instead of flattering you)
//   · the expert detail (a real specialist, not one model faking every role)
//   · takes it on       (someone actually handles the work)
// It plays on a loop, one message at a time, so it reads as a team talking. Pick a
// different thing to say with the chips; hovering pauses it.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import { Reveal, EASE } from "./primitives";

type Tone = "truth" | "depth" | "do";
type Turn = { who: string; role: string; tag: string; tone: Tone; line: string };
type Scene = { ask: string; bot: string; team: Turn[] };

const TONE: Record<Tone, { color: string; bg: string }> = {
  truth: { color: "var(--lv3-amber)", bg: "rgba(242,180,65,0.14)" },
  depth: { color: "var(--lv3-blue)", bg: "rgba(66,87,232,0.10)" },
  do: { color: "#0F9D76", bg: "rgba(15,157,118,0.12)" },
};

const SCENES: Scene[] = [
  {
    ask: "Let's put the calendar connect first, it'll boost activation.",
    bot: "Great instinct! Asking for calendar access early can drive engagement. Here's a rollout you could try…",
    team: [
      { who: "Sam", role: "QA Lead", tag: "the honest read", tone: "truth", line: "Three of five test users stalled right there. That's your drop-off, not a feature." },
      { who: "Alex", role: "Product Manager", tag: "the expert detail", tone: "depth", line: "Activation lifts when the ask comes after first value, not before. Move it one step." },
      { who: "Cleo", role: "Product Designer", tag: "takes it on", tone: "do", line: "I'll redraw the flow so value lands first, and put it in front of you to approve." },
    ],
  },
  {
    ask: "We should raise prices 20% across the board.",
    bot: "Sure! A 20% lift can grow revenue. Just be sure to communicate the added value to customers…",
    team: [
      { who: "Juhi", role: "Finance Analyst", tag: "the honest read", tone: "truth", line: "What's your net revenue retention? Under 100% and pricing isn't the problem, retention is." },
      { who: "Blake", role: "Business Strategist", tag: "the expert detail", tone: "depth", line: "Price on the value each tier gets, not a flat percent. Some can take more, some can't." },
      { who: "Alex", role: "Product Manager", tag: "takes it on", tone: "do", line: "I'll model it tier by tier and bring you the packaging call." },
    ],
  },
  {
    ask: "Let's launch on Product Hunt next week.",
    bot: "Exciting! Product Hunt is great for visibility. Line up your assets and rally the community…",
    team: [
      { who: "Kai", role: "Growth Marketer", tag: "the honest read", tone: "truth", line: "Launching to a cold audience burns your one shot. Warm a list first." },
      { who: "Wren", role: "Copywriter", tag: "the expert detail", tone: "depth", line: "The tagline buries the hook. One promise, up top, in plain words." },
      { who: "Nova", role: "Marketing Specialist", tag: "takes it on", tone: "do", line: "I'll build the two-week warm-up and the launch-day runbook." },
    ],
  },
];

const TURNS_PER_SCENE = 4; // 1 chatbot + 3 specialists
const HOLD = 3; // extra ticks to read the finished thread
const CYCLE = TURNS_PER_SCENE + HOLD;
const TICK_MS = 1150;

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 border bg-white px-3 py-2.5" style={{ borderColor: "var(--lv3-border)" }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full"
          style={{ background: "var(--lv3-soft-55)" }}
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

function BotRow({ line }: { line: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-[30px] shrink-0 items-center justify-center rounded-full border" style={{ color: "var(--lv3-soft-55)", borderColor: "var(--lv3-border)" }}>
        <Sparkles className="size-3.5" />
      </span>
      <div className="min-w-0 border p-3" style={{ borderColor: "var(--lv3-border)", background: "#fbfbfe" }}>
        <span className="lv3-label lv3-t-soft-55">A chatbot</span>
        <p className="lv3-t-soft mt-1 text-[13.5px] leading-snug">{line}</p>
      </div>
    </div>
  );
}

function ExpertRow({ t }: { t: Turn }) {
  const tone = TONE[t.tone];
  return (
    <div className="flex items-start gap-2.5">
      <AgentAvatar characterName={t.who} role={t.role} size={30} state="working" className="mt-0.5 shrink-0" />
      <div className="min-w-0 border bg-white p-3" style={{ borderColor: "var(--lv3-border)" }}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="lv3-t-navy text-[12.5px] font-semibold">
            {t.who}
            <span className="lv3-t-soft-55 font-normal"> · {t.role}</span>
          </span>
          <span className="lv3-label rounded px-1.5 py-0.5 text-[8px]" style={{ color: tone.color, background: tone.bg }}>
            {t.tag}
          </span>
        </div>
        <p className="lv3-t-ink mt-1 text-[13.5px] leading-snug">{t.line}</p>
      </div>
    </div>
  );
}

export function SectionCompare() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px -20% 0px" });
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (reduce || held || !inView) return;
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, [reduce, held, inView]);

  const sceneIndex = reduce ? tick % SCENES.length : Math.floor(tick / CYCLE) % SCENES.length;
  const scene = SCENES[sceneIndex];
  // turn 0 is the chatbot, turns 1-3 are the specialists
  const turns = [{ kind: "bot" as const }, ...scene.team.map((t) => ({ kind: "expert" as const, t }))];
  const phase = tick % CYCLE;
  const revealed = reduce ? turns.length : Math.min(phase, turns.length);

  return (
    <section ref={ref} id="knowledge" className="lv3-bg-candle py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="mb-8 max-w-2xl">
          <span className="lv3-label lv3-t-blue">Not a chatbot</span>
          <h2 className="lv3-display lv3-t-navy mt-4 text-balance">
            A chatbot agrees with you.{" "}
            <span className="lv3-serif-em">Your team gets to work.</span>
          </h2>
          <p className="lv3-t-soft mt-4 text-lg leading-relaxed">
            One bot plays every role. Your team is the real expert for each.
          </p>
        </Reveal>

        {/* pick what you say */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="lv3-label lv3-t-soft-55 mr-1">You say:</span>
          {SCENES.map((s, idx) => {
            const on = idx === sceneIndex;
            return (
              <button
                key={s.ask}
                type="button"
                onClick={() => setTick(idx * CYCLE)}
                aria-pressed={on}
                className="cursor-pointer border px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  ["--tw-ring-color" as string]: "var(--lv3-blue)",
                  borderColor: on ? "var(--lv3-navy)" : "var(--lv3-border)",
                  background: on ? "var(--lv3-navy)" : "#fff",
                  color: on ? "#fff" : "var(--lv3-soft)",
                }}
              >
                {s.ask.length > 42 ? s.ask.slice(0, 40) + "…" : s.ask}
              </button>
            );
          })}
        </div>

        {/* the living conversation */}
        <div
          className="mx-auto max-w-2xl border bg-white p-5 sm:p-7"
          style={{ borderColor: "var(--lv3-border)", boxShadow: "0 20px 50px -34px rgba(20,24,47,0.35)" }}
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => setHeld(false)}
        >
          {/* what you said */}
          <div className="border-2 p-3.5" style={{ borderColor: "var(--lv3-navy)", background: "#fff" }}>
            <span className="lv3-label lv3-t-soft-55">You say</span>
            <p className="lv3-t-navy mt-1 text-[15px] font-semibold leading-snug">&ldquo;{scene.ask}&rdquo;</p>
          </div>

          <div className="my-3 flex items-center gap-2">
            <span className="h-px flex-1" style={{ background: "var(--lv3-border)" }} />
            <span className="lv3-label lv3-t-soft-55">the room answers</span>
            <span className="h-px flex-1" style={{ background: "var(--lv3-border)" }} />
          </div>

          {/* reserve height so the card does not jump as messages arrive */}
          <div className="flex min-h-[320px] flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {turns.slice(0, revealed).map((turn, i) => (
                <motion.div
                  key={`${sceneIndex}-${i}`}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  {turn.kind === "bot" ? <BotRow line={scene.bot} /> : <ExpertRow t={turn.t} />}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* whoever is about to speak, typing */}
            {!reduce && revealed < turns.length && (
              <motion.div
                key={`typing-${sceneIndex}-${revealed}`}
                className="flex items-center gap-2.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {turns[revealed].kind === "bot" ? (
                  <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full border" style={{ color: "var(--lv3-soft-55)", borderColor: "var(--lv3-border)" }}>
                    <Sparkles className="size-3.5" />
                  </span>
                ) : (
                  <AgentAvatar
                    characterName={(turns[revealed] as { t: Turn }).t.who}
                    role={(turns[revealed] as { t: Turn }).t.role}
                    size={30}
                    state="working"
                    className="shrink-0"
                  />
                )}
                <TypingDots />
              </motion.div>
            )}
          </div>
        </div>

        <p className="lv3-label lv3-t-soft-55 mx-auto mt-4 max-w-2xl">
          The chatbot line is illustrative · the specialists answer the way these roles actually do
        </p>
      </div>
    </section>
  );
}

export default SectionCompare;
