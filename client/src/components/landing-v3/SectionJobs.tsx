// Landing v3 · Real jobs — one team, every kind of job.
//
// Repointed to BREADTH: the range of things you can hand this one team, and the
// finished work you get back. Six asks across very different domains, each
// landing a real deliverable led by the right specialist, plus the full roster.
//
// Six equal cards read as chaos, so the grid walks a spotlight: one card is lit
// at a time (the rest dimmed and still) on a slow cycle, and hovering any card
// holds it. Same calm, guided feel the rest of the page uses.
//
// The jobs are representative of how work moves through the product, not
// transcripts of one session, and the section says so at the bottom.

import { useEffect, useRef, useState } from "react";
import { ArrowRight, FileText, ShieldCheck } from "lucide-react";
import { motion, useInView, useReducedMotion } from "framer-motion";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import RosterGrid from "./RosterGrid";
import { Reveal, EASE, VIEWPORT } from "./primitives";

type Job = {
  ask: string;
  kind: string;
  title: string;
  by: string;
  role: string;
};

const JOBS: Job[] = [
  { ask: "60% of signups quit before they finish setup.", kind: "Product requirements", title: "Move the calendar ask after first value", by: "Alex", role: "Product Manager" },
  { ask: "We need a landing page for the new pricing, by Friday.", kind: "Landing page copy", title: "Positioned, written, cut to the bone", by: "Wren", role: "Copywriter" },
  { ask: "The client sent their contract. Can we sign it?", kind: "Review summary", title: "Three clauses to change before signing", by: "Ira", role: "Legal Counsel" },
  { ask: "The monthly investor update is due and I haven't started.", kind: "Investor update", title: "Numbers first, every claim checked", by: "Juhi", role: "Finance Analyst" },
  { ask: "How should we price the new tier?", kind: "Pricing model", title: "Value-based, with the math behind it", by: "Blake", role: "Business Strategist" },
  { ask: "We need a brand people actually remember.", kind: "Brand guide", title: "A position, not a mood", by: "Cass", role: "Brand Strategist" },
];

function JobCard({ job, lit, onTake, onRelease }: { job: Job; lit: boolean; onTake: () => void; onRelease: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      onMouseEnter={onTake}
      onMouseLeave={onRelease}
      className="flex cursor-default flex-col border bg-white p-5"
      initial={{ opacity: 0, y: 22 }}
      animate={
        seen
          ? {
              opacity: lit ? 1 : 0.5,
              y: 0,
              borderColor: lit ? "rgba(84,104,240,0.45)" : "var(--lv3-border)",
              boxShadow: lit ? "0 16px 42px rgba(20,24,47,0.12)" : "0 1px 0 rgba(20,24,47,0.03)",
            }
          : { opacity: 0, y: 22 }
      }
      transition={{ duration: 0.5, ease: EASE }}
    >
      <span className="lv3-label lv3-t-soft-55">You ask</span>
      <p className="lv3-t-navy mt-2 border p-3 text-[14px] leading-snug" style={{ background: "#f1f2f8" }}>
        &ldquo;{job.ask}&rdquo;
      </p>

      <div className="my-3 flex items-center gap-2">
        <span className="h-px flex-1" style={{ background: "var(--lv3-border)" }} />
        <span className="lv3-label lv3-t-soft-55 flex items-center gap-1">
          <ArrowRight className="size-3" /> you get
        </span>
        <span className="h-px flex-1" style={{ background: "var(--lv3-border)" }} />
      </div>

      <div className="flex flex-1 flex-col border p-3.5" style={{ borderColor: "rgba(84,104,240,0.28)", background: "rgba(84,104,240,0.04)" }}>
        <span className="lv3-label lv3-t-blue flex items-center gap-1.5">
          <FileText className="size-3.5" /> {job.kind}
        </span>
        <p className="lv3-t-navy mt-2 flex-1 text-[14px] font-semibold leading-snug">{job.title}</p>
        <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: "var(--lv3-border)" }}>
          <AgentAvatar characterName={job.by} role={job.role} size={22} state={lit ? "working" : "idle"} className="shrink-0" />
          <span className="lv3-t-soft-55 min-w-0 truncate text-[11px]">
            {job.by} · {job.role}
          </span>
          <span className="lv3-label lv3-t-soft-55 ml-auto flex shrink-0 items-center gap-1">
            <ShieldCheck className="size-3" /> reviewed
          </span>
        </div>
      </div>
    </motion.div>
  );
}

const DWELL_MS = 2500;

export function SectionJobs() {
  const reduce = useReducedMotion();
  const gridRef = useRef<HTMLDivElement>(null);
  const inView = useInView(gridRef, { margin: "-20% 0px -20% 0px" });
  const [i, setI] = useState(0);
  const [held, setHeld] = useState<number | null>(null);

  // rewind to the first card each time the grid is entered
  useEffect(() => {
    if (inView) setI(0);
  }, [inView]);

  // walk the spotlight while on screen and nothing is hovered
  useEffect(() => {
    if (reduce || !inView || held !== null) return;
    const id = setInterval(() => setI((v) => (v + 1) % JOBS.length), DWELL_MS);
    return () => clearInterval(id);
  }, [inView, reduce, held]);

  const lit = held ?? i;

  return (
    <section id="jobs" className="lv3-bg-paper px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-8 max-w-2xl">
          <span className="lv3-label lv3-t-blue">The range</span>
          <h2 className="lv3-display lv3-t-navy mt-4 text-balance">
            One team.{" "}
            <span className="lv3-serif-em">Every kind of job.</span>
          </h2>
          <p className="lv3-t-soft mt-4 text-lg leading-relaxed">
            Whatever the job, the right person picks it up and hands back finished work.
          </p>
        </Reveal>

        <div ref={gridRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {JOBS.map((j, idx) => (
            <JobCard
              key={j.title}
              job={j}
              lit={reduce ? true : idx === lit}
              onTake={() => setHeld(idx)}
              onRelease={() => setHeld(null)}
            />
          ))}
        </div>

        {/* the roster keeps its place: the whole team, on call */}
        <motion.div
          className="mt-3 border p-8 sm:p-10"
          style={{ borderColor: "var(--lv3-border)" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <RosterGrid />
        </motion.div>

        <p className="lv3-t-soft mt-6 text-[13.5px]">
          Every draft is read by a second teammate before it reaches you.{" "}
          <span className="lv3-t-soft-55">Jobs shown are representative.</span>
        </p>
      </div>
    </section>
  );
}

export default SectionJobs;
