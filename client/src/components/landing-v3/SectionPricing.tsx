// Landing v3 · 06 — Pricing.
//
// Replaces "Two ways in. Both free to try.", which was vague twice over: it did
// not say what the two ways were, and it buried the actual price in a link row
// at the bottom. A visitor at this point wants one question answered — what
// does it cost and what do I get — so the section answers it directly.
//
// The animation is the difference between the plans, not decoration: the Pro
// card runs the team working while you are away, which is literally the thing
// the paid tier unlocks. Free shows the same team, idle, waiting for you.

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Check, Minus } from "lucide-react";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import { CTA, Reveal, EASE, VIEWPORT } from "./primitives";

const CREW = [
  { name: "Alex", role: "Product Manager" },
  { name: "Lumi", role: "UX Designer" },
  { name: "Sam", role: "QA Lead" },
  { name: "Juhi", role: "Finance Analyst" },
];

/** Free: the team is there, but nothing moves unless you are in the room. */
function IdleCrew() {
  return (
    <div className="flex items-center gap-2">
      {CREW.map((c) => (
        <AgentAvatar
          key={c.name}
          characterName={c.name}
          role={c.role}
          size={30}
          className="opacity-45"
        />
      ))}
      <span className="lv3-label lv3-t-soft-55 ml-1">waiting for you</span>
    </div>
  );
}

/** Pro: the same team, working, with the shift rotating between them. */
function WorkingCrew({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce || !active) return;
    const id = setInterval(() => setI((v) => (v + 1) % CREW.length), 1100);
    return () => clearInterval(id);
  }, [active, reduce]);

  return (
    <div className="flex items-center gap-2">
      {CREW.map((c, idx) => (
        <motion.span
          key={c.name}
          className="relative inline-flex"
          animate={reduce ? {} : { y: idx === i ? -3 : 0 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          <AgentAvatar
            characterName={c.name}
            role={c.role}
            size={30}
            state={idx === i ? "working" : "idle"}
          />
          {idx === i && !reduce && (
            <span
              className="absolute -right-0.5 -top-0.5 size-2 rounded-full"
              style={{ background: "var(--lv3-amber-fill)" }}
            />
          )}
        </motion.span>
      ))}
      <span className="lv3-label ml-1" style={{ color: "var(--lv3-amber)" }}>
        working while you are out
      </span>
    </div>
  );
}

const PLANS = [
  {
    name: "Free",
    price: "$0",
    per: "forever",
    line: "The whole team, at your desk.",
    has: ["Every role on the roster", "3 projects", "Unlimited conversation", "Exportable deliverables"],
    hasnt: ["No work while you are away"],
    cta: "Start free",
    variant: "outlineNavy" as const,
  },
  {
    name: "Pro",
    price: "$19",
    per: "a month",
    line: "They keep going after you leave.",
    has: [
      "Everything in Free",
      "Unlimited projects",
      "Runs in the background",
      "Automatic handoffs",
      "A briefing when you return",
    ],
    hasnt: [],
    cta: "Go Pro",
    variant: "primary" as const,
  },
];

export function SectionPricing() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px -15% 0px" });

  return (
    <section ref={ref} id="start" className="lv3-bg-paper py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="mx-auto max-w-3xl text-center">
          <span className="lv3-label lv3-t-blue">Pricing</span>
          <h2 className="lv3-display lv3-t-navy mx-auto mt-4 text-balance">
            Free until{" "}
            <span className="lv3-serif-em">they start working without you.</span>
          </h2>
          <p className="lv3-t-soft mx-auto mt-4 max-w-xl text-lg">
            No seats. No per-teammate cost.
          </p>
        </Reveal>

        <div className="mt-12 grid overflow-hidden border md:grid-cols-2">
          {PLANS.map((p, i) => {
            const isPro = p.name === "Pro";
            return (
              <motion.div
                key={p.name}
                className="flex flex-col p-8 sm:p-10"
                style={isPro ? { background: "#fbfbff" } : undefined}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={VIEWPORT}
                transition={{ duration: 0.5, ease: EASE, delay: i * 0.08 }}
              >
                <div className={i === 0 ? "md:border-r-0" : ""}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="lv3-label lv3-t-soft-70">{p.name}</span>
                    {isPro && (
                      <span
                        className="lv3-label border px-2 py-0.5"
                        style={{
                          borderColor: "rgba(84,104,240,0.4)",
                          color: "var(--lv3-blue)",
                          background: "rgba(84,104,240,0.07)",
                        }}
                      >
                        adds autonomy
                      </span>
                    )}
                  </div>

                  <p className="lv3-num lv3-t-navy mt-3 text-[3rem] leading-none">
                    {p.price}
                    <span className="lv3-t-soft ml-2 text-base font-medium">{p.per}</span>
                  </p>
                  <p className="lv3-t-navy mt-3 text-[15px] font-semibold">{p.line}</p>

                  <div className="mt-6 border p-4">
                    {isPro ? <WorkingCrew active={inView} /> : <IdleCrew />}
                  </div>

                  <ul className="mt-6 space-y-2.5">
                    {p.has.map((f) => (
                      <li key={f} className="lv3-t-ink flex items-start gap-2.5 text-[14.5px]">
                        <Check className="lv3-t-blue mt-0.5 size-4 shrink-0" />
                        {f}
                      </li>
                    ))}
                    {p.hasnt.map((f) => (
                      <li key={f} className="lv3-t-soft-55 flex items-start gap-2.5 text-[14.5px]">
                        <Minus className="mt-0.5 size-4 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8">
                    <CTA href="/login" variant={p.variant}>
                      {p.cta}
                    </CTA>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <p className="lv3-label lv3-t-soft-55 mt-4 text-center">
          No card to start · cancel any time
        </p>
      </div>
    </section>
  );
}

export default SectionPricing;
