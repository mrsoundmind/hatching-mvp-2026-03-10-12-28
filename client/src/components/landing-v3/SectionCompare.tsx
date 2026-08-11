// Landing v3 · Not a chatbot — the many differences, side by side.
//
// The "why not just use ChatGPT?" beat. Earlier cuts argued a single point (you're
// the CEO / it agrees vs it's honest), which sold a chatbot short: the real gap is
// broad. This lays the differences out as a comparison, a faceless one-AI column
// against your team of real named specialists, across six things a chatbot can't do
// and the team does. A spotlight walks down the rows so each difference gets its
// moment; the green checks draw themselves in as the rows arrive; hover holds a row.
// Reduced motion gets the full static table.

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { Check, Minus, Sparkles } from "lucide-react";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import { Reveal } from "./primitives";

const ROWS = [
  { bot: "One AI, playing every role", team: "A team of real specialists, by name" },
  { bot: "Agrees with whatever you say", team: "Tells you the truth, pushes back" },
  { bot: "Hands you a wall of text", team: "Hands you finished, ready work" },
  { bot: "Waits for your next message", team: "Keeps working while you're away" },
  { bot: "Nobody checks its answer", team: "A teammate reviews it before you see it" },
  { bot: "Forgets every new chat", team: "Remembers your project, and builds on it" },
];

const CLUSTER = [
  { name: "Alex", role: "Product Manager" },
  { name: "Cleo", role: "Product Designer" },
  { name: "Juhi", role: "Finance Analyst" },
  { name: "Kai", role: "Growth Marketer" },
  { name: "Sam", role: "QA Lead" },
];

export function SectionCompare() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px -15% 0px" });
  const reduce = useReducedMotion();
  const [seen, setSeen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState<number | null>(null);

  // fade the rows in the first time the section is on screen
  useEffect(() => {
    if (inView) setSeen(true);
  }, [inView]);

  // once the rows have arrived, let the spotlight start walking
  useEffect(() => {
    if (!seen) return;
    if (reduce) { setEntered(true); return; }
    const t = setTimeout(() => setEntered(true), 1300);
    return () => clearTimeout(t);
  }, [seen, reduce]);

  // walk the highlight down the differences; hover holds one, off-screen pauses
  useEffect(() => {
    if (!entered || reduce || held !== null || !inView) return;
    const id = setInterval(() => setActive((a) => (a + 1) % ROWS.length), 1500);
    return () => clearInterval(id);
  }, [entered, reduce, held, inView]);

  const activeIdx = held ?? active;

  return (
    <section ref={ref} id="knowledge" className="lv3-bg-candle py-24 sm:py-28">
      <style>{`
        .lv3cmp-check path, .lv3cmp-check polyline { stroke-dasharray: 26; stroke-dashoffset: 26; transition: stroke-dashoffset 0.55s ease 0.2s; }
        .lv3cmp-check.drawn path, .lv3cmp-check.drawn polyline { stroke-dashoffset: 0; }
        @media (prefers-reduced-motion: reduce) {
          .lv3cmp-check path, .lv3cmp-check polyline { stroke-dashoffset: 0 !important; transition: none !important; }
        }
      `}</style>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <span className="lv3-label lv3-t-blue">Not a chatbot</span>
          <h2 className="lv3-display lv3-t-navy mt-4 text-balance">
            One bot,{" "}
            <span className="lv3-serif-em">or a whole team.</span>
          </h2>
          <p className="lv3-t-soft mt-4 text-lg leading-relaxed">
            The difference isn't one thing. It's most things.
          </p>
        </Reveal>

        <div className="mt-9 overflow-hidden border bg-white" style={{ borderColor: "var(--lv3-border)" }}>
          {/* header: one faceless AI vs your real faces */}
          <div className="grid grid-cols-1 sm:grid-cols-2">
            <div className="flex items-center gap-3 border-b border-r p-5 sm:px-7" style={{ borderColor: "var(--lv3-border)", background: "#f5f6fb" }}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: "var(--lv3-border)", color: "var(--lv3-soft-55)", background: "#e9ebf4" }}>
                <Sparkles className="size-4" />
              </span>
              <span className="lv3-label lv3-t-soft-55">A chatbot</span>
            </div>
            <div className="flex items-center gap-3 border-b p-5 sm:px-7" style={{ borderColor: "var(--lv3-border)" }}>
              <span className="flex -space-x-2">
                {CLUSTER.map((m) => (
                  <span key={m.name} className="rounded-full ring-2 ring-white">
                    <AgentAvatar characterName={m.name} role={m.role} size={26} />
                  </span>
                ))}
              </span>
              <span className="lv3-label lv3-t-blue">Your Hatchin team</span>
            </div>
          </div>

          {/* the differences */}
          {ROWS.map((r, i) => {
            const on = !reduce && entered && activeIdx === i;
            const dim = !reduce && entered && activeIdx !== i;
            return (
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-2"
                style={{
                  opacity: reduce ? 1 : !seen ? 0 : dim ? 0.5 : 1,
                  transform: !seen && !reduce ? "translateY(8px)" : "none",
                  transition: "opacity 0.45s ease, transform 0.45s cubic-bezier(0.16,1,0.3,1)",
                  transitionDelay: seen && !entered && !reduce ? `${0.05 + i * 0.09}s` : "0s",
                }}
                onMouseEnter={() => setHeld(i)}
                onMouseLeave={() => setHeld(null)}
              >
                <div className="flex items-start gap-3 border-r border-t px-5 py-4 sm:px-7" style={{ borderColor: "var(--lv3-border)", background: "#f5f6fb" }}>
                  <Minus className="mt-0.5 size-4 shrink-0" style={{ color: "#b3b7c7" }} />
                  <span className="lv3-t-soft text-[15px] leading-snug">{r.bot}</span>
                </div>
                <div
                  className="flex items-start gap-3 border-t px-5 py-4 sm:px-7"
                  style={{ borderColor: "var(--lv3-border)", background: on ? "rgba(15,157,118,0.08)" : "transparent", transition: "background 0.3s ease" }}
                >
                  <Check
                    className={"lv3cmp-check mt-0.5 size-4 shrink-0" + (seen || reduce ? " drawn" : "")}
                    style={{
                      color: "#0F9D76",
                      transform: on ? "scale(1.35)" : "scale(1)",
                      transformOrigin: "50% 50%",
                      transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
                    }}
                  />
                  <span className="lv3-t-navy text-[15px] font-medium leading-snug">{r.team}</span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="lv3-t-soft mt-5 max-w-3xl text-[14px] leading-relaxed">
          <span className="lv3-t-navy font-semibold">One bot answers.</span> A team of real specialists tells you the
          truth, checks each other, and keeps working, even while you sleep.
        </p>
      </div>
    </section>
  );
}

export default SectionCompare;
