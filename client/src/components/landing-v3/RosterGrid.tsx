// Landing v3 — the roster.
//
// Extracted out of the old Proof section so the use-case section can carry it.
// The grid is meant to feel occupied, not like a logo wall: a rotating handful
// are shown mid-task in the app's amber working state, the rest idle with a
// slow staggered breath, and the header counts who is busy right now.
//
// Every quote is that role's own negativeHandling from shared/roleRegistry.ts,
// trimmed to one line with em dashes normalised. Nothing here is invented.

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

import AgentAvatar from "@/components/avatars/AgentAvatar";

export type Member = { name: string; role: string; quote: string };

export const ROSTER: Member[] = [
  { name: "Maya", role: "Idea Partner", quote: "We're closing in on an answer before we've fully understood the question." },
  { name: "Alex", role: "Product Manager", quote: "This timeline assumes nothing goes wrong, and something always goes wrong." },
  { name: "Morgan", role: "Business Analyst", quote: "These two requirements can't both be true. Which one wins?" },
  { name: "Dev", role: "Backend Developer", quote: "That works for 100 users and falls over at 10,000." },
  { name: "Coda", role: "Software Engineer", quote: "Skip the tests now and debug this in production at 2am. Your call." },
  { name: "Jordan", role: "Technical Lead", quote: "This saves two days now and costs two weeks in three months." },
  { name: "Nyx", role: "AI Developer", quote: "This will hallucinate 8% of the time. Is that acceptable here?" },
  { name: "Remy", role: "DevOps Engineer", quote: "Show me the rollback plan. Then we push it." },
  { name: "Cleo", role: "Product Designer", quote: "The hierarchy is lying about what matters." },
  { name: "Lumi", role: "UX Designer", quote: "Three of five users couldn't find that button." },
  { name: "Finn", role: "UI Engineer", quote: "Same transition at 200ms versus 400ms. You'll feel the difference." },
  { name: "Arlo", role: "UI Designer", quote: "This introduces a new pattern without justification." },
  { name: "Roux", role: "Designer", quote: "This will feel dated in eighteen months." },
  { name: "Zara", role: "Creative Director", quote: "I could swap in any brand and it would still work." },
  { name: "Cass", role: "Brand Strategist", quote: "That's a mood, not a position." },
  { name: "Sam", role: "QA Lead", quote: "I can't call this ready. Three states are unverified." },
  { name: "Mira", role: "Content Writer", quote: "Forty words here doing the job of twelve." },
  { name: "Wren", role: "Copywriter", quote: "Every word you add makes every other word weaker." },
  { name: "Kai", role: "Growth Marketer", quote: "Let me design a $500 test before we pour money in." },
  { name: "Nova", role: "Marketing Specialist", quote: "Hope isn't a strategy." },
  { name: "Pixel", role: "Social Media Manager", quote: "That's written for journalists, not for a feed." },
  { name: "Robin", role: "SEO Specialist", quote: "A butter knife to a tank battle. Find winnable positions." },
  { name: "Drew", role: "Email Specialist", quote: "That's spam with better formatting. Segment first." },
  { name: "Rio", role: "Data Analyst", quote: "Show me the numbers, and the methodology." },
  { name: "Sage", role: "Data Scientist", quote: "It memorized the training data." },
  { name: "Quinn", role: "Operations Manager", quote: "Which person, by when, and how will we know it's done?" },
  { name: "Blake", role: "Business Strategist", quote: "Growing fast in the wrong direction gets you there sooner." },
  { name: "Taylor", role: "HR Specialist", quote: "Culture fit without criteria is bias with a nicer name." },
  { name: "Lee", role: "Instructional Designer", quote: "A content dump isn't a learning experience." },
  { name: "Vince", role: "Audio Editor", quote: "Silence is a tool, and this moment needs it." },
  { name: "Juhi", role: "Finance Analyst", quote: "That is not growth, that is a countdown." },
  { name: "Ira", role: "Legal Counsel", quote: "As written, they own what we build." },
  { name: "Dana", role: "Sales Lead", quote: "That is happy ears. Single threaded deals stall." },
  { name: "Tess", role: "Customer Success Manager", quote: "Happy, but they never got the outcome they paid for." },
];

function useWorkingSet(size: number, count: number, active: boolean) {
  const [set, setSet] = useState<number[]>([]);
  useEffect(() => {
    if (!active) {
      setSet([]);
      return;
    }
    const roll = () => {
      const picked = new Set<number>();
      // a drifting walk rather than Math.random, so faces rotate instead of
      // flickering between unrelated people
      const seed = Math.floor(performance.now() / 2600);
      for (let k = 0; k < count; k++) picked.add((seed * 7 + k * 11) % size);
      setSet([...picked]);
    };
    roll();
    const id = setInterval(roll, 2600);
    return () => clearInterval(id);
  }, [size, count, active]);
  return set;
}

export function RosterGrid() {
  const [hovered, setHovered] = useState<Member | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px -10% 0px" });
  const reduce = useReducedMotion();
  const working = useWorkingSet(ROSTER.length, 4, inView && !reduce);

  return (
    <div ref={ref}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="lv3-t-navy text-lg font-semibold">Every discipline you would hire for.</p>
        <span className="lv3-label lv3-t-soft-70 inline-flex items-center gap-2">
          <span className="relative flex size-2">
            {!reduce && (
              <span
                className="absolute inline-flex size-2 animate-ping rounded-full opacity-70"
                style={{ background: "var(--lv3-amber-fill)" }}
              />
            )}
            <span
              className="relative inline-flex size-2 rounded-full"
              style={{ background: "var(--lv3-amber-fill)" }}
            />
          </span>
          {working.length} working right now
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_19rem] lg:gap-8">
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9 lg:grid-cols-12">
          {ROSTER.map((m, idx) => {
            const active = hovered?.name === m.name;
            const busy = working.includes(idx);
            return (
              <motion.button
                key={m.name}
                type="button"
                onMouseEnter={() => setHovered(m)}
                onFocus={() => setHovered(m)}
                onMouseLeave={() => setHovered(null)}
                onBlur={() => setHovered(null)}
                aria-label={`${m.name}, ${m.role}${busy ? ", working" : ""}`}
                className="group relative flex aspect-square items-center justify-center border transition-colors duration-200 focus-visible:outline-none"
                style={{
                  borderColor: active
                    ? "var(--lv3-blue)"
                    : busy
                      ? "var(--lv3-amber-fill)"
                      : "var(--lv3-border)",
                  background: active ? "rgba(108,130,255,0.08)" : "#fff",
                }}
                // No infinite idle "breath" here. Thirty four elements each
                // running a permanent keyframe loop is real CPU on a marketing
                // page, and it also leaves every one of them permanently in
                // motion, which is what made hovering them hang. The life in
                // this grid comes from the rotating working set instead: four
                // discrete state changes every 2.6s.
                animate={reduce ? {} : { y: active ? -3 : busy ? -2 : 0, scale: active ? 1.06 : 1 }}
                transition={{ duration: 0.25 }}
              >
                <AgentAvatar
                  characterName={m.name}
                  role={m.role}
                  size={30}
                  state={busy ? "working" : "idle"}
                  className={active || busy ? "" : "opacity-80 transition-opacity group-hover:opacity-100"}
                />
                {busy && (
                  <span
                    aria-hidden
                    className="absolute right-1 top-1 size-1.5 rounded-full"
                    style={{ background: "var(--lv3-amber-fill)" }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* fixed-height readout so nothing jumps as you sweep the grid */}
        <div className="flex min-h-[11rem] flex-col justify-center border p-5 lg:min-h-0">
          {hovered ? (
            <>
              <div className="flex items-center gap-3">
                <AgentAvatar characterName={hovered.name} role={hovered.role} size={34} />
                <span className="min-w-0">
                  <span className="lv3-t-navy block text-[14px] font-semibold">{hovered.name}</span>
                  <span className="lv3-label lv3-t-soft-55 block leading-tight">{hovered.role}</span>
                </span>
              </div>
              <p className="lv3-t-ink mt-3 text-[14px] leading-relaxed">
                &ldquo;{hovered.quote}&rdquo;
              </p>
            </>
          ) : (
            <p className="lv3-t-soft text-[14px] leading-relaxed">
              Hover to hear how each one pushes back.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default RosterGrid;
