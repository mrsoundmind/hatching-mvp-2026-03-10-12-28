// Landing v3 · 02 — Give them a real job.
//
// This replaces the old Proof section, which argued the wrong thing: it led
// with QA metrics (a 0% false-block rate, 4,107 corpus passages, a voice test)
// that prove the system works to someone who already believes it should exist.
// A founder asks what this does for them on Monday.
//
// So the section is now four real jobs. Pick one and it plays: what you say,
// who picks it up and what they push back with, and what lands in your hands.
// One section that carries autonomy, the team behaving like a team, and the
// expertise, without a single benchmark.
//
// The teammate lines are written in each role's own register, taken from their
// negativeHandling in shared/roleRegistry.ts. The jobs are representative of
// how work moves through the product, not transcripts of one recorded session,
// and the section says so at the bottom.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, FileText, ShieldCheck } from "lucide-react";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import RosterGrid from "./RosterGrid";
import { Reveal, EASE, VIEWPORT } from "./primitives";

type Beat = { name: string; role: string; line: string; kind: "picks" | "pushes" | "blocks" };

type Job = {
  tab: string;
  ask: string;
  beats: Beat[];
  deliverable: { kind: string; title: string; bullets: string[] };
};

const JOBS: Job[] = [
  {
    tab: "Fix onboarding",
    ask: "60% of signups quit before they finish setup.",
    beats: [
      { name: "Alex", role: "Product Manager", line: "Which step? Four screens is a different problem from one.", kind: "picks" },
      { name: "Lumi", role: "UX Designer", line: "Three of five stalled at the calendar ask.", kind: "pushes" },
      { name: "Sam", role: "QA Lead", line: "Three permission states are unverified. Not yet.", kind: "blocks" },
    ],
    deliverable: {
      kind: "Product requirements",
      title: "Move the calendar ask after first value",
      bullets: ["Scope, and what is out of it", "Three numbered success criteria", "The edge cases Sam forced in"],
    },
  },
  {
    tab: "Launch a page",
    ask: "We need a landing page for the new pricing by Friday.",
    beats: [
      { name: "Cass", role: "Brand Strategist", line: "What do we claim that a competitor cannot?", kind: "picks" },
      { name: "Wren", role: "Copywriter", line: "Every word you add weakens the rest. Cutting one.", kind: "pushes" },
      { name: "Zara", role: "Creative Director", line: "Swap in any brand and it still works. Rewrite.", kind: "blocks" },
    ],
    deliverable: {
      kind: "Landing page copy",
      title: "Pricing page, positioned and written",
      bullets: ["A position, not a mood", "Headline, subhead, three sections", "The safe draft Zara killed"],
    },
  },
  {
    tab: "Check a contract",
    ask: "The client sent their MSA. Can we sign it?",
    beats: [
      { name: "Ira", role: "Legal Counsel", line: "As written, they own what we build. That clause changes before we sign.", kind: "picks" },
      { name: "Juhi", role: "Finance Analyst", line: "Net 60, no late fee. Two months of runway.", kind: "pushes" },
      { name: "Blake", role: "Business Strategist", line: "Exclusivity locks out our next segment.", kind: "blocks" },
    ],
    deliverable: {
      kind: "Review summary",
      title: "Three clauses to change before signing",
      bullets: ["IP clause, quoted and rewritten", "Payment terms vs runway", "What to concede, what not to"],
    },
  },
  {
    tab: "Investor update",
    ask: "The monthly update is due and I have not started.",
    beats: [
      { name: "Juhi", role: "Finance Analyst", line: "Retention is under 100%. Lead with it.", kind: "picks" },
      { name: "Blake", role: "Business Strategist", line: "Fast in the wrong direction is still wrong.", kind: "pushes" },
      { name: "Alex", role: "Product Manager", line: "Two roadmap claims slipped last month.", kind: "blocks" },
    ],
    deliverable: {
      kind: "Investor update",
      title: "Monthly update, numbers first",
      bullets: ["The metric you would have buried", "Claims checked against what shipped", "One ask they can act on"],
    },
  },
];

const KIND_LABEL: Record<Beat["kind"], string> = {
  picks: "picks it up",
  pushes: "pushes back",
  blocks: "holds it",
};

const KIND_COLOR: Record<Beat["kind"], string> = {
  picks: "var(--lv3-blue)",
  pushes: "var(--lv3-purple)",
  blocks: "var(--lv3-amber)",
};

function JobStage({ job }: { job: Job }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px -15% 0px" });
  const reduce = useReducedMotion();
  // 0 asked · 1..3 each teammate weighs in · 4 the deliverable lands
  const [step, setStep] = useState(reduce ? 4 : 0);

  // restart whenever the job changes or the section comes back into view
  useEffect(() => {
    if (reduce) {
      setStep(4);
      return;
    }
    if (!inView) return;
    setStep(0);
    const id = setInterval(() => setStep((s) => (s >= 4 ? 4 : s + 1)), 1100);
    return () => clearInterval(id);
  }, [job.tab, inView, reduce]);

  return (
    <div ref={ref} className="grid lg:grid-cols-[1.15fr_1fr]">
      {/* ── what you say, and who answers ─────────────────────────── */}
      <div className="border-b p-7 sm:p-9 lg:border-b-0 lg:border-r">
        <span className="lv3-label lv3-t-soft-55">You say</span>
        <AnimatePresence mode="wait">
          <motion.p
            key={job.ask}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="lv3-t-navy mt-2 border p-3 text-[15px] leading-snug"
            style={{ background: "#f1f2f8" }}
          >
            &ldquo;{job.ask}&rdquo;
          </motion.p>
        </AnimatePresence>

        <span className="lv3-label lv3-t-soft-55 mt-6 block">Your team, while you are elsewhere</span>
        <ul className="mt-2 flex flex-col gap-2">
          {job.beats.map((b, i) => {
            const on = step >= i + 1;
            return (
              <motion.li
                key={`${job.tab}-${b.name}`}
                className="flex items-start gap-3 border bg-white p-3"
                style={{ borderColor: on ? KIND_COLOR[b.kind] : "var(--lv3-border)" }}
                initial={reduce ? { opacity: 1, x: 0 } : { opacity: 0.25, x: -6 }}
                animate={{ opacity: on ? 1 : 0.25, x: on ? 0 : -6 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <AgentAvatar
                  characterName={b.name}
                  role={b.role}
                  size={30}
                  state={step === i + 1 ? "working" : "idle"}
                  className="mt-0.5 shrink-0"
                />
                <span className="min-w-0">
                  <span className="lv3-t-navy block text-[12.5px] font-semibold leading-snug">
                    {b.name}
                    <span className="lv3-t-soft-55 font-normal"> · {b.role}</span>
                    <span className="lv3-label ml-2" style={{ color: KIND_COLOR[b.kind] }}>
                      {KIND_LABEL[b.kind]}
                    </span>
                  </span>
                  <span className="lv3-t-soft mt-0.5 block text-[13px] leading-snug">
                    &ldquo;{b.line}&rdquo;
                  </span>
                </span>
              </motion.li>
            );
          })}
        </ul>
      </div>

      {/* ── what lands in your hands ──────────────────────────────── */}
      <div className="flex flex-col p-7 sm:p-9">
        <span className="lv3-label lv3-t-soft-55">You get</span>
        <motion.div
          className="mt-2 flex flex-1 flex-col border bg-white p-5"
          initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0.25, y: 8 }}
          animate={{ opacity: step >= 4 ? 1 : 0.25, y: step >= 4 ? 0 : 8 }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          <div className="flex items-center gap-2">
            <FileText className="lv3-t-blue size-4" />
            <span className="lv3-label lv3-t-blue">{job.deliverable.kind}</span>
          </div>
          <p className="lv3-t-navy mt-3 text-[17px] font-semibold leading-snug">
            {job.deliverable.title}
          </p>
          <ul className="mt-4 flex-1 space-y-2">
            {job.deliverable.bullets.map((b) => (
              <li key={b} className="lv3-t-soft flex items-start gap-2 text-[13px] leading-snug">
                <ArrowRight className="lv3-t-blue mt-0.5 size-3.5 shrink-0" />
                {b}
              </li>
            ))}
          </ul>
          <div
            className="mt-4 inline-flex items-center gap-2 self-start border px-2.5 py-1.5"
            style={{ borderColor: "rgba(84,104,240,0.4)", background: "rgba(84,104,240,0.07)" }}
          >
            <ShieldCheck className="lv3-t-blue size-3.5" />
            <span className="lv3-label lv3-t-blue">Read by a second teammate first</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function SectionJobs() {
  const [i, setI] = useState(0);

  return (
    <section id="jobs" className="lv3-bg-paper px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-8 max-w-2xl">
          <span className="lv3-label lv3-t-blue">Try it on real work</span>
          <h2 className="lv3-display lv3-t-navy mt-4 text-balance">
            You ask. They argue.{" "}
            <span className="lv3-serif-em">You get the work.</span>
          </h2>
        </Reveal>

        {/* the job picker — obviously clickable, one selected at a time */}
        <div className="flex flex-wrap gap-2">
          {JOBS.map((j, idx) => {
            const on = idx === i;
            return (
              <button
                key={j.tab}
                type="button"
                data-job={idx}
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
                {j.tab}
              </button>
            );
          })}
        </div>

        <motion.div
          className="mt-3 overflow-hidden border"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <JobStage job={JOBS[i]} />
        </motion.div>

        {/* the roster keeps its place under the jobs */}
        <motion.div
          className="mt-2 border p-8 sm:p-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <RosterGrid />
        </motion.div>

        {/* the old metrics, demoted to one line of credibility */}
        <p className="lv3-t-soft mt-6 text-[13.5px]">
          Every draft is read by a second teammate before it reaches you.{" "}
          <span className="lv3-t-soft-55">
            Jobs shown are representative.
          </span>
        </p>
      </div>
    </section>
  );
}

export default SectionJobs;
