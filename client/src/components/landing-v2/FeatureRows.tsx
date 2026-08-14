// Landing v2 — FeatureRows  (reference: technology-section + feature-section-wrapper)
//
// Their DOM:
//   div.technology-section
//     div.cu-section-header             (eyebrow, title, founder quote)
//     div.feature-section-wrapper
//       div.feature-section             (375px tall, grid 1fr / 2fr)
//         div.feature-left  > div.feature-text > h3.feature-title + p.feature-desc + button.feature-btn
//         div.feature-right.two-cols > div.feature-col
//     div.last-feature-section          (rendered separately, see SixUpGrid)
//
// Row geometry, the 1fr/2fr split and the dashed hairline above each row are
// all theirs, from the port.
//
// Their inner visuals are deliberately NOT ported: analytics percentile, top
// performers, agents online, radar. Those render ClickUp's own product data,
// so copying them would mean showing a competitor's dashboard with our name
// on it. The four visuals below are ours, built from what Hatchin actually
// puts on screen.

import { Link } from "wouter";
import CuSectionHeader from "./CuSectionHeader";
import { characterHex } from "./characterAssets";
import { useReveal } from "./useReveal";

/* ── our own inner visuals ─────────────────────────────────────────── */

function ActivityVisual() {
  const rows = [
    { who: "Alex", hex: characterHex("Alex"), what: "wrote the scope", when: "2m" },
    { who: "Cleo", hex: characterHex("Cleo"), what: "picked it up", when: "2m" },
    { who: "Sam", hex: characterHex("Sam"), what: "asked for changes", when: "1m" },
    { who: "Cleo", hex: characterHex("Cleo"), what: "sent v2", when: "just now" },
  ];
  return (
    <div className="lv2-viz lv2-viz-feed">
      {rows.map((r, i) => (
        <div className="lv2-feed-row" key={i}>
          <i style={{ background: r.hex }} />
          <span className="lv2-feed-who">{r.who}</span>
          <span className="lv2-feed-what">{r.what}</span>
          <span className="lv2-feed-when">{r.when}</span>
        </div>
      ))}
    </div>
  );
}

function RunTreeVisual() {
  const nodes = [
    { label: "Scope the flow", depth: 0, who: "Alex", ok: true },
    { label: "Design the screens", depth: 1, who: "Cleo", ok: true },
    { label: "Peer review", depth: 2, who: "Sam", ok: false },
    { label: "Revision", depth: 2, who: "Cleo", ok: true },
  ];
  return (
    <div className="lv2-viz lv2-viz-tree">
      {nodes.map((n, i) => (
        <div className="lv2-tree-row" key={i} style={{ paddingInlineStart: n.depth * 18 }}>
          <i style={{ background: characterHex(n.who) }} />
          <span className="lv2-tree-label">{n.label}</span>
          <span className={n.ok ? "lv2-tree-ok" : "lv2-tree-warn"}>
            {n.ok ? "Improved" : "Sent back"}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReviewVisual() {
  return (
    <div className="lv2-viz lv2-viz-review">
      <div className="lv2-review-head">
        <span className="lv2-review-model">Written by DeepSeek</span>
        <span className="lv2-review-arrow">&rarr;</span>
        <span className="lv2-review-model">Judged by Groq</span>
      </div>
      <div className="lv2-review-verdict">Asked for changes</div>
      <div className="lv2-review-fixes">
        <span>Claim in paragraph 2 has no source</span>
        <span>Pricing contradicts the brief</span>
      </div>
      <div className="lv2-review-foot">Blind to who wrote it</div>
    </div>
  );
}

function BrainVisual() {
  const items = [
    { k: "Brand voice", v: "warm, direct, no jargon", who: "Maya" },
    { k: "Tech stack", v: "React, Express, Postgres", who: "Dev" },
    { k: "Decision", v: "no product tour", who: "Alex" },
  ];
  return (
    <div className="lv2-viz lv2-viz-brain">
      {items.map((it) => (
        <div className="lv2-brain-row" key={it.k}>
          <span className="lv2-brain-k">{it.k}</span>
          <span className="lv2-brain-v">{it.v}</span>
          <span className="lv2-brain-who" style={{ color: characterHex(it.who) }}>
            {it.who}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── rows ──────────────────────────────────────────────────────────── */

const ROWS = [
  {
    title: "Activity you can actually read",
    desc: "Every handoff, review and decision, in plain words. No event codes, no raw risk scores.",
    visual: <ActivityVisual />,
  },
  {
    title: "A run tree, not a black box",
    desc: "Open any finished task and see the exact chain that produced it, step by step, with the version each step wrote.",
    visual: <RunTreeVisual />,
  },
  {
    title: "Cross-model peer review",
    desc: "The judge runs on a different model family than the writer, so nothing grades its own homework.",
    visual: <ReviewVisual />,
  },
  {
    title: "One project brain",
    desc: "Facts, decisions and voice live in one place that every teammate reads before it writes a word.",
    visual: <BrainVisual />,
  },
];

export function FeatureRows() {
  const { ref, className } = useReveal<HTMLDivElement>(0.05);

  return (
    <div className="lv2-technology-section">
      <CuSectionHeader
        eyebrow="TECHNOLOGY"
        title={
          <>
            Built to be
            <br />
            checked.
          </>
        }
        description="Every claim on this page maps to something you can open in the product and read for yourself."
      />

      <div ref={ref} className={`lv2-feature-section-wrapper ${className}`}>
        {ROWS.map((row) => (
          <div className="lv2-feature-section" key={row.title}>
            <div className="lv2-feature-left">
              <div className="lv2-feature-text">
                <h3 className="lv2-feature-title">{row.title}</h3>
                <p className="lv2-feature-desc">{row.desc}</p>
                <Link href="/login">
                  <button type="button" className="lv2-feature-btn">
                    Get started
                  </button>
                </Link>
              </div>
            </div>
            <div className="lv2-feature-right lv2-two-cols">
              <div className="lv2-feature-col">{row.visual}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FeatureRows;
