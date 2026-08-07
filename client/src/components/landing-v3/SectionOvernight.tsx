// Landing v3 · 03 — While you were away.
//
// Replaces the old "Talk / Delegate / Ship" stepper, which described the
// product in three abstract nouns that are equally true of Slack or Asana.
// Nobody realises anything from reading "runs in the background".
//
// So this runs a night instead. You say go ahead at 17:47, close the tab, and
// the clock moves: work gets picked up, handed off, sent back by a reviewer,
// fixed, and one decision is left waiting because it needed you. At 09:02 you
// come back to a briefing. The realisation the section is after is the gap
// between the two times, not a sentence claiming there is one.
//
// It plays on its own and any moment on the timeline can be clicked to jump.

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Moon, Pause, Play, ShieldCheck, Sunrise } from "lucide-react";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import { Reveal } from "./primitives";

type Moment = {
  time: string;
  who: string | null;
  role?: string;
  label: string;
  kind: "you" | "work" | "handoff" | "review" | "waiting" | "done";
};

const NIGHT: Moment[] = [
  { time: "17:47", who: null, label: "“Go ahead, fix the onboarding drop.” Tab closed.", kind: "you" },
  { time: "18:10", who: "Alex", role: "Product Manager", label: "Scoped it. Wrote success criteria.", kind: "work" },
  { time: "19:30", who: "Alex", role: "Product Manager", label: "Handed to Lumi for the new flow.", kind: "handoff" },
  { time: "21:15", who: "Lumi", role: "UX Designer", label: "Redrew screens one to three.", kind: "work" },
  { time: "21:40", who: "Sam", role: "QA Lead", label: "Read it cold. Sent it back.", kind: "review" },
  { time: "23:05", who: "Lumi", role: "UX Designer", label: "Added the missing states. Passed.", kind: "work" },
  { time: "06:20", who: "Kai", role: "Growth Marketer", label: "Wants $500. Waiting on you.", kind: "waiting" },
  { time: "09:02", who: null, label: "One document ready. One decision waiting.", kind: "done" },
];

const TONE: Record<Moment["kind"], string> = {
  you: "var(--lv3-navy)",
  work: "var(--lv3-blue)",
  handoff: "var(--lv3-purple)",
  review: "var(--lv3-amber)",
  waiting: "var(--lv3-amber)",
  done: "var(--lv3-blue)",
};

const STEP_MS = 1500;

export function SectionOvernight() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px -20% 0px" });
  const reduce = useReducedMotion();
  const [at, setAt] = useState(reduce ? NIGHT.length - 1 : 0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || !inView || paused) return;
    const id = setInterval(() => {
      setAt((a) => (a >= NIGHT.length - 1 ? 0 : a + 1));
    }, STEP_MS);
    return () => clearInterval(id);
  }, [inView, reduce, paused]);

  const now = NIGHT[at];
  const asleep = at > 0 && at < NIGHT.length - 1;

  return (
    <section ref={ref} id="how-it-works" className="lv3-bg-candle py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <span className="lv3-label lv3-t-blue">While you were away</span>
          <h2 className="lv3-display lv3-t-navy mt-4">
            You close the tab. <span className="lv3-serif-em">They keep going.</span>
          </h2>
        </Reveal>

        <div className="mt-10 grid overflow-hidden border bg-white lg:grid-cols-[260px_1fr]">
          {/* ── the clock ─────────────────────────────────────────── */}
          <div className="flex flex-col justify-between border-b p-7 lg:border-b-0 lg:border-r" style={{ background: "#fbfbfe" }}>
            <div>
              <span className="lv3-label lv3-t-soft-55 flex items-center gap-2">
                {asleep ? <Moon className="size-3.5" /> : <Sunrise className="size-3.5" />}
                {asleep ? "you are asleep" : at === 0 ? "you sign off" : "you are back"}
              </span>
              <p
                className="lv3-num lv3-t-navy mt-3 text-[3.4rem] leading-none tabular-nums"
                aria-live="polite"
              >
                {now.time}
              </p>
              <p className="lv3-t-soft mt-3 text-[13.5px] leading-snug">
                {at === NIGHT.length - 1
                  ? "Fifteen hours you were not here for."
                  : "They do not wait for you."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-pressed={paused}
              className="lv3-label lv3-t-navy mt-6 inline-flex w-fit cursor-pointer items-center gap-2 border bg-white px-3 py-1.5 transition-colors hover:bg-[#f1f2f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ ["--tw-ring-color" as string]: "var(--lv3-blue)" }}
            >
              {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
              {paused ? "Paused" : "Playing the night"}
            </button>
          </div>

          {/* ── the night ─────────────────────────────────────────── */}
          <ol className="relative p-7 sm:p-9">
            <span
              aria-hidden
              className="absolute bottom-10 left-[calc(1.75rem+52px)] top-10 w-px sm:left-[calc(2.25rem+52px)]"
              style={{ background: "var(--lv3-border)" }}
            />
            {NIGHT.map((m, i) => {
              const on = i <= at;
              const isNow = i === at;
              return (
                <li key={m.time}>
                  <button
                    type="button"
                    data-moment={i}
                    onClick={() => setAt(i)}
                    aria-current={isNow ? "true" : undefined}
                    className="flex w-full cursor-pointer items-start gap-4 rounded-md py-1.5 text-left transition-colors hover:bg-[#f6f7fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{ ["--tw-ring-color" as string]: "var(--lv3-blue)" }}
                  >
                    <span
                      className="lv3-label w-[52px] shrink-0 pt-2 tabular-nums transition-colors"
                      style={{ color: on ? "var(--lv3-navy)" : "var(--lv3-soft-55)" }}
                    >
                      {m.time}
                    </span>

                    <span className="relative flex w-4 shrink-0 justify-center pt-2.5">
                      <motion.span
                        className="size-2.5 rounded-full border-2 bg-white"
                        animate={{
                          borderColor: on ? TONE[m.kind] : "var(--lv3-border)",
                          backgroundColor: on ? TONE[m.kind] : "#fff",
                          scale: isNow ? 1.5 : 1,
                        }}
                        transition={{ duration: 0.3 }}
                      />
                    </span>

                    <motion.span
                      className="flex min-w-0 flex-1 items-start gap-2.5 border p-2.5"
                      animate={{
                        opacity: on ? 1 : 0.3,
                        borderColor: isNow ? TONE[m.kind] : "var(--lv3-border)",
                        backgroundColor: isNow ? "#fbfbff" : "#fff",
                      }}
                      transition={{ duration: 0.3 }}
                    >
                      {m.who ? (
                        <AgentAvatar
                          characterName={m.who}
                          role={m.role}
                          size={26}
                          state={isNow ? "working" : "idle"}
                          className="mt-0.5 shrink-0"
                        />
                      ) : (
                        <span
                          className="mt-0.5 flex size-[26px] shrink-0 items-center justify-center rounded-full text-[10px] text-white"
                          style={{ background: "var(--lv3-navy)", fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          Y
                        </span>
                      )}
                      <span className="min-w-0">
                        {m.who && (
                          <span className="lv3-t-navy block text-[12px] font-semibold leading-snug">
                            {m.who}
                            <span className="lv3-t-soft-55 font-normal"> · {m.role}</span>
                          </span>
                        )}
                        <span className="lv3-t-soft block text-[13px] leading-snug">{m.label}</span>
                      </span>
                      {m.kind === "handoff" && <ArrowRight className="mt-1 size-3.5 shrink-0" style={{ color: TONE[m.kind] }} />}
                      {m.kind === "review" && <ShieldCheck className="mt-1 size-3.5 shrink-0" style={{ color: TONE[m.kind] }} />}
                      {m.kind === "done" && <Check className="mt-1 size-3.5 shrink-0" style={{ color: TONE[m.kind] }} />}
                    </motion.span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="lv3-label lv3-t-soft-55 mt-4">
          Anything that spends money waits for you
        </p>
      </div>
    </section>
  );
}

export default SectionOvernight;
