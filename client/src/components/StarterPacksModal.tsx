import FocusTrap from 'focus-trap-react';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PackSummary } from '@shared/packBlueprints';
import { X, ChevronRight, Search, List, LayoutGrid, LayoutDashboard } from 'lucide-react';
import PackDepth from './starter-pack/PackDepth';
import './starter-pack/biab.css';

// Business-in-a-Box library. The pack list can be shown three ways via a Rows / Cards /
// Bento view switcher (the choice is remembered), is grouped by category when nothing is
// filtered, and has a fuzzy search that recommends the closest packs instead of dead-ending.

interface StarterPack {
  id: string;
  title: string;
  description: string;
  emoji: string;
  color: string;
  members: string[];
  welcomeMessage: string;
}

// Curated category taxonomy from the mockup (kept short + plain), widened 2026-08-12
// across five waves. Added an Agencies & studios cluster (design, dev, ad, digital,
// photo/video, creative) and a Climate & impact sector. The rail scrolls past ~12 entries.
const CATS = ['All', 'Digital products', 'Local & services', 'Services', 'Agencies & studios', 'Media', 'Retail', 'Finance', 'Property', 'Health & wellness', 'Healthcare', 'Community & events', 'AI & data', 'Gaming', 'Travel & hospitality', 'Food & beverage', 'Agriculture', 'Logistics', 'Manufacturing & hardware', 'Climate & impact'];

// Which category each live (deep) pack belongs to.
const PACK_CAT: Record<string, string> = {
  'saas-startup': 'Digital products',
  'mobile-app': 'Digital products',
  'marketplace-platform': 'Digital products',
  'b2b-saas': 'Digital products',
  'restaurant-launch': 'Local & services',
  'local-service': 'Local & services',
  'beauty-salon': 'Local & services',
  'franchise-expansion': 'Local & services',
  'consulting-practice': 'Services',
  'coaching-practice': 'Services',
  'creative-agency': 'Agencies & studios',
  'design-studio': 'Agencies & studios',
  'dev-agency': 'Agencies & studios',
  'ad-agency': 'Agencies & studios',
  'digital-agency': 'Agencies & studios',
  'photo-video-studio': 'Agencies & studios',
  'online-course': 'Media',
  'podcast-newsletter': 'Media',
  'membership-community': 'Media',
  'ecommerce-store': 'Retail',
  'product-brand': 'Retail',
  'craft-handmade': 'Retail',
  'fintech-product': 'Finance',
  'accounting-firm': 'Finance',
  'real-estate': 'Property',
  'property-management': 'Property',
  'fitness-studio': 'Health & wellness',
  'wellness-retreat': 'Health & wellness',
  'healthcare-clinic': 'Healthcare',
  'nonprofit-org': 'Community & events',
  'event-business': 'Community & events',
  'ai-product': 'AI & data',
  'ai-agency': 'AI & data',
  'game-studio': 'Gaming',
  'mobile-game': 'Gaming',
  'boutique-hotel': 'Travel & hospitality',
  'tour-operator': 'Travel & hospitality',
  'food-beverage': 'Food & beverage',
  'hardware-startup': 'Manufacturing & hardware',
  'climate-venture': 'Climate & impact',
  // Batch 2 packs (2026-08-14)
  'web3-startup': 'Finance',
  'agtech-startup': 'Agriculture',
  'logistics-startup': 'Logistics',
  'telehealth-startup': 'Healthcare',
};

// Extra search terms so a loose keyword finds the right pack even when it isn't in the
// title/tagline ("coffee" -> Restaurant, "gym" -> Fitness). Additive; packs not listed
// still match on title + tagline + category.
const KEYWORDS: Record<string, string> = {
  'restaurant-launch': 'food dining cafe coffee eatery menu chef bistro hospitality',
  'food-beverage': 'food drink beverage cpg snack packaged coffee',
  'fitness-studio': 'gym workout yoga pilates trainer health exercise',
  'wellness-retreat': 'wellness spa retreat meditation yoga health',
  'real-estate': 'property homes realtor listings rental broker agent',
  'property-management': 'property rental landlord tenant homes lease',
  'ecommerce-store': 'shop online store products dropship goods retail',
  'product-brand': 'product brand consumer goods retail dtc',
  'ai-product': 'artificial intelligence ml llm model automation',
  'ai-agency': 'artificial intelligence automation ml consulting',
  'craft-handmade': 'etsy artisan maker jewelry pottery crafts',
  'beauty-salon': 'salon spa hair nails skincare barber beauty',
  'boutique-hotel': 'hotel hospitality lodging bnb rooms travel',
  'tour-operator': 'tours travel trips guide tourism experiences',
  'coaching-practice': 'coach mentor course program clients',
  'consulting-practice': 'consultant advisory clients services',
  'game-studio': 'games gaming indie studio unity',
  'mobile-game': 'game gaming mobile ios android',
  'podcast-newsletter': 'podcast audio newsletter media show',
  'online-course': 'course education teaching students elearning',
  'membership-community': 'membership community subscription forum',
  'healthcare-clinic': 'clinic medical health patients practice doctor',
  'nonprofit-org': 'nonprofit charity ngo donors fundraising',
  'event-business': 'events wedding conference planner',
  'fintech-product': 'fintech finance payments banking money',
  'accounting-firm': 'accounting bookkeeping tax cpa finance',
  'hardware-startup': 'hardware device electronics manufacturing iot',
  'climate-venture': 'climate sustainability green carbon energy',
  'web3-startup': 'crypto blockchain token defi nft dao web3 wallet ethereum onchain smart contract',
  'agtech-startup': 'agriculture farming agtech crops precision farm agronomy growers harvest soil',
  'logistics-startup': 'logistics freight delivery shipping supply chain last-mile trucking warehouse fleet',
  'telehealth-startup': 'telehealth virtual care remote medicine patients hipaa clinic providers',
};

// Coming-soon packs — clearly "in the works", to show where the library keeps growing.
const SOON: { emoji: string; name: string; cat: string; one: string }[] = [
  { emoji: '🚚', name: 'Food Truck & Cloud Kitchen', cat: 'Local & services', one: 'Launch a food truck or delivery-only kitchen people seek out.' },
  { emoji: '📬', name: 'Subscription Box', cat: 'Retail', one: 'Build a recurring box customers look forward to every month.' },
  { emoji: '🎓', name: 'Cohort Bootcamp', cat: 'Media', one: 'Run a cohort-based program that actually gets students results.' },
  { emoji: '⚖️', name: 'Professional Firm', cat: 'Services', one: 'Start a modern law, accounting, or advisory practice.' },
  { emoji: '🐾', name: 'Pet Care Business', cat: 'Local & services', one: 'Grow a grooming, boarding, or pet-care business locals trust.' },
];

const TINT_FREE = 'rgba(108,130,255,.16)';
const TINT_PRO = 'rgba(242,180,65,.16)';
const TINT_SOON = 'rgba(108,130,255,.1)';
type ViewMode = 'rows' | 'cards' | 'bento';

const catOf = (p: PackSummary) => PACK_CAT[p.packId] ?? 'Digital products';
const tintOf = (tier: string) => (tier === 'pro' ? TINT_PRO : TINT_FREE);
const metaOf = (p: PackSummary) => `${p.teamCount} · ${p.taskCount} · ${p.docCount}`;
const packHay = (p: PackSummary) =>
  `${p.title} ${p.tagline} ${catOf(p)} ${KEYWORDS[p.packId] ?? ''}`.toLowerCase();

// Fuzzy rank: title match weighs most, then any-field substring, then word-prefix.
function searchRank(packs: PackSummary[], q: string) {
  const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return packs
    .map((p) => {
      const hay = packHay(p);
      let s = 0, titleHit = false;
      for (const t of terms) {
        if (p.title.toLowerCase().includes(t)) { s += 10; titleHit = true; }
        if (hay.includes(t)) s += 5;
        else for (const w of hay.split(/\s+/)) if (w.startsWith(t)) s += 2;
      }
      return { p, s, titleHit };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
}

interface StarterPacksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onSelectTemplate: (pack: StarterPack) => void;
  isLoading?: boolean;
  selectedPackId?: string;
}

export default function StarterPacksModal({
  isOpen,
  onClose,
  onSelectTemplate,
  isLoading = false,
  selectedPackId,
}: StarterPacksModalProps) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [previewPackId, setPreviewPackId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewMode>(() => {
    try { const v = localStorage.getItem('biab_lib_view'); return v === 'cards' || v === 'bento' || v === 'rows' ? v : 'cards'; }
    catch { return 'cards'; }
  });

  useEffect(() => { try { localStorage.setItem('biab_lib_view', view); } catch { /* ignore */ } }, [view]);

  const { data: catalog } = useQuery<{ packs: PackSummary[] }>({
    queryKey: ['/api/packs/catalog'],
    queryFn: async () => {
      const res = await fetch('/api/packs/catalog', { credentials: 'include' });
      if (!res.ok) throw new Error('catalog failed');
      return res.json();
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!isOpen) { setPreviewPackId(null); setActiveCategory('All'); setQuery(''); }
  }, [isOpen]);

  useEffect(() => {
    if (selectedPackId) setPreviewPackId(selectedPackId);
  }, [selectedPackId]);

  if (!isOpen) return null;

  const livePacks = catalog?.packs ?? [];
  const totalCount = livePacks.length + SOON.length;
  const inCat = (cat: string) => activeCategory === 'All' || cat === activeCategory;
  const scopedLive = livePacks.filter((p) => inCat(catOf(p)));
  const scopedSoon = SOON.filter((s) => inCat(s.cat));

  const handleStart = (p: PackSummary) => {
    onSelectTemplate({
      id: p.packId,
      title: p.title,
      description: p.tagline,
      emoji: p.emoji,
      color: p.tier === 'pro' ? 'amber' : 'blue',
      members: [],
      welcomeMessage: '',
    });
  };

  const openPack = (id: string) => setPreviewPackId(id);
  const packKey = (id: string) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPack(id); }
  };

  // ---- per-view renderers for one list (live packs + optional coming-soon) ----
  function renderItems(live: PackSummary[], soon: typeof SOON, key: string) {
    if (view === 'rows') {
      return (
        <div className="biab-rows" key={key}>
          {live.map((p) => (
            <div key={p.packId} className="biab-row" role="button" tabIndex={0} onClick={() => openPack(p.packId)} onKeyDown={packKey(p.packId)}>
              <span className="biab-etile" style={{ width: 30, height: 30, background: tintOf(p.tier), fontSize: 15 }} aria-hidden>{p.emoji}</span>
              <span className="rt">{p.title}</span>
              <span className="rd">{p.tagline}</span>
              <span className="rm">{metaOf(p)}</span>
              <span className={`biab-chip ${p.tier}`}>{p.tier === 'pro' ? 'Pro' : 'Free'}</span>
            </div>
          ))}
          {soon.map((s) => (
            <div key={s.name} className="biab-row soon">
              <span className="biab-etile" style={{ width: 30, height: 30, background: TINT_SOON, fontSize: 15 }} aria-hidden>{s.emoji}</span>
              <span className="rt">{s.name}</span>
              <span className="rd">{s.one}</span>
              <span className="rm">In the works</span>
              <span className="biab-chip soon">Soon</span>
            </div>
          ))}
        </div>
      );
    }
    if (view === 'cards') {
      return (
        <div className="biab-grid" key={key}>
          {live.map((p) => (
            <div key={p.packId} className="biab-pcard live" role="button" tabIndex={0} onClick={() => openPack(p.packId)} onKeyDown={packKey(p.packId)}>
              <div className="ptop">
                <span className="biab-etile" style={{ width: 40, height: 40, background: tintOf(p.tier), fontSize: 20 }} aria-hidden>{p.emoji}</span>
                <span className={`biab-chip ${p.tier}`}>{p.tier === 'pro' ? 'Pro' : 'Free'}</span>
              </div>
              <h3>{p.title}</h3>
              <p className="one">{p.tagline}</p>
              <div className="meta">{p.teamCount} specialists · {p.taskCount} steps · {p.docCount} docs</div>
              <span className="cta">See what&apos;s inside <ChevronRight size={13} /></span>
            </div>
          ))}
          {soon.map((s) => (
            <div key={s.name} className="biab-pcard soon">
              <div className="ptop">
                <span className="biab-etile" style={{ width: 40, height: 40, background: TINT_SOON, fontSize: 20 }} aria-hidden>{s.emoji}</span>
                <span className="biab-chip soon">Coming soon</span>
              </div>
              <h3>{s.name}</h3>
              <p className="one">{s.one}</p>
              <div className="meta">In the works</div>
            </div>
          ))}
        </div>
      );
    }
    // bento — fixed 3-column grid; the last tile of the section stretches to fill its
    // row (CSS :last-child rule), which both guarantees no empty gap and gives the
    // bento its rhythm. The stretched tile shows its tagline.
    const items: Array<{ kind: 'live'; p: PackSummary } | { kind: 'soon'; s: typeof SOON[number] }> = [
      ...live.map((p) => ({ kind: 'live' as const, p })),
      ...soon.map((s) => ({ kind: 'soon' as const, s })),
    ];
    const lastWide = items.length % 3 !== 0;
    return (
      <div className="biab-blib" key={key}>
        {items.map((it, i) => {
          const wide = lastWide && i === items.length - 1;
          if (it.kind === 'live') {
            const p = it.p;
            return (
              <div key={p.packId} className="biab-bt" role="button" tabIndex={0} onClick={() => openPack(p.packId)} onKeyDown={packKey(p.packId)}>
                <div className="btop">
                  <span className="biab-etile" style={{ width: 30, height: 30, background: tintOf(p.tier), fontSize: 15 }} aria-hidden>{p.emoji}</span>
                  <span className={`biab-chip ${p.tier}`}>{p.tier === 'pro' ? 'Pro' : 'Free'}</span>
                </div>
                <h3>{p.title}</h3>
                {wide && <p className="bp">{p.tagline}</p>}
                <div className="bm">{metaOf(p)}</div>
              </div>
            );
          }
          const s = it.s;
          return (
            <div key={s.name} className="biab-bt soon">
              <div className="btop">
                <span className="biab-etile" style={{ width: 30, height: 30, background: TINT_SOON, fontSize: 15 }} aria-hidden>{s.emoji}</span>
                <span className="biab-chip soon">Soon</span>
              </div>
              <h3>{s.name}</h3>
              {wide && <p className="bp">{s.one}</p>}
              <div className="bm">In the works</div>
            </div>
          );
        })}
      </div>
    );
  }

  // ---- body: search results (flat) OR category sections OR single category ----
  let body: React.ReactNode;
  const q = query.trim();
  if (q) {
    const ranked = searchRank(scopedLive, q);
    const anyTitle = ranked.some((x) => x.titleHit);
    const results = ranked.map((x) => x.p);
    if (results.length === 0) {
      // never dead-end: recommend the scoped packs
      const rec = scopedLive.slice(0, 9);
      body = (
        <>
          <div className="biab-reslabel">No exact match for <b>“{q}”</b> — packs you might start from</div>
          {renderItems(rec, [], 'norec')}
        </>
      );
    } else {
      body = (
        <>
          <div className="biab-reslabel">{anyTitle ? 'Results for' : 'Closest matches for'} <b>“{q}”</b> · {results.length}</div>
          {renderItems(results, [], 'res')}
        </>
      );
    }
  } else if (activeCategory === 'All') {
    body = CATS.filter((c) => c !== 'All').map((cat) => {
      const live = livePacks.filter((p) => catOf(p) === cat);
      const soon = SOON.filter((s) => s.cat === cat);
      if (!live.length && !soon.length) return null;
      return (
        <div className="biab-catsec" key={cat}>
          <div className="biab-cathead">{cat}<span className="cc">{live.length + soon.length}</span></div>
          {renderItems(live, soon, cat)}
        </div>
      );
    });
  } else {
    body = renderItems(scopedLive, scopedSoon, activeCategory);
  }

  const viewBtn = (mode: ViewMode, Icon: typeof List, label: string) => (
    <button type="button" className={`biab-vbtn${view === mode ? ' on' : ''}`} onClick={() => setView(mode)} aria-pressed={view === mode} title={label}>
      <Icon size={15} /><span>{label}</span>
    </button>
  );

  return (
    <FocusTrap active={isOpen} focusTrapOptions={{ fallbackFocus: '#biab-lib-modal', escapeDeactivates: false, clickOutsideDeactivates: false }}>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
        <div
          id="biab-lib-modal"
          tabIndex={-1}
          className="biab"
          role="dialog"
          aria-modal="true"
          aria-label="Pick your kind of business"
          style={{ position: 'relative', width: 1160, maxWidth: '100%', height: 680, maxHeight: '90vh', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 22, overflow: 'hidden', boxShadow: 'var(--shadow)', outline: 'none' }}
        >
          {previewPackId ? (
            <PackDepth
              packId={previewPackId}
              onBack={() => setPreviewPackId(null)}
              onStart={(id) => { const p = livePacks.find((x) => x.packId === id); if (p) handleStart(p); }}
              isStarting={isLoading}
            />
          ) : (
            <>
              <button
                onClick={onClose}
                aria-label="Close"
                style={{ position: 'absolute', top: 14, right: 16, zIndex: 2, border: 'none', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'grid', placeItems: 'center' }}
              >
                <X size={20} />
              </button>

              <div className="biab-lib">
                <div className="biab-cats">
                  <h4>Categories</h4>
                  {CATS.map((c) => (
                    <button
                      key={c}
                      className={`biab-cat${activeCategory === c ? ' on' : ''}`}
                      onClick={() => { setActiveCategory(c); setQuery(''); }}
                    >
                      <span style={{ flex: 1 }}>{c}</span>
                      {c === 'All' && <span className="c">{totalCount}</span>}
                    </button>
                  ))}
                </div>

                <div className="biab-libmain">
                  <h2>Pick your kind of business</h2>
                  <p className="sub">Proven starting points, not blank pages.</p>

                  <div className="biab-libtools">
                    <div className="biab-search">
                      <Search size={16} />
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search any kind of business — coffee shop, AI tool, gym…"
                        aria-label="Search packs"
                      />
                      {query && <button className="clr" aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button>}
                    </div>
                    <div className="biab-viewsw" role="group" aria-label="View">
                      {viewBtn('cards', LayoutGrid, 'Cards')}
                      {viewBtn('rows', List, 'Rows')}
                      {viewBtn('bento', LayoutDashboard, 'Bento')}
                    </div>
                  </div>

                  <div className="biab-libbody">{body}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </FocusTrap>
  );
}
