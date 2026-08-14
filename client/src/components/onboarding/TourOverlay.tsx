import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * First-run coachmark tour that spotlights the REAL app.
 *
 * Unlike a mocked demo, this measures live DOM nodes (the actual sidebar, chat,
 * and right-sidebar panels) and dims everything except the current target. It is
 * mounted by home.tsx once, right after a project is created during onboarding.
 *
 * Anchors:
 *  - [data-tour="team"]          -> LeftSidebar project/roster list
 *  - [data-tour="chat"]          -> CenterPanel message area
 *  - #sidebar-tabpanel-brain     -> RightSidebar Brain tab (switched via event)
 *  - #sidebar-tabpanel-activity  -> RightSidebar Activity tab (switched via event)
 */

export const TOUR_DONE_KEY = "hatchin_tour_completed";

interface Beat {
  key: string;
  selector: string;
  title: string;
  body: string;
  side: "left" | "right";
  preAction?: () => void;
}

const BEATS: Beat[] = [
  {
    key: "team",
    selector: '[data-tour="team"]',
    title: "Real experts, real personalities",
    body: "A PM, an engineer, a designer, and more. Each is trained on the real expertise of their field, and each has their own voice, no two reply the same.",
    side: "right",
  },
  {
    key: "chat",
    selector: '[data-tour="chat"]',
    title: "They get to work for you",
    body: "Give them a goal and the team runs with it, each in their own voice. Here they scope the MVP, push back on what won't work, and draft the copy, real output, not just chat.",
    side: "right",
  },
  {
    key: "brain",
    selector: "#sidebar-tabpanel-brain",
    title: "Give them your context once",
    body: "Everything the team knows about your project lives here. Drop in a brief and the whole team follows it, always, so you never start from scratch or repeat yourself.",
    side: "left",
    preAction: () => window.dispatchEvent(new CustomEvent("hatchin:open-brain")),
  },
  {
    key: "autonomy",
    selector: '[data-tour="autonomy"]',
    title: "Turn on autonomy",
    body: "This dial sets how much they do on their own, from just watching to running the whole task. Turn it up and they work in the background without you, handing off between specialists and reviewing each other.",
    side: "left",
    preAction: () => {
      window.dispatchEvent(new CustomEvent("hatchin:open-brain"));
      // Bring the autonomy dial into view within the scrollable Brain panel.
      setTimeout(() => {
        document.querySelector('[data-tour="autonomy"]')?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 60);
    },
  },
  {
    key: "activity",
    selector: "#sidebar-tabpanel-activity",
    title: "They work while you sleep",
    body: "Once they're running, their progress shows up here, live. Close the laptop and come back to it done, work handed between specialists while you were away.",
    side: "left",
    preAction: () => window.dispatchEvent(new CustomEvent("hatchin:open-activity")),
  },
];

const CARD_W = 340;
const PAD = 8;
const GAP = 18;

interface TourOverlayProps {
  onDone: () => void;
}

export function TourOverlay({ onDone }: TourOverlayProps) {
  const [index, setIndex] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const doneRef = useRef(false);

  const measure = useCallback((selector: string): DOMRect | null => {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null; // not laid out / hidden tab
    return r;
  }, []);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    try { localStorage.setItem(TOUR_DONE_KEY, "1"); } catch { /* ignore */ }
    onDone();
  }, [onDone]);

  // Advance to a beat: run its side-effect (e.g. switch sidebar tab), then poll
  // for the target to be laid out before showing the spotlight. Missing targets
  // are skipped rather than blocking the tour.
  const goTo = useCallback((i: number) => {
    if (i >= BEATS.length) { finish(); return; }
    const beat = BEATS[i];
    beat.preAction?.();
    let tries = 0;
    const tick = () => {
      if (doneRef.current) return;
      const r = measure(beat.selector);
      if (r) {
        setIndex(i);
        setRect(r);
      } else if (tries++ < 40) {
        setTimeout(tick, 50);
      } else {
        goTo(i + 1); // give up on this anchor, keep the tour moving
      }
    };
    tick();
  }, [measure, finish]);

  // Kick off on mount.
  useEffect(() => {
    goTo(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the spotlight glued to its target through resizes / inner scrolls.
  useEffect(() => {
    if (index < 0) return;
    const remeasure = () => {
      const r = measure(BEATS[index].selector);
      if (r) setRect(r);
    };
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);
    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true);
    };
  }, [index, measure]);

  // Escape skips the whole tour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  // Position the tooltip card next to the target once we know both rects.
  useLayoutEffect(() => {
    if (!rect || index < 0) return;
    const beat = BEATS[index];
    const cardH = cardRef.current?.offsetHeight ?? 210;
    let left = beat.side === "right" ? rect.right + GAP : rect.left - CARD_W - GAP;
    let top = rect.top;
    left = Math.max(16, Math.min(left, window.innerWidth - CARD_W - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - cardH - 16));
    setCardPos({ top, left });
  }, [rect, index]);

  const next = () => goTo(index + 1);
  const back = () => { if (index > 0) goTo(index - 1); };

  const beat = index >= 0 ? BEATS[index] : null;
  const isLast = index === BEATS.length - 1;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100 }} aria-live="polite">
      {/* Transparent blocker so the app underneath isn't interactable mid-tour. */}
      <div
        style={{ position: "absolute", inset: 0, pointerEvents: "auto", background: "transparent" }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Spotlight: a hole punched in a full-screen dim via a huge box-shadow. */}
      {rect && (
        <div
          style={{
            position: "absolute",
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            borderRadius: 14,
            boxShadow: "0 0 0 9999px rgba(6,8,16,0.74)",
            outline: "2px solid rgba(79,107,255,0.9)",
            outlineOffset: 2,
            pointerEvents: "none",
            transition: "top .35s cubic-bezier(.22,1,.36,1), left .35s cubic-bezier(.22,1,.36,1), width .35s cubic-bezier(.22,1,.36,1), height .35s cubic-bezier(.22,1,.36,1)",
          }}
        />
      )}

      {/* Coach card */}
      {beat && (
        <div
          ref={cardRef}
          style={{
            position: "absolute",
            top: cardPos.top,
            left: cardPos.left,
            width: CARD_W,
            maxWidth: "calc(100vw - 32px)",
            background: "linear-gradient(180deg,#161a2b,#121524)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 16,
            padding: 18,
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            pointerEvents: "auto",
            transition: "top .35s cubic-bezier(.22,1,.36,1), left .35s cubic-bezier(.22,1,.36,1)",
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7C8CFF", fontWeight: 700 }}>
            Step {index + 1} of {BEATS.length}
          </div>
          <h3 style={{ margin: "6px 0 8px", fontSize: 17, letterSpacing: "-0.01em", color: "#F1F2F7" }}>
            {beat.title}
          </h3>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "#c9cde0" }}>
            {beat.body}
          </p>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {BEATS.map((b, i) => (
                <span
                  key={b.key}
                  style={{
                    width: i === index ? 18 : 6,
                    height: 6,
                    borderRadius: 99,
                    background: i === index ? "#4F6BFF" : "rgba(255,255,255,0.16)",
                    transition: "width .2s, background .2s",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={finish}
                style={{ background: "none", border: 0, color: "#8A90A6", fontSize: 13, cursor: "pointer", padding: 8 }}
              >
                Skip
              </button>
              {index > 0 && (
                <button
                  onClick={back}
                  style={{ background: "none", border: 0, color: "#c9cde0", fontSize: 13, cursor: "pointer", padding: 8 }}
                >
                  Back
                </button>
              )}
              <button
                onClick={isLast ? finish : next}
                style={{ background: "#4F6BFF", border: 0, color: "#fff", fontWeight: 600, fontSize: 13.5, padding: "9px 16px", borderRadius: 10, cursor: "pointer" }}
              >
                {isLast ? "Start building" : "Next"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
