// Landing v3 · 05 — Inside a project.
//
// Port of FIMI's ProjectConnected: an animated BENTO GRID on a tinted canvas,
// white tiles, same six-tile span pattern (2x2, 2x1, 2x2, 2x1, 3, 3). Each tile
// has an ENTRY animation on scroll-in, and its micro-visual plays ONLY ON HOVER
// (the `active` prop gates every loop, so nothing animates off-screen).
//
// FIMI's six tiles are the content types its taxonomy surfaces. The six here
// are the surfaces of a Hatchin project: the team, the tasks, the deliverables,
// the brain, the activity feed, and peer review.

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowDown,
  Brain,
  Check,
  FileText,
  ListChecks,
  Radio,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import { cn } from "@/lib/utils";
import { Reveal } from "./primitives";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ── tile 01: the team, cycling ──────────────────────────────────────── */
// Four, not five: five rows overflow the 2x2 tile and collide with its header.
// Verified in the browser at 1440.
const TEAM = [
  { name: "Maya", role: "Idea Partner" },
  { name: "Alex", role: "Product Manager" },
  { name: "Dev", role: "Backend Developer" },
  { name: "Cleo", role: "Product Designer" },
];

function TeamViz({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(-1);
  useEffect(() => {
    if (!active || reduce) {
      setI(-1);
      return;
    }
    setI(0);
    const id = setInterval(() => setI((a) => (a + 1) % TEAM.length), 900);
    return () => clearInterval(id);
  }, [active, reduce]);

  return (
    <div className="flex h-full flex-col justify-center gap-1.5">
      {TEAM.map((m, idx) => (
        <motion.div
          key={m.name}
          className="flex items-center gap-3 border bg-white p-2 transition-colors"
          style={
            idx === i
              ? { borderColor: "rgba(108,130,255,0.4)", background: "rgba(108,130,255,0.05)" }
              : undefined
          }
          animate={{ x: idx === i ? 3 : 0 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          <AgentAvatar
            characterName={m.name}
            role={m.role}
            size={30}
            state={idx === i ? "working" : "idle"}
            className="shrink-0"
          />
          {/* no truncate: at 768 the role names were cut mid-word */}
          <span className="min-w-0">
            <span className="lv3-t-navy block text-[13px] font-semibold">{m.name}</span>
            <span className="lv3-label lv3-t-soft-55 block leading-tight">{m.role}</span>
          </span>
        </motion.div>
      ))}
    </div>
  );
}

/* ── tile 02: a line of chat becoming a tracked task ────────────────── */
function TasksViz({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(0); // 0 said · 1 caught · 2 owned
  useEffect(() => {
    if (!active || reduce) {
      setPhase(reduce ? 2 : 0);
      return;
    }
    setPhase(0);
    const id = setInterval(() => setPhase((p) => (p >= 2 ? 0 : p + 1)), 1200);
    return () => clearInterval(id);
  }, [active, reduce]);

  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <div className="lv3-t-navy self-end border px-2.5 py-1.5 text-[12px]" style={{ background: "#f1f2f8" }}>
        “Someone should fix the empty state.”
      </div>

      <motion.div
        className="flex items-center gap-2 self-center"
        animate={{ opacity: phase >= 1 ? 1 : 0.2 }}
        transition={{ duration: 0.3 }}
      >
        <ArrowDown className="lv3-t-soft-55 size-3.5" />
        <span className="lv3-label lv3-t-soft-55">caught</span>
      </motion.div>

      <motion.div
        className="flex items-center gap-2.5 border bg-white p-2.5"
        animate={{
          opacity: phase >= 1 ? 1 : 0.2,
          borderColor: phase >= 2 ? "var(--lv3-blue)" : "var(--lv3-border)",
        }}
        transition={{ duration: 0.35 }}
      >
        <span
          className="flex size-4 shrink-0 items-center justify-center border"
          style={{
            borderColor: phase >= 2 ? "var(--lv3-blue)" : "var(--lv3-border)",
            background: phase >= 2 ? "var(--lv3-blue)" : "#fff",
          }}
        >
          {phase >= 2 && <Check className="size-2.5 text-white" />}
        </span>
        <span className="lv3-t-navy min-w-0 flex-1 text-[12.5px] font-medium">Fix the empty state</span>
        <motion.span animate={{ opacity: phase >= 2 ? 1 : 0 }} transition={{ duration: 0.3 }}>
          <AgentAvatar characterName="Cleo" role="Product Designer" size={20} />
        </motion.span>
      </motion.div>
    </div>
  );
}

/* ── tile 03: versions stacking up, any one restorable ──────────────── */
const VERSIONS = ["v1", "v2", "v3"];

function DeliverablesViz({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active || reduce) {
      setV(reduce ? VERSIONS.length - 1 : 0);
      return;
    }
    setV(0);
    const id = setInterval(() => setV((x) => (x + 1) % VERSIONS.length), 1400);
    return () => clearInterval(id);
  }, [active, reduce]);

  return (
    <div className="flex h-full flex-col justify-center gap-4">
      {/* one document, a soft stack of past versions behind it */}
      <div className="relative">
        <div aria-hidden className="absolute left-2 right-2 -top-2 h-24 border" style={{ background: "#fff", opacity: 0.45 }} />
        <div aria-hidden className="absolute left-1 right-1 -top-1 h-24 border" style={{ background: "#fff", opacity: 0.75 }} />
        <motion.div
          className="relative flex flex-col gap-2 border bg-white p-3"
          style={{ borderColor: "var(--lv3-blue)" }}
          animate={{ boxShadow: active ? "0 8px 24px rgba(66,87,232,0.12)" : "0 0 0 rgba(0,0,0,0)" }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <div className="flex items-center gap-2">
            <FileText className="lv3-t-blue size-3.5 shrink-0" />
            <span className="lv3-t-navy text-[12px] font-medium">Product requirements</span>
            <AnimatePresence mode="popLayout">
              <motion.span
                key={v}
                className="lv3-label lv3-t-blue ml-auto"
                initial={reduce ? false : { y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                {VERSIONS[v]}
              </motion.span>
            </AnimatePresence>
          </div>
          <div className="h-1.5" style={{ background: "var(--lv3-border)", width: "92%" }} />
          <div className="h-1.5" style={{ background: "var(--lv3-border)", width: "68%" }} />
        </motion.div>
      </div>

      {/* every version restorable */}
      <div className="flex items-center gap-1.5">
        {VERSIONS.map((label, i) => (
          <motion.span
            key={label}
            className="lv3-label border px-2 py-1"
            animate={{
              borderColor: i === v ? "var(--lv3-blue)" : "var(--lv3-border)",
              color: i === v ? "var(--lv3-blue)" : "var(--lv3-soft-55)",
              backgroundColor: i === v ? "rgba(108,130,255,0.08)" : "rgba(255,255,255,0)",
            }}
            transition={{ duration: 0.3 }}
          >
            {label}
          </motion.span>
        ))}
        <span className="lv3-label lv3-t-soft-55 ml-auto">restore any</span>
      </div>
    </div>
  );
}

/* ── tile 04: you drop a file, everyone reads it ─────────────────────── */
const READERS = [
  { name: "Alex", role: "Product Manager" },
  { name: "Lumi", role: "UX Designer" },
  { name: "Sam", role: "QA Lead" },
  { name: "Juhi", role: "Finance Analyst" },
];

function BrainViz({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [read, setRead] = useState(0);
  useEffect(() => {
    if (!active || reduce) {
      setRead(reduce ? READERS.length : 0);
      return;
    }
    setRead(0);
    const id = setInterval(() => setRead((n) => (n > READERS.length ? 0 : n + 1)), 700);
    return () => clearInterval(id);
  }, [active, reduce]);

  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="flex items-center gap-2 border bg-white p-2.5">
        <FileText className="lv3-t-blue size-4 shrink-0" />
        <span className="lv3-t-navy text-[12.5px] font-medium">brand-guidelines.pdf</span>
        <span className="lv3-label lv3-t-soft-55 ml-auto">uploaded</span>
      </div>

      <div className="flex items-center gap-2">
        {READERS.map((r, i) => (
          <motion.span
            key={r.name}
            className="relative inline-flex"
            animate={{ opacity: i < read ? 1 : 0.3, y: i < read ? -2 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <AgentAvatar characterName={r.name} role={r.role} size={26} />
            {i < read && (
              <span
                className="absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full"
                style={{ background: "var(--lv3-blue)" }}
              >
                <Check className="size-2 text-white" />
              </span>
            )}
          </motion.span>
        ))}
        <span className="lv3-label lv3-t-soft-55 ml-1">
          {read >= READERS.length ? "all read it" : "reading..."}
        </span>
      </div>
    </div>
  );
}

/* ── tile 05: the live activity feed ─────────────────────────────────── */
const FEED = [
  { who: "Dev", role: "Backend Developer", label: "Handed the scope to Cleo." },
  { who: "Sam", role: "QA Lead", label: "Read it cold, asked for two changes." },
  { who: "Kai", role: "Growth Marketer", label: "Waiting on your approval." },
];

function ActivityViz({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active || reduce) {
      setI(0);
      return;
    }
    const id = setInterval(() => setI((v) => (v + 1) % FEED.length), 2000);
    return () => clearInterval(id);
  }, [active, reduce]);

  return (
    <div className="flex h-full gap-4">
      <div className="hidden w-2/5 shrink-0 flex-col justify-center gap-1.5 border bg-white p-3 sm:flex">
        {FEED.map((f, idx) => (
          <div key={f.who} className="flex items-center gap-2">
            <AgentAvatar
              characterName={f.who}
              role={f.role}
              size={22}
              state={idx === i ? "working" : "idle"}
            />
            <span
              className="lv3-label truncate"
              style={{ color: idx === i ? "var(--lv3-blue)" : "var(--lv3-soft-55)" }}
            >
              {f.who}
            </span>
          </div>
        ))}
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ y: 16, opacity: 0, filter: "blur(4px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ y: -16, opacity: 0, filter: "blur(4px)", position: "absolute" }}
            transition={{ duration: 0.5, ease: EASE }}
            className="flex h-full flex-col justify-center"
          >
            <span className="lv3-label lv3-t-blue">{FEED[i].role}</span>
            <p className="lv3-t-navy mt-1.5 text-[15px] font-medium leading-snug">{FEED[i].label}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── tile 06: review verdicts landing in order ───────────────────────── */
const VERDICTS = [
  { mark: "Pass", label: "Shipped as written" },
  { mark: "Fix", label: "Changes asked, then re-read" },
  { mark: "Stop", label: "Blocked before you saw it" },
];

function ReviewViz({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(-1);
  useEffect(() => {
    if (!active || reduce) {
      setI(-1);
      return;
    }
    setI(0);
    const id = setInterval(() => setI((v) => (v + 1) % VERDICTS.length), 900);
    return () => clearInterval(id);
  }, [active, reduce]);

  return (
    <div className="flex h-full items-center">
      <ul className="relative w-full space-y-3">
        <div className="absolute bottom-2 left-[7px] top-2 w-px" style={{ background: "var(--lv3-border)" }} />
        {VERDICTS.map((v, idx) => (
          <li key={v.mark} className="relative flex items-center gap-3 pl-6">
            <motion.span
              className="absolute left-0 size-3.5 border bg-white transition-colors"
              style={
                idx === i
                  ? { borderColor: "var(--lv3-blue)", background: "var(--lv3-blue)" }
                  : undefined
              }
              animate={{ scale: idx === i ? 1.15 : 1 }}
              transition={{ duration: 0.3 }}
            />
            <span className="lv3-label lv3-t-soft-55 w-10 shrink-0">{v.mark}</span>
            <span
              className="text-[13px] font-medium transition-colors"
              style={{ color: idx === i ? "var(--lv3-navy)" : "var(--lv3-soft)" }}
            >
              {v.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── one bento tile ──────────────────────────────────────────────────── */
type TileDef = {
  key: string;
  span: string;
  icon: LucideIcon;
  label: string;
  title: string;
  why: string;
  Viz: (p: { active: boolean }) => JSX.Element;
  delay: number;
  };

const TILES: TileDef[] = [
  {
    key: "team",
    span: "md:col-span-2 md:row-span-2",
    icon: Users,
    label: "The team",
    title: "Your people, in the sidebar.",
    why: "Ask the room, or one person.",
    Viz: TeamViz,
    delay: 0,
  },
  {
    key: "tasks",
    span: "md:col-span-2",
    icon: ListChecks,
    label: "Tasks",
    title: "Nothing you mention gets lost.",
    why: "Mention it. It becomes tracked work.",
    Viz: TasksViz,
    delay: 0.08,
  },
  {
    key: "deliverables",
    span: "md:col-span-2 md:row-span-2",
    icon: FileText,
    label: "Deliverables",
    title: "The actual work, versioned.",
    why: "Roll back to any version.",
    Viz: DeliverablesViz,
    delay: 0.16,
  },
  {
    key: "brain",
    span: "md:col-span-2",
    icon: Brain,
    label: "Project brain",
    title: "Brief them once, not every time.",
    why: "Drop a PDF. Everyone has read it.",
    Viz: BrainViz,
    delay: 0.24,
  },
  {
    key: "activity",
    span: "md:col-span-3",
    icon: Radio,
    label: "Activity",
    title: "What happened while you were gone.",
    why: "What changed, not unread chat.",
    Viz: ActivityViz,
    delay: 0.32,
  },
  {
    key: "review",
    span: "md:col-span-3",
    icon: ShieldCheck,
    label: "Peer review",
    title: "The verdict on every piece of work.",
    why: "Only reviewed work reaches you.",
    Viz: ReviewViz,
    delay: 0.4,
  },
];

function Tile({
  t,
  index,
  lit,
  onTake,
  onRelease,
}: {
  t: TileDef;
  index: number;
  lit: boolean;
  onTake: () => void;
  onRelease: () => void;
}) {
  const Icon = t.icon;
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "-60px" });

  // Reused from v1's magnified-bento, which was written and never mounted:
  // a motion-value pair driving a radial highlight that tracks the pointer.
  // There it drove a magnifier lens; here it is a soft glow on the lit tile.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const glow = useMotionTemplate`radial-gradient(340px circle at ${mx}px ${my}px, rgba(66,87,232,0.10), transparent 70%)`;
  // Only ONE tile animates at a time. Six loops running at once gave the eye
  // nowhere to land, so the section now walks a spotlight: the lit tile plays
  // and everything else is dimmed and completely still.
  const num = String(index).padStart(2, "0");

  // Label + title only. Every tile description was cut: the illustration is
  // the content, and a paragraph under it just competes with the next tile.
  const header = (
    <div className="mb-4">
      <div className="lv3-t-blue flex items-center gap-2">
        <Icon className="size-4" />
        <span className="lv3-label">
          {num} · {t.label}
        </span>
      </div>
      <h3
        className="lv3-t-navy mt-1.5 text-[17px] font-semibold leading-snug"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        {t.title}
      </h3>
      {/* The why shows only on the lit tile, but its space is RESERVED rather
          than animated open. Animating height to auto reflowed the grid every
          time the spotlight moved, which read as jitter and left the section
          permanently unstable. Fixed box, opacity only. */}
      <motion.p
        className="lv3-t-soft mt-1.5 h-[34px] overflow-hidden text-[13px] leading-snug"
        initial={false}
        animate={{ opacity: lit ? 1 : 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        aria-hidden={!lit}
      >
        {t.why}
      </motion.p>
    </div>
  );

  const viz = (
    <div className="min-h-0 flex-1">
      <t.Viz active={lit} />
    </div>
  );

  return (
    <div
      ref={ref}
      className={cn("group relative flex", t.span)}
      onMouseEnter={onTake}
      onMouseLeave={onRelease}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
      }}
    >
      {/* entrance and spotlight share ONE animate target on purpose: with a
          whileInView gesture alongside it, the gesture wins while the tile is
          on screen and pins every tile to opacity 1, which defeats the dim. */}
      <motion.span
        className="relative flex w-full flex-col overflow-hidden border bg-white p-6"
        initial={{ opacity: 0, y: 30 }}
        animate={
          seen
            ? {
                opacity: lit ? 1 : 0.72,
                y: 0,
                borderColor: lit ? "rgba(84,104,240,0.45)" : "var(--lv3-border)",
                boxShadow: lit ? "0 14px 40px rgba(20,24,47,0.10)" : "0 1px 0 rgba(20,24,47,0.03)",
              }
            : { opacity: 0, y: 30 }
        }
        transition={{ duration: 0.5, ease: EASE }}
      >
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{ background: glow, opacity: lit ? 1 : 0 }}
        />
        {/* header on top for every tile now. It used to sit under the art on
            four of six, which meant those tiles read bottom-up and left their
            illustration only 59px of height. */}
        {header}
        {viz}
      </motion.span>
    </div>
  );
}

const DWELL_MS = 2800;

export function SectionInside() {
  const ref = useRef<HTMLDivElement>(null);
  // `once: false` + a tight margin so this fires when the grid is genuinely on
  // screen, not a third of a viewport early.
  const inView = useInView(ref, { margin: "-25% 0px -25% 0px" });
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  // a hovered tile takes the spotlight and holds the walk until you leave
  const [held, setHeld] = useState<number | null>(null);

  // Rewind to 01 every time the section is entered. Without this the walk keeps
  // running off screen and you arrive at whatever tile it happens to be on,
  // which is exactly the wrong first impression.
  useEffect(() => {
    if (inView) setI(0);
  }, [inView]);

  useEffect(() => {
    if (reduce || !inView || held !== null) return;
    const id = setInterval(() => setI((v) => (v + 1) % TILES.length), DWELL_MS);
    return () => clearInterval(id);
  }, [inView, reduce, held]);

  const lit = held ?? i;

  return (
    <section ref={ref} id="inside" className="lv3-bg-candle px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <span className="lv3-label lv3-t-blue">Inside a project</span>
          <h2 className="lv3-display lv3-t-navy mt-4">
            The whole project, in one place.
          </h2>
          <p className="lv3-t-soft mt-4 text-lg">
            Your team, your tasks, your files, your decisions, and the review on
            all of it. Six surfaces, nothing lost in a thread.
          </p>
        </Reveal>

        <div className="mt-14 grid auto-rows-[268px] grid-cols-1 gap-2 md:grid-cols-6">
          {TILES.map((t, idx) => (
            <Tile
              key={t.key}
              t={t}
              index={idx + 1}
              lit={reduce ? true : idx === lit}
              onTake={() => setHeld(idx)}
              onRelease={() => setHeld(null)}
            />
          ))}
        </div>

        <p className="lv3-label lv3-t-soft-55 mt-6">
          Every tile is a real surface
        </p>
      </div>
    </section>
  );
}

export default SectionInside;
