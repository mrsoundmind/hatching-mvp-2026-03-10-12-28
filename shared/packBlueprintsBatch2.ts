/**
 * Business-in-a-Box, Batch 2 packs (2026-08-14): Web3, AgTech, Logistics, Telehealth.
 *
 * Authored from four researched, sourced specs (mastery-map frameworks, real citations, no invented
 * numbers). Guardrails are baked into direction, roleBriefs, documents, tasks, and playbook framing:
 *  - Web3: a token is a utility/coordination mechanism, never an investment; security-first; all
 *    securities/tax/legal content is "jurisdiction-dependent, verify locally, consult counsel, not advice".
 *  - AgTech: proof-first (nothing is a guaranteed yield or return); food-safety/environmental content is
 *    "verify with the relevant authority, consult a professional".
 *  - Logistics: DOT/FMCSA-type compliance is "typical, verify locally, consult a licensed professional".
 *  - Telehealth: the BUSINESS of a virtual clinic ONLY; never medical advice; clinical scope/licensure is
 *    owned by the founder's medical director and licensed clinicians; HIPAA/billing content is "verify with
 *    counsel and a compliance professional, not legal or medical advice".
 *
 * Kept in a separate file with a TYPE-ONLY import of PackBlueprint (no runtime circular dependency), so it
 * plugs into PACK_BLUEPRINTS with a single import + spread and minimizes edits to the large shared file.
 * Telehealth is deliberately distinct from the existing `healthcare-clinic` pack (a physical local clinic):
 * this is a digital, multi-state, platform + provider-network business.
 */
import type { PackBlueprint, BlueprintStage } from './packBlueprints';

const STAGES: BlueprintStage[] = [
  { key: "prerequisites", label: "Get set up", summary: "Validate the idea and lay the foundations before you build." },
  { key: "build", label: "Build", summary: "Make the core thing customers will actually use." },
  { key: "launch", label: "Launch", summary: "Get it in front of the first real customers." },
  { key: "grow", label: "Grow", summary: "Turn early traction into steady, repeatable growth." },
];

// -----------------------------------------------------------------------------
// Web3 Startup
// -----------------------------------------------------------------------------
export const WEB3_PACK: PackBlueprint = {
  packId: "web3-startup",
  packTitle: "Web3 Startup",
  emoji: "🔗",
  tagline: "Ship an on-chain product with a utility token, audited contracts, and a real path to community ownership.",
  tier: "pro",
  team: ["Product Manager", "Technical Lead", "Backend Developer", "UX Designer", "Legal Counsel", "Finance Analyst", "Growth Marketer", "Content Writer", "Social Media Manager"],
  addOnRoles: ["Data Analyst", "QA Lead", "DevOps Engineer", "Operations Manager"],
  direction: {
    whatBuilding: "An on-chain product: a decentralized application backed by audited smart contracts on an EVM chain, with a utility token that powers real actions inside the product such as access, coordination, and paying network fees. Accounts are wallet-based, and the token is a mechanism that makes the product work, not a promise of profit.",
    whyMatters: "People increasingly want verifiable ownership and transparent, tamper-resistant rules instead of trusting a hidden middleman. An on-chain product gives users assets and permissions they truly control and rules anyone can inspect, which earns durable trust in a category crowded with scams and opaque promises. The value here is utility and trust, not price speculation.",
    whoFor: "A specific community that needs on-chain coordination or ownership that centralized tools cannot give them, for example a creator collective, a data or compute network, or a group coordinating shared resources. They are comfortable with a wallet, or willing to be onboarded gently, and they care about controlling their own assets.",
  },
  roleBriefs: {
    "Product Manager": "Owns what the dApp does and what the token is genuinely for, keeps scope tight around one real user job, and enforces the rule that the token is a utility mechanism, never framed as an investment.",
    "Technical Lead": "Owns smart-contract architecture and security posture: picks the standards, sets the testnet-before-mainnet discipline, scopes the external audit, and treats every external call and private key as a threat surface.",
    "Backend Developer": "Builds the contracts on audited OpenZeppelin bases plus the off-chain services (indexer, APIs) that make the dApp usable, and writes the tests and fuzzing that must pass before any mainnet deploy.",
    "UX Designer": "Designs wallet onboarding and everyday flows so a non-crypto user can succeed, using account-abstraction patterns like social recovery and sponsored gas to hide seed-phrase friction.",
    "Legal Counsel": "Flags typical token, securities, tax, and consumer questions as jurisdiction-dependent items to raise with a licensed professional, and drafts plain disclaimers. Never gives authoritative legal or financial advice.",
    "Finance Analyst": "Models token supply, allocations, vesting, and treasury runway as system mechanics for a healthy product, tracks on-chain health signals, and refuses any modeling that implies price appreciation or returns.",
    "Growth Marketer": "Runs community-led, no-hype growth: a testnet campaign, honest positioning around utility, and a launch sequenced around progressive decentralization rather than token-price excitement.",
    "Content Writer": "Writes the litepaper, docs, and safety FAQ in plain, non-promissory language, explaining how the product and token work and how users verify the real contract and avoid scams.",
    "Social Media Manager": "Runs the community across Discord, X, and forums, turns testnet participants into contributors, moderates against scams and impersonation, and keeps a steady cadence of honest updates.",
  },
  stages: STAGES,
  documents: [
    { key: "token-utility-brief", type: "prd", title: "Token Utility and Mechanism Brief", description: "Defines exactly what the token does inside the product and its supply logic, with the hard rule that it is a utility, never an investment.", role: "Product Manager", stage: "prerequisites" },
    { key: "compliance-considerations-checklist", type: "legal-checklist", title: "Token and Compliance Considerations Checklist", description: "Lists typical token, securities, tax, and disclosure considerations to review with licensed counsel, marked jurisdiction-dependent and not legal advice.", role: "Legal Counsel", stage: "prerequisites" },
    { key: "token-treasury-model", type: "financial-model", title: "Token Supply and Treasury Model", description: "Models token supply, allocations, vesting, and treasury runway as system mechanics, with no price or return projections.", role: "Finance Analyst", stage: "prerequisites" },
    { key: "smart-contract-spec", type: "tech-spec", title: "Smart Contract Architecture Spec", description: "Specifies the contracts, the chosen token standard, access control, the upgrade approach, and the on-chain versus off-chain split.", role: "Technical Lead", stage: "build" },
    { key: "security-audit-readiness-plan", type: "process-doc", title: "Security and Audit-Readiness Plan", description: "The security process: OWASP Smart Contract Top 10 coverage, safe coding patterns, test and fuzz gates, key management, and audit scope before mainnet.", role: "Technical Lead", stage: "build" },
    { key: "wallet-ux-brief", type: "design-brief", title: "Wallet and Onboarding UX Brief", description: "Describes wallet onboarding and daily flows using account-abstraction patterns so non-crypto users can start without a seed phrase.", role: "UX Designer", stage: "build" },
    { key: "dapp-prd", type: "prd", title: "dApp Product Requirements", description: "The product requirements for the dApp's core user journeys across on-chain and off-chain steps.", role: "Product Manager", stage: "build" },
    { key: "community-launch-plan", type: "gtm-plan", title: "Community-Led Launch Plan", description: "The no-hype go-to-market: testnet campaign, honest positioning, and a launch sequenced around progressive decentralization.", role: "Growth Marketer", stage: "launch" },
    { key: "litepaper", type: "custom", title: "Litepaper (Utility and Mechanics)", description: "A plain-language explainer of what the product does and how the token works, with no price talk or return promises.", role: "Content Writer", stage: "launch" },
    { key: "user-safety-faq", type: "process-doc", title: "User Safety Guide and FAQ", description: "A user safety guide covering how to verify the real contract address, spot scams and impersonators, and protect keys.", role: "Content Writer", stage: "launch" },
    { key: "community-content-calendar", type: "content-calendar", title: "Community and Content Calendar", description: "A steady calendar of honest community updates, AMAs, and educational posts across Discord and X.", role: "Social Media Manager", stage: "grow" },
    { key: "onchain-health-report", type: "data-report", title: "On-Chain Health Report", description: "A recurring report on on-chain health signals like active wallets, transactions, and treasury, focused on utility, not price.", role: "Finance Analyst", stage: "grow" },
  ],
  tasks: [
    { title: "Define the token's real in-product utility", description: "Write down exactly what the token lets people do inside the product, and explicitly rule out any investment or return framing.", role: "Product Manager", stage: "prerequisites", priority: "high", producesDocKey: "token-utility-brief" },
    { title: "Map typical legal and compliance considerations with counsel", description: "Sit with licensed counsel and list the typical securities, tax, and disclosure questions for your token across the jurisdictions you touch.", role: "Legal Counsel", stage: "prerequisites", priority: "urgent", producesDocKey: "compliance-considerations-checklist" },
    { title: "Model token supply and treasury runway", description: "Model token supply, allocations, vesting, and treasury runway as system mechanics, with no price projections.", role: "Finance Analyst", stage: "prerequisites", priority: "high", producesDocKey: "token-treasury-model" },
    { title: "Choose the token standard and the on-chain versus off-chain split", description: "Pick the token standard (ERC-20, ERC-721, or ERC-1155) and decide what state lives on-chain versus off-chain.", role: "Technical Lead", stage: "build", priority: "high" },
    { title: "Write the smart-contract architecture spec", description: "Document the contracts, access control, upgrade approach, and external dependencies before writing production code.", role: "Technical Lead", stage: "build", priority: "high", producesDocKey: "smart-contract-spec" },
    { title: "Write the security and audit-readiness plan", description: "Map OWASP Smart Contract Top 10 coverage, safe coding patterns, test and fuzz gates, key management, and the testnet-before-mainnet gates.", role: "Technical Lead", stage: "build", priority: "urgent", producesDocKey: "security-audit-readiness-plan" },
    { title: "Build contracts on audited bases and deploy to testnet", description: "Implement the contracts on audited OpenZeppelin bases, add unit tests and fuzzing, and deploy to a public testnet.", role: "Backend Developer", stage: "build", priority: "high" },
    { title: "Design the wallet onboarding and everyday UX", description: "Design onboarding and daily flows using account-abstraction patterns like social recovery so non-crypto users can succeed.", role: "UX Designer", stage: "build", priority: "high", producesDocKey: "wallet-ux-brief" },
    { title: "Write the dApp product requirements", description: "Specify the core on-chain and off-chain user journeys the product must support.", role: "Product Manager", stage: "build", priority: "medium", producesDocKey: "dapp-prd" },
    { title: "Commission an independent smart-contract audit before mainnet", description: "Engage an independent audit firm, fix every finding, and re-test before any value moves on mainnet.", role: "Technical Lead", stage: "launch", priority: "urgent" },
    { title: "Run a testnet community campaign and gather feedback", description: "Invite the community to use the product on testnet, collect real usage feedback, and surface bugs before mainnet.", role: "Social Media Manager", stage: "launch", priority: "medium" },
    { title: "Write the community-led launch plan", description: "Sequence the launch around progressive decentralization and honest utility positioning, not price hype.", role: "Growth Marketer", stage: "launch", priority: "high", producesDocKey: "community-launch-plan" },
    { title: "Write the litepaper", description: "Explain the product and the token in plain language, with no price or return talk.", role: "Content Writer", stage: "launch", priority: "medium", producesDocKey: "litepaper" },
    { title: "Write the user safety guide and FAQ", description: "Teach users how to verify the real contract, spot scams and impersonators, and protect their keys.", role: "Content Writer", stage: "launch", priority: "medium", producesDocKey: "user-safety-faq" },
    { title: "Build the community content and AMA calendar", description: "Set a steady cadence of honest updates, AMAs, and educational posts across Discord and X.", role: "Social Media Manager", stage: "grow", priority: "low", producesDocKey: "community-content-calendar" },
    { title: "Set up on-chain metrics and a health report", description: "Track active wallets, transactions, and treasury health, and publish a recurring report focused on utility, not price.", role: "Finance Analyst", stage: "grow", priority: "medium", producesDocKey: "onchain-health-report" },
  ],
  playbook: {
    field: "Web3 product engineering, token design, and on-chain security",
    primer: "A strong Web3 operator treats the smart contract as a public vault that hostile people will probe for money the moment it ships, so they design for security first, lean on audited libraries and independent audits, and never touch mainnet before a contract has survived a testnet. They think of the token as a mechanism to be engineered, not a coin to be marketed: the rules and incentives should make the behavior they want emerge, and the token must earn its place as a utility rather than a promise of profit. They decentralize on purpose and in order, product first, community second, control last, and they treat every legal, securities, and tax question as jurisdiction-dependent and evolving, to be answered with a licensed professional, not guessed.",
    frameworks: ["OWASP Smart Contract Top 10", "SWC Registry", "Checks-Effects-Interactions pattern", "Trail of Bits Building Secure Contracts", "OpenZeppelin Contracts", "Certora formal verification", "ERC-20 / ERC-721 / ERC-1155 token standards", "ERC-4337 account abstraction", "Token engineering", "Mechanism design", "Progressive decentralization", "Howey test", "Testnet-before-mainnet"],
    groups: [
      { label: "Ship code that cannot be drained", frameworks: ["OWASP Smart Contract Top 10", "SWC Registry", "Checks-Effects-Interactions pattern", "Trail of Bits Building Secure Contracts", "OpenZeppelin Contracts", "Certora formal verification", "Testnet-before-mainnet"] },
      { label: "Pick building blocks wallets already speak", frameworks: ["ERC-20 / ERC-721 / ERC-1155 token standards", "ERC-4337 account abstraction"] },
      { label: "Design the token as a product, not a promise", frameworks: ["Token engineering", "Mechanism design"] },
      { label: "Decentralize and stay on the right side of the rules", frameworks: ["Progressive decentralization", "Howey test"] },
    ],
    glosses: {
      "OWASP Smart Contract Top 10": "A ranked list of the most common ways smart contracts get exploited, used as a security checklist before you ship.",
      "SWC Registry": "A catalog of known smart-contract weaknesses with examples and fixes, so you can name and test for each class of bug.",
      "Checks-Effects-Interactions pattern": "A coding order (check conditions, update your own state, then call other contracts) that prevents the classic reentrancy drain.",
      "Trail of Bits Building Secure Contracts": "A free security handbook and tool set (Slither, Echidna) from a top audit firm for writing and testing safer contracts.",
      "OpenZeppelin Contracts": "A library of audited, reusable smart-contract building blocks (tokens, access control, reentrancy guards) so you do not hand-roll risky code.",
      "Certora formal verification": "A tool that mathematically checks your contract always obeys rules you write, catching bugs that ordinary tests miss.",
      "ERC-20 / ERC-721 / ERC-1155 token standards": "The standard blueprints for fungible tokens, unique NFTs, and mixed collections that every wallet and exchange already understands.",
      "ERC-4337 account abstraction": "A standard that lets users have smart-contract wallets with features like social recovery and paying gas in any token, so onboarding can feel like a normal app.",
      "Token engineering": "Designing a token's rules and incentives as a system so the behavior you want actually emerges, rather than bolting a token on as marketing.",
      "Mechanism design": "The economics of setting the rules of a system so that people acting in their own interest produce the outcome you intended.",
      "Progressive decentralization": "A staged playbook: nail the product first, grow a community second, hand control to that community last, in that order.",
      "Howey test": "A US legal test for whether something counts as an investment security, a consideration to raise with counsel, jurisdiction-dependent and evolving, not legal advice.",
      "Testnet-before-mainnet": "The discipline of deploying and battle-testing on free dev networks and public testnets before risking any real value on mainnet.",
    },
  },
};

// -----------------------------------------------------------------------------
// AgTech Startup
// -----------------------------------------------------------------------------
export const AGTECH_PACK: PackBlueprint = {
  packId: "agtech-startup",
  packTitle: "AgTech Startup",
  emoji: "🌾",
  tagline: "Build technology that pays for itself per acre, proven on real fields and sold through the people growers already trust.",
  tier: "pro",
  team: ["Product Manager", "Technical Lead", "Data Scientist", "Operations Manager", "Finance Analyst", "Legal Counsel", "Sales Lead", "Content Writer"],
  addOnRoles: ["Backend Developer", "DevOps Engineer", "Customer Success Manager", "Brand Strategist"],
  direction: {
    whatBuilding: "Technology for agriculture that produces a clear, measurable on-farm outcome: more yield per acre, lower input cost, or less risk, delivered through software, data, sensors, or a mix. The product turns field data into decisions a grower can act on this season.",
    whyMatters: "Growers run on thin margins and one growing season a year, so they adopt slowly and only after they have seen a result on ground like theirs. Technology that reliably lifts yield or cuts a real input cost pays for itself and earns a durable place in the operation. The goal is proof on real fields, not promises.",
    whoFor: "A specific grower and crop: their acreage, the region and soil they farm, the decision you help them make better, and the moment in the season that decision happens. Narrow beats broad, one crop, one region, one clear job.",
  },
  roleBriefs: {
    "Product Manager": "Owns what the product does for a grower and keeps it tied to one measurable on-farm outcome (more yield, less input, or less risk), sequenced around the crop calendar so features land when growers can actually use them.",
    "Technical Lead": "Owns the platform and any sensors or hardware, choosing rugged, low-connectivity-tolerant designs, because a device that fails in a wet field in season loses trust fast, and keeps the data pipeline from field to insight short.",
    "Data Scientist": "Owns the agronomic models and remote-sensing work such as NDVI and yield estimation, validates every model against real field outcomes, and refuses to ship an insight that has not held up across seasons and geographies.",
    "Operations Manager": "Owns on-farm trials and grower operations: designs replicated strip trials, coordinates field logistics with growers, and runs the seasonal support rhythm that keeps a paying grower successful.",
    "Finance Analyst": "Models unit economics per acre and the seasonal cash-flow reality of farming (money out at planting, in at harvest), and builds the partial-budget case that shows a grower the return before they commit.",
    "Legal Counsel": "Flags typical food-safety, environmental, pesticide, water-use, and grower-data-ownership questions as region and crop dependent items to raise with the relevant authority and a licensed professional. Never gives authoritative legal or agronomic advice.",
    "Sales Lead": "Owns go-to-market to growers, which means winning the trusted advisors first (agronomists, co-ops, and dealers), running demonstration plots, and selling on proven per-acre ROI rather than features.",
    "Content Writer": "Writes grower-facing education in plain, respectful language (agronomy explainers, trial results, how-to guides) that earns credibility with a skeptical, practical audience.",
  },
  stages: STAGES,
  documents: [
    { key: "ag-business-plan", type: "business-plan", title: "AgTech Business Plan", description: "The founding document: the on-farm problem, the product, the crop and region to start in, how it makes money, and the path from first trials to scale.", role: "Product Manager", stage: "prerequisites" },
    { key: "grower-problem-validation", type: "market-research", title: "Grower Problem and Market Validation", description: "Evidence from real conversations with growers and their advisors that the problem is painful, frequent, and worth paying to solve, for a defined crop and region.", role: "Sales Lead", stage: "prerequisites" },
    { key: "per-acre-economics", type: "financial-model", title: "Per-Acre Unit Economics and Seasonal Cash Flow", description: "A model of the cost to deliver and the return per acre, plus the season's cash-flow shape, so you know the grower's ROI and your own before you scale.", role: "Finance Analyst", stage: "prerequisites" },
    { key: "ag-regulatory-considerations", type: "legal-checklist", title: "Regulatory and Data-Ownership Considerations", description: "Typical food-safety, environmental, pesticide, water, and grower-data-ownership considerations to review with the relevant authority and counsel, marked region and crop dependent, not legal advice.", role: "Legal Counsel", stage: "prerequisites" },
    { key: "product-requirements", type: "prd", title: "Product Requirements (Season 1)", description: "What the product does in its first season, the core grower workflows, and what is deliberately left out.", role: "Product Manager", stage: "build" },
    { key: "data-architecture-spec", type: "tech-spec", title: "Data and Sensor Architecture Spec", description: "The stack, the field-to-insight data pipeline, hardware or integrations like weather, satellite, and machinery, and how it holds up in low-connectivity conditions.", role: "Technical Lead", stage: "build" },
    { key: "field-trial-protocol", type: "project-plan", title: "On-Farm Trial Protocol", description: "A replicated on-farm strip-trial design (treatment versus check strips, replication, what to measure) that will produce a credible, defensible result.", role: "Operations Manager", stage: "build" },
    { key: "agronomic-model-brief", type: "data-report", title: "Agronomic Model and Remote-Sensing Brief", description: "How the product turns data such as NDVI, soil, and weather into a recommendation, and how each model is validated against real field outcomes.", role: "Data Scientist", stage: "build" },
    { key: "grower-gtm-plan", type: "gtm-plan", title: "Go-to-Market to Growers", description: "The plan to win trusted advisors first (agronomists, co-ops, dealers), run demonstration plots, and price and sell on proven per-acre ROI.", role: "Sales Lead", stage: "launch" },
    { key: "grower-onboarding-sop", type: "sop", title: "Grower Onboarding and Seasonal Support SOP", description: "The repeatable steps to onboard a grower, set them up before the season, and support them through it so they succeed and renew.", role: "Operations Manager", stage: "launch" },
    { key: "grower-education-calendar", type: "content-calendar", title: "Grower Education Calendar", description: "A season-aware calendar of plain-language agronomy explainers, trial results, and how-to content that builds credibility with a practical audience.", role: "Content Writer", stage: "launch" },
    { key: "season-review-report", type: "data-report", title: "End-of-Season Review and ROI Report", description: "A recurring end-of-season report on yield, input, and ROI outcomes across growers, feeding the next season's product and pitch.", role: "Data Scientist", stage: "grow" },
  ],
  tasks: [
    { title: "Talk to 10 growers and their advisors", description: "Interview ten growers and a few agronomists or co-op advisors for one crop and region to confirm the problem is painful, frequent, and worth paying to fix.", role: "Sales Lead", stage: "prerequisites", priority: "high", producesDocKey: "grower-problem-validation" },
    { title: "Write the AgTech business plan", description: "Capture the on-farm problem, the product, the starting crop and region, the business model, and the path from trials to scale.", role: "Product Manager", stage: "prerequisites", priority: "high", producesDocKey: "ag-business-plan" },
    { title: "Model per-acre economics and seasonal cash flow", description: "Model the cost to deliver and the return per acre, plus the season's cash-flow timing, so you know both the grower's ROI and your own.", role: "Finance Analyst", stage: "prerequisites", priority: "high", producesDocKey: "per-acre-economics" },
    { title: "Map regulatory and data-ownership considerations", description: "With counsel, list the typical food-safety, environmental, pesticide, water, and grower-data-ownership considerations for your crop and region.", role: "Legal Counsel", stage: "prerequisites", priority: "urgent", producesDocKey: "ag-regulatory-considerations" },
    { title: "Write the season-1 product requirements", description: "Define what the product does in its first season, the core grower workflows, and what is out of scope.", role: "Product Manager", stage: "build", priority: "high", producesDocKey: "product-requirements" },
    { title: "Design the data and sensor architecture", description: "Specify the stack, the field-to-insight pipeline, any hardware or integrations, and how it stays reliable in low-connectivity fields.", role: "Technical Lead", stage: "build", priority: "high", producesDocKey: "data-architecture-spec" },
    { title: "Design the on-farm trial protocol", description: "Design replicated strip trials (treatment versus check, replication, what to measure) that will produce a credible result on real ground.", role: "Operations Manager", stage: "build", priority: "urgent", producesDocKey: "field-trial-protocol" },
    { title: "Build and validate the agronomic model", description: "Turn field, soil, weather, and remote-sensing data into a recommendation, and validate it against real field outcomes before trusting it.", role: "Data Scientist", stage: "build", priority: "high", producesDocKey: "agronomic-model-brief" },
    { title: "Build the season-1 product and get it field-ready", description: "Ship the first working product and harden it for real field conditions: connectivity, weather, and rough handling.", role: "Technical Lead", stage: "build", priority: "high" },
    { title: "Run replicated trials on partner farms", description: "Run the trials on a handful of partner farms across the season and collect clean, comparable data.", role: "Operations Manager", stage: "launch", priority: "urgent" },
    { title: "Win the trusted advisors and set up demo plots", description: "Recruit agronomists, co-ops, and dealers as champions, stand up demonstration plots, and build the ROI-based sales motion.", role: "Sales Lead", stage: "launch", priority: "high", producesDocKey: "grower-gtm-plan" },
    { title: "Write the grower onboarding and support SOP", description: "Document the repeatable steps to onboard a grower before the season and support them through it.", role: "Operations Manager", stage: "launch", priority: "medium", producesDocKey: "grower-onboarding-sop" },
    { title: "Build the grower education calendar", description: "Plan season-aware, plain-language content (agronomy explainers, trial results, how-tos) that earns credibility.", role: "Content Writer", stage: "launch", priority: "medium", producesDocKey: "grower-education-calendar" },
    { title: "Publish the season's trial results honestly", description: "Turn the trial data into an honest, clearly explained result, including where it did not work, because credibility compounds with growers.", role: "Data Scientist", stage: "grow", priority: "high" },
    { title: "Run the end-of-season review and ROI report", description: "Review yield, input, and ROI outcomes across growers and feed the findings into next season's product and pitch.", role: "Data Scientist", stage: "grow", priority: "medium", producesDocKey: "season-review-report" },
    { title: "Set the renewal and expansion motion", description: "Build the motion to renew paying growers and expand acre by acre and farm by farm on the back of proven results.", role: "Sales Lead", stage: "grow", priority: "medium" },
  ],
  playbook: {
    field: "Precision agriculture, agronomy, on-farm trial design, and go-to-market to growers",
    primer: "A strong AgTech operator respects that a grower gets one shot a year and will not bet the farm on a promise, so they prove the value on real fields with replicated trials before they ever sell it, and they lead with return per acre, not features. They sell through the people a grower already trusts (agronomists, co-ops, and dealers) rather than around them, and they design hardware and software to survive dust, water, and dead cell zones. They plan everything around the crop calendar, because a tool that shows up after planting is a tool for next year.",
    frameworks: ["Precision agriculture and Variable-Rate Application", "NDVI and remote sensing", "Soil sampling with grid and management zones", "Replicated on-farm strip trials", "Partial budget analysis", "4Rs Nutrient Stewardship", "Integrated Pest Management", "Technology Adoption Lifecycle", "Crossing the Chasm", "Channel go-to-market through agronomists, co-ops, and dealers", "The crop calendar and seasonality planning", "Cold chain management"],
    groups: [
      { label: "Make the field legible (measure before you act)", frameworks: ["Precision agriculture and Variable-Rate Application", "NDVI and remote sensing", "Soil sampling with grid and management zones"] },
      { label: "Prove it pays, per acre", frameworks: ["Replicated on-farm strip trials", "Partial budget analysis", "4Rs Nutrient Stewardship", "Integrated Pest Management"] },
      { label: "Win the grower's trust and channel", frameworks: ["Technology Adoption Lifecycle", "Crossing the Chasm", "Channel go-to-market through agronomists, co-ops, and dealers"] },
      { label: "Respect the season and the supply chain", frameworks: ["The crop calendar and seasonality planning", "Cold chain management"] },
    ],
    glosses: {
      "Precision agriculture and Variable-Rate Application": "Managing a field by small zones instead of as one block, so seed, fertilizer, and water go where they pay off, guided by data.",
      "NDVI and remote sensing": "Using satellite or drone imagery to measure how healthy and dense a crop is across a field, so you can spot problems early and target action.",
      "Soil sampling with grid and management zones": "Testing soil in a grid or by zones so recommendations match what each part of the field actually needs, rather than a field-wide average.",
      "Replicated on-farm strip trials": "Running your product on some strips and a normal check on others, repeated across a field, so the result is credible and not luck.",
      "Partial budget analysis": "A simple per-acre calculation of the added costs versus the added returns of a change, so a grower can see if it pays before committing.",
      "4Rs Nutrient Stewardship": "Applying nutrients with the Right source, Right rate, Right time, and Right place, the industry framework for responsible, effective fertility.",
      "Integrated Pest Management": "A decision approach that combines monitoring, thresholds, and multiple tactics to control pests with the least cost and risk, rather than spraying by calendar.",
      "Technology Adoption Lifecycle": "Everett Rogers' model of how a new practice spreads, from innovators and early adopters to the majority, which explains why growers adopt in stages.",
      "Crossing the Chasm": "Geoffrey Moore's playbook for getting past the hard gap between early enthusiasts and the pragmatic mainstream by winning one focused segment first.",
      "Channel go-to-market through agronomists, co-ops, and dealers": "Selling through the trusted advisors a grower already relies on, because their endorsement carries far more weight than direct outreach.",
      "The crop calendar and seasonality planning": "Planning product, trials, and sales around planting, growing, and harvest windows, because timing decides whether a tool is usable this year.",
      "Cold chain management": "Keeping perishable produce within safe temperature ranges from field to buyer to prevent loss, relevant for fresh-produce and supply-chain products.",
    },
  },
};

// -----------------------------------------------------------------------------
// Logistics & Delivery Startup
// -----------------------------------------------------------------------------
export const LOGISTICS_PACK: PackBlueprint = {
  packId: "logistics-startup",
  packTitle: "Logistics & Delivery Startup",
  emoji: "🚚",
  tagline: "Move freight and last-mile parcels reliably, on an asset-light network you grow lane by lane.",
  tier: "pro",
  team: ["Operations Manager", "Finance Analyst", "Data Analyst", "Backend Developer", "Legal Counsel", "Business Strategist", "Sales Lead", "Product Manager"],
  addOnRoles: ["Customer Success Manager", "Growth Marketer", "DevOps Engineer", "UX Designer", "HR Specialist"],
  direction: {
    whatBuilding: "An asset-light, tech-enabled logistics startup that moves freight and last-mile parcels for regional shippers without owning a fleet on day one. It matches shipper demand to a vetted network of carriers and drivers through a dispatch and tracking platform, and runs a cross-dock to consolidate loads. The model starts brokerage-first and adds owned assets only on lanes where the unit economics prove out.",
    whyMatters: "Shippers lose money and customers on late, incomplete, or opaque deliveries, and most small carriers have no easy way to keep their trucks full. A network that holds on-time in-full performance with live tracking wins freight that would otherwise go to slower incumbents. Because the model is asset-light, it can grow lane by lane on proven margins instead of betting the company on trucks upfront.",
    whoFor: "Regional shippers such as manufacturers, distributors, and e-commerce brands that need reliable freight or last-mile delivery but cannot justify a private fleet. It also serves owner-operator carriers and drivers who want steady, well-routed loads. The first wedge is a handful of dense, repeatable lanes where on-time performance and cost-to-serve can be measured and improved.",
  },
  roleBriefs: {
    "Operations Manager": "Owns the physical network day to day: dispatch, the cross-dock, carrier and driver capacity, and the on-time numbers. Turns the plan into moving trucks and clean handoffs.",
    "Finance Analyst": "Builds and defends the unit economics per shipment, route, and parcel, and runs cost-to-serve so the team knows which lanes and customers actually make money. Sets pricing floors and the asset-light versus owned-fleet call.",
    "Data Analyst": "Turns tracking and dispatch data into route efficiency, OTIF, and drop-density insight, and stands up the dashboards that show whether service and cost are improving.",
    "Backend Developer": "Builds the dispatch engine, live tracking, and carrier and mapping API integrations that keep every load visible from pickup to proof of delivery.",
    "Legal Counsel": "Handles carrier and broker authority, DOT-type registration, insurance, and the contracts and liability terms between shippers, carriers, and drivers. Frames every requirement as typical, verify locally, consult a licensed professional.",
    "Business Strategist": "Chooses the lanes, the network shape, and the asset-light model, and writes the business plan and competitor view that decide where to grow next.",
    "Sales Lead": "Lands the first anchor shippers and repeatable lane contracts, and builds the book of business the network runs on.",
    "Product Manager": "Owns the shipper portal and driver app: what gets built and in what order, so shippers self-serve and drivers get clean routes and simple proof of delivery.",
  },
  stages: STAGES,
  documents: [
    { key: "logistics-business-plan", type: "business-plan", title: "Asset-Light Logistics Business Plan", description: "The one-document view of the network model, target lanes, revenue plan, and the trigger for buying owned assets.", role: "Business Strategist", stage: "prerequisites" },
    { key: "market-and-lane-research", type: "market-research", title: "Market and Profitable-Lane Research", description: "Where demand is dense, which lanes repeat, and what shippers pay, so the network starts on routes that can actually clear a margin.", role: "Business Strategist", stage: "prerequisites" },
    { key: "unit-economics-model", type: "financial-model", title: "Per-Shipment Unit Economics Model", description: "A model of cost and margin per shipment, per route, and per parcel, including the pricing floor below which a load is not worth taking.", role: "Finance Analyst", stage: "prerequisites" },
    { key: "carrier-compliance-checklist", type: "legal-checklist", title: "Carrier, Broker Authority, and DOT Compliance Checklist", description: "A plain checklist of registration, insurance, and safety items to confirm before hauling, each marked verify locally and consult a licensed professional.", role: "Legal Counsel", stage: "prerequisites" },
    { key: "platform-prd", type: "prd", title: "Shipper Portal and Driver App PRD", description: "What the shipper booking portal and the driver app must do, in priority order, from quote to proof of delivery.", role: "Product Manager", stage: "build" },
    { key: "dispatch-platform-spec", type: "tech-spec", title: "Dispatch, Tracking, and Carrier-API Tech Spec", description: "The architecture for the dispatch engine, live GPS tracking, and the carrier and mapping API integrations behind it.", role: "Backend Developer", stage: "build" },
    { key: "cross-dock-warehouse-sop", type: "sop", title: "Cross-Dock and Cycle-Count Warehouse SOP", description: "Step-by-step receiving, cross-docking, staging, and inventory-accuracy routine for the consolidation facility.", role: "Operations Manager", stage: "build" },
    { key: "carrier-driver-onboarding-sop", type: "sop", title: "Carrier and Driver Vetting and Onboarding SOP", description: "How a new carrier or driver is checked, insured, contracted, and activated on the network, with safety gates at each step.", role: "Operations Manager", stage: "build" },
    { key: "shipper-gtm-plan", type: "gtm-plan", title: "Shipper Acquisition Go-To-Market Plan", description: "How the team lands the first anchor shippers and repeatable lane contracts, channel by channel.", role: "Sales Lead", stage: "launch" },
    { key: "pilot-lane-launch-plan", type: "project-plan", title: "First Pilot Lane Launch Plan", description: "The staffing, routes, carriers, and checkpoints to run the first live lane end to end without dropping a load.", role: "Operations Manager", stage: "launch" },
    { key: "otif-cost-to-serve-report", type: "data-report", title: "OTIF and Cost-to-Serve Performance Report", description: "A recurring readout of on-time in-full, route efficiency, and cost-to-serve by lane and customer, with the worst offenders flagged.", role: "Data Analyst", stage: "grow" },
    { key: "competitor-landscape", type: "competitive-analysis", title: "Competitor and Rate-Benchmark Landscape", description: "A view of who else runs these lanes, what they charge, and where reliability or price leaves an opening to grow into.", role: "Business Strategist", stage: "grow" },
  ],
  tasks: [
    { title: "Map profitable lanes and target shipper segments", description: "Identify the dense, repeatable routes and the shipper types where reliable service can clear a real margin.", role: "Business Strategist", stage: "prerequisites", priority: "high", producesDocKey: "market-and-lane-research" },
    { title: "Build the per-shipment unit economics model", description: "Model cost and margin per shipment, route, and parcel, and set the pricing floor below which a load is refused.", role: "Finance Analyst", stage: "prerequisites", priority: "high", producesDocKey: "unit-economics-model" },
    { title: "Draft the carrier authority and DOT compliance checklist", description: "List the registration, insurance, and safety items to confirm before hauling, each marked verify locally and consult a licensed professional.", role: "Legal Counsel", stage: "prerequisites", priority: "high", producesDocKey: "carrier-compliance-checklist" },
    { title: "Write the asset-light business plan and network model", description: "Turn the lane, cost, and compliance work into one plan with the trigger for buying owned assets.", role: "Business Strategist", stage: "prerequisites", priority: "medium", producesDocKey: "logistics-business-plan" },
    { title: "Decide the asset-light versus owned-fleet mix for the first region", description: "Choose how much freight to broker to outside carriers versus haul on owned assets in the opening region, and why.", role: "Business Strategist", stage: "prerequisites", priority: "medium" },
    { title: "Define the shipper portal and driver app requirements", description: "Specify what shippers and drivers must be able to do, in priority order, from quote to proof of delivery.", role: "Product Manager", stage: "build", priority: "high", producesDocKey: "platform-prd" },
    { title: "Spec the dispatch, tracking, and carrier-API architecture", description: "Design the dispatch engine, live tracking, and the carrier and mapping integrations that keep loads visible.", role: "Backend Developer", stage: "build", priority: "high", producesDocKey: "dispatch-platform-spec" },
    { title: "Write the cross-dock and cycle-count warehouse SOP", description: "Document receiving, cross-docking, staging, and the inventory-accuracy routine for the consolidation facility.", role: "Operations Manager", stage: "build", priority: "medium", producesDocKey: "cross-dock-warehouse-sop" },
    { title: "Write the carrier and driver vetting and onboarding SOP", description: "Document how a carrier or driver is checked, insured, contracted, and activated, with a safety gate at each step.", role: "Operations Manager", stage: "build", priority: "high", producesDocKey: "carrier-driver-onboarding-sop" },
    { title: "Set OTIF and on-time delivery targets and how they are measured", description: "Define the on-time in-full target, what counts as a miss, and where the numbers are captured.", role: "Data Analyst", stage: "build", priority: "medium" },
    { title: "Build the shipper acquisition go-to-market plan", description: "Lay out the channels and offers to land the first anchor shippers and lane contracts.", role: "Sales Lead", stage: "launch", priority: "high", producesDocKey: "shipper-gtm-plan" },
    { title: "Plan and staff the first pilot lane end to end", description: "Line up the routes, carriers, drivers, and checkpoints to run the first live lane without dropping a load.", role: "Operations Manager", stage: "launch", priority: "urgent", producesDocKey: "pilot-lane-launch-plan" },
    { title: "Line up cargo, liability, and auto insurance before the first load", description: "Confirm the insurance and liability cover is bound before any freight moves, with a licensed broker.", role: "Legal Counsel", stage: "launch", priority: "high" },
    { title: "Sign the first anchor shipper contract", description: "Close the first repeatable-lane agreement that the network can be built around.", role: "Sales Lead", stage: "launch", priority: "urgent" },
    { title: "Stand up the OTIF and cost-to-serve performance report", description: "Build the recurring readout of on-time in-full, route efficiency, and cost-to-serve by lane and customer.", role: "Data Analyst", stage: "grow", priority: "high", producesDocKey: "otif-cost-to-serve-report" },
    { title: "Run a competitor and rate-benchmark landscape scan", description: "Map who else runs these lanes, what they charge, and where reliability or price leaves an opening.", role: "Business Strategist", stage: "grow", priority: "medium", producesDocKey: "competitor-landscape" },
  ],
  playbook: {
    field: "Logistics and supply-chain operations",
    primer: "Logistics is a game of unit economics and reliability at the same time: every shipment, route, and parcel has a cost and a promised delivery window, and the winner is whoever keeps both under control as volume grows. These frameworks cover how to design the network, route the fleet, keep the warehouse accurate, measure service, and stay compliant. Treat them as named tools, and ground every specific number in your own lanes and a licensed professional, never in a rule of thumb.",
    frameworks: ["SCOR model", "Hub-and-spoke network design", "Cross-docking", "Asset-light versus asset-based model", "Vehicle Routing Problem", "Last-mile cost-per-stop economics", "ABC analysis cycle counting", "Economic Order Quantity", "Safety stock and reorder point", "On-Time In-Full (OTIF)", "DIFOT and Perfect Order Rate", "Cost-to-Serve analysis", "Lean Six Sigma (DMAIC)", "FMCSA and USDOT registration compliance"],
    groups: [
      { label: "Network and model design", frameworks: ["SCOR model", "Hub-and-spoke network design", "Cross-docking", "Asset-light versus asset-based model"] },
      { label: "Routes and fleet efficiency", frameworks: ["Vehicle Routing Problem", "Last-mile cost-per-stop economics"] },
      { label: "Warehouse and inventory accuracy", frameworks: ["ABC analysis cycle counting", "Economic Order Quantity", "Safety stock and reorder point"] },
      { label: "Service and cost performance", frameworks: ["On-Time In-Full (OTIF)", "DIFOT and Perfect Order Rate", "Cost-to-Serve analysis", "Lean Six Sigma (DMAIC)"] },
      { label: "Compliance and risk", frameworks: ["FMCSA and USDOT registration compliance"] },
    ],
    glosses: {
      "SCOR model": "A standard map of any supply chain into six activities, Plan, Source, Make, Deliver, Return, and Enable, so you can describe and measure your operation with shared language.",
      "Hub-and-spoke network design": "Route everything through one or a few central sorting hubs instead of point to point, so you reach many destinations with fewer trucks and routes.",
      "Cross-docking": "Move goods straight from the inbound truck to the outbound truck with little or no storage in between, to cut handling and speed up delivery.",
      "Asset-light versus asset-based model": "The choice between owning trucks and drivers yourself or brokering loads to outside carriers for a margin, each with different control, flexibility, and margin swings.",
      "Vehicle Routing Problem": "The math of finding the cheapest set of routes for a fleet to serve all stops, balancing distance, time, vehicle capacity, and delivery windows.",
      "Last-mile cost-per-stop economics": "The final delivery leg is the most expensive part of shipping, and its cost per stop falls as you pack more drops into a tighter area.",
      "ABC analysis cycle counting": "Count your fast-moving, high-value items far more often than slow, low-value ones, so inventory stays accurate without a full stock-take.",
      "Economic Order Quantity": "A formula for the reorder size that keeps the combined cost of ordering and holding stock as low as possible.",
      "Safety stock and reorder point": "Safety stock is the buffer you hold for demand or delivery surprises, and the reorder point is the stock level that triggers a new order in time to avoid running out.",
      "On-Time In-Full (OTIF)": "The share of orders that arrive both on time and complete, counted as a miss if either part fails, and the headline promise a logistics network sells.",
      "DIFOT and Perfect Order Rate": "Measures that add condition and paperwork accuracy to on-time delivery, giving one at-a-glance score for how often you get the whole delivery right.",
      "Cost-to-Serve analysis": "Adding up every cost of serving a specific customer or lane, warehousing, transport, returns, and support, to see which ones actually make money.",
      "Lean Six Sigma (DMAIC)": "A structured Define, Measure, Analyze, Improve, Control cycle for cutting waste and variation out of a repeatable process such as loading or sorting.",
      "FMCSA and USDOT registration compliance": "The federal registration, operating authority, insurance, and safety-monitoring steps a US motor carrier or broker typically must clear, which you should verify locally and confirm with a licensed professional.",
    },
  },
};

// -----------------------------------------------------------------------------
// Telehealth Startup (business-of-clinic ONLY; distinct from the physical healthcare-clinic pack)
// -----------------------------------------------------------------------------
export const TELEHEALTH_PACK: PackBlueprint = {
  packId: "telehealth-startup",
  packTitle: "Telehealth Startup",
  emoji: "💻",
  tagline: "Build and run a virtual-care company: the platform, patient acquisition, provider operations, billing, and compliance basics.",
  tier: "pro",
  team: ["Product Manager", "Technical Lead", "Operations Manager", "Legal Counsel", "Finance Analyst", "Customer Success Manager", "Growth Marketer", "Data Analyst"],
  addOnRoles: ["Content Writer", "SEO Specialist", "UX Designer", "Backend Developer", "HR Specialist"],
  direction: {
    whatBuilding: "A virtual-care company: the telehealth platform and the operations that connect patients with licensed providers for remote visits, whether live (synchronous) or store-and-forward (asynchronous). This team builds and runs the business side: the software, patient acquisition, provider-network operations, billing, and the compliance groundwork. All clinical care, protocols, and standards of care are delivered and owned by your licensed clinicians and medical director, not by this team.",
    whyMatters: "Virtual care can widen access, cut travel and wait times, and lower the cost of routine visits, but only if the business behind it is trustworthy, compliant, and financially sound. Patients decide on trust and convenience, providers decide on ease and coverage, and payers decide on correct billing, so the operation has to earn all three. Getting the compliance, reimbursement, and experience foundations right early is what separates a durable clinic from one that stalls.",
    whoFor: "A founder-operator standing up a telehealth business who needs the platform, patient funnel, provider operations, and compliance scaffolding in one place. It serves patients in the states where your clinicians are licensed and the providers who deliver care on your platform. It is not a source of medical advice: those decisions stay with licensed clinicians.",
  },
  roleBriefs: {
    "Product Manager": "Owns the virtual-care product: the visit flow, scheduling, and patient journey, prioritizing what to build with RICE and Jobs to be Done. Keeps the roadmap pointed at access and trust, never at clinical decisions, which stay with your clinicians.",
    "Technical Lead": "Owns the platform architecture and the technical safeguards that keep patient data protected, mapped to HIPAA Security Rule considerations and verified with a compliance professional. Builds the visit, scheduling, and integration layer to be reliable and auditable.",
    "Operations Manager": "Runs provider-network operations: coordinating credentialing and privileging, scheduling, and provider coverage so visits happen smoothly. Coordinates clinical scope and licensure with your medical director and licensed clinicians, who own those decisions.",
    "Legal Counsel": "Frames the compliance landscape (HIPAA, HITECH, state telehealth and licensure rules, informed consent, business associate agreements) as typical considerations to verify with healthcare counsel. Flags risk early: this is not legal advice and never a substitute for your own attorney.",
    "Finance Analyst": "Models the money: reimbursement and cash-pay pricing, telehealth billing considerations, and the unit economics of each visit including LTV to CAC. Frames coding and payer questions as considerations to confirm with a billing professional, not as billing guidance.",
    "Customer Success Manager": "Owns the patient experience end to end: intake, the informed-consent workflow, first-visit onboarding, retention, and NPS. Turns a smooth, trustworthy experience into loyalty and referrals.",
    "Growth Marketer": "Owns patient acquisition across your licensed states, building the healthcare patient-acquisition funnel from awareness to a booked visit. Optimizes trust signals and the booking flow while respecting healthcare advertising and privacy rules.",
    "Data Analyst": "Instruments the business: acquisition funnel, activation, retention cohorts, and experience metrics like NPS, using AARRR as the scoreboard. Reports on business quality only; clinical quality measures stay owned by clinicians.",
  },
  stages: STAGES,
  documents: [
    { key: "virtual-care-business-plan", type: "business-plan", title: "Virtual Care Business Plan", description: "The case for the business: who you serve, in which states, the care model, and how you make money.", role: "Product Manager", stage: "prerequisites" },
    { key: "compliance-considerations-checklist", type: "legal-checklist", title: "Compliance Considerations Checklist", description: "A plain-language checklist of typical HIPAA, HITECH, state-licensure, and consent considerations to verify with healthcare counsel, not legal advice.", role: "Legal Counsel", stage: "prerequisites" },
    { key: "telehealth-market-research", type: "market-research", title: "Telehealth Market Research", description: "A scan of patient demand, competitors, and pricing norms in your target states to size the opportunity.", role: "Data Analyst", stage: "prerequisites" },
    { key: "reimbursement-and-unit-economics-model", type: "financial-model", title: "Reimbursement and Unit Economics Model", description: "A model of visit revenue, reimbursement and cash-pay assumptions, costs, and the LTV to CAC ratio per patient.", role: "Finance Analyst", stage: "prerequisites" },
    { key: "platform-prd", type: "prd", title: "Telehealth Platform PRD", description: "The product requirements for the visit flow, scheduling, and patient-record handling the team will build.", role: "Product Manager", stage: "build" },
    { key: "platform-security-architecture", type: "tech-spec", title: "Platform Security Architecture", description: "The technical design for protecting patient data, mapped to HIPAA Security Rule safeguards and to be verified with a compliance professional.", role: "Technical Lead", stage: "build" },
    { key: "provider-network-operations-sop", type: "sop", title: "Provider Network Operations SOP", description: "The standard operating procedure for coordinating credentialing, scheduling, and provider coverage, with clinical decisions owned by your medical director.", role: "Operations Manager", stage: "build" },
    { key: "patient-intake-and-consent-workflow", type: "process-doc", title: "Patient Intake and Consent Workflow", description: "The step-by-step patient intake and informed-consent flow, with consent language to be verified with counsel.", role: "Customer Success Manager", stage: "build" },
    { key: "patient-acquisition-gtm", type: "gtm-plan", title: "Patient Acquisition Go-To-Market", description: "The plan to reach and convert patients across your licensed states through the healthcare acquisition funnel.", role: "Growth Marketer", stage: "launch" },
    { key: "patient-landing-page-copy", type: "landing-copy", title: "Patient Landing Page Copy", description: "Trust-first landing page and booking copy that explains the service without making clinical claims.", role: "Growth Marketer", stage: "launch" },
    { key: "patient-experience-and-retention-emails", type: "email-sequence", title: "Patient Experience and Retention Emails", description: "A welcome, follow-up, and re-engagement email sequence plus an NPS check-in to keep patients coming back.", role: "Customer Success Manager", stage: "grow" },
    { key: "care-experience-and-quality-dashboard", type: "data-report", title: "Care Experience and Business Quality Dashboard", description: "A dashboard of business-quality metrics like funnel, retention, and NPS, with clinical quality measures owned by clinicians.", role: "Data Analyst", stage: "grow" },
  ],
  tasks: [
    { title: "Define the virtual-care business model and initial licensed states", description: "Decide who you serve, the synchronous or asynchronous care model, the states you can operate in, and how the business earns money.", role: "Product Manager", stage: "prerequisites", priority: "high", producesDocKey: "virtual-care-business-plan" },
    { title: "Map HIPAA, state-licensure, and consent considerations to verify with counsel", description: "List the typical HIPAA, HITECH, state telehealth, and informed-consent considerations and note what must be confirmed with healthcare counsel.", role: "Legal Counsel", stage: "prerequisites", priority: "urgent", producesDocKey: "compliance-considerations-checklist" },
    { title: "Research the telehealth market, competitors, and patient demand", description: "Size demand, map competitors, and gather pricing and reimbursement norms in your target states.", role: "Data Analyst", stage: "prerequisites", priority: "medium", producesDocKey: "telehealth-market-research" },
    { title: "Model reimbursement, cash-pay pricing, and unit economics", description: "Build the per-visit economics, reimbursement and cash-pay assumptions, and the LTV to CAC ratio, framing billing questions as considerations to confirm with a billing professional.", role: "Finance Analyst", stage: "prerequisites", priority: "high", producesDocKey: "reimbursement-and-unit-economics-model" },
    { title: "Coordinate with your medical director on clinical scope, licensure, and standards of care", description: "Set up the working relationship where your medical director and licensed clinicians define and own clinical scope, licensure, and standards of care.", role: "Operations Manager", stage: "prerequisites", priority: "urgent" },
    { title: "Write the telehealth platform PRD", description: "Specify the visit flow, scheduling, and patient-record handling the platform needs, prioritized with RICE.", role: "Product Manager", stage: "build", priority: "high", producesDocKey: "platform-prd" },
    { title: "Specify platform security architecture aligned to HIPAA Security Rule safeguards", description: "Design the administrative, physical, and technical safeguards for patient data and note what to verify with a compliance professional.", role: "Technical Lead", stage: "build", priority: "high", producesDocKey: "platform-security-architecture" },
    { title: "Draft the provider-network operations SOP", description: "Document how you coordinate credentialing and privileging, scheduling, and coverage, with credentialing decisions owned by your medical director.", role: "Operations Manager", stage: "build", priority: "high", producesDocKey: "provider-network-operations-sop" },
    { title: "Design the patient intake and informed-consent workflow", description: "Map the intake steps and the informed-consent flow, with consent language to be verified with counsel.", role: "Customer Success Manager", stage: "build", priority: "medium", producesDocKey: "patient-intake-and-consent-workflow" },
    { title: "Set up business associate agreements and vendor data-handling review", description: "Identify vendors that touch patient data and prepare the business associate agreement and data-handling questions to review with counsel.", role: "Legal Counsel", stage: "build", priority: "high" },
    { title: "Launch patient acquisition across your licensed states", description: "Stand up the acquisition funnel from awareness to a booked visit, respecting healthcare advertising and privacy rules.", role: "Growth Marketer", stage: "launch", priority: "high", producesDocKey: "patient-acquisition-gtm" },
    { title: "Write and ship the patient landing page and booking copy", description: "Publish trust-first landing and booking copy that describes the service without clinical claims.", role: "Growth Marketer", stage: "launch", priority: "medium", producesDocKey: "patient-landing-page-copy" },
    { title: "Stand up analytics for the patient-acquisition funnel and activation", description: "Instrument AARRR-style tracking so you can see acquisition, activation, and first-visit conversion.", role: "Data Analyst", stage: "launch", priority: "medium" },
    { title: "Build patient retention and re-engagement emails with an NPS survey", description: "Create the welcome, follow-up, and win-back sequence and an NPS check-in to measure and grow loyalty.", role: "Customer Success Manager", stage: "grow", priority: "medium", producesDocKey: "patient-experience-and-retention-emails" },
    { title: "Build the care-experience and business-quality dashboard", description: "Assemble business-quality metrics like funnel, retention, and NPS, keeping clinical quality measures owned by clinicians.", role: "Data Analyst", stage: "grow", priority: "medium", producesDocKey: "care-experience-and-quality-dashboard" },
  ],
  playbook: {
    field: "Virtual-care business operations (non-clinical)",
    primer: "A strong telehealth operator runs the business of care, not the care itself: they obsess over access, trust, and a clean patient journey, while licensed clinicians and the medical director own every clinical decision. They treat compliance as a design constraint from day one, not a bolt-on, and they watch the cost and reimbursement of each visit as closely as the patient experience. Durable growth comes from earning trust across the acquisition funnel and keeping patients through a reliable, well-run experience.",
    frameworks: ["HIPAA Privacy Rule", "HIPAA Security Rule", "HITECH Breach Notification Rule", "Informed consent for telehealth", "Provider credentialing and privileging", "Synchronous versus asynchronous care", "IHI Triple Aim", "Telehealth CPT coding and modifiers", "LTV to CAC ratio", "Healthcare patient-acquisition funnel", "AARRR Pirate Metrics", "Net Promoter Score", "Jobs to be Done", "RICE prioritization"],
    groups: [
      { label: "Compliance and safety guardrails (own these with counsel and clinicians)", frameworks: ["HIPAA Privacy Rule", "HIPAA Security Rule", "HITECH Breach Notification Rule", "Informed consent for telehealth", "Provider credentialing and privileging"] },
      { label: "Care model and delivery", frameworks: ["Synchronous versus asynchronous care", "IHI Triple Aim"] },
      { label: "Reimbursement and unit economics", frameworks: ["Telehealth CPT coding and modifiers", "LTV to CAC ratio"] },
      { label: "Patient acquisition and experience", frameworks: ["Healthcare patient-acquisition funnel", "AARRR Pirate Metrics", "Net Promoter Score", "Jobs to be Done", "RICE prioritization"] },
    ],
    glosses: {
      "HIPAA Privacy Rule": "The federal rule that sets who may see or share a patient's health information and the minimum-necessary principle for using it.",
      "HIPAA Security Rule": "The federal rule requiring administrative, physical, and technical safeguards to protect electronic patient health information.",
      "HITECH Breach Notification Rule": "The rule that requires notifying patients, regulators, and sometimes the media when unsecured health information is breached.",
      "Informed consent for telehealth": "Getting a patient's documented agreement to be treated over telehealth before the visit, with requirements that vary by state.",
      "Provider credentialing and privileging": "Verifying a clinician's qualifications and defining what they are authorized to do, owned with your medical director.",
      "Synchronous versus asynchronous care": "Live audio or video visits versus store-and-forward messaging where information is shared and reviewed at different times.",
      "IHI Triple Aim": "A healthcare improvement lens balancing patient experience, population health, and per-person cost, used here for business framing only.",
      "Telehealth CPT coding and modifiers": "The billing codes and modifiers, like place-of-service and audio-only indicators, used to bill telehealth visits, to confirm with a billing professional.",
      "LTV to CAC ratio": "Lifetime value of a patient compared to what it costs to acquire them, a core test of whether the business is sustainable.",
      "Healthcare patient-acquisition funnel": "The stages patients move through from awareness to consideration to a booked visit and then retention.",
      "AARRR Pirate Metrics": "A five-stage scoreboard, acquisition, activation, retention, referral, revenue, for tracking product and business health.",
      "Net Promoter Score": "A loyalty measure based on how likely patients are to recommend you, scored as promoters minus detractors.",
      "Jobs to be Done": "The idea that people hire a product to do a specific job, so you design around the real need, not the demographic.",
      "RICE prioritization": "A way to rank what to build by Reach, Impact, Confidence, and Effort so effort goes to the highest-value work.",
    },
  },
};

/** All Batch 2 packs, spread into PACK_BLUEPRINTS by packBlueprints.ts. */
export const BATCH2_PACKS: PackBlueprint[] = [WEB3_PACK, AGTECH_PACK, LOGISTICS_PACK, TELEHEALTH_PACK];
