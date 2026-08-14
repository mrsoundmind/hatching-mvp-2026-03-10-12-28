// Landing v2 — SkillShowcase  (reference: human-skills-section + PillShowcase)
//
// Their DOM:
//   section.human-skills-section
//     div.cu-section-header            (with a quote in the right column)
//     div.pill-showcase
//       div.showcase-container
//         div.showcase-left
//           h3.showcase-title
//           div.showcase-pills
//             div.expandable-pill[.is-expanded]
//               div.pill-header > img.pill-icon + div.pill-content
//         div.showcase-right           (panel, character, speech pill)
//
// This is the one section that genuinely needed their JS: only one pill is
// open at a time, and opening it swaps the panel on the right. Reimplemented
// with React state rather than ported, since their handler is inside a
// minified bundle. The markup and every class name is still theirs.
//
// This is also the fix for the audit finding that our product mocks are
// present but unreadable: the teammate stands in the panel's corner doing the
// thing the panel is showing.

import { useState } from "react";
import { Check, FileText, GitBranch, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CharacterSlot from "./CharacterSlot";
import { characterHex } from "./characterAssets";
import CuSectionHeader from "./CuSectionHeader";
import { useReveal } from "./useReveal";

type PanelSpec =
  | { kind: "chat"; title: string; lines: { who: string; text: string; self?: boolean }[] }
  | { kind: "doc"; title: string; meta: string; sections: string[] }
  | { kind: "review"; title: string; verdict: string; fixes: string[] }
  | { kind: "handoff"; from: string; to: string; task: string; carried: string[] };

interface Skill {
  id: string;
  icon: LucideIcon;
  label: string;
  blurb: string;
  character: string;
  pill: string;
  panel: PanelSpec;
}

const SKILLS: Skill[] = [
  {
    id: "push",
    icon: MessageSquare,
    label: "Push back on you",
    blurb:
      "They tell you when you are wrong. A teammate who agrees with everything is worth nothing.",
    character: "Alex",
    pill: "This timeline assumes nothing goes wrong.",
    panel: {
      kind: "chat",
      title: "Project chat",
      lines: [
        { who: "You", text: "Let's ship the whole thing by Friday.", self: true },
        {
          who: "Alex",
          text: "This timeline assumes nothing goes wrong, and something always goes wrong. We can have the auth flow or the billing page by Friday. Not both. Which one?",
        },
      ],
    },
  },
  {
    id: "deliver",
    icon: FileText,
    label: "Write the actual document",
    blurb:
      "Not a summary of what a document might contain. A finished brief with real sections, versioned and editable.",
    character: "Mira",
    pill: "Draft is ready. I cut section three, it repeated the intro.",
    panel: {
      kind: "doc",
      title: "Launch announcement",
      meta: "v3 · edited 2 minutes ago",
      sections: ["The problem", "What we built", "Who it's for", "How to start"],
    },
  },
  {
    id: "review",
    icon: ShieldCheck,
    label: "Review each other",
    blurb:
      "Work is read by a different teammate on a different model family, blind to who wrote it. Weak work gets sent back.",
    character: "Sam",
    pill: "Sending this back. Two claims have nothing behind them.",
    panel: {
      kind: "review",
      title: "Peer review",
      verdict: "Asked for changes",
      fixes: ["Claim in paragraph 2 has no source", "Pricing figure contradicts the brief"],
    },
  },
  {
    id: "handoff",
    icon: GitBranch,
    label: "Hand work to each other",
    blurb:
      "When one finishes, the next picks it up with the context already attached. You route nothing.",
    character: "Cleo",
    pill: "Taking the scope from Alex. Starting on the flows.",
    panel: {
      kind: "handoff",
      from: "Alex",
      to: "Cleo",
      task: "Design the onboarding flow",
      carried: ["Scope doc", "Two open questions", "Decision: skip the tour"],
    },
  },
  {
    id: "remember",
    icon: Sparkles,
    label: "Remember everything",
    blurb:
      "Your brand voice, your stack, the decision you made in week one. Every teammate has it.",
    character: "Maya",
    pill: "You ruled out the tour in week one. Still holding?",
    panel: {
      kind: "chat",
      title: "Project brain",
      lines: [
        { who: "Maya", text: "Brand voice: warm, direct, no jargon. Added by you, week 1." },
        { who: "Maya", text: "Tech stack: React, Express, Postgres. Added by Dev, week 2." },
        { who: "Maya", text: "Decision: no product tour. Added by you, week 1." },
      ],
    },
  },
];

/** Their --pill-ring-color takes a bare "r,g,b" triplet, not a hex. */
function hexToRgbTriplet(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function Panel({ spec, hex }: { spec: PanelSpec; hex: string }) {
  if (spec.kind === "chat") {
    return (
      <div className="lv2-panel">
        <div className="lv2-panel-title">{spec.title}</div>
        <div className="lv2-panel-stack">
          {spec.lines.map((line, i) => (
            <div key={i} className={line.self ? "lv2-msg lv2-msg-self" : "lv2-msg"}>
              <span className="lv2-msg-who">{line.who}</span>
              <div
                className="lv2-msg-body"
                style={{
                  background: line.self ? "rgba(255,255,255,.06)" : `${hex}1c`,
                  borderColor: line.self ? "rgba(255,255,255,.08)" : `${hex}33`,
                }}
              >
                {line.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (spec.kind === "doc") {
    return (
      <div className="lv2-panel">
        <div className="lv2-panel-head">
          <span className="lv2-panel-name">{spec.title}</span>
          <span className="lv2-panel-meta">{spec.meta}</span>
        </div>
        <div className="lv2-panel-stack">
          {spec.sections.map((s) => (
            <div className="lv2-doc-row" key={s}>
              <span>{s}</span>
              <i style={{ width: "92%" }} />
              <i style={{ width: "74%" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (spec.kind === "review") {
    return (
      <div className="lv2-panel">
        <div className="lv2-panel-title">{spec.title}</div>
        <span
          className="lv2-verdict"
          style={{ background: `${hex}22`, borderColor: `${hex}44` }}
        >
          {spec.verdict}
        </span>
        <div className="lv2-panel-stack">
          {spec.fixes.map((f) => (
            <div className="lv2-fix-row" key={f}>
              <i style={{ background: `${hex}55`, borderColor: hex }} />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="lv2-panel">
      <div className="lv2-panel-title">Handoff</div>
      <div className="lv2-handoff-row">
        <span className="lv2-tag">{spec.from}</span>
        <span className="lv2-arrow">&rarr;</span>
        <span className="lv2-tag" style={{ background: `${hex}26`, borderColor: `${hex}44` }}>
          {spec.to}
        </span>
      </div>
      <div className="lv2-handoff-task">{spec.task}</div>
      <div className="lv2-panel-stack">
        {spec.carried.map((c) => (
          <div className="lv2-carried" key={c}>
            <Check size={15} style={{ color: hex, flex: "none" }} />
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkillShowcase() {
  const [openId, setOpenId] = useState(SKILLS[0].id);
  const active = SKILLS.find((s) => s.id === openId) ?? SKILLS[0];
  const hex = characterHex(active.character);
  const { ref, className } = useReveal<HTMLDivElement>(0.06);

  return (
    <section className="lv2-human-skills-section">
      <CuSectionHeader
        eyebrow="WHAT THEY DO"
        title={
          <>
            Not answers.
            <br />
            Work.
          </>
        }
        description="Every one of these runs on its own, in your project, while you are doing something else."
      />

      <div ref={ref} className={`lv2-pill-showcase ${className}`}>
        <div className="lv2-showcase-container">
          <div className="lv2-showcase-left">
            <h3 className="lv2-showcase-title">The only teammates that work like colleagues</h3>

            <div className="lv2-showcase-pills">
              {SKILLS.map((skill) => {
                const open = skill.id === openId;
                const skillHex = characterHex(skill.character);
                const Icon = skill.icon;
                return (
                  <div
                    key={skill.id}
                    className={`lv2-expandable-pill${open ? " lv2-is-expanded" : ""}`}
                    /* their pill ring is driven by --pill-ring-color, so tint
                       it with the teammate's colour instead of overriding */
                    style={
                      open
                        ? ({ "--pill-ring-color": hexToRgbTriplet(skillHex) } as React.CSSProperties)
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      className="lv2-pill-header"
                      aria-expanded={open}
                      onClick={() => setOpenId(skill.id)}
                    >
                      {/* Their .pill-label lives in .pill-header beside the
                          icon, and .pill-content is display:none until the
                          pill expands. Nesting the label inside pill-content
                          hides it when collapsed. */}
                      <Icon
                        className="lv2-pill-icon"
                        size={18}
                        style={{ color: open ? skillHex : "rgba(255,255,255,.55)" }}
                      />
                      <span className="lv2-pill-label">{skill.label}</span>
                    </button>
                    {/* their .pill-content is the description only, and their
                        CSS shows it exclusively in the expanded state */}
                    <div className="lv2-pill-content">
                      <p>{skill.blurb}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lv2-showcase-right">
            <div
              className="lv2-showcase-canvas"
              style={{
                background: `radial-gradient(120% 90% at 80% 100%, ${hex}1a 0%, rgba(255,255,255,.02) 55%)`,
              }}
            >
              <div className="lv2-showcase-panel">
                <Panel spec={active.panel} hex={hex} />
              </div>

              <div className="lv2-agent-container">
                <CharacterSlot
                  key={active.character}
                  name={active.character}
                  pose="working"
                  className="lv2-agent-image"
                />
              </div>

              <div
                className="lv2-agent-dialog"
                style={{ background: `${hex}e6`, boxShadow: `0 10px 40px ${hex}33` }}
              >
                <span className="lv2-dialog-icon">{active.character}:</span>
                <span className="lv2-dialog-text">{active.pill}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SkillShowcase;
