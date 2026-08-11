// Landing v3 · Start from a pack — one interactive, detailed explorer.
//
// A row of packs (a pack for whatever you're building, and more) and a panel
// that OPENS the selected one to its REAL contents: the team, grouped by
// discipline; the staged journey with the tasks in each stage; the full list of
// documents; and the field playbook, with the note that the pack adapts those
// frameworks to your project rather than handing over generic templates.
//
// Only the two packs that are actually built and staffed (SaaS Startup,
// Restaurant Launch) are clickable. The rest are shown so a visitor sees the
// ambition, but they are disabled and labelled "soon" until they exist. No
// Free/Pro tiers are shown yet.
//
// Only the selected detail is mounted, so its continuous loop animations (the
// working spotlight walking the team, the stage highlight, the playbook pulse)
// never stack up.

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BookOpen, Check, FileText, Layers, Lock, Users } from "lucide-react";

import AgentAvatar from "@/components/avatars/AgentAvatar";
import { CTA, Reveal, EASE } from "./primitives";

const GREEN = "#0F9D76";

type Member = { name: string; role: string };
type TeamGroup = { group: string; members: Member[] };
type Stage = { name: string; tasks: string[] };
type Pack = {
  id: string;
  emoji: string;
  name: string;
  cat: string;
  status: "ready" | "soon";
  tint: string;
  tagline?: string;
  stats?: { team: number; steps: number; docs: number; frameworks: number };
  team?: TeamGroup[];
  journey?: Stage[];
  docs?: string[];
  frameworks?: string[];
};

const PACKS: Pack[] = [
  {
    id: "saas",
    emoji: "🚀",
    name: "SaaS Startup",
    cat: "Digital products",
    status: "ready",
    tint: "linear-gradient(135deg,#eef1ff,#dde4ff)",
    tagline: "A subscription software product, from first user to steady growth.",
    stats: { team: 7, steps: 14, docs: 9, frameworks: 12 },
    team: [
      {
        group: "Product & delivery",
        members: [
          { name: "Alex", role: "Product Manager" },
          { name: "Jordan", role: "Technical Lead" },
          { name: "Cleo", role: "Product Designer" },
        ],
      },
      {
        group: "Growth & story",
        members: [
          { name: "Kai", role: "Growth Marketer" },
          { name: "Wren", role: "Copywriter" },
        ],
      },
      {
        group: "Money & risk",
        members: [
          { name: "Juhi", role: "Finance Analyst" },
          { name: "Ira", role: "Legal Counsel" },
        ],
      },
    ],
    journey: [
      { name: "Get set up", tasks: ["Validate the problem with 5 users", "Write the business plan", "Build the financial model", "Legal & compliance checklist"] },
      { name: "Build", tasks: ["Write the product requirements", "Define the architecture", "Design the core flows", "Scope & build the MVP"] },
      { name: "Launch", tasks: ["Go-to-market plan", "Landing page copy", "Pricing & packaging"] },
      { name: "Grow", tasks: ["SEO growth brief", "Activation & retention loops"] },
    ],
    docs: [
      "Business Plan",
      "Financial Model",
      "Legal & Compliance Checklist",
      "Product Requirements",
      "Architecture Spec",
      "Design Brief",
      "Go-to-Market Plan",
      "Landing Page Copy",
      "SEO Growth Brief",
    ],
    frameworks: ["RICE scoring", "Jobs-to-Be-Done", "Kano model", "Value-based pricing", "LTV : CAC & payback", "Rule of 40", "North Star Metric", "Growth loops", "Sean Ellis PMF test", "Cohort retention", "Van Westendorp", "Activation / aha moment"],
  },
  {
    id: "restaurant",
    emoji: "🍽️",
    name: "Restaurant Launch",
    cat: "Local & services",
    status: "ready",
    tint: "linear-gradient(135deg,#f7efd8,#efe0b6)",
    tagline: "A concept people want, a menu that makes money, an operation that holds up.",
    stats: { team: 6, steps: 14, docs: 8, frameworks: 8 },
    team: [
      {
        group: "Concept & brand",
        members: [
          { name: "Blake", role: "Business Strategist" },
          { name: "Cass", role: "Brand Strategist" },
        ],
      },
      {
        group: "Run the place",
        members: [{ name: "Quinn", role: "Operations Manager" }],
      },
      {
        group: "Fill the seats",
        members: [{ name: "Nova", role: "Marketing Specialist" }],
      },
      {
        group: "Money & risk",
        members: [
          { name: "Juhi", role: "Finance Analyst" },
          { name: "Ira", role: "Legal Counsel" },
        ],
      },
    ],
    journey: [
      { name: "Concept & menu", tasks: ["Define the concept & positioning", "Engineer & cost the menu", "Build the financial model", "Licensing & food-safety checklist"] },
      { name: "Fit-out & licence", tasks: ["Site & lease review", "Kitchen & floor plan", "Supplier & inventory plan"] },
      { name: "Open the doors", tasks: ["Hiring & training plan", "Soft-open plan", "POS & operations setup"] },
      { name: "Fill the seats", tasks: ["Local marketing launch", "Reviews & reputation playbook"] },
    ],
    docs: ["Concept Brief", "Menu & Costing Sheet", "Financial Model", "Licensing Checklist", "Supplier Plan", "Opening Plan", "Local Marketing Plan", "Reviews Playbook"],
    frameworks: ["Menu engineering", "Prime cost ratio", "Break-even covers", "Table-turn math", "Local SEO", "Foot-traffic siting", "Loyalty loop", "Review velocity"],
  },
  { id: "ecom", emoji: "🛍️", name: "E-commerce Store", cat: "Digital products", status: "soon", tint: "linear-gradient(135deg,#eef1ff,#e2e7ff)" },
  { id: "app", emoji: "📱", name: "Mobile App", cat: "Digital products", status: "soon", tint: "linear-gradient(135deg,#eef1ff,#e2e7ff)" },
  { id: "agency", emoji: "🎨", name: "Design Agency", cat: "Services", status: "soon", tint: "linear-gradient(135deg,#f2ecfb,#e6dcf5)" },
  { id: "news", emoji: "✍️", name: "Newsletter", cat: "Media", status: "soon", tint: "linear-gradient(135deg,#f2ecfb,#e6dcf5)" },
  { id: "course", emoji: "🎓", name: "Online Course", cat: "Media", status: "soon", tint: "linear-gradient(135deg,#f2ecfb,#e6dcf5)" },
  { id: "consult", emoji: "🤝", name: "Consulting Practice", cat: "Services", status: "soon", tint: "linear-gradient(135deg,#f2ecfb,#e6dcf5)" },
  { id: "fitness", emoji: "🏋️", name: "Fitness Studio", cat: "Local & services", status: "soon", tint: "linear-gradient(135deg,#f7efd8,#efe0b6)" },
  { id: "cafe", emoji: "☕", name: "Coffee Shop", cat: "Local & services", status: "soon", tint: "linear-gradient(135deg,#f7efd8,#efe0b6)" },
  { id: "podcast", emoji: "🎙️", name: "Podcast", cat: "Media", status: "soon", tint: "linear-gradient(135deg,#f2ecfb,#e6dcf5)" },
  { id: "realestate", emoji: "🏠", name: "Real Estate", cat: "Local & services", status: "soon", tint: "linear-gradient(135deg,#f7efd8,#efe0b6)" },
  { id: "handmade", emoji: "🧵", name: "Handmade Brand", cat: "Retail", status: "soon", tint: "linear-gradient(135deg,#f6e0de,#edc3c0)" },
  { id: "pets", emoji: "🐕", name: "Pet Services", cat: "Local & services", status: "soon", tint: "linear-gradient(135deg,#f7efd8,#efe0b6)" },
];

function SectionLabel({ icon: Icon, children }: { icon: typeof Users; children: React.ReactNode }) {
  return (
    <span className="lv3-label lv3-t-navy mb-2.5 flex items-center gap-2 text-[10px]">
      <Icon className="lv3-t-blue size-3.5" />
      {children}
    </span>
  );
}

function ReadyDetail({ pack, tick, reduce }: { pack: Pack; tick: number; reduce: boolean | null }) {
  const flatTeam = (pack.team ?? []).flatMap((g) => g.members);
  const litName = flatTeam.length ? flatTeam[tick % flatTeam.length].name : "";

  return (
    <motion.div
      key={pack.id}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="flex flex-col gap-6"
    >
      {/* identity + stats */}
      <div className="flex flex-wrap items-center gap-3 border-b pb-5" style={{ borderColor: "var(--lv3-border)" }}>
        <span className="flex size-12 items-center justify-center rounded-lg text-2xl" style={{ background: pack.tint }}>
          {pack.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="lv3-t-navy text-[18px] font-semibold">{pack.name}</span>
            <span className="lv3-label lv3-t-soft-55 text-[9px]">{pack.cat}</span>
            <span className="lv3-label inline-flex items-center gap-1 text-[9px]" style={{ color: GREEN }}>
              <span className="relative flex size-1.5">
                {!reduce && <span className="absolute inline-flex size-1.5 animate-ping rounded-full" style={{ background: GREEN }} />}
                <span className="relative inline-flex size-1.5 rounded-full" style={{ background: GREEN }} />
              </span>
              staffed and ready
            </span>
          </span>
          <span className="lv3-t-soft mt-1 block text-[13px] leading-snug">{pack.tagline}</span>
        </span>
        {pack.stats && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {[
              [pack.stats.team, "specialists"],
              [pack.stats.steps, "steps"],
              [pack.stats.docs, "documents"],
              [pack.stats.frameworks, "frameworks"],
            ].map(([n, label]) => (
              <span key={label as string} className="flex items-baseline gap-1">
                <span className="lv3-t-navy text-[15px] font-semibold">{n}</span>
                <span className="lv3-t-soft-55 text-[10.5px]">{label}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* THE TEAM — grouped by discipline, names + roles clear */}
        <div>
          <SectionLabel icon={Users}>The team</SectionLabel>
          <div className="flex flex-col gap-3">
            {pack.team?.map((g) => (
              <div key={g.group}>
                <span className="lv3-label lv3-t-soft-55 mb-1.5 block text-[9px]">{g.group}</span>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {g.members.map((m) => {
                    const lit = m.name === litName;
                    return (
                      <motion.div
                        key={m.name}
                        className="flex items-center gap-2 border bg-white p-1.5"
                        animate={{ borderColor: lit ? "var(--lv3-amber-fill)" : "var(--lv3-border)" }}
                        transition={{ duration: 0.3 }}
                      >
                        <motion.span animate={reduce ? {} : { y: lit ? -2 : 0 }} transition={{ duration: 0.3 }} className="shrink-0">
                          <AgentAvatar characterName={m.name} role={m.role} size={24} state={lit ? "working" : "idle"} />
                        </motion.span>
                        <span className="min-w-0">
                          <span className="lv3-t-navy block truncate text-[11.5px] font-semibold leading-tight">{m.name}</span>
                          <span className="lv3-t-soft-55 block truncate text-[9.5px] leading-tight">{m.role}</span>
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* THE JOURNEY — stages with their tasks */}
        <div>
          <SectionLabel icon={Layers}>The journey, staged</SectionLabel>
          <div className="flex flex-col gap-2">
            {pack.journey?.map((s, i) => (
              <div key={s.name} className="border p-2.5" style={{ borderColor: "var(--lv3-border)", background: "#fbfbfe" }}>
                <span className="lv3-label lv3-t-navy mb-1.5 flex items-center gap-1.5 text-[9.5px]">
                  <span className="flex size-4 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ background: "var(--lv3-blue)" }}>{i + 1}</span>
                  {s.name}
                </span>
                <div className="flex flex-wrap gap-1">
                  {s.tasks.map((t) => (
                    <span key={t} className="lv3-t-soft rounded bg-white px-1.5 py-0.5 text-[9.5px]" style={{ border: "1px solid var(--lv3-border)" }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* THE DOCUMENTS — full list */}
        <div>
          <SectionLabel icon={FileText}>The documents it builds</SectionLabel>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {pack.docs?.map((d) => (
              <span key={d} className="flex items-center gap-1.5 border bg-white px-2 py-1.5" style={{ borderColor: "var(--lv3-border)" }}>
                <FileText className="lv3-t-blue size-3 shrink-0" />
                <span className="lv3-t-navy truncate text-[10.5px] font-medium">{d}</span>
              </span>
            ))}
          </div>
        </div>

        {/* THE PLAYBOOK — frameworks, adapted not templated */}
        <div>
          <SectionLabel icon={BookOpen}>The field playbook</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {pack.frameworks?.map((f, i) => {
              const lit = pack.frameworks && i === tick % pack.frameworks.length;
              return (
                <motion.span
                  key={f}
                  className="rounded border px-1.5 py-0.5 text-[10px] font-semibold"
                  animate={{
                    borderColor: lit ? "var(--lv3-blue)" : "var(--lv3-border)",
                    color: lit ? "var(--lv3-blue)" : "var(--lv3-navy)",
                    backgroundColor: lit ? "rgba(66,87,232,0.06)" : "#fff",
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {f}
                </motion.span>
              );
            })}
          </div>
          <p className="lv3-t-soft-55 mt-2.5 text-[11px] leading-snug">
            Not generic templates. Your team adapts these to your project as they work.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export function SectionPresets() {
  const reduce = useReducedMotion();
  const [sel, setSel] = useState("saas");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setTick((t) => t + 1), 950);
    return () => clearInterval(id);
  }, [reduce]);

  const pack = PACKS.find((p) => p.id === sel && p.status === "ready") ?? PACKS[0];

  return (
    <section id="packs" className="lv3-bg-candle px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-8 max-w-2xl">
          <span className="lv3-label lv3-t-blue">Start from a pack</span>
          <h2 className="lv3-display lv3-t-navy mt-4 text-balance">
            Whatever you're building,{" "}
            <span className="lv3-serif-em">there's a pack for it.</span>
          </h2>
          <p className="lv3-t-soft mt-4 text-lg leading-relaxed">
            Pick one to see everything inside. If yours isn't here yet, it's on the way.
          </p>
        </Reveal>

        {/* the pack picker — the built packs are clickable, the rest are on the way */}
        <div className="mb-3 flex flex-wrap gap-2">
          {PACKS.map((p) => {
            const ready = p.status === "ready";
            const on = ready && p.id === sel;
            return (
              <button
                key={p.id}
                type="button"
                disabled={!ready}
                onClick={ready ? () => setSel(p.id) : undefined}
                aria-pressed={on}
                aria-disabled={!ready}
                className="flex items-center gap-2 border px-3 py-2 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  ["--tw-ring-color" as string]: "var(--lv3-blue)",
                  cursor: ready ? "pointer" : "not-allowed",
                  opacity: ready ? 1 : 0.5,
                  borderStyle: ready ? "solid" : "dashed",
                  borderColor: on ? "var(--lv3-navy)" : "var(--lv3-border)",
                  background: on ? "var(--lv3-navy)" : "#fff",
                  color: on ? "#fff" : "var(--lv3-soft)",
                }}
              >
                <span className="text-[15px] leading-none">{p.emoji}</span>
                <span>{p.name}</span>
                {!ready && <Lock className="lv3-t-soft-55 size-3" />}
              </button>
            );
          })}
        </div>
        <p className="lv3-t-soft-55 mb-4 text-[12px]">
          <span className="lv3-t-soft font-medium">Two packs are ready today.</span> Click either to look inside. The rest are on the way.
        </p>

        {/* the opened pack */}
        <motion.div
          layout
          className="border p-5 sm:p-6"
          style={{ borderColor: "var(--lv3-border)", background: "#fff", boxShadow: "0 20px 50px -30px rgba(20,24,47,0.25)" }}
        >
          <AnimatePresence mode="wait">
            <ReadyDetail key={pack.id} pack={pack} tick={tick} reduce={reduce} />
          </AnimatePresence>
        </motion.div>

        {/* close */}
        <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="lv3-t-soft max-w-xl text-[13.5px] leading-relaxed">
            Every pack is a real team, plan, and documents.{" "}
            <span className="lv3-t-soft-55">Not a template you fill in.</span>
          </p>
          <CTA href="/login" variant="primary" className="shrink-0">
            Start free
            <ArrowRight className="ml-1.5 size-4" />
          </CTA>
        </div>
      </div>
    </section>
  );
}

export default SectionPresets;
