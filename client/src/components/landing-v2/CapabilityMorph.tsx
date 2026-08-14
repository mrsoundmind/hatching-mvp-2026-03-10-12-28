// Landing v2 — CapabilityMorph  (reference: dark-section / capabilities-showcase)
//
// Their DOM:
//   section.dark-section > div.lined-sector > div.lined-content
//     div.cu-section-header.dissect
//     div.superintelligence-content > div.capabilities-showcase
//       div.cap-column.cap-left    > span.cap-eyebrow + ul.cap-list > li.cap-list-item
//                                    > span.cap-number + span.cap-label
//       div.cap-column.cap-middle  > div.cap-media-wrapper > div.cap-media
//       div.cap-column.cap-right   > div.cap-details
//
// Second section that needed their JS: the index auto-advances, clicking
// pins, and the middle visual morphs per capability. Reimplemented in React
// state; markup and class names are theirs.
//
// The seven capabilities are modules that actually ship. Each names the file
// behind it, so the section cannot drift into aspiration.

import { useCallback, useEffect, useRef, useState } from "react";
import CharacterSlot from "./CharacterSlot";
import { characterHex } from "./characterAssets";
import CuSectionHeader from "./CuSectionHeader";
import { useReveal } from "./useReveal";

interface Capability {
  num: string;
  name: string;
  headline: string;
  body: string;
  character: string;
  proof: string;
}

const CAPABILITIES: Capability[] = [
  {
    num: "01",
    name: "Memory",
    headline: "Tell them once.",
    body: "Your brand voice, your stack, the decision you made in week one. Every teammate reads the same project brain, so nobody asks you twice.",
    character: "Maya",
    proof: "conversation_memory + project brain",
  },
  {
    num: "02",
    name: "Expertise",
    headline: "Thirty real specialisms.",
    body: "Each role carries its own reasoning pattern, output standard and domain depth. A growth marketer does not think like a backend developer, and it shows in what they hand you.",
    character: "Kai",
    proof: "roleIntelligence, 30 profiles",
  },
  {
    num: "03",
    name: "Handoffs",
    headline: "Work moves on its own.",
    body: "When one teammate finishes, the next picks it up with the previous output attached as context. Cycle detection stops the chain eating itself.",
    character: "Cleo",
    proof: "handoffOrchestrator",
  },
  {
    num: "04",
    name: "Peer review",
    headline: "They check each other.",
    body: "Work is judged by a different model family than the one that wrote it, blind to authorship. Confident rejections block delivery. Revisions trigger a real rewrite, not a reword.",
    character: "Sam",
    proof: "llmJudge, cross-model",
  },
  {
    num: "05",
    name: "Autonomy",
    headline: "They keep going.",
    body: "Say go ahead and the work continues on a durable queue. Come back to finished output and a briefing on what changed while you were away.",
    character: "Dev",
    proof: "taskExecutionPipeline + pg-boss",
  },
  {
    num: "06",
    name: "Safety",
    headline: "Brakes that hold.",
    body: "Every action is risk-scored before it runs. Low risk completes, mid risk gets reviewed, high risk stops and waits for you. Destructive intent is caught by pattern, not by vibes.",
    character: "Alex",
    proof: "scoreDestructiveIntent, three tiers",
  },
  {
    num: "07",
    name: "Growth",
    headline: "They get better at you.",
    body: "Thumbs, edits and rejections feed back into each teammate's traits, anchored to their role baseline so feedback sharpens them instead of flattening them into agreeable mush.",
    character: "Zara",
    proof: "personalityEvolution",
  },
];

const DWELL_MS = 5200;

export function CapabilityMorph() {
  const [index, setIndex] = useState(0);
  const [pinned, setPinned] = useState(false);
  const { ref, visible, className } = useReveal<HTMLDivElement>(0.12);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (!visible || pinned || reduced.current) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % CAPABILITIES.length), DWELL_MS);
    return () => window.clearTimeout(t);
  }, [index, visible, pinned]);

  const pick = useCallback((i: number) => {
    setIndex(i);
    setPinned(true);
  }, []);

  const active = CAPABILITIES[index];
  const hex = characterHex(active.character);

  return (
    <section className="lv2-dark-section">
      <div className="lv2-lined-sector">
        <div className="lv2-lined-content">
          <CuSectionHeader
            eyebrow="HOW THEY WORK"
            title={
              <>
                A team, not a
                <br />
                row of chatbots.
              </>
            }
            description="Seven things that make them behave like colleagues. Every one is a module already running in the product."
            className="lv2-dissect"
          />

          <div ref={ref} className={`lv2-superintelligence-content ${className}`}>
            <div className="lv2-capabilities-showcase" onMouseEnter={() => setPinned(true)}>
              <div className="lv2-cap-column lv2-cap-left">
                <span className="lv2-cap-eyebrow">Capabilities</span>
                <ul className="lv2-cap-list">
                  {CAPABILITIES.map((cap, i) => (
                    <li
                      key={cap.num}
                      className={`lv2-cap-list-item${i === index ? " lv2-active" : ""}`}
                    >
                      <button type="button" onClick={() => pick(i)} aria-current={i === index}>
                        <span
                          className="lv2-cap-number"
                          style={{ color: i === index ? hex : undefined }}
                        >
                          {cap.num}
                        </span>
                        <span className="lv2-cap-label">{cap.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lv2-cap-column lv2-cap-middle">
                <div className="lv2-cap-media-wrapper">
                  <div
                    className="lv2-cap-media"
                    style={{
                      background: `radial-gradient(90% 70% at 50% 92%, ${hex}26 0%, rgba(255,255,255,.015) 62%)`,
                    }}
                  >
                    <CharacterSlot
                      key={active.character}
                      name={active.character}
                      pose="thinking"
                      className="lv2-cap-character"
                    />
                  </div>
                </div>
              </div>

              <div className="lv2-cap-column lv2-cap-right">
                <div className="lv2-cap-details">
                  <div className="lv2-cap-detail-number" style={{ color: `${hex}66` }}>
                    {active.num}
                  </div>
                  <h3 className="lv2-cap-detail-title">{active.headline}</h3>
                  <p className="lv2-cap-detail-desc">{active.body}</p>
                  <div className="lv2-cap-proof">
                    <i style={{ background: hex }} />
                    <code>{active.proof}</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CapabilityMorph;
