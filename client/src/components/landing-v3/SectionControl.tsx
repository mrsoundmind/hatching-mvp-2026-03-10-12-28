// Landing v3 · While you're away, and always in control.
//
// Merged section: the old "While you were away" night timeline and the old
// "You're in control" dial/approvals now live together, because they are two
// halves of one promise. Left: a night runs on its own while the tab is closed,
// work handed off and reviewed, one decision left waiting because it needed you.
// Right: the controls that make that safe, an autonomy dial you can move, an
// approval waiting for your yes, and a pause. The footer is the standing rule:
// nothing that spends money happens without you, even overnight.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Check, Moon, Pause, Sunrise, X } from "lucide-react";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import { Reveal, EASE } from "./primitives";

/* ─────────────────────────── While you were away ─────────────────────────── */

type NightKind = "you" | "work" | "handoff" | "review" | "waiting" | "done";
type Moment = { time: string; who: string | null; role?: string; label: string; kind: NightKind };

const NIGHT: Moment[] = [
  { time: "17:47", who: null, label: "“Go ahead, fix the onboarding drop.” Tab closed.", kind: "you" },
  { time: "18:10", who: "Alex", role: "Product Manager", label: "Scoped it, wrote success criteria.", kind: "work" },
  { time: "19:30", who: "Alex", role: "Product Manager", label: "Handed to Lumi for the new flow.", kind: "handoff" },
  { time: "21:40", who: "Sam", role: "QA Lead", label: "Read it cold, sent it back.", kind: "review" },
  { time: "06:20", who: "Kai", role: "Growth Marketer", label: "Wants $500. Waiting on you.", kind: "waiting" },
  { time: "09:02", who: null, label: "One document ready. One decision waiting.", kind: "done" },
];

const TONE: Record<NightKind, string> = {
  you: "var(--lv3-navy)",
  work: "var(--lv3-blue)",
  handoff: "var(--lv3-purple)",
  review: "var(--lv3-amber)",
  waiting: "var(--lv3-amber)",
  done: "var(--lv3-blue)",
};

function NightTimeline({ reduce }: { reduce: boolean | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px -20% 0px" });
  const [at, setAt] = useState(reduce ? NIGHT.length - 1 : 0);

  useEffect(() => {
    if (reduce || !inView) return;
    const id = setInterval(() => setAt((a) => (a >= NIGHT.length - 1 ? 0 : a + 1)), 1500);
    return () => clearInterval(id);
  }, [inView, reduce]);

  const now = NIGHT[at];
  const asleep = at > 0 && at < NIGHT.length - 1;

  return (
    <div ref={ref} className="flex h-full flex-col border bg-white p-5" style={{ borderColor: "var(--lv3-border)" }}>
      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--lv3-border)" }}>
        <span className="lv3-label lv3-t-soft-55 flex items-center gap-2">
          {asleep ? <Moon className="size-3.5" /> : <Sunrise className="size-3.5" />}
          {asleep ? "you're asleep" : at === 0 ? "you sign off" : "you're back"}
        </span>
        <span className="lv3-num lv3-t-navy text-[22px] leading-none tabular-nums" aria-live="polite">
          {now.time}
        </span>
      </div>

      <ol className="mt-3 flex flex-col gap-1.5">
        {NIGHT.map((m, i) => {
          const on = i <= at;
          const isNow = i === at;
          return (
            <li key={m.time}>
              <motion.div
                className="flex items-start gap-2.5 border p-2"
                animate={{
                  opacity: on ? 1 : 0.35,
                  borderColor: isNow ? TONE[m.kind] : "var(--lv3-border)",
                  backgroundColor: isNow ? "#fbfbff" : "#fff",
                }}
                transition={{ duration: 0.3 }}
              >
                <span
                  className="lv3-label w-[42px] shrink-0 pt-0.5 tabular-nums"
                  style={{ color: on ? "var(--lv3-navy)" : "var(--lv3-soft-55)" }}
                >
                  {m.time}
                </span>
                {m.who ? (
                  <AgentAvatar characterName={m.who} role={m.role} size={22} state={isNow ? "working" : "idle"} className="mt-0.5 shrink-0" />
                ) : (
                  <span
                    className="mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full text-[9px] text-white"
                    style={{ background: "var(--lv3-navy)", fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Y
                  </span>
                )}
                <span className="lv3-t-soft min-w-0 flex-1 text-[12px] leading-snug">{m.label}</span>
              </motion.div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ─────────────────────────────── You set how far ─────────────────────────── */

const LEVELS = [
  { name: "Observe", desc: "They watch and suggest. They never act on their own." },
  { name: "Propose", desc: "They draft the actions. You pick which ones happen." },
  { name: "Confirm", desc: "They act, but check anything risky with you first." },
  { name: "Autonomous", desc: "They run the work. Only spending waits for your yes." },
];

function AutonomyDial({ reduce }: { reduce: boolean | null }) {
  const [level, setLevel] = useState(2); // default "Confirm"
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (reduce || held) return;
    const id = setInterval(() => setLevel((l) => (l + 1) % LEVELS.length), 2200);
    return () => clearInterval(id);
  }, [reduce, held]);

  return (
    <div className="flex h-full flex-col">
      <span className="lv3-label lv3-t-soft-55 mb-3">How much they can do on their own</span>

      <div className="relative flex rounded-full border p-1" style={{ borderColor: "var(--lv3-border)", background: "#fbfbfe" }}>
        <motion.div
          className="absolute bottom-1 top-1 rounded-full"
          style={{ background: "var(--lv3-navy)", width: `calc(${100 / LEVELS.length}% - 4px)` }}
          animate={{ left: `calc(${(level * 100) / LEVELS.length}% + 2px)` }}
          transition={{ duration: 0.45, ease: EASE }}
        />
        {LEVELS.map((l, i) => (
          <button
            key={l.name}
            type="button"
            onClick={() => { setLevel(i); setHeld(true); }}
            aria-pressed={i === level}
            className="relative z-10 flex-1 rounded-full px-1 py-2 text-[10px] font-semibold leading-tight transition-colors focus-visible:outline-none sm:text-[12.5px]"
            style={{ color: i === level ? "#fff" : "var(--lv3-soft)" }}
          >
            {l.name}
          </button>
        ))}
      </div>

      <div className="mt-4 flex min-h-[52px] items-start gap-2.5 border p-3" style={{ borderColor: "var(--lv3-border)", background: "#fff" }}>
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: "var(--lv3-blue)" }}>
          {level + 1}
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={level}
            className="lv3-t-navy text-[13.5px] leading-snug"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            <b className="font-semibold">{LEVELS[level].name}.</b> {LEVELS[level].desc}
          </motion.span>
        </AnimatePresence>
      </div>

      <span className="lv3-t-soft-55 mt-3 text-[12px] leading-snug">
        Move it any time. Up when you trust them, down when the stakes are high.
      </span>
    </div>
  );
}

function ApprovalCard({ reduce }: { reduce: boolean | null }) {
  const [state, setState] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setState((s) => (s + 1) % 2), 2600);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div className="flex flex-col gap-3 border p-4" style={{ borderColor: state === 1 ? "rgba(15,157,118,0.35)" : "var(--lv3-amber-fill)", background: state === 1 ? "rgba(15,157,118,0.05)" : "rgba(242,180,65,0.06)" }}>
      <div className="flex items-center gap-2.5">
        <AgentAvatar characterName="Kai" role="Growth Marketer" size={30} state={state === 0 ? "working" : "idle"} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="lv3-t-navy block text-[12.5px] font-semibold leading-tight">Kai wants to spend $500</span>
          <span className="lv3-t-soft block text-[11px] leading-tight">on an ad test before Friday</span>
        </span>
        <AnimatePresence mode="wait">
          {state === 0 ? (
            <motion.span
              key="wait"
              className="lv3-label inline-flex items-center gap-1.5 text-[9px]"
              style={{ color: "var(--lv3-amber)" }}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <span className="relative flex size-1.5">
                {!reduce && <span className="absolute inline-flex size-1.5 animate-ping rounded-full" style={{ background: "var(--lv3-amber-fill)" }} />}
                <span className="relative inline-flex size-1.5 rounded-full" style={{ background: "var(--lv3-amber-fill)" }} />
              </span>
              waiting for you
            </motion.span>
          ) : (
            <motion.span
              key="done"
              className="lv3-label inline-flex items-center gap-1 text-[9px]"
              style={{ color: "#0F9D76" }}
              initial={reduce ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Check className="size-3" /> approved
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="flex gap-2">
        <motion.span
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[12.5px] font-semibold text-white"
          style={{ background: "var(--lv3-blue)" }}
          animate={reduce ? {} : { scale: state === 0 ? [1, 1.03, 1] : 1 }}
          transition={{ duration: 1.6, repeat: state === 0 ? Infinity : 0, ease: "easeInOut" }}
        >
          <Check className="size-3.5" /> Approve
        </motion.span>
        <span className="flex flex-1 items-center justify-center gap-1.5 rounded-md border py-2 text-[12.5px] font-semibold" style={{ borderColor: "var(--lv3-border)", color: "var(--lv3-soft)" }}>
          <X className="size-3.5" /> Reject
        </span>
      </div>
    </div>
  );
}

export function SectionControl() {
  const reduce = useReducedMotion();
  return (
    <section id="control" className="lv3-bg-candle px-5 py-14 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-6 max-w-2xl sm:mb-10">
          <span className="lv3-label lv3-t-blue">While you're away</span>
          <h2 className="lv3-display lv3-t-navy mt-4 text-balance">
            They work while away.{" "}
            <span className="lv3-serif-em">You set how far.</span>
          </h2>
          <p className="lv3-t-soft mt-4 text-lg leading-relaxed">
            They keep working. Nothing risky happens without you.
          </p>
        </Reveal>

        <div className="grid gap-3 lg:grid-cols-2">
          {/* while you were away */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <NightTimeline reduce={reduce} />
          </motion.div>

          {/* you set how far */}
          <motion.div
            className="flex flex-col gap-3"
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
          >
            <div className="border bg-white p-6" style={{ borderColor: "var(--lv3-border)" }}>
              <AutonomyDial reduce={reduce} />
            </div>
            <ApprovalCard reduce={reduce} />
            <div className="flex items-center gap-3 border bg-white p-4" style={{ borderColor: "var(--lv3-border)" }}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md" style={{ background: "rgba(20,24,47,0.05)" }}>
                <Pause className="lv3-t-navy size-4" />
              </span>
              <span className="min-w-0">
                <span className="lv3-t-navy block text-[13px] font-semibold leading-tight">Pause the whole team</span>
                <span className="lv3-t-soft-55 block text-[11px] leading-tight">One click, everything stops.</span>
              </span>
            </div>
          </motion.div>
        </div>

        <p className="lv3-t-soft mt-6 text-[13.5px] leading-relaxed">
          Even overnight, anything that spends money waits for you.{" "}
          <span className="lv3-t-soft-55">You come back to a decision, never a surprise.</span>
        </p>
      </div>
    </section>
  );
}

export default SectionControl;
