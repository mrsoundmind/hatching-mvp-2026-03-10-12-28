// PackDepth — the "inside a pack" screen for Business-in-a-Box.
// A faithful build of the approved v3 mockup (artifact 17f0a255): a calm, flat bento —
// two balanced columns, hairline-separated, stats inline on the header. LEFT = who
// (team) + how they think (playbook); RIGHT = what they do (plan) + what they make
// (documents). Styling lives in ./biab.css (a 1:1 port of the mockup's design system).
// Emoji is used ONLY for the pack's identity tile; documents use small Lucide icons.
import { useQuery } from "@tanstack/react-query";
import {
  Check, Loader2, ChevronRight,
  ClipboardList, BarChart3, Scale, FileText, Building2, Palette,
  Megaphone, PenLine, Search, BookOpen, CalendarDays,
} from "lucide-react";
import AgentAvatar from "@/components/avatars/AgentAvatar";
import "./biab.css";

interface PackDetailMember { role: string; name: string; department: string; brief: string }
interface PackDetailDoc { key: string; title: string; type: string; role: string; stage: string }
interface PackDetailStep { title: string; role: string; producesDocKey?: string }
interface PackDetailStage { key: string; label: string; summary: string; steps: PackDetailStep[] }
interface PackDetail {
  packId: string; title: string; emoji: string; tagline: string;
  tier: "free" | "pro"; field: string | null;
  stats: { team: number; steps: number; docs: number; frameworks: number };
  team: PackDetailMember[]; frameworks: string[];
  playbookGroups: { label: string; frameworks: string[] }[];
  playbookGlosses: Record<string, string>;
  addOnRoles: string[];
  documents: PackDetailDoc[]; plan: PackDetailStage[];
}

function docIconFor(type: string) {
  const t = type.toLowerCase();
  if (t.includes("business-plan")) return ClipboardList;
  if (t.includes("financial")) return BarChart3;
  if (t.includes("legal")) return Scale;
  if (t.includes("tech")) return Building2;
  if (t.includes("design") || t.includes("brand")) return Palette;
  if (t.includes("gtm")) return Megaphone;
  if (t.includes("landing") || t.includes("copy")) return PenLine;
  if (t.includes("seo")) return Search;
  if (t.includes("sop")) return BookOpen;
  if (t.includes("calendar") || t.includes("content")) return CalendarDays;
  return FileText;
}

// Identity-tile tint, matching the mockup (free = blue wash, pro = amber wash).
function tintFor(tier: "free" | "pro"): string {
  return tier === "pro" ? "rgba(242,180,65,.16)" : "rgba(108,130,255,.16)";
}

interface PackDepthProps {
  packId: string;
  onBack: () => void;
  onStart: (packId: string) => void;
  isStarting?: boolean;
}

export default function PackDepth({ packId, onBack, onStart, isStarting = false }: PackDepthProps) {
  const { data, isLoading, isError } = useQuery<{ pack: PackDetail }>({
    queryKey: ["/api/packs", packId],
    queryFn: async () => {
      const res = await fetch(`/api/packs/${packId}`, { credentials: "include" });
      if (!res.ok) throw new Error("pack detail failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const pack = data?.pack;

  // Defensive locals: an older server build (the dev server runs plain `tsx`,
  // no watch, so it can serve a pack payload predating a field) or a legacy pack
  // may omit any of these. Default every collection so a partial payload renders
  // gracefully instead of white-screening on `.length` / `.map`.
  const team = pack?.team ?? [];
  const stats = pack?.stats ?? { team: 0, steps: 0, docs: 0, frameworks: 0 };
  const frameworks = pack?.frameworks ?? [];
  const rawGroups = pack?.playbookGroups ?? [];
  const glosses = pack?.playbookGlosses ?? {};
  const addOnRoles = pack?.addOnRoles ?? [];
  const documents = pack?.documents ?? [];
  const plan = pack?.plan ?? [];

  // Group team by department (first-seen order) for the department bento. Each
  // department is a tile that spans columns by its member count, so multi-person
  // departments read wider and single-person ones tuck in around them.
  const departments: { name: string; members: PackDetailMember[] }[] = [];
  {
    const byDept = new Map<string, PackDetailMember[]>();
    for (const m of team) {
      let list = byDept.get(m.department);
      if (!list) { list = []; byDept.set(m.department, list); departments.push({ name: m.department, members: list }); }
      list.push(m);
    }
  }

  const playbookGroups = rawGroups.length > 0
    ? rawGroups
    : (frameworks.length > 0 ? [{ label: "Proven methods", frameworks }] : []);

  return (
    <div className="biab" style={{ background: "var(--panel)", height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="biab-depth" style={{ flex: 1 }}>
        {isLoading && (
          <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--ink-3)", gap: 8 }}>
            <Loader2 className="animate-spin" size={18} /> Loading pack…
          </div>
        )}
        {isError && (
          <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--ink-3)" }}>Could not load this pack.</div>
        )}
        {pack && (
          <>
            <button className="biab-backlink" onClick={onBack}><ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Library</button>

            {/* identity row + inline stats */}
            <div className="biab-idrow">
              <span className="biab-etile" style={{ width: 52, height: 52, background: tintFor(pack.tier), fontSize: 26 }} aria-hidden>{pack.emoji}</span>
              <div style={{ minWidth: 0 }}>
                <div className="nm">
                  {pack.title}
                  <span className={`biab-chip ${pack.tier}`}>{pack.tier === "pro" ? "Pro" : "Free"}</span>
                  <span className="ready"><span className="d" />staffed &amp; ready</span>
                </div>
                <div className="tag">{pack.tagline}</div>
              </div>
              <div className="stats">
                <span className="stat"><b>{stats.team}</b><span>specialists</span></span>
                <span className="stat"><b>{stats.steps}</b><span>steps</span></span>
                <span className="stat"><b>{stats.docs}</b><span>documents</span></span>
                <span className="stat"><b>{stats.frameworks}</b><span>frameworks</span></span>
              </div>
            </div>

            <div className="biab-bento">
              {/* LEFT — team + playbook */}
              <div className="biab-bcol">
                <div className="biab-cell">
                  <div className="biab-cellh">Your team<span className="ct">{stats.team}</span></div>
                  {/* Department bento: one tile per department, spanning columns by
                      member count (dense-packed), so the section fills with no orphan
                      and the grouping is kept as tile headers. */}
                  <div className="biab-teambento">
                    {departments.map((dept) => (
                      <div
                        className="biab-dtile"
                        style={{ gridColumn: `span ${Math.min(dept.members.length, 3)}` }}
                        key={dept.name}
                      >
                        <div className="dl">{dept.name}</div>
                        <div className="biab-dmem">
                          {dept.members.map((m) => (
                            <div className="biab-dm" key={m.role}>
                              <AgentAvatar characterName={m.name} role={m.role} size={28} />
                              <div className="di">
                                <div className="mn">{m.name}</div>
                                <div className="mr">{m.role}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {addOnRoles.length > 0 && (
                    <div className="biab-addon">
                      <div className="dl">Add as you scale</div>
                      <div className="biab-addchips">
                        {addOnRoles.map((r) => <span className="biab-addchip" key={r}>{r}</span>)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="biab-cell">
                  <div className="biab-cellh">Proven methods they use<span className="ct">{stats.frameworks}</span></div>
                  <p className="biab-note">These are the proven methods your team already knows, grouped by what they are for. They apply the ones that fit your project and cite the source, never generic templates.</p>
                  <div className="biab-pbbento">
                    {playbookGroups.map((g) => (
                      <div className="biab-pbtile" key={g.label}>
                        <div className="gl">{g.label}</div>
                        <div className="biab-pbchips">
                          {g.frameworks.map((f) => (
                            <span className="biab-pbchip" key={f} title={glosses[f] || undefined}>{f}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT — plan + documents */}
              <div className="biab-bcol">
                <div className="biab-cell">
                  <div className="biab-cellh">The plan<span className="ct">{stats.steps} steps</span></div>
                  <div className="biab-jtl">
                    {plan.map((stage, i) => (
                      <div className="biab-jstep" key={stage.key}>
                        <span className="num">{i + 1}</span>
                        <div className="sname">{stage.label}</div>
                        <div className="tasks">
                          {stage.steps.map((s, si) => <span className="biab-jtask" key={si}>{s.title}</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="biab-cell">
                  <div className="biab-cellh">Documents<span className="ct">{stats.docs}</span></div>
                  <div className="biab-docgrid">
                    {documents.map((d) => {
                      const Icon = docIconFor(d.type);
                      return (
                        <div className="biab-doc" key={d.key}>
                          <Icon className="di" size={15} />
                          <span className="dt">{d.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="biab-dfoot">
              <span className="fl"><Check size={13} style={{ color: "var(--green)", flexShrink: 0 }} /> Every figure is cited to a vetted source. Legal steps are "verify locally", not advice.</span>
              <button className="biab-btn pri" onClick={() => onStart(packId)} disabled={isStarting}>
                {isStarting ? <><Loader2 size={16} className="animate-spin" /> Starting</> : <>Start with this pack <ChevronRight size={16} /></>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
