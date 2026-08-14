/**
 * Deliverable Type Registry — maps agent roles to the deliverable types they can produce.
 * Each type has a canonical section schema for structured output.
 */

export interface DeliverableTypeSpec {
  type: string;
  label: string;
  description: string;
  sections: string[];
  estimatedMinutes: number;
}

export interface RoleDeliverableMap {
  role: string;
  types: DeliverableTypeSpec[];
}

export const DELIVERABLE_TYPE_REGISTRY: RoleDeliverableMap[] = [
  {
    role: 'Product Manager',
    types: [
      {
        type: 'prd',
        label: 'Product Requirements Document',
        description: 'Comprehensive product spec with goals, features, and success metrics',
        sections: ['Overview', 'Problem Statement', 'Goals & Success Metrics', 'User Stories', 'Feature Requirements', 'Non-Functional Requirements', 'Timeline & Milestones', 'Risks & Mitigations'],
        estimatedMinutes: 3,
      },
      {
        type: 'user-stories',
        label: 'User Stories',
        description: 'Prioritized user stories with acceptance criteria',
        sections: ['Epic Overview', 'User Stories', 'Acceptance Criteria', 'Priority Matrix'],
        estimatedMinutes: 2,
      },
      {
        type: 'project-plan',
        label: 'Project Plan',
        description: 'Sprint breakdown with timeline and dependencies',
        sections: ['Project Overview', 'Scope', 'Sprint Breakdown', 'Dependencies', 'Resource Allocation', 'Risk Register'],
        estimatedMinutes: 3,
      },
    ],
  },
  {
    role: 'Backend Developer',
    types: [
      {
        type: 'tech-spec',
        label: 'Technical Specification',
        description: 'Architecture doc with system design, data models, and API contracts',
        sections: ['Overview', 'Architecture', 'Data Model', 'API Contracts', 'Error Handling', 'Security Considerations', 'Performance Requirements', 'Testing Strategy'],
        estimatedMinutes: 4,
      },
    ],
  },
  {
    role: 'Software Engineer',
    types: [
      {
        type: 'tech-spec',
        label: 'Technical Specification',
        description: 'Architecture doc with system design and implementation plan',
        sections: ['Overview', 'Architecture', 'Data Model', 'API Contracts', 'Implementation Plan', 'Testing Strategy'],
        estimatedMinutes: 4,
      },
    ],
  },
  {
    role: 'Product Designer',
    types: [
      {
        type: 'design-brief',
        label: 'Design Brief',
        description: 'UX requirements, user flows, and design principles',
        sections: ['Design Goals', 'User Personas', 'User Flows', 'Wireframe Descriptions', 'Design Principles', 'Accessibility Requirements', 'Visual Direction'],
        estimatedMinutes: 3,
      },
    ],
  },
  {
    role: 'UX Designer',
    types: [
      {
        type: 'design-brief',
        label: 'UX Design Brief',
        description: 'User research-driven design requirements',
        sections: ['Research Summary', 'Personas', 'Journey Maps', 'Information Architecture', 'Interaction Patterns', 'Usability Requirements'],
        estimatedMinutes: 3,
      },
    ],
  },
  {
    role: 'Growth Marketer',
    types: [
      {
        type: 'gtm-plan',
        label: 'Go-to-Market Plan',
        description: 'Launch strategy with channels, messaging, and metrics',
        sections: ['Market Overview', 'Target Audience', 'Positioning & Messaging', 'Channel Strategy', 'Launch Timeline', 'Budget', 'KPIs & Success Metrics'],
        estimatedMinutes: 3,
      },
    ],
  },
  {
    role: 'Marketing Specialist',
    types: [
      {
        type: 'gtm-plan',
        label: 'Marketing Plan',
        description: 'Comprehensive marketing strategy',
        sections: ['Situation Analysis', 'Target Market', 'Marketing Mix', 'Campaign Calendar', 'Budget Allocation', 'Measurement Framework'],
        estimatedMinutes: 3,
      },
    ],
  },
  {
    role: 'Content Writer',
    types: [
      {
        type: 'blog-post',
        label: 'Blog Post',
        description: 'SEO-optimized long-form content',
        sections: ['Hook', 'Introduction', 'Body Sections', 'Conclusion', 'Call to Action', 'SEO Meta'],
        estimatedMinutes: 2,
      },
    ],
  },
  {
    role: 'Copywriter',
    types: [
      {
        type: 'landing-copy',
        label: 'Landing Page Copy',
        description: 'Conversion-focused landing page content',
        sections: ['Headline', 'Subheadline', 'Hero Section', 'Benefits', 'Social Proof', 'Features', 'FAQ', 'CTA'],
        estimatedMinutes: 2,
      },
    ],
  },
  {
    role: 'Social Media Manager',
    types: [
      {
        type: 'content-calendar',
        label: 'Content Calendar',
        description: 'Social media content plan with posts and scheduling',
        sections: ['Content Pillars', 'Weekly Schedule', 'Post Templates', 'Hashtag Strategy', 'Engagement Plan'],
        estimatedMinutes: 2,
      },
    ],
  },
  {
    role: 'Email Specialist',
    types: [
      {
        type: 'email-sequence',
        label: 'Email Sequence',
        description: 'Automated email drip campaign',
        sections: ['Sequence Overview', 'Email 1: Welcome', 'Email 2: Value', 'Email 3: Social Proof', 'Email 4: Offer', 'Email 5: Follow-up', 'Subject Line Variants'],
        estimatedMinutes: 3,
      },
    ],
  },
  {
    role: 'SEO Specialist',
    types: [
      {
        type: 'seo-brief',
        label: 'SEO Strategy Brief',
        description: 'Keyword strategy and optimization plan',
        sections: ['Keyword Research', 'Content Gaps', 'On-Page Optimization', 'Technical SEO', 'Link Building Strategy', 'Measurement Plan'],
        estimatedMinutes: 2,
      },
    ],
  },
  {
    role: 'Business Analyst',
    types: [
      {
        type: 'competitive-analysis',
        label: 'Competitive Analysis',
        description: 'Market landscape and competitor comparison',
        sections: ['Market Overview', 'Competitor Profiles', 'Feature Comparison', 'SWOT Analysis', 'Positioning Map', 'Recommendations'],
        estimatedMinutes: 3,
      },
      {
        type: 'market-research',
        label: 'Market Research Report',
        description: 'Data-driven market insights',
        sections: ['Executive Summary', 'Market Size & Growth', 'Customer Segments', 'Trends', 'Opportunities', 'Risks'],
        estimatedMinutes: 3,
      },
    ],
  },
  {
    role: 'Operations Manager',
    types: [
      {
        type: 'process-doc',
        label: 'Process Documentation',
        description: 'Standard operating procedures',
        sections: ['Process Overview', 'Scope', 'Roles & Responsibilities', 'Step-by-Step Procedure', 'Quality Checks', 'Exception Handling'],
        estimatedMinutes: 2,
      },
      {
        // Business-in-a-Box (DOC-02) — SOP as a distinct staged document type.
        type: 'sop',
        label: 'Standard Operating Procedure',
        description: 'A repeatable, step-by-step procedure anyone on the team can follow',
        sections: ['Purpose & Scope', 'Roles & Responsibilities', 'Step-by-Step Procedure', 'Tools & Inputs', 'Quality Checks', 'Exceptions & Escalation', 'Revision History'],
        estimatedMinutes: 2,
      },
    ],
  },
  {
    role: 'Data Analyst',
    types: [
      {
        type: 'data-report',
        label: 'Data Analysis Report',
        description: 'Insights from data with visualizations',
        sections: ['Executive Summary', 'Methodology', 'Key Findings', 'Data Visualizations', 'Recommendations', 'Appendix'],
        estimatedMinutes: 3,
      },
    ],
  },
  // Business-in-a-Box (DOC-02) — new pre-scaffolded document types packs seed. Keyed under the role
  // that owns each one so getDeliverableTypesForRole resolves real types (not the custom fallback),
  // and getSectionsForType/getTypeLabel find the section schema + label.
  {
    role: 'Business Strategist',
    types: [
      {
        type: 'business-plan',
        label: 'Business Plan',
        description: 'The founding document: what you are building, for whom, how it makes money, and the path to get there',
        sections: ['Executive Summary', 'Problem & Opportunity', 'Solution & Product', 'Market & Customers', 'Business Model & Pricing', 'Go-to-Market', 'Competition', 'Team', 'Financial Summary', 'Milestones & Risks'],
        estimatedMinutes: 4,
      },
    ],
  },
  {
    role: 'Finance Analyst',
    types: [
      {
        type: 'financial-model',
        label: 'Financial Model',
        description: 'The numbers behind the plan: revenue, costs, unit economics, and how long the money lasts',
        sections: ['Assumptions', 'Revenue Model', 'Unit Economics', 'Cost Structure', 'Cash Flow & Runway', 'Break-Even Analysis', 'Scenarios (Base / Best / Worst)'],
        estimatedMinutes: 3,
      },
    ],
  },
  {
    role: 'Legal Counsel',
    types: [
      {
        type: 'legal-checklist',
        label: 'Legal & Compliance Checklist',
        description: 'The typical legal, tax, and compliance steps for this business (verify locally, consult a professional — not legal advice)',
        sections: ['Entity & Registration', 'Contracts & Terms', 'Intellectual Property', 'Licenses & Permits', 'Data & Privacy', 'Tax Registration', 'Verify-Locally Notes'],
        estimatedMinutes: 2,
      },
    ],
  },
  {
    role: 'Brand Strategist',
    types: [
      {
        type: 'brand-guide',
        label: 'Brand Guide',
        description: 'How the brand looks, sounds, and shows up everywhere',
        sections: ['Brand Story & Positioning', 'Voice & Tone', 'Logo & Usage', 'Color Palette', 'Typography', 'Imagery & Iconography', "Do's and Don'ts"],
        estimatedMinutes: 3,
      },
    ],
  },
];

/**
 * Get deliverable types available for a given role.
 */
export function getDeliverableTypesForRole(role: string): DeliverableTypeSpec[] {
  const entry = DELIVERABLE_TYPE_REGISTRY.find(r => r.role === role);
  return entry?.types || [{
    type: 'custom',
    label: 'Custom Document',
    description: 'A custom deliverable',
    sections: ['Overview', 'Details', 'Conclusion'],
    estimatedMinutes: 2,
  }];
}

/**
 * Get the section schema for a deliverable type.
 */
export function getSectionsForType(type: string): string[] {
  for (const entry of DELIVERABLE_TYPE_REGISTRY) {
    for (const t of entry.types) {
      if (t.type === type) return t.sections;
    }
  }
  return ['Overview', 'Details', 'Conclusion'];
}

/**
 * Get a human-readable label for a deliverable type.
 */
export function getTypeLabel(type: string): string {
  for (const entry of DELIVERABLE_TYPE_REGISTRY) {
    for (const t of entry.types) {
      if (t.type === type) return t.label;
    }
  }
  return type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Phase 39 (READ-01) — deliverable types that a reader OUTSIDE the project consumes as prose,
 * and therefore benefit from a fresh-eyes ("reader test") review before delivery. These are the
 * documents that fail the "this only makes sense if you wrote it" test: a PRD a stakeholder reads,
 * a blog post, a marketing email, a landing page, a brief, an external research/analysis writeup,
 * a process doc read by someone who wasn't in the room.
 *
 * Deliberately EXCLUDED (structured/internal scaffolding where cover-to-cover outsider readability
 * is not the quality bar): tech-spec (internal engineering reference), user-stories (structured
 * list), content-calendar (schedule), project-plan (task table), data-report (numbers), custom
 * (unknown shape). The frozen rubric already grades those on their own terms; the reader test adds
 * value specifically for prose meant to be understood by a stranger.
 */
export const READER_FACING_DOC_TYPES: ReadonlySet<string> = new Set([
  'prd',
  'design-brief',
  'gtm-plan',
  'blog-post',
  'landing-copy',
  'email-sequence',
  'seo-brief',
  'market-research',
  'competitive-analysis',
  'process-doc',
]);

/**
 * True when a deliverable type is reader-facing prose (see READER_FACING_DOC_TYPES). Fails closed:
 * unknown/empty types return false so the reader test never fires on something it wasn't meant for.
 */
export function isReaderFacingDocType(type: string): boolean {
  return READER_FACING_DOC_TYPES.has(type);
}

/**
 * Deliverable types that generate money, legal, or compliance content and therefore must carry a
 * "not professional advice" disclaimer on the produced document, wherever it is shown or exported.
 * (Audit R0-3: AI-generated financial/legal docs were shipping as branded PDFs with no disclaimer.)
 */
export const PROFESSIONAL_DISCLAIMER_TYPES: ReadonlySet<string> = new Set([
  'business-plan',
  'financial-model',
  'legal-checklist',
]);

/** The disclaimer text, in the product's plain voice (no dashes). */
export const PROFESSIONAL_DISCLAIMER =
  'AI-generated draft, not professional advice. This document was produced by an AI teammate and may contain errors or omissions. It is not legal, financial, tax, or investment advice. Verify every figure, claim, and legal point with a licensed professional before you rely on it.';

/** Returns the disclaimer for a type that needs one, else null. Fails closed on unknown types. */
export function professionalDisclaimerFor(type: string): string | null {
  return PROFESSIONAL_DISCLAIMER_TYPES.has(type) ? PROFESSIONAL_DISCLAIMER : null;
}
