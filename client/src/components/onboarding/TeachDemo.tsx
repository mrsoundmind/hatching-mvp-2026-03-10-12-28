import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Check, FileText, X } from "lucide-react";

/**
 * TeachDemo — a self-contained, game-like interactive demo of the Hatchin team.
 * It runs on a clearly-labeled "Demo workspace" (never a real project), so it
 * needs no server calls. Kept as a reusable product demo (e.g. for the landing
 * page / homepage) — it is NOT the onboarding flow (onboarding teaches on the
 * real app). Preview it in dev at /dev/teachdemo.
 *
 * Four beats, each an action the user takes, then the lesson is revealed:
 *   1. meet  — tap Alex, then Cleo, hear two distinct expert voices
 *   2. talk  — send a message, watch Alex push back (they tell you the truth)
 *   3. brain — drop in a brief, the whole team works from it
 *   4. work  — hand a task to Dev, come back to it done (while you were away)
 */

interface TeachDemoProps {
  isOpen: boolean;
  onDone: () => void;
}

type Msg = { who: string; text: string; me?: boolean; color?: string; typing?: boolean };

const ALEX = "#3D5BFF";
const DEV = "#22A06B";
const CLEO = "#E0559A";
const MAYA = "#7C5CFF";

type BeatKey = "meet" | "talk" | "brain" | "work";

interface Beat {
  key: BeatKey;
  promptEy: string;
  promptTitle: string;
  reveal: { ey: string; title: string; body: string };
}

const BEATS: Beat[] = [
  {
    key: "meet",
    promptEy: "Your team",
    promptTitle: "Meet your team",
    reveal: {
      ey: "Your team",
      title: "Real experts, real personalities",
      body: "Each Hatch is trained on the real expertise of their field, so their calls are sharper. And each has their own voice, no two reply the same.",
    },
  },
  {
    key: "talk",
    promptEy: "How you use it",
    promptTitle: "Now talk to them",
    reveal: {
      ey: "Real opinions",
      title: "They tell you the truth",
      body: "Not a yes-machine. They push back when you are wrong.",
    },
  },
  {
    key: "brain",
    promptEy: "The brain",
    promptTitle: "Give them your context",
    reveal: {
      ey: "The brain",
      title: "Give them your context once",
      body: "Drop in a doc and the whole team follows it, always. No starting from scratch.",
    },
  },
  {
    key: "work",
    promptEy: "The work",
    promptTitle: "Hand off the work",
    reveal: {
      ey: "The work",
      title: "They work while you sleep",
      body: "Hand it off and walk away. You come back to it done.",
    },
  },
];

function Avatar({ label, color, size = 28 }: { label: string; color: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold text-white shrink-0"
      style={{ background: color, width: size, height: size, fontSize: size * 0.42 }}
    >
      {label[0]}
    </div>
  );
}

function Bubble({ m }: { m: Msg }) {
  if (m.me) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[84%] rounded-2xl rounded-tr-sm bg-hatchin-blue px-3.5 py-2.5 text-sm leading-snug text-white">
          {m.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5 max-w-[86%]">
      <Avatar label={m.who} color={m.color || MAYA} />
      <div>
        <div className="mb-1 ml-0.5 text-[11px] font-semibold text-hatchin-text-muted">{m.who}</div>
        <div
          className={`rounded-2xl rounded-tl-sm border border-hatchin-border-subtle bg-hatchin-card px-3.5 py-2.5 text-sm leading-snug text-hatchin-text ${
            m.typing ? "italic text-hatchin-text-muted" : ""
          }`}
        >
          {m.text}
        </div>
      </div>
    </div>
  );
}

// A subtle "look here" ring for the currently-actionable element.
const RING = "ring-2 ring-hatchin-blue shadow-[0_0_0_5px_rgba(108,130,255,0.16)]";

export function TeachDemo({ isOpen, onDone }: TeachDemoProps) {
  const [beatIndex, setBeatIndex] = useState(0);
  const [phase, setPhase] = useState<"prompt" | "reveal">("prompt");
  const [messages, setMessages] = useState<Msg[]>([
    { who: "Maya", text: "This is your team space. Ask anyone anything.", color: MAYA },
  ]);
  const [metAlex, setMetAlex] = useState(false);
  const [metCleo, setMetCleo] = useState(false);
  const [sent, setSent] = useState(false);
  const [briefAdded, setBriefAdded] = useState(false);
  const [handoff, setHandoff] = useState<"idle" | "working" | "done">("idle");

  if (!isOpen) return null;

  const beat = BEATS[beatIndex];
  const isLast = beatIndex === BEATS.length - 1;

  // Which element should glow as the next thing to tap.
  const target =
    phase === "reveal"
      ? null
      : beat.key === "meet"
      ? metAlex
        ? "cleo"
        : "alex"
      : beat.key === "talk"
      ? "composer"
      : beat.key === "brain"
      ? "brain"
      : handoff === "idle"
      ? "handoff"
      : null;

  const advance = () => {
    if (isLast) {
      onDone();
      return;
    }
    setBeatIndex((i) => i + 1);
    setPhase("prompt");
  };

  const addMsg = (m: Msg) => setMessages((prev) => [...prev, m]);

  const onTapAlex = () => {
    if (beat.key !== "meet" || metAlex) return;
    setMetAlex(true);
    addMsg({ who: "Alex", text: "Hey, I'm Alex, your PM. I keep us shipping the right thing, not just the most things.", color: ALEX });
  };

  const onTapCleo = () => {
    if (beat.key !== "meet" || !metAlex || metCleo) return;
    setMetCleo(true);
    addMsg({ who: "Cleo", text: "Cleo, design. I care how it feels, not just what it does, and I'll push on the details.", color: CLEO });
    window.setTimeout(() => setPhase("reveal"), 800);
  };

  const onSend = () => {
    if (beat.key !== "talk" || sent) return;
    setSent(true);
    addMsg({ who: "You", text: "Let's pack every feature into launch.", me: true });
    addMsg({ who: "Alex", text: "Alex is typing…", color: ALEX, typing: true });
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev.filter((m) => !m.typing),
        { who: "Alex", text: "Honestly, that's how launches slip. Ship what people need first, I'll have Dev size it.", color: ALEX },
      ]);
      window.setTimeout(() => setPhase("reveal"), 600);
    }, 1300);
  };

  const onAddBrief = () => {
    if (beat.key !== "brain" || briefAdded) return;
    setBriefAdded(true);
    window.setTimeout(() => setPhase("reveal"), 700);
  };

  const onGiveToDev = () => {
    if (beat.key !== "work" || handoff !== "idle") return;
    setHandoff("working");
    window.setTimeout(() => {
      setHandoff("done");
      window.setTimeout(() => setPhase("reveal"), 600);
    }, 1500);
  };

  const rowBase =
    "flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-hatchin-border-subtle bg-hatchin-dark shadow-2xl">
        {/* Top bar */}
        <div className="flex h-12 items-center gap-3 border-b border-hatchin-border-subtle px-4">
          <span className="text-sm font-extrabold tracking-tight text-hatchin-text-bright">
            Hatchin<span className="text-hatchin-blue">.</span>
          </span>
          <span className="rounded-full border border-hatchin-border-subtle px-2.5 py-1 text-[11px] text-hatchin-text-muted">
            Demo workspace
          </span>
          <div className="flex-1" />
          <button
            onClick={onDone}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] text-hatchin-text-muted hover:text-hatchin-text-bright"
          >
            Skip tour <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Mini app: roster / chat / brain+activity */}
        <div className="grid h-[440px] grid-cols-[200px_1fr_248px]">
          {/* Roster */}
          <div className="border-r border-hatchin-border-subtle p-3">
            <div className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-hatchin-text-muted">
              Team
            </div>
            <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-hatchin-card/60 px-2.5 py-2">
              <span className="text-lg">🧗</span>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-hatchin-text">Climbing Gym App</div>
                <div className="text-[11px] text-hatchin-text-muted">Demo · 3 Hatches</div>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <button
                onClick={onTapAlex}
                className={`${rowBase} text-left ${target === "alex" ? RING : "hover:bg-hatchin-card/60"} ${metAlex ? "bg-hatchin-blue/10" : ""}`}
              >
                <Avatar label="Alex" color={ALEX} />
                <div>
                  <div className="text-[13px] font-semibold text-hatchin-text">Alex</div>
                  <div className="text-[11px] text-hatchin-text-muted">Product Manager</div>
                </div>
              </button>
              <div className={`${rowBase}`}>
                <Avatar label="Dev" color={DEV} />
                <div>
                  <div className="text-[13px] font-semibold text-hatchin-text">Dev</div>
                  <div className="text-[11px] text-hatchin-text-muted">Engineer</div>
                </div>
              </div>
              <button
                onClick={onTapCleo}
                className={`${rowBase} text-left ${target === "cleo" ? RING : "hover:bg-hatchin-card/60"} ${metCleo ? "bg-hatchin-blue/10" : ""}`}
              >
                <Avatar label="Cleo" color={CLEO} />
                <div>
                  <div className="text-[13px] font-semibold text-hatchin-text">Cleo</div>
                  <div className="text-[11px] text-hatchin-text-muted">Designer</div>
                </div>
              </button>
            </div>
          </div>

          {/* Chat */}
          <div className="flex flex-col">
            <div className="flex h-12 items-center gap-2.5 border-b border-hatchin-border-subtle px-4">
              <Avatar label="Maya" color={MAYA} />
              <div>
                <div className="text-[13px] font-bold text-hatchin-text">Maya</div>
                <div className="text-[11px] text-hatchin-text-muted">Everyone</div>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              <AnimatePresence initial={false}>
                {messages.map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <Bubble m={m} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="border-t border-hatchin-border-subtle p-3">
              <div className={`flex items-center gap-2 rounded-xl border border-hatchin-border-subtle bg-hatchin-panel px-2 py-1.5 ${target === "composer" ? RING : ""}`}>
                <div className={`flex-1 px-2 text-sm ${beat.key === "talk" && !sent ? "text-hatchin-text" : "text-hatchin-text-muted"}`}>
                  {beat.key === "talk" && !sent ? "Let's pack every feature into launch." : "Message your team…"}
                </div>
                <button
                  onClick={onSend}
                  disabled={beat.key !== "talk" || sent}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-white transition ${
                    beat.key === "talk" && !sent ? "bg-hatchin-blue animate-pulse" : "bg-hatchin-blue/40"
                  }`}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Brain + activity */}
          <div className="border-l border-hatchin-border-subtle p-3.5">
            <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-hatchin-text-muted">
              Project brain
            </div>
            <div className={`rounded-xl border border-hatchin-border-subtle bg-hatchin-card/50 p-3 ${target === "brain" ? RING : ""}`}>
              <div className="mb-1.5 text-[12.5px] font-bold text-hatchin-text">
                {briefAdded ? "Project brain" : "What we're building"}
              </div>
              <p className="text-[12px] leading-snug text-hatchin-text-muted">
                Booking app for climbing gyms. For gym owners and members.
              </p>
              {beat.key === "brain" && !briefAdded && (
                <button
                  onClick={onAddBrief}
                  className="mt-2.5 rounded-lg bg-hatchin-blue px-3 py-1.5 text-[12.5px] font-semibold text-white hover:brightness-110"
                >
                  + Add your brief (PDF)
                </button>
              )}
              {briefAdded && (
                <div className="mt-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-hatchin-border-subtle bg-hatchin-blue/15 px-2 py-1 text-[12px] text-hatchin-text">
                    <FileText className="h-3.5 w-3.5" /> climbing-gym-brief.pdf
                  </span>
                  <p className="mt-2 flex items-center gap-1 text-[11.5px] text-hatchin-green">
                    <Check className="h-3.5 w-3.5" /> Read by the whole team. They'll follow it.
                  </p>
                </div>
              )}
            </div>

            <div className="mb-2.5 mt-3.5 text-[11px] font-semibold uppercase tracking-wide text-hatchin-text-muted">
              Activity
            </div>
            <div className="rounded-xl border border-hatchin-border-subtle bg-hatchin-card/50 p-3">
              {handoff === "idle" && beat.key !== "work" && (
                <p className="text-[12px] leading-snug text-hatchin-text-muted">
                  Alex drafted the scope, handed to Dev to estimate.
                </p>
              )}
              {handoff === "idle" && beat.key === "work" && (
                <>
                  <p className="mb-2.5 text-[12px] text-hatchin-text-muted">Alex scoped it. Ready to build.</p>
                  <button
                    onClick={onGiveToDev}
                    className="rounded-lg bg-hatchin-blue px-3 py-1.5 text-[12.5px] font-semibold text-white hover:brightness-110"
                  >
                    Give it to Dev →
                  </button>
                </>
              )}
              {handoff === "working" && (
                <p className="text-[12px] leading-snug text-amber-400">
                  ● Dev is on it, sizing the build. This runs in the background, you can close the laptop.
                </p>
              )}
              {handoff === "done" && (
                <>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-hatchin-text-muted">
                    While you were away
                  </p>
                  <p className="mb-1 flex items-center gap-1 text-[12px] text-hatchin-green">
                    <Check className="h-3.5 w-3.5" /> Dev delivered the estimate.
                  </p>
                  <p className="text-[11.5px] text-hatchin-text-muted">Saved to your brain. 3 day build.</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Coach dock */}
        <div className="border-t border-hatchin-border-subtle bg-hatchin-panel px-5 py-4">
          <div className="mx-auto flex max-w-3xl items-center gap-4">
            {/* progress dots */}
            <div className="flex gap-1.5">
              {BEATS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === beatIndex ? "w-5 bg-hatchin-blue" : "w-1.5 bg-hatchin-border-subtle"
                  }`}
                />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-hatchin-blue">
                {phase === "reveal" ? beat.reveal.ey : beat.promptEy}
              </div>
              <div className="text-[15px] font-semibold text-hatchin-text-bright">
                {phase === "reveal" ? beat.reveal.title : beat.promptTitle}
              </div>
              <div className="text-[13px] leading-snug text-hatchin-text-muted">
                {phase === "reveal"
                  ? beat.reveal.body
                  : beat.key === "meet"
                  ? metAlex
                    ? "Now tap Cleo, hear a different voice."
                    : "Tap Alex to say hi."
                  : beat.key === "talk"
                  ? "Hit send and see what Alex says."
                  : beat.key === "brain"
                  ? "Add your brief to the brain."
                  : "Tap Give it to Dev."}
              </div>
            </div>
            {phase === "reveal" && (
              <button
                onClick={advance}
                className="shrink-0 rounded-lg bg-hatchin-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
              >
                {isLast ? "Start my project" : "Next"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
