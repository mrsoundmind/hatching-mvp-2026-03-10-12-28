// Landing v3 · How the work gets made — the review trail.
//
// The old proof section showed a finished document, which a chatbot can also
// produce, so it did not prove anything ("every chatbot can do this"). The real,
// un-fakeable difference is that the work is made by a TEAM that checks itself:
// one writes it, another reads it cold and sends it back, the first fixes it, and
// only then does it reach you. This section draws that relay, on a loop, next to
// the finished document, with the concrete gap the reviewer caught marked on it.
// No invented testimonials or user counts.

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, PenLine, RotateCcw, ShieldAlert } from "lucide-react";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import { CTA, Reveal, EASE, VIEWPORT } from "./primitives";

const GREEN = "#0F9D76";

type Step = {
  who: string | null;
  role?: string;
  act: string;
  note?: string;
  tone: string;
  icon: typeof PenLine;
};

// One task, passed hand to hand. Each stop lights up in turn, on a loop.
const RELAY: Step[] = [
  { who: "Alex", role: "Product Manager", act: "writes the first draft", tone: "var(--lv3-blue)", icon: PenLine },
  { who: "Sam", role: "QA Lead", act: "reads it cold, sends it back", note: "Caught: no plan for users who have no calendar.", tone: "var(--lv3-amber)", icon: ShieldAlert },
  { who: "Alex", role: "Product Manager", act: "adds the missing case", tone: "var(--lv3-blue)", icon: RotateCcw },
  { who: null, act: "reaches you, already checked", tone: GREEN, icon: Check },
];

const DOC: { title: string; sections: { h: string; b: string; added?: boolean }[] } = {
  title: "Move the calendar ask after first value",
  sections: [
    { h: "Problem", b: "60% of new users quit during setup. Most stall at the calendar step, which asks for access before they've seen any value." },
    { h: "Scope", b: "Move the calendar ask to after the first win. Not touching the dashboard." },
    { h: "Success", b: "Setup completion up 15 points. First value in under 3 minutes." },
    { h: "Edge cases", b: "Users with no calendar, revoked access, and re-onboarding.", added: true },
  ],
};

const STEP_MS = 1500;

function Relay({ reduce }: { reduce: boolean | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px -20% 0px" });
  const [step, setStep] = useState(reduce ? RELAY.length - 1 : 0);

  useEffect(() => {
    if (reduce || !inView) return;
    const id = setInterval(() => setStep((s) => (s >= RELAY.length - 1 ? 0 : s + 1)), STEP_MS);
    return () => clearInterval(id);
  }, [inView, reduce]);

  return (
    <div ref={ref} className="flex flex-col gap-2.5">
      {RELAY.map((s, i) => {
        const on = i <= step;
        const isNow = i === step;
        const Icon = s.icon;
        return (
          <motion.div
            key={i}
            className="flex items-start gap-3 border p-3"
            animate={{
              opacity: on ? 1 : 0.4,
              borderColor: isNow ? s.tone : "var(--lv3-border)",
              backgroundColor: isNow ? "#fbfbff" : "#fff",
            }}
            transition={{ duration: 0.3 }}
          >
            {s.who ? (
              <AgentAvatar characterName={s.who} role={s.role} size={30} state={isNow ? "working" : "idle"} className="shrink-0" />
            ) : (
              <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full" style={{ background: on ? GREEN : "var(--lv3-border)" }}>
                <Check className="size-4 text-white" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="lv3-t-navy block text-[13px] font-semibold leading-tight">
                {s.who ?? "It"}
                {s.who && s.role && <span className="lv3-t-soft-55 font-normal"> · {s.role}</span>}
              </span>
              <span className="lv3-t-soft block text-[12.5px] leading-snug">{s.act}</span>
              {s.note && (
                <span
                  className="lv3-t-navy mt-1.5 flex items-start gap-1.5 border px-2 py-1 text-[11.5px] leading-snug"
                  style={{ borderColor: "var(--lv3-amber-fill)", background: "rgba(242,180,65,0.08)" }}
                >
                  <ShieldAlert className="mt-0.5 size-3 shrink-0" style={{ color: "var(--lv3-amber)" }} />
                  {s.note}
                </span>
              )}
            </span>
            {s.who && <Icon className="mt-0.5 size-3.5 shrink-0" style={{ color: on ? s.tone : "var(--lv3-soft-55)" }} />}
          </motion.div>
        );
      })}
    </div>
  );
}

export function SectionProof() {
  const reduce = useReducedMotion();
  return (
    <section id="proof" className="lv3-bg-candle px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-9 max-w-2xl">
          <span className="lv3-label lv3-t-blue">How the work gets made</span>
          <h2 className="lv3-display lv3-t-navy mt-4 text-balance">
            Written by one.{" "}
            <span className="lv3-serif-em">Checked by another.</span>
          </h2>
          <p className="lv3-t-soft mt-4 text-lg leading-relaxed">
            A chatbot hands you its first try. Your team fixes it before you see it.
          </p>
        </Reveal>

        <div className="grid items-start gap-3 lg:grid-cols-[0.95fr_1.05fr]">
          {/* the review trail — the un-fakeable part */}
          <div>
            <span className="lv3-label lv3-t-soft-55 mb-2.5 block">The same task, passed hand to hand</span>
            <Relay reduce={reduce} />
          </div>

          {/* the finished document, with the reviewer's catch marked on it */}
          <motion.div
            className="overflow-hidden border bg-white"
            style={{ borderColor: "var(--lv3-border)", boxShadow: "0 24px 60px -34px rgba(20,24,47,0.4)" }}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="flex items-center gap-2 border-b px-5 py-3" style={{ borderColor: "var(--lv3-border)", background: "#fbfbfe" }}>
              <span className="lv3-label rounded px-1.5 py-0.5 text-white" style={{ background: "var(--lv3-blue)" }}>PRD</span>
              <span className="lv3-t-navy truncate text-[13.5px] font-semibold">{DOC.title}</span>
              <span className="lv3-label lv3-t-soft-55 ml-auto shrink-0">final</span>
            </div>
            <div className="flex flex-col gap-4 p-5 sm:p-6">
              {DOC.sections.map((s, i) => (
                <motion.div
                  key={s.h}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.4, ease: EASE, delay: 0.15 + i * 0.1 }}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="lv3-label lv3-t-blue">{s.h}</span>
                    {s.added && (
                      <span
                        className="lv3-label inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px]"
                        style={{ background: "rgba(242,180,65,0.14)", color: "var(--lv3-amber)" }}
                      >
                        added after Sam's review
                      </span>
                    )}
                  </span>
                  <p className="lv3-t-navy mt-1.5 text-[13.5px] leading-relaxed">{s.b}</p>
                </motion.div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t px-5 py-3" style={{ borderColor: "var(--lv3-border)", background: "rgba(15,157,118,0.05)" }}>
              <AgentAvatar characterName="Sam" role="QA Lead" size={22} className="shrink-0" />
              <span className="lv3-t-soft text-[11.5px]">Checked by Sam before it reached you</span>
              <span className="lv3-label lv3-t-soft-55 ml-auto">PDF · .md</span>
            </div>
          </motion.div>
        </div>

        <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="lv3-t-soft max-w-xl text-[14px] leading-relaxed">
            A chatbot gives you a first draft.{" "}
            <span className="lv3-t-navy font-medium">You get the fixed one.</span>
          </p>
          <CTA href="/login" variant="primary" className="shrink-0">
            Start free
            <ArrowRight className="ml-1.5 size-4" />
          </CTA>
        </div>

        <p className="lv3-label lv3-t-soft-55 mt-4">An example review trail · illustrative</p>
      </div>
    </section>
  );
}

export default SectionProof;
