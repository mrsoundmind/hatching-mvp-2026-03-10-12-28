// Landing v3 · Real jobs — one team, every kind of job.
//
// Repointed from the old "watch them argue on each job" cut, which re-showed the
// debate/pushback mechanic that the Overview (coordination) and Compare (experts
// weighing in) now own. This section's job is BREADTH: the range of things you
// can hand this one team, and the finished work you get back. Six asks across
// very different domains, each landing a real deliverable led by the right
// specialist, plus the full roster underneath.
//
// The jobs are representative of how work moves through the product, not
// transcripts of one session, and the section says so at the bottom.

import { ArrowRight, FileText, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

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

function JobCard({ job, i }: { job: Job; i: number }) {
  return (
    <motion.div
      className="flex flex-col border bg-white p-5 transition-shadow hover:shadow-[0_18px_44px_rgba(20,24,47,0.10)]"
      style={{ borderColor: "var(--lv3-border)" }}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.5, ease: EASE, delay: (i % 3) * 0.08 }}
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
          <AgentAvatar characterName={job.by} role={job.role} size={22} className="shrink-0" />
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

export function SectionJobs() {
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
            Hand them a product problem, a contract, a launch, a spreadsheet, a brand. The right
            specialist picks it up and you get finished work, not a chat you have to turn into work.
          </p>
        </Reveal>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {JOBS.map((j, i) => (
            <JobCard key={j.title} job={j} i={i} />
          ))}
        </div>

        {/* the roster keeps its place: every discipline you'd hire for */}
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
