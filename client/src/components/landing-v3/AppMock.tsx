// Landing v3 — the whole process, drawn as a storyboard.
//
// Six stages, scroll-driven from SectionOverview, that walk a stranger through
// the ENTIRE arc from a one-line idea to a finished project, explaining each
// step: (1) you say what to build, (2) a whole team assembles from the pack,
// (3) they lay out the plan, (4) they think and push back, (5) they build and
// review each other, (6) you come back to finished, reviewed work.
//
// Every stage animates, and a caption bar under the mock names the step in plain
// language so nothing needs decoding. Only one stage is mounted at a time, so
// the continuous loops inside each scene never stack up.

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, FileText, Lightbulb, ShieldCheck } from "lucide-react";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import { EASE } from "./primitives";

// the stages, in order, with the plain-language caption shown under the mock
const STAGES = [
  { key: "idea", caption: "You tell them what you want to build." },
  { key: "assemble", caption: "A whole team assembles from the pack." },
  { key: "plan", caption: "They lay out every step, and who owns it." },
  { key: "think", caption: "They talk, hand work off, supervise, and push back." },
  { key: "review", caption: "They build it, and check each other's work." },
  { key: "done", caption: "You come back to finished, reviewed work." },
] as const;

export const OVERVIEW_STAGES = STAGES.length; // 6

// one place to resolve a character's role, so avatars seed and colour correctly
const ROLE: Record<string, string> = {
  Alex: "Product Manager",
  Jordan: "Technical Lead",
  Cleo: "Product Designer",
  Kai: "Growth Marketer",
  Wren: "Copywriter",
  Juhi: "Finance Analyst",
  Ira: "Legal Counsel",
  Sam: "QA Lead",
  Lumi: "UX Designer",
  Robin: "SEO Specialist",
  Maya: "Idea Partner",
  Dev: "Backend Developer",
  Rio: "Data Analyst",
  Cass: "Brand Strategist",
  Nova: "Marketing Specialist",
  Quinn: "Operations Manager",
  Blake: "Business Strategist",
  Mira: "Content Writer",
  Coda: "Software Engineer",
};

// the SaaS pack's named specialists
const PACK_TEAM = ["Alex", "Jordan", "Cleo", "Kai", "Wren", "Juhi", "Ira"];
// the wider roster, previewed as an overlapping stack
const PACK_MORE = ["Maya", "Sam", "Dev", "Rio", "Cass", "Nova", "Quinn", "Robin", "Lumi", "Blake", "Mira", "Coda"];

// the SaaS pack's staged plan (the journey)
const JOURNEY: { stage: string; tasks: { t: string; by: string; doc?: boolean }[] }[] = [
  {
    stage: "Get set up",
    tasks: [
      { t: "Validate the problem", by: "Alex" },
      { t: "Business plan", by: "Alex", doc: true },
      { t: "Financial model", by: "Juhi", doc: true },
    ],
  },
  {
    stage: "Build",
    tasks: [
      { t: "Product requirements", by: "Alex", doc: true },
      { t: "Architecture spec", by: "Jordan", doc: true },
      { t: "Design the flows", by: "Cleo", doc: true },
    ],
  },
  {
    stage: "Launch",
    tasks: [
      { t: "Go-to-market plan", by: "Kai", doc: true },
      { t: "Landing page copy", by: "Wren", doc: true },
    ],
  },
  {
    stage: "Grow",
    tasks: [
      { t: "SEO growth brief", by: "Robin", doc: true },
      { t: "Retention loops", by: "Kai" },
    ],
  },
];

// the finished documents the pack produces (the "done" payoff)
const DOCS: { t: string; by: string }[] = [
  { t: "Business Plan", by: "Alex" },
  { t: "Financial Model", by: "Juhi" },
  { t: "Legal Checklist", by: "Ira" },
  { t: "Product Requirements", by: "Alex" },
  { t: "Architecture Spec", by: "Jordan" },
  { t: "Design Brief", by: "Cleo" },
  { t: "Go-to-Market Plan", by: "Kai" },
  { t: "Landing Page Copy", by: "Wren" },
  { t: "SEO Growth Brief", by: "Robin" },
];

// what actually happens when the team works: they talk to each other, hand work
// off to the right specialist, supervise, and push back — not one bot answering.
type ThinkRow =
  | { kind: "brief"; text: string }
  | { kind: "talk"; who: string; text: string }
  | { kind: "handoff"; from: string; to: string }
  | { kind: "pushback"; who: string; text: string }
  | { kind: "supervise"; who: string; text: string };

const THINK: ThinkRow[] = [
  { kind: "brief", text: "Onboarding drops 60% of signups before they finish setup." },
  { kind: "talk", who: "Alex", text: "Which step? Four screens is a different problem from one." },
  { kind: "handoff", from: "Alex", to: "Lumi" },
  { kind: "talk", who: "Lumi", text: "Three of five stalled at the calendar ask." },
  { kind: "pushback", who: "Sam", text: "Not before I see the three states we never verified." },
  { kind: "supervise", who: "Maya", text: "keeping the thread on the goal" },
];

const THINK_TAG: Record<Exclude<ThinkRow["kind"], "brief">, { label: string; color: string }> = {
  talk: { label: "talks it through", color: "var(--lv3-blue)" },
  handoff: { label: "hands off", color: "var(--lv3-purple)" },
  pushback: { label: "pushes back", color: "var(--lv3-amber)" },
  supervise: { label: "supervises", color: "#0F9D76" },
};

// a shared "live" pulse dot
function LiveDot({ color }: { color: string }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative flex size-1.5">
      {!reduce && <span className="absolute inline-flex size-1.5 animate-ping rounded-full" style={{ background: color }} />}
      <span className="relative inline-flex size-1.5 rounded-full" style={{ background: color }} />
    </span>
  );
}

// ── stage 1 · your idea ─────────────────────────────────────────────────────
function IdeaScene({ reduce }: { reduce: boolean | null }) {
  const IDEA = "A SaaS startup";
  const [typed, setTyped] = useState(reduce ? IDEA : "");
  useEffect(() => {
    if (reduce) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(IDEA.slice(0, i));
      if (i >= IDEA.length) clearInterval(id);
    }, 85);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <span className="lv3-label lv3-t-blue">Start here</span>
      <div className="w-full max-w-md">
        <span className="lv3-label lv3-t-soft-55 mb-2 block">Your idea</span>
        <div
          className="flex items-center gap-3 border px-4 py-4"
          style={{ borderColor: "var(--lv3-blue)", background: "#fff", boxShadow: "0 0 0 4px rgba(66,87,232,0.08)" }}
        >
          <Lightbulb className="lv3-t-blue size-5 shrink-0" />
          <span className="lv3-t-navy text-[19px] font-medium leading-none">
            {typed}
            <motion.span
              aria-hidden
              className="ml-0.5 inline-block align-middle"
              style={{ width: 2, height: 21, background: "var(--lv3-blue)" }}
              animate={reduce ? {} : { opacity: [1, 1, 0, 0] }}
              transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
            />
          </span>
        </div>
      </div>
      <motion.span
        className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[14px] font-semibold text-white"
        style={{ background: "var(--lv3-blue)", boxShadow: "0 8px 22px -10px rgba(66,87,232,0.6)" }}
        animate={reduce ? {} : { scale: [1, 1.035, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        Build my team <ArrowRight className="size-4" />
      </motion.span>
    </motion.div>
  );
}

// ── stage 2 · your team assembles ───────────────────────────────────────────
function AssembleScene({ reduce }: { reduce: boolean | null }) {
  const [ring, setRing] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setRing((r) => (r + 1) % PACK_TEAM.length), 900);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col justify-center gap-4 px-6 sm:px-9"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <span className="lv3-label lv3-t-blue inline-flex items-center gap-2">
        <LiveDot color="var(--lv3-blue)" /> assembling your team
      </span>
      <motion.div
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } } }}
        initial={reduce ? false : "hidden"}
        animate="show"
      >
        {PACK_TEAM.map((name, i) => {
          const lit = ring === i;
          return (
            <motion.div
              key={name}
              className="flex items-center gap-2.5 border bg-white p-2.5"
              variants={{ hidden: { opacity: 0, y: 16, scale: 0.8 }, show: { opacity: 1, y: 0, scale: 1 } }}
              transition={{ duration: 0.4, ease: EASE }}
              animate={{
                borderColor: lit ? "var(--lv3-amber-fill)" : "var(--lv3-border)",
                backgroundColor: lit ? "rgba(242,180,65,0.06)" : "#ffffff",
              }}
            >
              <motion.span
                className="shrink-0"
                animate={reduce ? {} : { y: [0, -3, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
              >
                <AgentAvatar characterName={name} role={ROLE[name]} size={30} state={lit ? "working" : "idle"} />
              </motion.span>
              <span className="min-w-0">
                <span className="lv3-t-navy block truncate text-[12px] font-semibold leading-tight">{name}</span>
                <span className="lv3-label lv3-t-soft-55 block truncate text-[8.5px] leading-tight">{ROLE[name]}</span>
              </span>
            </motion.div>
          );
        })}
      </motion.div>
      <motion.div
        className="flex items-center gap-3 border-t pt-4"
        style={{ borderColor: "var(--lv3-border)" }}
        animate={reduce ? {} : { y: [0, -2, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex items-center">
          {PACK_MORE.map((name, i) => (
            <motion.span
              key={name}
              className="rounded-full ring-2 ring-white"
              style={{ marginLeft: i === 0 ? 0 : -9, zIndex: PACK_MORE.length - i }}
              initial={reduce ? false : { opacity: 0, x: -8, scale: 0.7 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.7 + i * 0.05 }}
            >
              <AgentAvatar characterName={name} role={ROLE[name]} size={26} state="idle" />
            </motion.span>
          ))}
        </div>
        <span className="lv3-label lv3-t-soft-55 text-[9.5px] leading-snug">
          the full Hatchin roster,
          <br />
          30+ specialists, on call
        </span>
      </motion.div>
    </motion.div>
  );
}

// ── stage 3 · they lay out the plan (tasks complete one by one, on a loop) ───
function PlanScene({ reduce }: { reduce: boolean | null }) {
  const total = JOURNEY.reduce((n, c) => n + c.tasks.length, 0);
  const [prog, setProg] = useState(reduce ? total : 0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setProg((p) => (p >= total + 3 ? 0 : p + 1)), 620);
    return () => clearInterval(id);
  }, [reduce, total]);

  let gi = -1;
  return (
    <motion.div
      className="absolute inset-0 flex flex-col gap-3 p-5 sm:p-6"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <span className="lv3-label lv3-t-blue inline-flex items-center gap-2">
        <LiveDot color="var(--lv3-blue)" /> working the plan, top to bottom
      </span>
      <div className="grid flex-1 grid-cols-2 gap-2.5 lg:grid-cols-4">
        {JOURNEY.map((col, ci) => (
          <div
            key={col.stage}
            className="flex flex-col gap-2 border p-2.5"
            style={{ borderColor: "var(--lv3-border)", background: "#fbfbfe" }}
          >
            <span className="lv3-label lv3-t-navy flex items-center gap-1.5 text-[9.5px]">
              <span className="flex size-4 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ background: "var(--lv3-blue)" }}>
                {ci + 1}
              </span>
              {col.stage}
            </span>
            {col.tasks.map((task) => {
              gi += 1;
              const done = gi < prog;
              const working = gi === prog;
              return (
                <motion.div
                  key={task.t}
                  className="flex items-center gap-1.5 border bg-white p-1.5"
                  animate={{ borderColor: working ? "var(--lv3-amber-fill)" : "var(--lv3-border)" }}
                  transition={{ duration: 0.3 }}
                >
                  <span
                    className="flex size-3.5 shrink-0 items-center justify-center rounded-[3px]"
                    style={{
                      background: done ? "#0F9D76" : "transparent",
                      border: done ? "none" : working ? "1.5px dashed var(--lv3-amber-fill)" : "1.5px solid var(--lv3-border)",
                    }}
                  >
                    {done && <Check className="size-2.5 text-white" />}
                    {working && !reduce && (
                      <motion.span
                        className="size-1.5 rounded-full"
                        style={{ background: "var(--lv3-amber-fill)" }}
                        animate={{ scale: [1, 1.5, 1] }}
                        transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                  </span>
                  <AgentAvatar characterName={task.by} role={ROLE[task.by]} size={16} state={working ? "working" : "idle"} className="shrink-0" />
                  <span
                    className="lv3-t-navy min-w-0 flex-1 truncate text-[9.5px] font-medium leading-tight"
                    style={{ textDecoration: done ? "line-through" : "none", opacity: done ? 0.55 : 1 }}
                  >
                    {task.t}
                  </span>
                  {task.doc && <FileText className="lv3-t-blue size-2.5 shrink-0" />}
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>
      <span className="lv3-label lv3-t-soft-55 text-[9px]">
        <FileText className="mb-0.5 mr-1 inline size-2.5" /> = a document the pack will build for you
      </span>
    </motion.div>
  );
}

// ── stage 4 · they work as a team: talk, hand off, supervise, push back ──────
function ThinkRowView({ row }: { row: ThinkRow }) {
  if (row.kind === "brief") {
    return (
      <div className="flex justify-end">
        <span className="lv3-t-navy max-w-[82%] border px-2.5 py-1.5 text-[11.5px] leading-snug" style={{ background: "#f1f2f8" }}>
          {row.text}
        </span>
      </div>
    );
  }

  if (row.kind === "handoff") {
    const tag = THINK_TAG.handoff;
    return (
      <div
        className="flex items-center gap-2 border px-2.5 py-2"
        style={{ borderColor: "rgba(159,123,255,0.35)", background: "rgba(159,123,255,0.06)" }}
      >
        <AgentAvatar characterName={row.from} role={ROLE[row.from]} size={20} className="shrink-0" />
        <ArrowRight className="lv3-t-purple size-3.5 shrink-0" />
        <AgentAvatar characterName={row.to} role={ROLE[row.to]} size={20} className="shrink-0" />
        <span className="lv3-t-navy min-w-0 flex-1 text-[11px] leading-tight">
          {row.from} hands the flow to {row.to}
        </span>
        <span className="lv3-label shrink-0 text-[8.5px]" style={{ color: tag.color }}>{tag.label}</span>
      </div>
    );
  }

  const who = row.who;
  const tag = THINK_TAG[row.kind];
  const bg =
    row.kind === "pushback" ? "rgba(242,180,65,0.12)"
      : row.kind === "supervise" ? "rgba(15,157,118,0.07)"
        : "rgba(108,130,255,0.10)";
  return (
    <div className="flex items-start gap-2">
      <AgentAvatar characterName={who} role={ROLE[who]} size={22} state={row.kind === "supervise" ? "working" : "idle"} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="mb-0.5 flex items-center gap-1.5">
          <span className="lv3-t-soft-55 text-[9.5px]">{who} · {ROLE[who]}</span>
          <span className="lv3-label text-[8.5px]" style={{ color: tag.color }}>{tag.label}</span>
        </span>
        <span
          className={row.kind === "supervise" ? "lv3-t-soft block text-[11px] italic leading-snug" : "lv3-t-navy block border px-2.5 py-1.5 text-[11.5px] leading-snug"}
          style={row.kind === "supervise" ? undefined : { background: bg }}
        >
          {row.text}
        </span>
      </span>
    </div>
  );
}

function ThinkScene({ reduce }: { reduce: boolean | null }) {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col p-5 sm:p-6"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <span className="lv3-label lv3-t-blue mb-3 inline-flex items-center gap-2">
        <LiveDot color="var(--lv3-purple)" /> the whole team, working
      </span>
      <motion.div
        className="flex flex-1 flex-col justify-end gap-2"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.28 } } }}
        initial={reduce ? false : "hidden"}
        animate="show"
      >
        {THINK.map((row, i) => (
          <motion.div
            key={i}
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <ThinkRowView row={row} />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ── stage 5 · they build, and review each other (write → read → fix → ship) ──
const REVIEW_LINES = [94, 76, 88, 62, 82, 70];
function ReviewScene({ reduce }: { reduce: boolean | null }) {
  // phase 0 write · 1 review · 2 fixes · 3 approved, looping
  const [phase, setPhase] = useState(reduce ? 3 : 0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setPhase((p) => (p + 1) % 4), 1500);
    return () => clearInterval(id);
  }, [reduce]);

  const status = [
    "Cleo is writing the draft",
    "Sam is reading it, line by line",
    "Sam sent back 2 fixes",
    "Approved, and on its way to you",
  ][phase];
  const builderActive = phase === 0;
  const reviewerActive = phase === 1 || phase === 2;

  return (
    <motion.div
      className="absolute inset-0 flex flex-col gap-3 p-5 sm:p-6"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* the doc + who is on it */}
      <div className="flex items-center gap-2">
        <span className="lv3-label rounded px-1.5 py-0.5 text-white" style={{ background: "var(--lv3-blue)" }}>PRD</span>
        <span className="lv3-t-navy truncate text-[12.5px] font-semibold">Move the calendar ask after first value</span>
        <div className="ml-auto flex items-center -space-x-1.5">
          <motion.span
            className="rounded-full ring-2 ring-white"
            title="Cleo writes it"
            animate={reduce ? {} : { y: builderActive ? -2 : 0 }}
          >
            <AgentAvatar characterName="Cleo" role={ROLE.Cleo} size={22} state={builderActive ? "working" : "idle"} />
          </motion.span>
          <motion.span
            className="rounded-full ring-2 ring-white"
            title="Sam reviews it"
            animate={reduce ? {} : { y: reviewerActive ? -2 : 0 }}
          >
            <AgentAvatar characterName="Sam" role={ROLE.Sam} size={22} state={reviewerActive ? "working" : "idle"} />
          </motion.span>
        </div>
      </div>

      {/* the document, written then scanned then fixed */}
      <div className="relative flex-1 overflow-hidden border p-3" style={{ borderColor: "var(--lv3-border)" }}>
        <div className="space-y-2.5">
          {REVIEW_LINES.map((w, i) => {
            const flagged = i === 1 || i === 3;
            const bg =
              flagged && phase === 1 ? "var(--lv3-amber-fill)"
                : flagged && phase >= 2 ? "rgba(15,157,118,0.55)"
                  : "var(--lv3-border)";
            return (
              <div key={i} className="relative h-2" style={{ width: `${w}%`, background: bg }}>
                {/* writing caret rides the last line while Cleo writes */}
                {phase === 0 && i === REVIEW_LINES.length - 1 && !reduce && (
                  <motion.span
                    className="absolute -right-1 top-1/2 h-3 w-0.5 -translate-y-1/2"
                    style={{ background: "var(--lv3-blue)" }}
                    animate={{ opacity: [1, 1, 0, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
                  />
                )}
              </div>
            );
          })}
        </div>
        {/* Sam's reading scan sweeps the page during review */}
        {phase === 1 && !reduce && (
          <motion.div
            className="pointer-events-none absolute inset-x-2 h-7 rounded"
            style={{ background: "linear-gradient(rgba(66,87,232,0.16), rgba(66,87,232,0))" }}
            initial={{ top: 8 }}
            animate={{ top: [8, 120, 8] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>

      {/* what's happening, in words */}
      <div
        className="flex items-center gap-2 border p-2.5 transition-colors"
        style={{
          borderColor: phase === 3 ? "rgba(15,157,118,0.35)" : "var(--lv3-border)",
          background: phase === 3 ? "rgba(15,157,118,0.06)" : "#fbfbfe",
        }}
      >
        {phase === 3 ? (
          <motion.span animate={reduce ? {} : { scale: [1, 1.15, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>
            <ShieldCheck className="size-4 shrink-0" style={{ color: "#0F9D76" }} />
          </motion.span>
        ) : (
          <LiveDot color={reviewerActive ? "var(--lv3-amber-fill)" : "var(--lv3-blue)"} />
        )}
        <AnimatePresence mode="wait">
          <motion.span
            key={phase}
            className="lv3-t-navy text-[11.5px] font-medium"
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {status}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── stage 6 · you come back to a finished project (docs land one by one) ─────
function DoneScene({ reduce }: { reduce: boolean | null }) {
  const [n, setN] = useState(reduce ? DOCS.length : 0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setN((x) => (x >= DOCS.length + 4 ? 0 : x + 1)), 420);
    return () => clearInterval(id);
  }, [reduce]);

  const checked = Math.min(n, DOCS.length);
  const pct = Math.round((checked / DOCS.length) * 100);
  const stagesDone = Math.round((checked / DOCS.length) * 4);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col gap-3 p-5 sm:p-6"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2.5">
        <motion.span
          className="flex size-7 items-center justify-center rounded-full"
          style={{ background: "rgba(15,157,118,0.12)" }}
          animate={reduce ? {} : { scale: [1, 1.14, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <Check className="size-4" style={{ color: "#0F9D76" }} />
        </motion.span>
        <span className="lv3-t-navy text-[14px] font-semibold">Your SaaS Startup is underway</span>
        <span className="lv3-label lv3-t-soft-55 ml-auto">{checked} of {DOCS.length} delivered</span>
      </div>

      {/* progress bar that fills as the work lands */}
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--lv3-border)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, var(--lv3-blue), #0F9D76)" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: EASE }}
        />
      </div>

      {/* the journey filling in */}
      <div className="flex items-center gap-1.5">
        {["Get set up", "Build", "Launch", "Grow"].map((s, i) => {
          const done = i < stagesDone;
          return (
            <div key={s} className="flex flex-1 items-center gap-1.5">
              <span
                className="flex w-full items-center justify-center gap-1 rounded px-1.5 py-1 text-[9px] font-semibold transition-colors"
                style={{
                  background: done ? "rgba(15,157,118,0.10)" : "rgba(242,180,65,0.12)",
                  color: done ? "#0F9D76" : "var(--lv3-amber)",
                }}
              >
                {done ? <Check className="size-2.5" /> : <LiveDot color="var(--lv3-amber-fill)" />}
                {s}
              </span>
            </div>
          );
        })}
      </div>

      {/* the finished documents, checking off in turn */}
      <span className="lv3-label lv3-t-soft-55 pt-1">9 documents, written and reviewed</span>
      <div className="grid flex-1 grid-cols-2 gap-2 lg:grid-cols-3">
        {DOCS.map((d, i) => {
          const on = i < checked;
          return (
            <motion.div
              key={d.t}
              className="flex items-center gap-2 border p-2"
              animate={{
                borderColor: on ? "rgba(15,157,118,0.35)" : "var(--lv3-border)",
                backgroundColor: on ? "rgba(15,157,118,0.05)" : "#ffffff",
              }}
              transition={{ duration: 0.3 }}
            >
              <FileText className="size-3.5 shrink-0" style={{ color: on ? "#0F9D76" : "var(--lv3-soft-55)" }} />
              <span className="lv3-t-navy min-w-0 flex-1 truncate text-[10px] font-medium leading-tight" style={{ opacity: on ? 1 : 0.55 }}>
                {d.t}
              </span>
              {on ? (
                <motion.span initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.25, ease: EASE }}>
                  <Check className="size-3 shrink-0" style={{ color: "#0F9D76" }} />
                </motion.span>
              ) : (
                <span className="size-3 shrink-0 rounded-full border" style={{ borderColor: "var(--lv3-border)" }} />
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function AppMock({ stage: external }: { stage?: number } = {}) {
  const reduce = useReducedMotion();
  const stage = external != null ? Math.max(0, Math.min(OVERVIEW_STAGES - 1, external)) : OVERVIEW_STAGES - 1;
  const meta = STAGES[stage];

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-[0_24px_70px_rgba(20,24,47,0.10)]"
      style={{ height: 512 }}
      aria-label="How a Hatchin project goes from a one-line idea to finished, reviewed work"
    >
      {/* top chrome: what this project is + where we are in the process */}
      <div className="flex items-center gap-2.5 border-b px-4 py-2.5">
        <span className="text-[15px] leading-none">{stage === 0 ? "✨" : "🚀"}</span>
        <span className="min-w-0">
          <span className="lv3-t-navy block text-[12.5px] font-semibold leading-tight">
            {stage === 0 ? "New project" : "SaaS Startup"}
          </span>
        </span>
        <div className="ml-auto flex items-center gap-2.5">
          <span className="lv3-label lv3-t-soft-55">
            Step {stage + 1} of {OVERVIEW_STAGES}
          </span>
          <div className="flex gap-1">
            {STAGES.map((_, i) => (
              <span
                key={i}
                className="size-1.5 rounded-full transition-all duration-300"
                style={{
                  background: i <= stage ? "var(--lv3-blue)" : "var(--lv3-border)",
                  transform: i === stage ? "scale(1.4)" : "scale(1)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* the scene for this stage — crossfade (no wait) so it tracks the scroll */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence>
          {stage === 0 && <IdeaScene key="idea" reduce={reduce} />}
          {stage === 1 && <AssembleScene key="assemble" reduce={reduce} />}
          {stage === 2 && <PlanScene key="plan" reduce={reduce} />}
          {stage === 3 && <ThinkScene key="think" reduce={reduce} />}
          {stage === 4 && <ReviewScene key="review" reduce={reduce} />}
          {stage === 5 && <DoneScene key="done" reduce={reduce} />}
        </AnimatePresence>
      </div>

      {/* the caption that explains this step in plain language */}
      <div className="flex items-center gap-2.5 border-t px-4 py-3" style={{ background: "#fbfbfe" }}>
        <span
          className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ background: "var(--lv3-blue)" }}
        >
          {stage + 1}
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={meta.key}
            className="lv3-t-navy text-[12.5px] font-medium"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            {meta.caption}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default AppMock;
