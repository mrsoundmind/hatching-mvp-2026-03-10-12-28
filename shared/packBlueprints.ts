// Business-in-a-Box — Pack Blueprints (BIAB-0)
// =============================================================================
// A "blueprint" turns a starter pack from "3 generic agents + one welcome line"
// into a complete guided operating system: the right team, a prefilled project
// direction, staged + assigned tasks, and pre-scaffolded documents linked to the
// tasks that produce them.
//
// This file is DATA ONLY (no side effects). The seeding logic that reads it and
// creates teams/agents/tasks/docs lives in server/starterPacks/seedBlueprint.ts,
// which runs through the IStorage interface so it behaves identically in
// MemStorage and DatabaseStorage.
//
// Design rules baked in here (from the milestone REQUIREMENTS):
//  - Roles are real roleRegistry roles, so packAgentName resolves the character
//    name (Alex, Cleo, Juhi…) and the agent is genuinely cast for the business.
//  - Tasks carry a lifecycle stage (prerequisites → build → launch → grow) and an
//    intra-stage order, so the journey renders in sequence.
//  - Documents are pre-scaffolded structural templates (cheap, zero-LLM at seed
//    time — OPS-01 cost model); an agent fills them in on demand.
//  - A task that produces a document references it by `producesDocKey`; the seed
//    helper wires the bidirectional task↔deliverable link (PROC-06).
//  - Legal/tax content is framed as "typical, verify locally, consult a
//    professional" — never authoritative advice (DOC-04). Owned by Legal (Ira).
//  - No invented statistics or fake case studies here — the sourced field
//    playbook (PLAY-*) is a later BIAB-1 layer; blueprints stay structural.
//
// Flagship blueprints (decision D-1, 2026-08-10): SaaS Startup + Restaurant
// Launch — one digital pack and one local/physical pack, to validate the
// four-layer template across two very different business shapes before scaling.
// =============================================================================

export type LifecycleStage = "prerequisites" | "build" | "launch" | "grow";

export interface BlueprintStage {
  key: LifecycleStage;
  label: string;
  summary: string;
}

export interface BlueprintDirection {
  whatBuilding: string;
  whyMatters: string;
  whoFor: string;
}

export interface BlueprintDocument {
  /** Stable key, unique within a blueprint — used to link a task to the doc it produces. */
  key: string;
  /** Deliverable type; must exist in DELIVERABLE_TYPE_REGISTRY / the deliverables.type union. */
  type: string;
  title: string;
  description: string;
  /** Producing role — must be one of blueprint.team so it maps to a created agent. */
  role: string;
  stage: LifecycleStage;
}

export interface BlueprintTask {
  title: string;
  description: string;
  /** Assignee role — must be one of blueprint.team so it maps to a created agent. */
  role: string;
  stage: LifecycleStage;
  priority: "low" | "medium" | "high" | "urgent";
  /** When set, links this task to the blueprint document with the matching key (PROC-06). */
  producesDocKey?: string;
}

export type PackTier = "free" | "pro";

export interface PackBlueprint {
  packId: string;
  packTitle: string;
  /**
   * Monetization tier (Business-in-a-Box freemium model, 2026-08-10).
   * "free" = fully usable by anyone. "pro" = preview free, upgrade to launch.
   * PRODUCT DECISION — the exact free/Pro split is just this field per pack, trivially
   * changed. Current split is a proposal (SaaS free taste, Restaurant Pro showcase); the
   * defensible Pro value is the cited field playbook + docs-to-spec layer (see HANDOFF moat note),
   * NOT the roster, so deep packs can carry the playbook behind Pro even when structure is free.
   */
  tier: PackTier;
  /** Roles to seed as the team (overrides pack.members). Real roleRegistry roles. */
  team: string[];
  /** Prefilled project direction (INTAKE-02) — a starting point the founder edits. */
  direction: BlueprintDirection;
  /** Per-role focus brief for THIS business (TEAM-03) — not a generic role description. */
  roleBriefs: Record<string, string>;
  stages: BlueprintStage[];
  documents: BlueprintDocument[];
  tasks: BlueprintTask[];
}

const STAGES: BlueprintStage[] = [
  { key: "prerequisites", label: "Get set up", summary: "Validate the idea and lay the foundations before you build." },
  { key: "build", label: "Build", summary: "Make the core thing customers will actually use." },
  { key: "launch", label: "Launch", summary: "Get it in front of the first real customers." },
  { key: "grow", label: "Grow", summary: "Turn early traction into steady, repeatable growth." },
];

// -----------------------------------------------------------------------------
// Flagship 1 — SaaS Startup (digital)
// -----------------------------------------------------------------------------
const SAAS_STARTUP: PackBlueprint = {
  packId: "saas-startup",
  packTitle: "SaaS Startup",
  tier: "free", // free deep-pack taste (proposal; flip to "pro" to gate)
  team: [
    "Product Manager",
    "Technical Lead",
    "Product Designer",
    "Growth Marketer",
    "Copywriter",
    "Finance Analyst",
    "Legal Counsel",
  ],
  direction: {
    whatBuilding: "A software product that solves one painful, recurring problem for a specific type of user, sold as a subscription.",
    whyMatters: "People will pay every month for software that reliably saves them time or money on something they do often. The goal is a product a small number of users cannot live without, then widen from there.",
    whoFor: "A clearly defined first user: their role, the job they are trying to get done, and the moment the pain shows up. Narrow beats broad at the start.",
  },
  roleBriefs: {
    "Product Manager": "Own the product direction for this SaaS. Keep the team ruthlessly focused on the one core problem, cut scope to an MVP that ships, and make sure every feature earns its place against real user need.",
    "Technical Lead": "Own the architecture. Pick a simple, boring, reliable stack that ships fast and holds up, avoid premature scale, and keep the path from idea to deployed feature short.",
    "Product Designer": "Own the experience. Make the core flow obvious in seconds, design onboarding that gets a new user to their first win fast, and keep the interface honest and uncluttered.",
    "Growth Marketer": "Own how the first users find and stick with the product. Build one or two channels that actually work, instrument activation and retention, and separate signal from vanity metrics.",
    "Copywriter": "Own the words. Write a landing page and in-product copy that make the value obvious to a stranger in one read, no jargon, no hype.",
    "Finance Analyst": "Own the numbers. Build the unit economics (what a customer costs to win and serve versus what they pay), track runway, and keep pricing tied to value.",
    "Legal Counsel": "Own the legal footing at a founder-appropriate level. Frame entity, terms of service, privacy, and data handling as typical steps to verify locally with a professional. Not legal advice.",
  },
  stages: STAGES,
  documents: [
    // prerequisites
    { key: "saas-biz-plan", type: "business-plan", title: "SaaS Business Plan", description: "The founding document: the problem, the product, who it is for, how it makes money, and the path to get there.", role: "Product Manager", stage: "prerequisites" },
    { key: "saas-fin-model", type: "financial-model", title: "Financial Model & Unit Economics", description: "Revenue, cost to acquire and serve a customer, break-even, and how long the money lasts.", role: "Finance Analyst", stage: "prerequisites" },
    { key: "saas-legal", type: "legal-checklist", title: "Legal & Compliance Checklist", description: "Typical entity, terms, privacy, and data steps for a SaaS. Verify locally, consult a professional. Not legal advice.", role: "Legal Counsel", stage: "prerequisites" },
    // build
    { key: "saas-prd", type: "prd", title: "Product Requirements (v1)", description: "What v1 does, who it is for, the core user stories, and what is deliberately left out.", role: "Product Manager", stage: "build" },
    { key: "saas-tech-spec", type: "tech-spec", title: "Technical Architecture Spec", description: "The stack, data model, key components, and how a feature goes from code to deployed.", role: "Technical Lead", stage: "build" },
    { key: "saas-design-brief", type: "design-brief", title: "Product Design Brief", description: "The core flows, the onboarding path to first value, and the design principles for the product.", role: "Product Designer", stage: "build" },
    // launch
    { key: "saas-gtm", type: "gtm-plan", title: "Go-to-Market Plan", description: "The first channels, the message, the launch sequence, and the metrics that say it worked.", role: "Growth Marketer", stage: "launch" },
    { key: "saas-landing", type: "landing-copy", title: "Landing Page Copy", description: "Conversion-focused copy that makes the value obvious to a first-time visitor.", role: "Copywriter", stage: "launch" },
    // grow
    { key: "saas-seo", type: "seo-brief", title: "SEO & Content Growth Brief", description: "The search terms worth ranking for and a content plan to earn steady organic signups.", role: "Growth Marketer", stage: "grow" },
  ],
  tasks: [
    // prerequisites
    { title: "Validate the problem with 5 target users", description: "Talk to five people who have the problem. Confirm it is painful, frequent, and something they would pay to fix before you build anything.", role: "Product Manager", stage: "prerequisites", priority: "high" },
    { title: "Write the SaaS business plan", description: "Capture the problem, the product, the first user, the business model, and the path to first revenue. A starting point you will revise as you learn.", role: "Product Manager", stage: "prerequisites", priority: "high", producesDocKey: "saas-biz-plan" },
    { title: "Build the financial model and unit economics", description: "Model pricing, cost to acquire and serve a customer, break-even, and runway. Keep pricing tied to the value delivered.", role: "Finance Analyst", stage: "prerequisites", priority: "high", producesDocKey: "saas-fin-model" },
    { title: "Work through the legal and compliance checklist", description: "List the typical entity, terms of service, privacy, and data steps for a SaaS in your market. Flag what to verify locally with a professional.", role: "Legal Counsel", stage: "prerequisites", priority: "medium", producesDocKey: "saas-legal" },
    // build
    { title: "Write the PRD for v1", description: "Define exactly what v1 does, the core user stories, and what is out of scope. Cut hard to the smallest thing that delivers real value.", role: "Product Manager", stage: "build", priority: "high", producesDocKey: "saas-prd" },
    { title: "Define the technical architecture", description: "Choose a simple, reliable stack, sketch the data model and key components, and keep the path from code to deployed feature short.", role: "Technical Lead", stage: "build", priority: "high", producesDocKey: "saas-tech-spec" },
    { title: "Create the product design brief and core flows", description: "Design the one core flow and the onboarding path to a new user's first win. Make it obvious in seconds.", role: "Product Designer", stage: "build", priority: "high", producesDocKey: "saas-design-brief" },
    { title: "Scope and build the MVP", description: "Build the smallest version that a real user can get value from. Resist adding anything that is not essential to the core job.", role: "Technical Lead", stage: "build", priority: "high" },
    // launch
    { title: "Write the go-to-market plan", description: "Pick one or two channels you can actually execute, define the message, and lay out the launch sequence and success metrics.", role: "Growth Marketer", stage: "launch", priority: "high", producesDocKey: "saas-gtm" },
    { title: "Write the landing page copy", description: "Make the value obvious to a stranger in one read. Lead with the problem you solve, not a feature list.", role: "Copywriter", stage: "launch", priority: "medium", producesDocKey: "saas-landing" },
    { title: "Design the pricing page and tiers", description: "Turn the financial model into clear, honest pricing tiers and a page that makes the right plan easy to choose.", role: "Product Designer", stage: "launch", priority: "medium" },
    { title: "Set up analytics for activation and retention", description: "Instrument the moments that matter: signup, first value, and repeat use. Measure what tells you the product is working, not vanity metrics.", role: "Growth Marketer", stage: "launch", priority: "medium" },
    // grow
    { title: "Build the SEO and content growth brief", description: "Find the search terms worth ranking for and plan content that earns steady organic signups over time.", role: "Growth Marketer", stage: "grow", priority: "medium", producesDocKey: "saas-seo" },
    { title: "Design the onboarding and activation flow", description: "Get more new users to their first win. Remove steps, add guidance, and measure the drop-off points.", role: "Product Designer", stage: "grow", priority: "medium" },
    { title: "Set up a weekly retention and churn review", description: "Review who is sticking, who is leaving, and why, every week. Feed what you learn back into the product.", role: "Finance Analyst", stage: "grow", priority: "low" },
  ],
};

// -----------------------------------------------------------------------------
// Flagship 2 — Restaurant Launch (local / physical)
// -----------------------------------------------------------------------------
const RESTAURANT_LAUNCH: PackBlueprint = {
  packId: "restaurant-launch",
  packTitle: "Restaurant Launch",
  tier: "pro", // Pro showcase (proposal; flip to "free" to open)
  team: [
    "Business Strategist",
    "Operations Manager",
    "Brand Strategist",
    "Legal Counsel",
    "Finance Analyst",
    "Social Media Manager",
  ],
  direction: {
    whatBuilding: "A restaurant with a clear concept, a menu that makes money per plate, and an operation that runs smoothly on a busy night.",
    whyMatters: "Restaurants succeed on the boring fundamentals as much as the food: a concept people want, food and labor costs that leave a margin, and a location and operation that hold up under a full house.",
    whoFor: "A specific neighborhood and diner: who they are, when they eat out, what they will pay, and why they choose you over the place next door.",
  },
  roleBriefs: {
    "Business Strategist": "Own the concept and the case for it. Define who this restaurant is for, why it wins in its neighborhood, and how the pieces (menu, price point, location, vibe) fit into one coherent idea.",
    "Operations Manager": "Own how the restaurant actually runs. Design the kitchen and floor procedures, source and negotiate with suppliers, plan staffing, and make service repeatable on a busy night.",
    "Brand Strategist": "Own the identity. Name, look, and feel that fit the concept and the neighborhood, from the sign outside to the menu in someone's hands.",
    "Legal Counsel": "Own the legal footing at a founder-appropriate level. Frame the typical licenses, permits, and food-safety requirements as steps to verify locally with the relevant authority and a professional. Not legal advice.",
    "Finance Analyst": "Own the numbers that decide whether this works: food cost percentage, labor, covers per night, break-even, and the money needed to open and survive the first months.",
    "Social Media Manager": "Own local awareness and the opening. Build anticipation before the doors open, run the soft-open-to-grand-open plan, and turn first diners into regulars and reviews.",
  },
  stages: STAGES,
  documents: [
    // prerequisites
    { key: "rest-biz-plan", type: "business-plan", title: "Restaurant Business Plan & Concept", description: "The concept, the neighborhood and diner, the menu direction, the money model, and the path to opening.", role: "Business Strategist", stage: "prerequisites" },
    { key: "rest-fin-model", type: "financial-model", title: "Restaurant Financial Model", description: "Covers per night, food cost %, labor, break-even, and the capital needed to open and survive the first months.", role: "Finance Analyst", stage: "prerequisites" },
    { key: "rest-legal", type: "legal-checklist", title: "Licenses, Permits & Food Safety Checklist", description: "Typical licenses, permits, and food-safety steps to open a restaurant. Verify locally with the authority. Not legal advice.", role: "Legal Counsel", stage: "prerequisites" },
    // build
    { key: "rest-brand", type: "brand-guide", title: "Restaurant Brand & Identity Guide", description: "Name, look, and feel, from the sign to the menu, that fit the concept and the neighborhood.", role: "Brand Strategist", stage: "build" },
    { key: "rest-kitchen-sop", type: "sop", title: "Kitchen & Floor SOPs", description: "The step-by-step procedures that make prep, service, and cleanup repeatable and safe.", role: "Operations Manager", stage: "build" },
    // launch
    { key: "rest-opening-plan", type: "gtm-plan", title: "Opening & Local Marketing Plan", description: "How you build anticipation, run the soft open, and fill the room for the grand opening.", role: "Social Media Manager", stage: "launch" },
    { key: "rest-content-cal", type: "content-calendar", title: "Launch Content Calendar", description: "The posts, from teaser to grand-open, that build a local audience before and after opening.", role: "Social Media Manager", stage: "launch" },
    // grow
    { key: "rest-weekly-sop", type: "sop", title: "Weekly Operations & Inventory SOP", description: "The weekly rhythm: inventory, ordering, prep, and the checks that keep food cost and quality in line.", role: "Operations Manager", stage: "grow" },
  ],
  tasks: [
    // prerequisites
    { title: "Lock the concept and target neighborhood", description: "Decide exactly what this restaurant is, who it is for, and where. One clear idea beats a menu that tries to please everyone.", role: "Business Strategist", stage: "prerequisites", priority: "high" },
    { title: "Write the restaurant business plan and concept", description: "Capture the concept, the diner, the menu direction, the money model, and the path to opening. A starting point you will refine.", role: "Business Strategist", stage: "prerequisites", priority: "high", producesDocKey: "rest-biz-plan" },
    { title: "Build the financial model: covers, food cost, break-even", description: "Model covers per night, food cost %, labor, break-even, and the capital to open and survive the first months.", role: "Finance Analyst", stage: "prerequisites", priority: "high", producesDocKey: "rest-fin-model" },
    { title: "Work through licenses, permits and food safety", description: "List the typical licenses, permits, and food-safety requirements for your area. Flag each one to verify with the local authority.", role: "Legal Counsel", stage: "prerequisites", priority: "high", producesDocKey: "rest-legal" },
    { title: "Scout and shortlist three locations", description: "Compare foot traffic, rent, size, and fit with the concept. The wrong location is the hardest mistake to undo.", role: "Operations Manager", stage: "prerequisites", priority: "high" },
    // build
    { title: "Design the menu and price each dish to margin", description: "Build a menu that fits the concept and prices each dish to hit the target food-cost margin from the financial model.", role: "Operations Manager", stage: "build", priority: "high" },
    { title: "Create the brand and identity guide", description: "Name, logo, colors, and the look that carry from the sign outside to the menu in a diner's hands.", role: "Brand Strategist", stage: "build", priority: "medium", producesDocKey: "rest-brand" },
    { title: "Write the kitchen and floor SOPs", description: "Document prep, service, and cleanup step by step so any shift runs the same way, safely.", role: "Operations Manager", stage: "build", priority: "high", producesDocKey: "rest-kitchen-sop" },
    { title: "Source suppliers and negotiate opening orders", description: "Line up reliable suppliers for food and essentials, and negotiate terms for the opening order.", role: "Operations Manager", stage: "build", priority: "medium" },
    // launch
    { title: "Write the opening and local marketing plan", description: "Plan how you build anticipation, run the soft open, and fill the room on grand-opening night.", role: "Social Media Manager", stage: "launch", priority: "high", producesDocKey: "rest-opening-plan" },
    { title: "Build the launch content calendar", description: "Map the posts from first teaser to grand open that build a local following before the doors open.", role: "Social Media Manager", stage: "launch", priority: "medium", producesDocKey: "rest-content-cal" },
    { title: "Plan and staff the soft-open week", description: "Run a soft open with friends and locals to shake out the kitchen and service before the real crowd arrives.", role: "Operations Manager", stage: "launch", priority: "high" },
    // grow
    { title: "Set up the weekly operations and inventory SOP", description: "Establish the weekly rhythm of inventory, ordering, and prep that keeps food cost and quality in line.", role: "Operations Manager", stage: "grow", priority: "medium", producesDocKey: "rest-weekly-sop" },
    { title: "Launch a local loyalty and reviews push", description: "Turn first diners into regulars: a simple loyalty offer and an easy nudge to leave an honest review.", role: "Social Media Manager", stage: "grow", priority: "medium" },
    { title: "Review food cost and labor against the model monthly", description: "Compare actual food cost and labor to the model every month and adjust the menu or staffing before small gaps become big ones.", role: "Finance Analyst", stage: "grow", priority: "low" },
  ],
};

// -----------------------------------------------------------------------------
// Registry
// -----------------------------------------------------------------------------
export const PACK_BLUEPRINTS: Record<string, PackBlueprint> = {
  [SAAS_STARTUP.packId]: SAAS_STARTUP,
  [RESTAURANT_LAUNCH.packId]: RESTAURANT_LAUNCH,
};

/** Returns the deep blueprint for a pack id, or undefined for packs not yet upgraded. */
export function getPackBlueprint(packId: string): PackBlueprint | undefined {
  return PACK_BLUEPRINTS[packId];
}

/** True when a pack has a deep blueprint (vs. the legacy team-only seeding). */
export function hasPackBlueprint(packId: string): boolean {
  return packId in PACK_BLUEPRINTS;
}

export interface PackSummary {
  packId: string;
  title: string;
  tier: PackTier;
  teamCount: number;
  taskCount: number;
  docCount: number;
  direction: BlueprintDirection;
}

/** Compact, client-safe summary of one blueprint (for the picker cards + router response). */
export function summarizeBlueprint(bp: PackBlueprint): PackSummary {
  return {
    packId: bp.packId,
    title: bp.packTitle,
    tier: bp.tier,
    teamCount: bp.team.length,
    taskCount: bp.tasks.length,
    docCount: bp.documents.length,
    direction: bp.direction,
  };
}

/** All deep packs as summaries — powers the pack catalog endpoint + the picker cards. */
export function packCatalog(): PackSummary[] {
  return Object.values(PACK_BLUEPRINTS).map(summarizeBlueprint);
}

/** Tier for a pack id; deep packs carry their own tier, unknown/legacy packs default to free. */
export function getPackTier(packId: string): PackTier {
  return PACK_BLUEPRINTS[packId]?.tier ?? "free";
}
