// Landing v3 · The work is real.
//
// The page's biggest gap was proof: every section was a beautiful illustration,
// and nothing showed the actual OUTPUT. This section closes that honestly, no
// fabricated testimonials or invented user counts. Instead it shows the thing
// that actually proves the product: a real example of the work it ships (clearly
// labelled "example"), plus three capability facts that are true of the product
// today, and an honest early-access framing.
//
// If/when there are real users, a real sample doc, or a founder quote, they slot
// straight in here. Until then this is credibility you can stand behind.

import { ArrowRight, BookOpen, Check, ShieldCheck, Users } from "lucide-react";
import { motion } from "framer-motion";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import { CTA, Reveal, EASE, VIEWPORT } from "./primitives";

// a realistic PRD excerpt — the kind of document the team produces
const DOC = {
  kind: "Product requirements",
  title: "Move the calendar ask after first value",
  sections: [
    { h: "Problem", b: "60% of new users drop during setup. Three of five watched sessions stalled at calendar-connect, which asks for access before anyone has seen value." },
    { h: "Scope", b: "Move calendar-connect to after the first aha moment. Out of scope: redesigning the dashboard." },
    { h: "Success", b: "Setup completion +15pp. Time-to-first-value under 3 minutes. No drop in connect rate among users who finish." },
    { h: "Edge cases", b: "No-calendar users, revoked permissions, and the re-onboarding path Sam flagged in review." },
  ],
};

const FACTS = [
  { icon: Users, label: "30+ specialists", sub: "One for every part of the work, not one bot in many hats." },
  { icon: ShieldCheck, label: "Every draft peer-reviewed", sub: "Read by a second teammate before it ever reaches you." },
  { icon: BookOpen, label: "Grounded in real frameworks", sub: "RICE, LTV : CAC, and the rest, applied, not guessed." },
];

export function SectionProof() {
  return (
    <section id="proof" className="lv3-bg-candle px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-9 max-w-2xl">
          <span className="lv3-label lv3-t-blue">The work is real</span>
          <h2 className="lv3-display lv3-t-navy mt-4 text-balance">
            This is the work.{" "}
            <span className="lv3-serif-em">Not a chat log.</span>
          </h2>
          <p className="lv3-t-soft mt-4 text-lg leading-relaxed">
            You don't get a transcript to turn into a document. You get the document, structured,
            reviewed, and ready. Here's the kind of thing that lands in your hands.
          </p>
        </Reveal>

        <div className="grid items-start gap-3 lg:grid-cols-[1.12fr_0.88fr]">
          {/* the example deliverable */}
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
              <span className="lv3-label lv3-t-soft-55 ml-auto shrink-0">v3</span>
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
                  <span className="lv3-label lv3-t-blue">{s.h}</span>
                  <p className="lv3-t-navy mt-1.5 text-[13.5px] leading-relaxed">{s.b}</p>
                </motion.div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t px-5 py-3" style={{ borderColor: "var(--lv3-border)", background: "rgba(15,157,118,0.05)" }}>
              <AgentAvatar characterName="Sam" role="QA Lead" size={22} className="shrink-0" />
              <span className="lv3-t-soft text-[11.5px]">Reviewed by Sam before it reached you</span>
              <span className="lv3-label lv3-t-soft-55 ml-auto">PDF · .md</span>
            </div>
          </motion.div>

          {/* honest credibility, not testimonials */}
          <div className="flex flex-col gap-3">
            <span className="lv3-label lv3-t-soft-55">An example of what your team ships, illustrative</span>
            {FACTS.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.label}
                  className="flex items-start gap-3 border bg-white p-4"
                  style={{ borderColor: "var(--lv3-border)" }}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.45, ease: EASE, delay: i * 0.08 }}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center" style={{ background: "rgba(66,87,232,0.08)" }}>
                    <Icon className="lv3-t-blue size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="lv3-t-navy block text-[14px] font-semibold leading-tight">{f.label}</span>
                    <span className="lv3-t-soft-55 mt-0.5 block text-[12px] leading-snug">{f.sub}</span>
                  </span>
                </motion.div>
              );
            })}

            {/* honest early-access framing + a real CTA */}
            <motion.div
              className="mt-1 flex flex-col gap-3 border p-5"
              style={{ borderColor: "var(--lv3-navy)", background: "var(--lv3-navy)" }}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.45, ease: EASE, delay: 0.24 }}
            >
              <span className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "#fff" }}>
                <Check className="size-4" style={{ color: "var(--lv3-mint)" }} /> Hatchin is new
              </span>
              <span className="text-[12.5px] leading-snug" style={{ color: "rgba(243,241,236,0.78)" }}>
                You'd be one of the first founders to run a team this way. Start free, and help shape
                what it becomes.
              </span>
              <CTA href="/login" variant="primary" className="mt-1 self-start">
                Start free
                <ArrowRight className="ml-1.5 size-4" />
              </CTA>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SectionProof;
