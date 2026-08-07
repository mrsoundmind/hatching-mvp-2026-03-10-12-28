// Landing v3 — the product, drawn rather than screenshotted.
//
// A three-pane mock of the real layout (roster left, conversation centre,
// activity right) built in HTML so it stays legible at any size, uses the page
// palette instead of fighting it, and never goes stale when the app changes.
// Real screenshots were tried here first and read as unreadable dark boxes.
//
// It runs a scripted loop once scrolled into view, and the loop carries the
// WHOLE product rather than just the chat: messages arrive, the roster lights
// up whoever is speaking, a task is caught out of the conversation, the
// activity rail logs each handoff and review, and at the end a finished,
// reviewed document slides over the thread the way the real artifact panel
// does. A written feature list was tried instead of this and cut as noise.
// Reduced motion jumps straight to the finished state.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ListChecks, ShieldCheck } from "lucide-react";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import { EASE } from "./primitives";

const CAST = [
  { name: "Maya", role: "Idea Partner" },
  { name: "Alex", role: "Product Manager" },
  { name: "Lumi", role: "UX Designer" },
  { name: "Sam", role: "QA Lead" },
];

type Turn = { who: string | null; role?: string; text: string; tint?: string };

const TURNS: Turn[] = [
  { who: null, text: "Onboarding drops 60% of signups before they finish setup." },
  {
    who: "Alex",
    role: "Product Manager",
    text: "Which step? A 60% drop across four screens is a different problem from 60% on one.",
    tint: "rgba(108,130,255,0.14)",
  },
  {
    who: "Lumi",
    role: "UX Designer",
    text: "I'd watch five sessions first. That usually means one screen asks for something people don't have yet.",
    tint: "rgba(159,123,255,0.14)",
  },
  { who: null, text: "It's the third screen. We ask them to connect their calendar." },
  {
    who: "Alex",
    role: "Product Manager",
    text: "Then it's the order, not the screen. Show value on sample data first. I'll scope it.",
    tint: "rgba(108,130,255,0.14)",
  },
  {
    who: "Sam",
    role: "QA Lead",
    text: "Not before I see the three states we never verified.",
    tint: "rgba(242,180,65,0.14)",
  },
];

const EVENTS = [
  { at: 1, label: "Alex picked it up", kind: "task" as const },
  { at: 2, label: "Task created, owner Lumi", kind: "task" as const },
  { at: 4, label: "Alex → Sam for review", kind: "handoff" as const },
  { at: 5, label: "Sam asked for changes", kind: "review" as const },
  { at: 6, label: "Reviewed. Document ready", kind: "done" as const },
];

/* the finished thing, sliding in over the thread like the real artifact panel */
function DeliverablePanel({ show }: { show: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col border-l bg-white"
      initial={false}
      animate={reduce ? { x: 0 } : { x: show ? "0%" : "104%" }}
      transition={{ duration: 0.55, ease: EASE }}
    >
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <span
          className="lv3-label rounded px-1.5 py-0.5 text-white"
          style={{ background: "var(--lv3-blue)" }}
        >
          PRD
        </span>
        <span className="lv3-t-navy truncate text-[12.5px] font-semibold">
          Move the calendar ask after first value
        </span>
        <span className="lv3-label lv3-t-soft-55 ml-auto shrink-0">v3</span>
      </div>
      <div className="flex-1 space-y-2 p-4">
        {[96, 78, 90, 62, 84].map((w, i) => (
          <motion.div
            key={i}
            className="h-2"
            style={{ background: "var(--lv3-border)" }}
            animate={{ width: show ? `${w}%` : 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: show ? 0.25 + i * 0.08 : 0 }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 border-t px-4 py-3">
        <ShieldCheck className="lv3-t-blue size-3.5 shrink-0" />
        <span className="lv3-label lv3-t-blue">Reviewed by Sam</span>
        <span className="lv3-label lv3-t-soft-55 ml-auto">PDF · .md</span>
      </div>
    </motion.div>
  );
}

export function AppMock() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: "-15% 0px -15% 0px" });
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? TURNS.length : 0);

  useEffect(() => {
    if (reduce) return;
    if (!inView) return;
    const id = setInterval(() => {
      setStep((s) => (s >= TURNS.length + 1 ? 0 : s + 1));
    }, 1500);
    return () => clearInterval(id);
  }, [inView, reduce]);

  const shown = TURNS.slice(0, step);
  const delivered = step > TURNS.length;
  const speaking = shown.length ? shown[shown.length - 1].who : null;
  const events = EVENTS.filter((e) => e.at <= step);

  return (
    <div
      ref={ref}
      className="grid overflow-hidden rounded-xl border bg-white shadow-sm md:grid-cols-[196px_1fr_210px]"
      style={{ height: 460 }}
      aria-label="A Hatchin project: the team on the left, the conversation in the middle, and what they did on the right"
    >
      {/* ── roster ─────────────────────────────────────────────────── */}
      <div className="hidden flex-col gap-1.5 border-r p-3 md:flex" style={{ background: "#fbfbfe" }}>
        <span className="lv3-label lv3-t-soft-55 px-1 pb-1">Your team</span>
        {CAST.map((c) => {
          const active = speaking === c.name;
          return (
            <motion.div
              key={c.name}
              className="flex items-center gap-2 border bg-white p-2"
              style={
                active
                  ? { borderColor: "rgba(108,130,255,0.45)", background: "rgba(108,130,255,0.06)" }
                  : undefined
              }
              animate={{ x: active ? 3 : 0 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <AgentAvatar
                characterName={c.name}
                role={c.role}
                size={24}
                state={active ? "working" : "idle"}
                className="shrink-0"
              />
              {/* role wraps rather than truncating: no mid-word cut-offs */}
              <span className="min-w-0">
                <span className="lv3-t-navy block text-[12px] font-semibold">{c.name}</span>
                <span className="lv3-label lv3-t-soft-55 block text-[9px] leading-tight">{c.role}</span>
              </span>
            </motion.div>
          );
        })}
        <div className="mt-auto border border-dashed p-2 text-center">
          <span className="lv3-label lv3-t-soft-55 text-[9px]">+ 30 more roles</span>
        </div>
      </div>

      {/* ── conversation, with the finished document arriving over it ── */}
      <div className="relative flex min-w-0 flex-col overflow-hidden">
        <DeliverablePanel show={delivered} />
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="lv3-t-navy text-[13px] font-semibold">Your project · everyone</span>
          <span className="lv3-label lv3-t-soft-55 hidden sm:block">project chat</span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden p-4">
          <AnimatePresence initial={false}>
            {shown.map((t, i) => (
              <motion.div
                key={`${i}-${t.text.slice(0, 12)}`}
                layout
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className={t.who ? "flex items-start gap-2" : "flex justify-end"}
              >
                {t.who ? (
                  <>
                    <AgentAvatar
                      characterName={t.who}
                      role={t.role}
                      size={22}
                      className="mt-0.5 shrink-0"
                    />
                    <span className="min-w-0 max-w-[85%]">
                      <span className="lv3-t-soft-55 mb-0.5 block text-[10px]">
                        {t.who} · {t.role}
                      </span>
                      <span
                        className="lv3-t-navy block border px-2.5 py-1.5 text-[12.5px] leading-snug"
                        style={{ background: t.tint }}
                      >
                        {t.text}
                      </span>
                    </span>
                  </>
                ) : (
                  <span
                    className="lv3-t-navy max-w-[80%] border px-2.5 py-1.5 text-[12.5px] leading-snug"
                    style={{ background: "#f1f2f8" }}
                  >
                    {t.text}
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="border-t px-4 py-2.5">
          <div className="lv3-t-soft-55 flex items-center justify-between border px-3 py-2 text-[12px]">
            Message your team...
            <span
              className="flex size-5 items-center justify-center rounded-full text-white"
              style={{ background: "var(--lv3-blue)" }}
            >
              <ArrowRight className="size-3" />
            </span>
          </div>
        </div>
      </div>

      {/* ── activity ───────────────────────────────────────────────── */}
      <div className="hidden flex-col border-l p-3 lg:flex" style={{ background: "#fbfbfe" }}>
        <span className="lv3-label lv3-t-soft-55 px-1 pb-2">Activity</span>
        <ul className="flex flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {events.map((e) => (
              <motion.li
                key={e.label}
                initial={reduce ? false : { opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="flex items-start gap-2 border bg-white p-2"
              >
                <span
                  className="mt-0.5 flex size-4 shrink-0 items-center justify-center"
                  style={{
                    background:
                      e.kind === "review"
                        ? "rgba(242,180,65,0.18)"
                        : e.kind === "handoff"
                          ? "rgba(159,123,255,0.16)"
                          : "rgba(108,130,255,0.12)",
                    color:
                      e.kind === "review"
                        ? "var(--lv3-amber)"
                        : e.kind === "handoff"
                          ? "var(--lv3-purple)"
                          : "var(--lv3-blue)",
                  }}
                >
                  {e.kind === "review" ? (
                    <ShieldCheck className="size-2.5" />
                  ) : e.kind === "handoff" ? (
                    <ArrowRight className="size-2.5" />
                  ) : e.kind === "done" ? (
                    <Check className="size-2.5" />
                  ) : (
                    <ListChecks className="size-2.5" />
                  )}
                </span>
                <span className="lv3-t-navy min-w-0 text-[11px] leading-snug">{e.label}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {events.length === 0 && (
          <span className="lv3-t-soft-55 px-1 text-[11px] leading-snug">
            Everything they do lands here.
          </span>
        )}
      </div>
    </div>
  );
}

export default AppMock;
