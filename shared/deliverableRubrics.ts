/**
 * Phase 36 — Frozen rubric registry.
 *
 * Each rubric scores a deliverable type 0-10 across 4-6 criteria. Anchors at 0
 * and 10 are scoring instructions for the LLM judge — they are NEVER shown to
 * the user. Mutations at runtime are prevented via Object.freeze (asserted by
 * scripts/test-rubric-scorer.ts case `immutability-invariant`).
 *
 * Each rubric is constructed via `rubricSchema.parse(...)` so malformed entries
 * fail at module-load time and the server refuses to start (fail-closed for an
 * immutability invariant — see D-01..D-05, RUBR-01, RUBR-03).
 *
 * Exports surface:
 *   - rubricCriterionSchema (Zod, strict)
 *   - rubricSchema (Zod, strict, refine() enforces weights sum to 1.0 ±1e-6)
 *   - Rubric type (z.infer)
 *   - DELIVERABLE_RUBRIC_REGISTRY: ReadonlyMap<string, Rubric>
 *   - getRubricForType(type: string): Rubric | null
 *   - listRubricTypes(): readonly string[]
 *
 * Downstream consumers:
 *   - server/ai/rubricScorer.ts (36-02) imports getRubricForType + Rubric type
 *   - client UI in 36-03 reads rubricScore JSONB from deliverable_versions and
 *     does NOT import from this file (anchor strings must not reach the bundle)
 */

import { z } from 'zod';

// -----------------------------------------------------------------------------
// Zod schemas
// -----------------------------------------------------------------------------

export const rubricCriterionSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string().min(1).max(60),
    weight: z.number().min(0).max(1),
    anchorAt10: z.string().min(1).max(280),
    anchorAt0: z.string().min(1).max(280),
  })
  .strict();

export const rubricSchema = z
  .object({
    rubricVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    type: z.enum([
      'prd',
      'tech-spec',
      'design-brief',
      'gtm-plan',
      'user-stories',
      'blog-post',
      'landing-copy',
      'content-calendar',
      'email-sequence',
      'seo-brief',
      'project-plan',
      'competitive-analysis',
      'market-research',
      'process-doc',
      'data-report',
    ]),
    criteria: z.array(rubricCriterionSchema).min(4).max(6),
  })
  .strict()
  .refine(
    (r) => Math.abs(r.criteria.reduce((s, c) => s + c.weight, 0) - 1.0) < 1e-6,
    { message: 'weights must sum to 1.0 (within 1e-6 tolerance)' },
  );

export type Rubric = z.infer<typeof rubricSchema>;

// -----------------------------------------------------------------------------
// 15 rubrics — one per deliverable type. All rubricVersion '1.0.0' (initial release).
// -----------------------------------------------------------------------------

const PRD_RUBRIC: Rubric = rubricSchema.parse({
  rubricVersion: '1.0.0',
  type: 'prd',
  criteria: [
    {
      key: 'problem_clarity',
      label: 'Problem Clarity',
      weight: 0.25,
      anchorAt10: 'Problem is stated with a specific user, situation, and pain — concrete enough that a stranger could spot the same problem in the wild.',
      anchorAt0: 'Problem is a generic aspiration like "users want a better experience" — no user named, no situation grounded.',
    },
    {
      key: 'solution_specificity',
      label: 'Solution Specificity',
      weight: 0.20,
      anchorAt10: 'Solution describes named features, behaviors, and constraints — a developer could start implementation without follow-up questions.',
      anchorAt0: 'Solution waves at "build a feature for X" without describing what it does, how it behaves, or what success looks like.',
    },
    {
      key: 'success_metrics',
      label: 'Success Metrics',
      weight: 0.20,
      anchorAt10: 'Each goal has a measurable metric, a baseline (or "TBD-baseline"), and a target — quantitative or behaviorally observable.',
      anchorAt0: 'Goals are listed as "improve engagement" or "delight users" with no numbers, baselines, or observable signals.',
    },
    {
      key: 'risk_coverage',
      label: 'Risk Coverage',
      weight: 0.15,
      anchorAt10: 'Risks identify specific failure modes (technical, market, user, or operational) and each carries a mitigation tied to a real action.',
      anchorAt0: 'Risks section is empty, generic ("scope creep"), or names risks with no mitigation plan attached.',
    },
    {
      key: 'user_story_quality',
      label: 'User Story Quality',
      weight: 0.20,
      anchorAt10: 'Stories follow As-a/I-want/So-that format, each with concrete acceptance criteria that a tester could check pass/fail.',
      anchorAt0: 'Stories are bullet points of features ("login", "dashboard") with no actor, motivation, or testable acceptance criteria.',
    },
  ],
});

const TECH_SPEC_RUBRIC: Rubric = rubricSchema.parse({
  rubricVersion: '1.0.0',
  type: 'tech-spec',
  criteria: [
    {
      key: 'architecture_clarity',
      label: 'Architecture Clarity',
      weight: 0.20,
      anchorAt10: 'Architecture names every component, its responsibility, and how data flows between them — a new engineer could draw the diagram from the text alone.',
      anchorAt0: 'Architecture is hand-wavy ("microservices talk to a database") with no named components, boundaries, or data-flow direction.',
    },
    {
      key: 'api_contract_specificity',
      label: 'API Contract Specificity',
      weight: 0.20,
      anchorAt10: 'Each endpoint has method, path, request schema, response schema, status codes, and at least one example payload — testable from the spec alone.',
      anchorAt0: 'APIs are described as "the user endpoint returns user data" with no method, no schema, no error contract.',
    },
    {
      key: 'data_model_completeness',
      label: 'Data Model Completeness',
      weight: 0.20,
      anchorAt10: 'Every table/entity lists fields with types, nullability, defaults, and key relationships; indexes called out where queries demand them.',
      anchorAt0: 'Data model is a paragraph mentioning "users" and "posts" with no field types, no relationships, no constraints.',
    },
    {
      key: 'failure_mode_coverage',
      label: 'Failure Mode Coverage',
      weight: 0.20,
      anchorAt10: 'Each subsystem names how it can fail (timeout, race, partial write, etc.) and what the recovery or degraded behavior is.',
      anchorAt0: 'No failure modes documented — assumes happy path, no mention of retries, idempotency, or partial-failure recovery.',
    },
    {
      key: 'testability',
      label: 'Testability',
      weight: 0.20,
      anchorAt10: 'Spec calls out unit/integration/e2e test boundaries with named seams and at least one critical test case per subsystem.',
      anchorAt0: 'Testing section says "we will write tests" with no test strategy, no seams, no critical scenarios named.',
    },
  ],
});

const DESIGN_BRIEF_RUBRIC: Rubric = rubricSchema.parse({
  rubricVersion: '1.0.0',
  type: 'design-brief',
  criteria: [
    {
      key: 'problem_framing',
      label: 'Problem Framing',
      weight: 0.20,
      anchorAt10: 'Frames the user problem with situation, friction, and the desired outcome — design constraints follow directly from the framing.',
      anchorAt0: 'Problem is "make the UI better" with no user, no friction, no outcome — design has nothing to anchor against.',
    },
    {
      key: 'user_persona_specificity',
      label: 'User Persona Specificity',
      weight: 0.20,
      anchorAt10: 'Personas have goals, context-of-use, blocking constraints, and a quote that captures their tension — recognizably human, not demographic-bucket cardboard.',
      anchorAt0: 'Personas are "tech-savvy millennial" stereotypes with no goals, no context, no quotes — interchangeable across products.',
    },
    {
      key: 'visual_direction_clarity',
      label: 'Visual Direction Clarity',
      weight: 0.20,
      anchorAt10: 'Visual direction names principles, mood, references (or anti-references), and the emotional response it should evoke — picks a side.',
      anchorAt0: 'Visual direction says "clean and modern" — every product says this; designer has no real direction.',
    },
    {
      key: 'success_signals',
      label: 'Success Signals',
      weight: 0.20,
      anchorAt10: 'Success signals are behaviorally observable: task completion, error rate, time-to-first-action, qualitative reactions — design can be A/B-evaluated.',
      anchorAt0: 'Success is "users love it" or "looks beautiful" — no observable signal, no falsifiable outcome.',
    },
    {
      key: 'constraints_named',
      label: 'Constraints Named',
      weight: 0.20,
      anchorAt10: 'Constraints (brand, accessibility, technical, budget, timeline) are named with specifics — designer knows where the walls are.',
      anchorAt0: 'No constraints listed — designer will invent something only to discover blocking constraints mid-flight.',
    },
  ],
});

const GTM_PLAN_RUBRIC: Rubric = rubricSchema.parse({
  rubricVersion: '1.0.0',
  type: 'gtm-plan',
  criteria: [
    {
      key: 'target_segment_specificity',
      label: 'Target Segment Specificity',
      weight: 0.20,
      anchorAt10: 'Target segment is named with firmographics, behaviors, and buying triggers — a sales rep could write a prospecting filter from this.',
      anchorAt0: 'Target is "SMBs" or "developers" with no size, no industry, no buying trigger — fits a million companies.',
    },
    {
      key: 'positioning_clarity',
      label: 'Positioning Clarity',
      weight: 0.20,
      anchorAt10: 'Positioning states for-whom, against-what-alternative, the unique value, and the proof — passes the "fill-in-the-blanks" positioning test.',
      anchorAt0: 'Positioning is a tagline ("the best X for Y") with no comparison, no proof, no audience-specific value.',
    },
    {
      key: 'channel_strategy',
      label: 'Channel Strategy',
      weight: 0.20,
      anchorAt10: 'Channels are named with rationale, expected CAC range, and the leading indicator for "this channel is working" — at least one primary, one experimental.',
      anchorAt0: 'Channels list "social media, content, email" with no rationale, no CAC, no measurement plan.',
    },
    {
      key: 'launch_milestones',
      label: 'Launch Milestones',
      weight: 0.20,
      anchorAt10: 'Launch has dated phases (pre-launch, launch week, 30-day, 90-day) with named owners and clear go/no-go criteria.',
      anchorAt0: 'Launch is "we launch on date X" with no phasing, no owners, no decision criteria for go-live.',
    },
    {
      key: 'success_metrics',
      label: 'Success Metrics',
      weight: 0.20,
      anchorAt10: 'Metrics cover acquisition, activation, retention, and revenue with baselines and 30/90-day targets — observable and time-bound.',
      anchorAt0: 'Metrics are "grow users" or "get traction" with no baseline, no target, no timeframe.',
    },
  ],
});

const USER_STORIES_RUBRIC: Rubric = rubricSchema.parse({
  rubricVersion: '1.0.0',
  type: 'user-stories',
  criteria: [
    {
      key: 'actor_action_outcome_format',
      label: 'Actor / Action / Outcome Format',
      weight: 0.25,
      anchorAt10: 'Every story follows As-a/I-want/So-that with a specific actor, a specific action, and a specific outcome — no generic "user" placeholders.',
      anchorAt0: 'Stories are feature bullets ("login flow", "search bar") with no actor, no motivation, no outcome.',
    },
    {
      key: 'acceptance_criteria_testability',
      label: 'Acceptance Criteria Testability',
      weight: 0.25,
      anchorAt10: 'Each story has Given/When/Then or checklist-style acceptance criteria that a tester could verify pass/fail without re-asking the author.',
      anchorAt0: 'Acceptance criteria are missing or vague ("works correctly") — no way to determine done.',
    },
    {
      key: 'edge_case_coverage',
      label: 'Edge Case Coverage',
      weight: 0.25,
      anchorAt10: 'Stories include edge cases (empty state, error state, max-input, unauthorized) and explicitly call out what should happen in each.',
      anchorAt0: 'Only happy path covered — no empty/error/edge scenarios named.',
    },
    {
      key: 'dependency_clarity',
      label: 'Dependency Clarity',
      weight: 0.25,
      anchorAt10: 'Cross-story dependencies are explicit (story A blocks B), letting a planner sequence work without guessing.',
      anchorAt0: 'No dependencies noted; stories appear independent but secretly require each other.',
    },
  ],
});

const BLOG_POST_RUBRIC: Rubric = rubricSchema.parse({
  rubricVersion: '1.0.0',
  type: 'blog-post',
  criteria: [
    {
      key: 'hook_strength',
      label: 'Hook Strength',
      weight: 0.20,
      anchorAt10: 'Opening creates immediate tension, curiosity, or surprise — a reader scrolling past cannot help but stop and read on.',
      anchorAt0: 'Opening is generic ("In today\'s fast-paced world...") — reader bounces before paragraph two.',
    },
    {
      key: 'thesis_clarity',
      label: 'Thesis Clarity',
      weight: 0.20,
      anchorAt10: 'Within the first 200 words, the reader knows exactly what argument the post is making and why it matters to them.',
      anchorAt0: 'Thesis is absent or buried — post meanders, reader cannot articulate the takeaway.',
    },
    {
      key: 'evidence_specificity',
      label: 'Evidence Specificity',
      weight: 0.20,
      anchorAt10: 'Claims are backed by named data, concrete examples, or first-hand specifics — not "studies show" or "experts agree".',
      anchorAt0: 'Claims float without evidence — vague appeals to authority, no numbers, no examples.',
    },
    {
      key: 'narrative_flow',
      label: 'Narrative Flow',
      weight: 0.20,
      anchorAt10: 'Sections build on each other; each paragraph earns its place; transitions feel inevitable rather than mechanical.',
      anchorAt0: 'Reads like a list of bullet points expanded into paragraphs — order could be shuffled without losing meaning.',
    },
    {
      key: 'cta_quality',
      label: 'CTA Quality',
      weight: 0.20,
      anchorAt10: 'CTA matches the reader\'s emotional state at end-of-post and names a single, low-friction next step.',
      anchorAt0: 'CTA is "subscribe / share / comment" pasted on — no fit with the post, no clear next action.',
    },
  ],
});

const LANDING_COPY_RUBRIC: Rubric = rubricSchema.parse({
  rubricVersion: '1.0.0',
  type: 'landing-copy',
  criteria: [
    {
      key: 'headline_hook',
      label: 'Headline Hook',
      weight: 0.25,
      anchorAt10: 'Headline names the outcome the user wants in their own words — they recognize themselves in the first 3 seconds.',
      anchorAt0: 'Headline is product-centric ("Introducing X") or generic ("Welcome to X") — user feels nothing.',
    },
    {
      key: 'value_proposition_clarity',
      label: 'Value Proposition Clarity',
      weight: 0.20,
      anchorAt10: 'Subhead and hero copy explain what it does, who it is for, and why it is better than the alternative — all above the fold.',
      anchorAt0: 'Value is buried in jargon or feature lists — user does not understand what they get or why they would care.',
    },
    {
      key: 'social_proof_specificity',
      label: 'Social Proof Specificity',
      weight: 0.20,
      anchorAt10: 'Testimonials name real people with roles and specific outcomes; metrics are concrete ("47% lift in week one").',
      anchorAt0: 'Social proof is logo soup or "5-star reviews" with no quote, no outcome, no named user.',
    },
    {
      key: 'cta_actionability',
      label: 'CTA Actionability',
      weight: 0.15,
      anchorAt10: 'CTA verb names what the user gets ("Get my report", "Start free trial") — friction and commitment are visible.',
      anchorAt0: 'CTA is "Submit" or "Click here" — user has no idea what happens next.',
    },
    {
      key: 'objection_handling',
      label: 'Objection Handling',
      weight: 0.20,
      anchorAt10: 'Top objections (price, switching cost, trust, fit) are surfaced and answered before the form — FAQ earns its place.',
      anchorAt0: 'Objections ignored — user lands, hits a doubt, leaves without converting.',
    },
  ],
});

const CONTENT_CALENDAR_RUBRIC: Rubric = rubricSchema.parse({
  rubricVersion: '1.0.0',
  type: 'content-calendar',
  criteria: [
    {
      key: 'cadence_realism',
      label: 'Cadence Realism',
      weight: 0.20,
      anchorAt10: 'Cadence matches the team\'s actual capacity (3 posts/week, not 12) with buffer for sick days and brand-moment improvisation.',
      anchorAt0: 'Cadence is aspirational ("daily across all channels") with no capacity check — calendar dies in week two.',
    },
    {
      key: 'topic_diversity',
      label: 'Topic Diversity',
      weight: 0.20,
      anchorAt10: 'Calendar mixes pillars (education, social proof, brand, promotion) in a ratio that avoids audience fatigue and over-promotion.',
      anchorAt0: 'Every post promotes the product — feed reads as advertising; followers tune out.',
    },
    {
      key: 'channel_alignment',
      label: 'Channel Alignment',
      weight: 0.20,
      anchorAt10: 'Each post is matched to a channel where the format and tone fit native conventions — LinkedIn ≠ TikTok ≠ Twitter.',
      anchorAt0: 'Same post copied across all channels — feels off everywhere, performs nowhere.',
    },
    {
      key: 'ownership_assignment',
      label: 'Ownership Assignment',
      weight: 0.20,
      anchorAt10: 'Every slot has a named owner for creation, review, and posting — clear handoffs, no orphans.',
      anchorAt0: 'No owners listed — calendar exists on paper, nobody ships.',
    },
    {
      key: 'success_measurement',
      label: 'Success Measurement',
      weight: 0.20,
      anchorAt10: 'Each pillar has a north-star metric and a weekly review cadence — calendar evolves on data.',
      anchorAt0: 'No metrics, no review cadence — calendar runs blind and never improves.',
    },
  ],
});

const EMAIL_SEQUENCE_RUBRIC: Rubric = rubricSchema.parse({
  rubricVersion: '1.0.0',
  type: 'email-sequence',
  criteria: [
    {
      key: 'subject_line_hook',
      label: 'Subject Line Hook',
      weight: 0.20,
      anchorAt10: 'Each subject creates curiosity or names a specific benefit — feels personal, not promotional; would survive a crowded inbox.',
      anchorAt0: 'Subjects are "Newsletter #4" or "Quick update" — reader deletes without opening.',
    },
    {
      key: 'opening_personalization',
      label: 'Opening Personalization',
      weight: 0.20,
      anchorAt10: 'First line references the reader\'s context (action, segment, last touchpoint) — feels written to them, not blasted at them.',
      anchorAt0: 'Opens with "Hi {first_name}, hope you\'re doing well" — generic, interchangeable, signals mass blast.',
    },
    {
      key: 'value_per_email',
      label: 'Value Per Email',
      weight: 0.25,
      anchorAt10: 'Each email delivers a standalone insight, tip, or proof — reader who only opens one still gets value.',
      anchorAt0: 'Each email is filler with the CTA at the end — reader feels manipulated, unsubscribes.',
    },
    {
      key: 'cta_progression',
      label: 'CTA Progression',
      weight: 0.20,
      anchorAt10: 'CTAs escalate commitment thoughtfully (read → reply → trial → buy) — each step earns the next.',
      anchorAt0: 'Every email asks for the sale on email one — pushy, premature, kills the relationship.',
    },
    {
      key: 'send_cadence',
      label: 'Send Cadence',
      weight: 0.15,
      anchorAt10: 'Cadence respects the reader\'s mental space (e.g., day 1, 3, 7, 14) and adapts on engagement signals.',
      anchorAt0: 'Daily blast for 30 days — high unsubscribe, low engagement, brand damage.',
    },
  ],
});

const SEO_BRIEF_RUBRIC: Rubric = rubricSchema.parse({
  rubricVersion: '1.0.0',
  type: 'seo-brief',
  criteria: [
    {
      key: 'target_query_specificity',
      label: 'Target Query Specificity',
      weight: 0.20,
      anchorAt10: 'Target query and supporting queries are named with search volume, difficulty, and clear user intent — not "rank for our product".',
      anchorAt0: 'Target is a broad head-term ("project management") with no volume, no difficulty, no intent — unwinnable, unfocused.',
    },
    {
      key: 'search_intent_alignment',
      label: 'Search Intent Alignment',
      weight: 0.20,
      anchorAt10: 'Brief names the intent (informational, commercial, transactional, navigational) and matches the content shape to it.',
      anchorAt0: 'No intent analysis — brief assumes a single content shape regardless of what searchers actually want.',
    },
    {
      key: 'content_outline_completeness',
      label: 'Content Outline Completeness',
      weight: 0.25,
      anchorAt10: 'Outline names H2/H3 sections, target depth per section, must-include subtopics, and proof types — writer has a contract, not a vibe.',
      anchorAt0: 'Outline is a few bullet topics — writer reinvents structure, gaps emerge against ranking competitors.',
    },
    {
      key: 'internal_link_strategy',
      label: 'Internal Link Strategy',
      weight: 0.15,
      anchorAt10: 'Brief names target internal links (from this page out, and inbound to this page) with anchor-text guidance.',
      anchorAt0: 'No internal linking plan — page lives alone, no authority flow, no topic-cluster context.',
    },
    {
      key: 'success_metrics',
      label: 'Success Metrics',
      weight: 0.20,
      anchorAt10: 'Brief names target rank window, traffic estimate, and conversion expectation with a review checkpoint at 90 days.',
      anchorAt0: 'Success is "rank on page one" — no traffic estimate, no conversion goal, no review cadence.',
    },
  ],
});

const PROJECT_PLAN_RUBRIC: Rubric = rubricSchema.parse({
  rubricVersion: '1.0.0',
  type: 'project-plan',
  criteria: [
    {
      key: 'scope_clarity',
      label: 'Scope Clarity',
      weight: 0.20,
      anchorAt10: 'Scope names what is in, what is out, and the cost of moving the line — surprises minimized.',
      anchorAt0: 'Scope is a wish-list with no in/out distinction — every conversation reopens what is being built.',
    },
    {
      key: 'milestone_specificity',
      label: 'Milestone Specificity',
      weight: 0.20,
      anchorAt10: 'Milestones are dated, owned, and tied to verifiable artifacts (demo, code merge, customer signoff) — done is observable.',
      anchorAt0: 'Milestones are "Phase 1: Discovery" with no date, no owner, no done-criterion.',
    },
    {
      key: 'dependency_mapping',
      label: 'Dependency Mapping',
      weight: 0.20,
      anchorAt10: 'Dependencies (technical, team, vendor, decision) are mapped with lead times — critical path is visible.',
      anchorAt0: 'Dependencies are missing — plan looks parallel, executes serial, slips by weeks.',
    },
    {
      key: 'risk_register',
      label: 'Risk Register',
      weight: 0.20,
      anchorAt10: 'Risks have likelihood × impact, an owner, and a mitigation or contingency — register is alive, not decorative.',
      anchorAt0: 'Risk section is "things could go wrong" — generic, no owners, no plan.',
    },
    {
      key: 'resource_allocation',
      label: 'Resource Allocation',
      weight: 0.20,
      anchorAt10: 'Resources (people, budget, vendors) are mapped to phases with realistic load — no implicit 150% utilization.',
      anchorAt0: 'No resource plan — team finds out mid-sprint they are overcommitted.',
    },
  ],
});

const COMPETITIVE_ANALYSIS_RUBRIC: Rubric = rubricSchema.parse({
  rubricVersion: '1.0.0',
  type: 'competitive-analysis',
  criteria: [
    {
      key: 'competitor_selection_rationale',
      label: 'Competitor Selection Rationale',
      weight: 0.20,
      anchorAt10: 'Competitors are chosen with explicit rationale (direct, indirect, aspirational, substitute) — set is defensible, not arbitrary.',
      anchorAt0: 'Competitors are the obvious 3 names — no rationale for inclusion or exclusion, missing real threats.',
    },
    {
      key: 'dimension_coverage',
      label: 'Dimension Coverage',
      weight: 0.20,
      anchorAt10: 'Comparison dimensions cover product, pricing, positioning, distribution, and brand — multi-axis, not just feature checklists.',
      anchorAt0: 'Comparison is a feature matrix only — misses pricing strategy, distribution, and brand moat differences.',
    },
    {
      key: 'evidence_specificity',
      label: 'Evidence Specificity',
      weight: 0.20,
      anchorAt10: 'Each claim cites a source (pricing page, review site, public filings) with a date — analysis is auditable.',
      anchorAt0: 'Claims are unsourced impressions ("they seem to focus on enterprise") — no audit trail, half stale.',
    },
    {
      key: 'differentiation_insight',
      label: 'Differentiation Insight',
      weight: 0.20,
      anchorAt10: 'Analysis names a defensible wedge (audience, distribution, mechanism, brand) the team can credibly own.',
      anchorAt0: 'Differentiation is "better UX" or "more affordable" — copyable, not defensible.',
    },
    {
      key: 'strategic_implication',
      label: 'Strategic Implication',
      weight: 0.20,
      anchorAt10: 'Closes with explicit recommendations on positioning, roadmap, or go-to-market — reader knows what to do differently on Monday.',
      anchorAt0: 'Ends with "they are doing X, we should consider Y" — no concrete recommendation, no action.',
    },
  ],
});

const MARKET_RESEARCH_RUBRIC: Rubric = rubricSchema.parse({
  rubricVersion: '1.0.0',
  type: 'market-research',
  criteria: [
    {
      key: 'problem_validation_evidence',
      label: 'Problem Validation Evidence',
      weight: 0.20,
      anchorAt10: 'Problem is validated with primary research (interviews, surveys) and secondary data — sample sizes, methodology, confidence are clear.',
      anchorAt0: 'Problem is asserted from one founder anecdote — no interviews, no data, no validation.',
    },
    {
      key: 'market_sizing_method',
      label: 'Market Sizing Method',
      weight: 0.20,
      anchorAt10: 'Sizing shows TAM/SAM/SOM with both top-down and bottom-up estimates and named assumptions — numbers are defensible.',
      anchorAt0: 'Market is "a $100B opportunity" — single number, no method, no assumptions, no breakdown.',
    },
    {
      key: 'segment_specificity',
      label: 'Segment Specificity',
      weight: 0.20,
      anchorAt10: 'Segments are defined by buying behavior and pain intensity, not just demographics — reveals which segment to attack first.',
      anchorAt0: 'Segments are age/income/region — descriptive but not actionable for go-to-market.',
    },
    {
      key: 'competitive_context',
      label: 'Competitive Context',
      weight: 0.20,
      anchorAt10: 'Names incumbents, substitutes, and adjacent threats — explains why this market has room for a new entrant.',
      anchorAt0: 'Competitive section is a logo grid with no analysis of moat, share, or whitespace.',
    },
    {
      key: 'decision_recommendation',
      label: 'Decision Recommendation',
      weight: 0.20,
      anchorAt10: 'Closes with a clear go / pivot / no-go recommendation tied to the evidence — reader can act on the report.',
      anchorAt0: 'Ends with "more research needed" or a neutral summary — no recommendation, no decision support.',
    },
  ],
});

const PROCESS_DOC_RUBRIC: Rubric = rubricSchema.parse({
  rubricVersion: '1.0.0',
  type: 'process-doc',
  criteria: [
    {
      key: 'trigger_clarity',
      label: 'Trigger Clarity',
      weight: 0.20,
      anchorAt10: 'Doc names the trigger that starts the process — event, request, signal, threshold — unambiguous from the first paragraph.',
      anchorAt0: 'No clear trigger — reader cannot tell when this process applies versus another.',
    },
    {
      key: 'step_atomicity',
      label: 'Step Atomicity',
      weight: 0.25,
      anchorAt10: 'Each step is one observable action with a clear input, output, and "done" state — no compound steps, no implicit substeps.',
      anchorAt0: 'Steps bundle multiple actions ("set up everything and configure access") — new operator gets stuck mid-step.',
    },
    {
      key: 'role_responsibility',
      label: 'Role Responsibility',
      weight: 0.20,
      anchorAt10: 'Each step has a named role responsible — RACI or single-owner — handoffs are explicit.',
      anchorAt0: 'No roles assigned — reader cannot tell who does what; work falls through the cracks.',
    },
    {
      key: 'failure_recovery',
      label: 'Failure Recovery',
      weight: 0.20,
      anchorAt10: 'Doc names the common failure modes and the recovery action for each — escalation path is clear.',
      anchorAt0: 'Only happy path documented — when something breaks, operator has no playbook.',
    },
    {
      key: 'success_signals',
      label: 'Success Signals',
      weight: 0.15,
      anchorAt10: 'Process names what "done correctly" looks like — observable outputs, quality checks, completion signal.',
      anchorAt0: 'No definition of done — operator finishes and asks "did that work?".',
    },
  ],
});

const DATA_REPORT_RUBRIC: Rubric = rubricSchema.parse({
  rubricVersion: '1.0.0',
  type: 'data-report',
  criteria: [
    {
      key: 'question_specificity',
      label: 'Question Specificity',
      weight: 0.20,
      anchorAt10: 'Report opens with the specific question the analysis answers — narrow enough that the methodology fits naturally.',
      anchorAt0: 'Report has no stated question — feels like a data dump in search of a meaning.',
    },
    {
      key: 'methodology_transparency',
      label: 'Methodology Transparency',
      weight: 0.20,
      anchorAt10: 'Methodology names data sources, time range, filters, exclusions, and analytical method — reproducible by a peer.',
      anchorAt0: 'Methodology is "we analyzed the data" — no sources, no filters, no reproducibility.',
    },
    {
      key: 'finding_specificity',
      label: 'Finding Specificity',
      weight: 0.20,
      anchorAt10: 'Findings are stated with magnitude, direction, and context ("conversion dropped 12% week-over-week in the EU region").',
      anchorAt0: 'Findings are directional ("conversion changed") with no number, no scope, no comparison.',
    },
    {
      key: 'confidence_calibration',
      label: 'Confidence Calibration',
      weight: 0.20,
      anchorAt10: 'Each finding is annotated with confidence (high/medium/low), caveats, and known limitations — reader knows what to trust.',
      anchorAt0: 'Findings are stated as absolute truths — caveats, sample-size issues, and confounders are hidden.',
    },
    {
      key: 'recommendation_actionability',
      label: 'Recommendation Actionability',
      weight: 0.20,
      anchorAt10: 'Recommendations name specific actions, owners, and expected outcomes — leadership can act in the next sprint.',
      anchorAt0: 'Recommendations are "consider improving X" — no owner, no action, no expected outcome.',
    },
  ],
});

// -----------------------------------------------------------------------------
// Registry — explicit pairs, order matches the type union in shared/schema.ts:310-315
// -----------------------------------------------------------------------------

const _REGISTRY = new Map<string, Rubric>([
  ['prd', PRD_RUBRIC],
  ['tech-spec', TECH_SPEC_RUBRIC],
  ['design-brief', DESIGN_BRIEF_RUBRIC],
  ['gtm-plan', GTM_PLAN_RUBRIC],
  ['user-stories', USER_STORIES_RUBRIC],
  ['blog-post', BLOG_POST_RUBRIC],
  ['landing-copy', LANDING_COPY_RUBRIC],
  ['content-calendar', CONTENT_CALENDAR_RUBRIC],
  ['email-sequence', EMAIL_SEQUENCE_RUBRIC],
  ['seo-brief', SEO_BRIEF_RUBRIC],
  ['project-plan', PROJECT_PLAN_RUBRIC],
  ['competitive-analysis', COMPETITIVE_ANALYSIS_RUBRIC],
  ['market-research', MARKET_RESEARCH_RUBRIC],
  ['process-doc', PROCESS_DOC_RUBRIC],
  ['data-report', DATA_REPORT_RUBRIC],
]);

// Runtime immutability invariant — see T-36-01 in 36-01-PLAN.md threat model.
for (const r of _REGISTRY.values()) {
  Object.freeze(r);
  Object.freeze(r.criteria);
  for (const c of r.criteria) Object.freeze(c);
}
Object.freeze(_REGISTRY);

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export const DELIVERABLE_RUBRIC_REGISTRY: ReadonlyMap<string, Rubric> = _REGISTRY;

export function getRubricForType(type: string): Rubric | null {
  return _REGISTRY.get(type) ?? null;
}

export function listRubricTypes(): readonly string[] {
  return Object.freeze([..._REGISTRY.keys()]);
}
