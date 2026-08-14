import FocusTrap from 'focus-trap-react';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import AgentAvatar from '@/components/avatars/AgentAvatar';
import type { PackSummary } from '@shared/packBlueprints';
import './starter-pack/biab.css';

// New-project naming step. Two modes, decided by whether a pack was chosen:
//  - IDEA mode (no templateName): the Maya idea-intake screen the founder loves —
//    Maya asks "What are you building?", they describe it in a sentence, and we hand
//    that straight to the tailored-journey creation flow.
//  - PACK mode (templateName present): a light name prompt for the chosen pack.
// Styling comes from ./starter-pack/biab.css (the shared blue-tinted design system).

interface ProjectNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onConfirm: (name: string, description?: string) => void;
  templateName?: string;
  templateDescription?: string;
  isLoading?: boolean;
}

const IDEA_EXAMPLES = [
  'a project-management tool',
  'a neighborhood cafe',
  'a wedding photography studio',
];

// Turn a one-line idea into a tidy project name (drop the leading article, capitalise).
function deriveName(idea: string): string {
  const n = idea.trim().replace(/^(a|an|the)\s+/i, '');
  return (n.charAt(0).toUpperCase() + n.slice(1)).slice(0, 60);
}

export default function ProjectNameModal({
  isOpen, onClose, onBack, onConfirm, templateName = '', templateDescription = '', isLoading = false,
}: ProjectNameModalProps) {
  const isIdea = !templateName;
  const [idea, setIdea] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  useEffect(() => {
    if (isOpen) {
      setIdea('');
      setProjectName(templateName || '');
      setProjectDescription(templateDescription || '');
    }
  }, [isOpen, templateName, templateDescription]);

  // Pack mode shows the chosen pack's identity (icon + counts). Look it up from the
  // cached catalog by title, so nothing new has to be threaded through the parents.
  const { data: catalog } = useQuery<{ packs: PackSummary[] }>({
    queryKey: ['/api/packs/catalog'],
    queryFn: async () => {
      const r = await fetch('/api/packs/catalog', { credentials: 'include' });
      if (!r.ok) throw new Error('catalog failed');
      return r.json();
    },
    enabled: isOpen && !isIdea,
    staleTime: 5 * 60 * 1000,
  });
  const pack = (catalog?.packs ?? []).find((p) => p.title === templateName);

  if (!isOpen) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', background: 'var(--panel-2)', border: '1px solid var(--line)',
    borderRadius: 12, color: 'var(--ink)', fontSize: 14.5, outline: 'none', resize: 'none',
    fontFamily: 'inherit',
  };

  // ── IDEA mode: the Maya intake screen ──────────────────────────────────────
  if (isIdea) {
    const submitIdea = (e: React.FormEvent) => {
      e.preventDefault();
      const text = idea.trim();
      if (!text) return;
      onConfirm(deriveName(text), text);
    };
    return (
      <FocusTrap active={isOpen}>
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div className="biab" role="dialog" aria-modal="true" aria-label="Start with your idea"
            style={{ position: 'relative', width: 560, maxWidth: '100%', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 22, boxShadow: 'var(--shadow)', padding: '38px clamp(22px,5vw,44px) 40px' }}>
            <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 16, right: 16, border: 'none', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', padding: 6 }}><X size={20} /></button>
            {onBack && (
              <button onClick={onBack} aria-label="Back" style={{ position: 'absolute', top: 16, left: 16, border: 'none', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', padding: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5 }}><ArrowLeft size={16} /></button>
            )}

            <div style={{ textAlign: 'center' }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', borderRadius: '50%', boxShadow: '0 0 0 4px var(--blue-wash)', marginBottom: 14 }}>
                <AgentAvatar characterName="Maya" size={68} />
              </span>
              <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--blue)' }}>Maya · your idea partner</div>
              <h1 style={{ fontSize: 'clamp(23px,3.2vw,29px)', fontWeight: 730, color: 'var(--ink)', margin: '8px 0 10px' }}>What are you building?</h1>
              <p style={{ color: 'var(--ink-2)', fontSize: 15, maxWidth: 400, margin: '0 auto 22px', lineHeight: 1.5 }}>
                Describe it in a sentence. I'll put the right team together, and a plan to start.
              </p>
            </div>

            <form onSubmit={submitIdea}>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { submitIdea(e); } }}
                placeholder="a meal-prep service for busy parents…"
                rows={2}
                autoFocus
                disabled={isLoading}
                style={{ ...inputStyle, textAlign: 'left' }}
              />
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 }}>
                {IDEA_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setIdea(ex)}
                    style={{ border: '1px solid var(--line-2)', background: 'var(--panel-2)', color: 'var(--ink)', borderRadius: 999, padding: '8px 15px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={!idea.trim() || isLoading}
                className="biab-btn pri"
                style={{ width: '100%', marginTop: 22 }}
              >
                {isLoading ? 'Building your team…' : <>Start building <ArrowRight size={16} /></>}
              </button>
              <p style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--ink-3)' }}>
                Maya assembles a team and a staged plan. You can change anything after.
              </p>
            </form>
          </div>
        </div>
      </FocusTrap>
    );
  }

  // ── PACK mode: a light name prompt for the chosen pack ─────────────────────
  const submitPack = (e: React.FormEvent) => {
    e.preventDefault();
    if (projectName.trim()) onConfirm(projectName.trim(), projectDescription.trim() || undefined);
  };
  const valid = projectName.trim().length > 0 && projectName.length <= 100;

  const stats: Array<[number | undefined, string]> = [
    [pack?.teamCount, 'specialists'],
    [pack?.taskCount, 'steps'],
    [pack?.docCount, 'documents'],
  ];

  return (
    <FocusTrap active={isOpen}>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
        <div className="biab" role="dialog" aria-modal="true" aria-label="Name your project"
          style={{ position: 'relative', width: 440, maxWidth: '100%', background: 'var(--panel)', border: '1px solid var(--line-2)', borderRadius: 20, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          {/* pack identity hero */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '20px 20px 16px', background: 'linear-gradient(160deg, rgba(108,130,255,.12), transparent 70%)', borderBottom: '1px solid var(--line)' }}>
            {onBack && (
              <button onClick={onBack} aria-label="Back" style={{ position: 'absolute', top: 13, left: 13, border: 'none', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', padding: 4 }}><ArrowLeft size={18} /></button>
            )}
            <span className="biab-etile" style={{ width: 46, height: 46, background: 'var(--blue-wash)', fontSize: 23, marginLeft: onBack ? 22 : 0, flexShrink: 0 }} aria-hidden>{pack?.emoji || '📦'}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 730, color: 'var(--ink)' }}>Let&apos;s name it</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {templateName}{pack ? ` · ${pack.teamCount} specialists staffed & ready` : ' · staffed & ready'}
                </span>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', padding: 4, flexShrink: 0 }}><X size={19} /></button>
          </div>

          <form onSubmit={submitPack} style={{ padding: '18px 20px 20px' }}>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value.slice(0, 100))}
              placeholder="Name your project"
              autoFocus
              disabled={isLoading}
              maxLength={100}
              style={inputStyle}
            />
            <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '7px 2px 0' }}>You can rename it anytime. Add a description later if you want.</p>

            {pack && (
              <div style={{ display: 'flex', gap: 8, margin: '16px 0 2px' }}>
                {stats.map(([n, l]) => (
                  <div key={l} style={{ flex: 1, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{n}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{l}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button type="button" onClick={onBack || onClose} disabled={isLoading}
                style={{ flex: '0 0 auto', padding: '11px 16px', background: 'var(--panel-2)', color: 'var(--ink)', border: '1px solid var(--line-2)', borderRadius: 11, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                Back
              </button>
              <button type="submit" disabled={!valid || isLoading} className="biab-btn pri" style={{ flex: 1 }}>
                {isLoading ? 'Creating…' : <>Create &amp; meet the team <ArrowRight size={15} /></>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </FocusTrap>
  );
}
