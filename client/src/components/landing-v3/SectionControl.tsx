// Landing v3 · You're always in control.
//
// The page sells autonomous teammates; this is the section that answers the fear
// that comes with that, "what if they go do something dumb?" It is the trust
// pillar the page was missing. Three concrete controls, drawn:
//   1. an autonomy dial you can move (Observe → Propose → Confirm → Autonomous),
//      each level explained in one line;
//   2. an approval card, the moment a risky action waits for your yes;
//   3. a pause, and the standing rule that anything that spends money or ships
//      outward waits for you, even overnight.
//
// It pairs with the Overnight section right before it: they keep going, but you
// set how far, and nothing that costs money happens without you.

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Pause, X } from "lucide-react";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import { Reveal, EASE } from "./primitives";

const LEVELS = [
  { name: "Observe", desc: "They watch and suggest. They never act on their own." },
  { name: "Propose", desc: "They draft the actions. You pick which ones happen." },
  { name: "Confirm", desc: "They act, but check anything risky with you first." },
  { name: "Autonomous", desc: "They run the work. Only spending waits for your yes." },
];

function AutonomyDial({ reduce }: { reduce: boolean | null }) {
  const [level, setLevel] = useState(2); // default "Confirm"
  const [held, setHeld] = useState(false);

  // slowly walk the dial so the spectrum is legible, until the visitor grabs it
  useEffect(() => {
    if (reduce || held) return;
    const id = setInterval(() => setLevel((l) => (l + 1) % LEVELS.length), 2200);
    return () => clearInterval(id);
  }, [reduce, held]);

  return (
    <div className="flex h-full flex-col">
      <span className="lv3-label lv3-t-soft-55 mb-3">How much they can do on their own</span>

      {/* the dial: four stops, the active one filled, a thumb that slides */}
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
            className="relative z-10 flex-1 rounded-full py-2 text-[12.5px] font-semibold transition-colors focus-visible:outline-none"
            style={{ color: i === level ? "#fff" : "var(--lv3-soft)" }}
          >
            {l.name}
          </button>
        ))}
      </div>

      {/* the meaning of the current level */}
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
        Move it any time. Dial it up when you trust them, down when the stakes are high.
      </span>
    </div>
  );
}

function ApprovalCard({ reduce }: { reduce: boolean | null }) {
  // 0 waiting · 1 approved, on a gentle loop so the moment reads as live
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
    <section id="control" className="lv3-bg-paper px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-10 max-w-2xl">
          <span className="lv3-label lv3-t-blue">You're always in control</span>
          <h2 className="lv3-display lv3-t-navy mt-4 text-balance">
            They move fast.{" "}
            <span className="lv3-serif-em">You set how far.</span>
          </h2>
          <p className="lv3-t-soft mt-4 text-lg leading-relaxed">
            Autonomy with a brake pedal. Choose how much they can do on their own, approve anything
            risky, and stop the whole team in one click. Nothing that spends money or ships outward
            happens without your yes.
          </p>
        </Reveal>

        <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
          {/* the dial */}
          <motion.div
            className="border bg-white p-6"
            style={{ borderColor: "var(--lv3-border)" }}
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <AutonomyDial reduce={reduce} />
          </motion.div>

          {/* approvals + pause */}
          <motion.div
            className="flex flex-col gap-3"
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
          >
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
          Even overnight, anything that spends money or leaves the project waits for you.{" "}
          <span className="lv3-t-soft-55">You come back to a decision, never a surprise.</span>
        </p>
      </div>
    </section>
  );
}

export default SectionControl;
