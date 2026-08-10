// Business-in-a-Box — the "server brain" (2026-08-10)
// =============================================================================
// Turns a founder's freeform idea into one of three outcomes, so the intent-first
// front door never dead-ends:
//   - mode "pack"     → a curated deep pack fits (recommend it)
//   - mode "assemble" → no pack fits; assemble a custom team + plan from the same
//                        building blocks (roles, deliverable types, the 4-stage
//                        lifecycle) — the generative fallback
//   - mode "clarify"  → too vague to route; ask one question
//
// classifyIdea is deliberately a cheap, dependency-free keyword pass right now.
// The LLM-backed classifier is a drop-in behind the same function signature later
// (see the `// LLM-SEAM` marker) — the router and everything above it stay unchanged.
//
// assembleBlueprint returns a real, seedable PackBlueprint (tier "free"), so an
// assembled idea instantiates through the exact same seeder as a curated pack.
// =============================================================================

import {
  type PackBlueprint, type PackSummary,
  getPackBlueprint, summarizeBlueprint,
} from "@shared/packBlueprints";

const MAX_IDEA_LEN = 300;

function cleanIdea(idea: string | undefined | null): string {
  return (idea ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_IDEA_LEN);
}

/** True when the idea is too thin to route confidently (empty, "not sure", one word). */
export function isVagueIdea(idea: string): boolean {
  const t = idea.toLowerCase();
  if (!t) return true;
  if (/^(not sure|dunno|idk|i don'?t know|no idea|nothing|anything|help)/.test(t)) return true;
  return t.split(/\s+/).length < 2;
}

/**
 * Map a freeform idea to a curated pack id, or null when none clearly fits.
 * LLM-SEAM: replace the body with a constrained LLM classification (must return a
 * known pack id or null) without changing the signature.
 */
export function classifyIdea(idea: string): string | null {
  const t = idea.toLowerCase();
  if (/\b(restaurant|cafe|café|coffee|food|bar|bakery|diner|kitchen|eatery|menu|bistro|deli|catering)\b/.test(t)) {
    if (getPackBlueprint("restaurant-launch")) return "restaurant-launch";
  }
  if (/\b(app|tool|saas|software|platform|dashboard|subscription|api|web app|webapp|mobile|booking|crm|startup|product|b2b)\b/.test(t)) {
    if (getPackBlueprint("saas-startup")) return "saas-startup";
  }
  return null;
}

export type RouteResult =
  | { mode: "pack"; idea: string; packId: string; summary: PackSummary }
  | { mode: "assemble"; idea: string; blueprint: PackBlueprint; summary: PackSummary }
  | { mode: "clarify"; idea: string };

/** Route an idea to a curated pack, an assembled custom blueprint, or a clarify prompt. */
export function routeIdea(rawIdea: string): RouteResult {
  const idea = cleanIdea(rawIdea);

  const packId = classifyIdea(idea);
  if (packId) {
    const bp = getPackBlueprint(packId)!;
    return { mode: "pack", idea, packId, summary: summarizeBlueprint(bp) };
  }

  if (isVagueIdea(idea)) {
    return { mode: "clarify", idea };
  }

  const blueprint = assembleBlueprint(idea);
  return { mode: "assemble", idea, blueprint, summary: summarizeBlueprint(blueprint) };
}

// -----------------------------------------------------------------------------
// Generative fallback — assemble a team + plan for ANY idea.
// Constrained to real roleRegistry roles + real deliverable types + the 4-stage
// lifecycle, so the output is always a valid, seedable blueprint (no nonsense).
// -----------------------------------------------------------------------------
const UNIVERSAL_TEAM: Array<{ role: string; brief: string }> = [
  { role: "Product Manager", brief: "Own the plan and keep the team focused on the single most important thing to do next." },
  { role: "Business Strategist", brief: "Own the case for the business: who it is for, why it wins, and how it makes money." },
  { role: "Brand Strategist", brief: "Own how it looks and sounds so people understand it fast and remember it." },
  { role: "Growth Marketer", brief: "Own how the first customers find it and why they come back." },
  { role: "Finance Analyst", brief: "Own the numbers: what it costs, what it earns, and how long the money lasts." },
  { role: "Legal Counsel", brief: "Own the typical legal and compliance steps as things to verify locally with a professional. Not legal advice." },
];

export function assembleBlueprint(rawIdea: string): PackBlueprint {
  const idea = cleanIdea(rawIdea) || "your idea";
  return {
    packId: "assembled",
    packTitle: "Your custom team",
    tier: "free", // the generative fallback is the free-tier safety net
    team: UNIVERSAL_TEAM.map(m => m.role),
    direction: {
      whatBuilding: idea,
      whyMatters: "Getting the fundamentals right early, a clear plan, honest numbers, and a first version in front of real people, is what turns an idea into something that lasts.",
      whoFor: "The specific first customer this is for: who they are, the problem they feel, and why they would choose this.",
    },
    roleBriefs: Object.fromEntries(UNIVERSAL_TEAM.map(m => [m.role, m.brief])),
    stages: [
      { key: "prerequisites", label: "Validate & plan", summary: "Pressure-test the idea and lay the foundations." },
      { key: "build", label: "Build", summary: "Make the first version people can actually use." },
      { key: "launch", label: "Launch", summary: "Get it in front of the first real customers." },
      { key: "grow", label: "Grow", summary: "Double down on what is working." },
    ],
    documents: [
      { key: "biz-plan", type: "business-plan", title: "Business Plan", description: "What you are building, for whom, how it makes money, and the path to get there.", role: "Business Strategist", stage: "prerequisites" },
      { key: "fin-model", type: "financial-model", title: "Financial Model", description: "Revenue, costs, break-even, and how long the money lasts.", role: "Finance Analyst", stage: "prerequisites" },
      { key: "legal", type: "legal-checklist", title: "Legal & Compliance Checklist", description: "Typical entity, contracts, and compliance steps. Verify locally, consult a professional. Not legal advice.", role: "Legal Counsel", stage: "prerequisites" },
      { key: "brand", type: "brand-guide", title: "Brand & Identity Guide", description: "Name, look, and voice that fit the idea and stick with people.", role: "Brand Strategist", stage: "build" },
      { key: "gtm", type: "gtm-plan", title: "Go-to-Market Plan", description: "The first channels, the message, and how you reach the first customers.", role: "Growth Marketer", stage: "launch" },
    ],
    tasks: [
      { title: "Pressure-test the idea with real people who would pay", description: "Talk to people who have the problem. Confirm it is real, painful, and something they would pay to solve before building.", role: "Product Manager", stage: "prerequisites", priority: "high" },
      { title: "Write the business plan", description: "Capture what you are building, who it is for, how it makes money, and the path to first revenue. A starting point you will revise.", role: "Business Strategist", stage: "prerequisites", priority: "high", producesDocKey: "biz-plan" },
      { title: "Build the financial model", description: "Model revenue, costs, break-even, and runway. Keep the numbers honest.", role: "Finance Analyst", stage: "prerequisites", priority: "high", producesDocKey: "fin-model" },
      { title: "Work through the legal and compliance checklist", description: "List the typical legal, tax, and compliance steps for this kind of business. Flag what to verify locally.", role: "Legal Counsel", stage: "prerequisites", priority: "medium", producesDocKey: "legal" },
      { title: "Make the smallest version people can actually use", description: "Build the least you can that delivers real value, then put it in front of someone.", role: "Product Manager", stage: "build", priority: "high" },
      { title: "Create the brand and identity", description: "A name, look, and voice that fit the idea and are easy to recognize.", role: "Brand Strategist", stage: "build", priority: "medium", producesDocKey: "brand" },
      { title: "Write the go-to-market plan", description: "Pick one or two channels you can actually execute, define the message, and lay out the first push.", role: "Growth Marketer", stage: "launch", priority: "high", producesDocKey: "gtm" },
      { title: "Get it in front of the first customers", description: "Run the launch, talk to everyone who tries it, and learn fast.", role: "Growth Marketer", stage: "launch", priority: "high" },
      { title: "Double down on what is working", description: "Find the one thing driving results and put more into it. Cut what is not.", role: "Product Manager", stage: "grow", priority: "medium" },
      { title: "Review the numbers every month", description: "Compare actuals to the model monthly and adjust before small gaps become big ones.", role: "Finance Analyst", stage: "grow", priority: "low" },
    ],
  };
}
