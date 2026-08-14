import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import "./starter-pack/biab.css";

// Two-door new-project entry — a faithful build of the approved v3 mockup
// (artifact 17f0a255): centered, calm, small emoji tiles, the pack door the bigger
// of the two. Styling comes from ./starter-pack/biab.css (a 1:1 port of the mockup).

interface PathSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartWithIdea: () => void;
  onUseStarterPack: () => void;
  onFigureItOut?: () => void;
}

const TINT = "rgba(108,130,255,.16)";

export function PathSelectionModal({
  isOpen,
  onClose,
  onStartWithIdea,
  onUseStarterPack,
  onFigureItOut,
}: PathSelectionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="biab p-0 overflow-hidden border-0"
        style={{ maxWidth: 860, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 22 }}
      >
        <DialogTitle className="sr-only">Choose your starting point</DialogTitle>
        <DialogDescription className="sr-only">Bring your own idea, or start from a proven pack.</DialogDescription>

        <div className="biab-center-wrap">
          <div className="biab-center-head">
            <span className="biab-eyebrow">New project</span>
            <h1>How would you like to start?</h1>
            <p>Bring your own idea, or start from a proven pack.</p>
          </div>

          <div className="biab-twocards">
            <div className="biab-ocard idea" onClick={onStartWithIdea} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStartWithIdea(); } }}>
              <span className="biab-etile" style={{ width: 44, height: 44, background: TINT, fontSize: 22 }} aria-hidden>💡</span>
              <h3>Start with your idea</h3>
              <p className="biab-lead">Describe it in a sentence. Maya, your idea partner, builds the right team around it.</p>
              <span className="biab-go">Describe my idea →</span>
            </div>

            <div className="biab-ocard pack" onClick={onUseStarterPack} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onUseStarterPack(); } }}>
              <span className="biab-etile" style={{ width: 44, height: 44, background: TINT, fontSize: 22 }} aria-hidden>📦</span>
              <h3>Start from a pack <span className="biab-chip pro">Pro</span></h3>
              <p className="biab-lead">A ready-made team, a cited field playbook, documents built to spec, and a staged plan for your kind of business.</p>
              {/* a real peek at what's inside — packs + tiers, not bare emojis */}
              <div style={{ display: "flex", gap: 8, margin: "14px 0 6px" }}>
                {[
                  { emoji: "🚀", label: "SaaS", tag: "Free" },
                  { emoji: "🍽️", label: "Restaurant", tag: "Pro" },
                  { emoji: "🛍️", label: "More", tag: "Soon" },
                ].map((t) => (
                  <div key={t.label} style={{ flex: 1, borderRadius: 11, background: "var(--panel-2)", border: "1px solid var(--line)", padding: "9px 10px" }}>
                    <span style={{ fontSize: 18, lineHeight: 1, display: "block", marginBottom: 6 }} aria-hidden>{t.emoji}</span>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.2 }}>{t.label}</div>
                    <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{t.tag}</div>
                  </div>
                ))}
              </div>
              <span className="biab-go">Browse the library →</span>
            </div>
          </div>

          {onFigureItOut && (
            <div style={{ textAlign: "center", marginTop: 22 }}>
              <button
                onClick={onFigureItOut}
                style={{ border: "none", background: "transparent", color: "var(--ink-3)", fontSize: 13, cursor: "pointer" }}
              >
                Not sure? <span style={{ color: "var(--blue)", fontWeight: 600 }}>I'll figure it out as I go</span>
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
