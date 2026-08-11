// Landing v3 · Real jobs — one team, every kind of job.
//
// The range of things you can hand this one team. Presented as an auto-scrolling
// carousel: richer ask -> deliverable cards drift past continuously, several in
// view at once, so the breadth reads as a living feed of work rather than a
// static grid. Each card shows the ask, the real deliverable (type, title, and a
// couple of concrete lines), and the specialist who made it, reviewed. Hovering
// pauses the drift so a card can be read; the edges fade so cards enter and leave
// cleanly. Reduced-motion gets a plain horizontal scroll instead.
//
// The jobs are representative of how work moves through the product, not
// transcripts of one session, and the section says so at the bottom.

import { useRef } from "react";
import { ArrowRight, Check, FileText, ShieldCheck } from "lucide-react";
import { motion, useAnimationFrame, useMotionValue, useReducedMotion } from "framer-motion";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import RosterGrid from "./RosterGrid";
import { Reveal, EASE, VIEWPORT } from "./primitives";

type Job = {
  ask: string;
  kind: string;
  title: string;
  details: string[];
  by: string;
  role: string;
};

const JOBS: Job[] = [
  { ask: "60% of signups quit before they finish setup.", kind: "Product requirements", title: "Move the calendar ask after first value", details: ["They drop at calendar-connect", "Setup +15pp, value in under 3 min"], by: "Alex", role: "Product Manager" },
  { ask: "We need a landing page for the new pricing, by Friday.", kind: "Landing page copy", title: "Positioned, written, cut to the bone", details: ["One promise, three proofs", "Every line earns its place"], by: "Wren", role: "Copywriter" },
  { ask: "The client sent their contract. Can we sign it?", kind: "Review summary", title: "Three clauses to change first", details: ["IP assignment reversed to us", "Liability capped, 30-day exit added"], by: "Ira", role: "Legal Counsel" },
  { ask: "The investor update is due and I haven't started.", kind: "Investor update", title: "Numbers first, every claim checked", details: ["MRR, burn and runway up top", "One honest risk called out"], by: "Juhi", role: "Finance Analyst" },
  { ask: "How should we price the new tier?", kind: "Pricing model", title: "Value-based, with the math behind it", details: ["Priced on the hours it saves", "Rule of 40 sanity check"], by: "Blake", role: "Business Strategist" },
  { ask: "We need a brand people actually remember.", kind: "Brand guide", title: "A position, not a mood", details: ["One idea we can own", "The rival we define against"], by: "Cass", role: "Brand Strategist" },
];

const CARD_W = 340;
const GAP = 16;
const LOOP = (CARD_W + GAP) * JOBS.length; // exact width of one set → seamless wrap
const SPEED = 46; // px per second

function JobCard({ job }: { job: Job }) {
  return (
    <div
      className="group flex shrink-0 flex-col border bg-white p-5 transition-shadow"
      style={{ width: CARD_W, borderColor: "var(--lv3-border)" }}
    >
      <span className="lv3-label lv3-t-soft-55">You ask</span>
      <p className="lv3-t-navy mt-2 border p-3 text-[14px] leading-snug" style={{ background: "#f1f2f8", borderColor: "var(--lv3-border)" }}>
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
        <p className="lv3-t-navy mt-2 text-[14px] font-semibold leading-snug">{job.title}</p>
        <ul className="mt-2.5 flex flex-1 flex-col gap-1.5">
          {job.details.map((d) => (
            <li key={d} className="lv3-t-soft flex items-start gap-1.5 text-[12px] leading-snug">
              <Check className="lv3-t-blue mt-0.5 size-3 shrink-0" /> {d}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: "var(--lv3-border)" }}>
          <AgentAvatar characterName={job.by} role={job.role} size={34} className="shrink-0 transition-transform group-hover:scale-110" />
          <span className="lv3-t-navy min-w-0 truncate text-[12px] font-semibold">
            {job.by}
            <span className="lv3-t-soft-55 font-normal"> · {job.role}</span>
          </span>
          <span className="lv3-label lv3-t-soft-55 ml-auto flex shrink-0 items-center gap-1">
            <ShieldCheck className="size-3" /> reviewed
          </span>
        </div>
      </div>
    </div>
  );
}

function JobsCarousel() {
  const x = useMotionValue(0);
  const paused = useRef(false);

  useAnimationFrame((_, delta) => {
    if (paused.current) return;
    let next = x.get() - (SPEED * delta) / 1000;
    if (next <= -LOOP) next += LOOP; // wrap by exactly one set
    x.set(next);
  });

  return (
    <div
      className="relative overflow-hidden"
      style={{
        maskImage: "linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent)",
        WebkitMaskImage: "linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent)",
      }}
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
    >
      <motion.div className="flex" style={{ x, gap: GAP }}>
        {[...JOBS, ...JOBS].map((j, i) => (
          <JobCard key={`${j.title}-${i}`} job={j} />
        ))}
      </motion.div>
    </div>
  );
}

export function SectionJobs({ showRoster = true }: { showRoster?: boolean } = {}) {
  const reduce = useReducedMotion();

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

        {reduce ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {JOBS.map((j) => (
              <JobCard key={j.title} job={j} />
            ))}
          </div>
        ) : (
          <JobsCarousel />
        )}

        {/* the whole team, on call — shown on v3, dropped on v4 where the team
            already appears in the Problem card and the closing band */}
        {showRoster && (
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
        )}

        <p className="lv3-t-soft mt-6 text-[13.5px]">
          Every draft is read by a second teammate before it reaches you.{" "}
          <span className="lv3-t-soft-55">Jobs shown are representative.</span>
        </p>
      </div>
    </section>
  );
}

export default SectionJobs;
