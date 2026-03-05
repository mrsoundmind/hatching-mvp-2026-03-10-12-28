// server/ai/graph.ts
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { FOUNDATION } from "./foundation.js";

// ========= Enforceable tokens (match your Foundation "Meta" footer") =========
const CONNECT_STARTERS = /^(Heard|Got it|Noted|Understood|Noticing)\b[—:\.\s]?/i;
const NEXT_ACTION_LABELS = /(Next 10[- ]?minute move:|Smallest next action:|Next step:)/i;
const CONSENT_TRIGGER = /Proposed update\s*→.*Approve or edit\?/i;

// ========= Roles & names =========
export type Role =
  | "PM"
  | "UIUX"
  | "Engineer"
  | "Analyst"
  | "Growth"
  | "Ops"
  | "Legal"
  | "CS";

const ROLE_NAME: Record<Role, string> = {
  PM: "Project Manager",
  UIUX: "UI/UX",
  Engineer: "Engineer",
  Analyst: "Analyst",
  Growth: "Growth Marketer",
  Ops: "Operations",
  Legal: "Legal Counsel",
  CS: "Customer Success",
};

// ========= Routing cues =========
const KEYWORDS: Record<Role, RegExp> = {
  UIUX: /(ui\/?ux|ux|ui|figma|wireframe|prototype|flow|accessibility|heuristic|design|layout|typography|spacing|contrast)/i,
  Engineer: /(api|endpoint|backend|server|schema|database|react|next\.js|frontend|tailwind|typescript|build|deploy|bug|error|stack trace|latency|timeout)/i,
  Analyst: /(metric|funnel|cohort|dashboard|sql|query|a\/?b|experiment|analytics|retention|conversion|ga4|looker|dbt)/i,
  Growth: /(seo|sem|ads|cpc|cpm|roas|landing|copy|email|crm|campaign|utm|creative|social|tiktok|instagram|twitter|x|newsletter)/i,
  Ops: /(process|sop|raci|procure|vendor|sla|ops|inventory|workflow|automation|notion|zapier|airtable)/i,
  Legal: /(contract|terms|policy|privacy|gdpr|hipaa|license|ip|nda|dpa|compliance|kyc|aml)/i,
  CS: /(ticket|support|onboarding|renewal|churn|health score|sla|csat|nps|customer success|helpdesk)/i,
  PM: /.*/i, // fallback
};

const MENTION_TO_ROLE: Record<string, Role> = {
  pm: "PM", manager: "PM",
  ui: "UIUX", ux: "UIUX", design: "UIUX",
  eng: "Engineer", dev: "Engineer", backend: "Engineer", frontend: "Engineer",
  analyst: "Analyst", data: "Analyst",
  growth: "Growth", marketing: "Growth",
  ops: "Ops", operations: "Ops",
  legal: "Legal", counsel: "Legal",
  cs: "CS", support: "CS",
};

function detectRole(input: string, lastRole?: Role): Role {
  // 1) explicit @mentions or /route commands
  const mention = input.match(/(?:^|\s)@([a-z]+)\b/i)?.[1]?.toLowerCase();
  if (mention && MENTION_TO_ROLE[mention]) return MENTION_TO_ROLE[mention];

  const cmd = input.match(/(?:^|\/)route\s+([a-z]+)/i)?.[1]?.toLowerCase();
  if (cmd && MENTION_TO_ROLE[cmd]) return MENTION_TO_ROLE[cmd];

  // 2) keyword vote
  const scores: Partial<Record<Role, number>> = {};
  (Object.keys(KEYWORDS) as Role[]).forEach((r) => {
    if (r === "PM") return; // keep PM for fallback
    if (KEYWORDS[r].test(input)) scores[r] = (scores[r] ?? 0) + 1;
  });
  const best = Object.entries(scores).sort((a, b) => (b[1]! - a[1]!))?.[0]?.[0] as Role | undefined;
  if (best) return best;

  // 3) continuity (keep last non-PM speaker)
  if (lastRole && lastRole !== "PM") return lastRole;

  // 4) fallback
  return "PM";
}

// ========= Types & helpers =========
type Msg = { role: "system" | "user" | "assistant"; content: string };

type State = {
  user: string;           // current user message
  messages: Msg[];        // history (system/user/assistant)
  role: Role;             // selected role for this turn
  lastRole?: Role;        // last role that spoke (for continuity)
  needsConsent?: boolean; // flag for UI ("Approve or edit?")
  enablePeerNotes?: boolean; // config flag (default false)
};

const llm = new ChatOpenAI({ model: "gpt-4o-mini" }); // uses OPENAI_API_KEY

const toLC = (arr: Msg[] = []) =>
  arr.map((m) =>
    m.role === "system" ? new SystemMessage(m.content)
      : m.role === "assistant" ? new AIMessage(m.content)
        : new HumanMessage(m.content)
  );

function str(content: unknown): string {
  if (typeof content === "string") return content;
  // @ts-ignore LangChain message parts
  if (Array.isArray(content)) return content.map((c) => c?.text ?? "").join("\n");
  return String(content ?? "");
}

// ========= Peer-note suggestion (exactly one, optional) =========
function suggestPeerRole(primary: Role, textA: string, textB: string): Role | null {
  const blob = `${textA}\n${textB}`.toLowerCase();
  const roles: Role[] = ["UIUX", "Engineer", "Analyst", "Growth", "Ops", "Legal", "CS"];
  for (const r of roles) {
    if (r === primary) continue;
    if (KEYWORDS[r].test(blob)) return r;
  }
  return null;
}

// ========= Nodes =========
// Router — choose role (mentions > keywords > continuity > PM)
async function router(state: State): Promise<Partial<State>> {
  const role = detectRole(state.user.toLowerCase(), state.lastRole);
  return { role, lastRole: role };
}

// Hatch — inject Foundation+role, call LLM, validate style, (optional) peer note
async function hatch(state: State): Promise<Partial<State>> {
  const system = FOUNDATION.replace("{{ROLE}}", ROLE_NAME[state.role]);

  const msgs = [
    new SystemMessage(system),
    ...toLC(state.messages || []),
    new HumanMessage(state.user),
  ];

  const res = await llm.invoke(msgs);
  let reply = str(res.content).trim();

  // Enforce connect line + next action label
  const hasConnect = CONNECT_STARTERS.test(reply);
  const hasNext = NEXT_ACTION_LABELS.test(reply);

  if (!hasConnect || !hasNext) {
    const fix = await llm.invoke([
      new SystemMessage(
        "Rewrite this reply to include: 1) a human connect line that starts with one of {Heard, Got it, Noted, Understood, Noticing}; 2) a final line labeled exactly as one of {Next 10-minute move:, Smallest next action:, Next step:}. Keep it concise and natural. Do not add extra preambles."
      ),
      new HumanMessage(reply),
    ]);
    reply = str(fix.content).trim();
  }

  // Consent detection
  const needsConsent = CONSENT_TRIGGER.test(reply);

  // Optional peer note (one, concise, advisory)
  let finalReply = reply;
  if (state.enablePeerNotes) {
    const peer = suggestPeerRole(state.role, state.user, reply);
    if (peer) {
      const peerResp = await llm.invoke([
        new SystemMessage(
          `You are the ${ROLE_NAME[peer]} Hatch. Provide a single advisory peer note (1–2 lines, max 35 words). Do not derail the main answer. No greetings, no plan, no repetition. Start exactly with: "Peer note (${ROLE_NAME[peer]}): "`
        ),
        new HumanMessage(
          `User message:\n${state.user}\n\nMain reply to append a note to:\n${reply}\n\nWrite the one-line peer note now.`
        ),
      ]);
      const note = str(peerResp.content).trim();
      // Basic safety: ensure correct prefix
      const safeNote = note.startsWith(`Peer note (${ROLE_NAME[peer]}):`)
        ? note
        : `Peer note (${ROLE_NAME[peer]}): ${note}`;
      finalReply = `${reply}\n\n${safeNote}`;
    }
  }

  return {
    messages: [...(state.messages || []), { role: "assistant", content: finalReply }],
    needsConsent,
    lastRole: state.role,
  };
}

// Consent gate — just flags; UI handles approval & next turn
async function consent(_state: State): Promise<Partial<State>> {
  return {};
}

// ========= Graph =========
// @ts-ignore - langgraph typing mismatch
const sg = new StateGraph({
  channels: {
    user: { value: (x: string) => x },
    messages: { value: (x: any[]) => x },
    role: { value: (x: string) => x },
    lastRole: { value: (x: string | undefined) => x },
    needsConsent: { value: (x: boolean | undefined) => x },
    enablePeerNotes: { value: (x: boolean | undefined) => x }
  }
})
  .addNode("router", router)
  .addNode("hatch", hatch)
  .addNode("consent", consent)
  .addEdge(START, "router")
  .addConditionalEdges("router", () => "hatch", { hatch: "hatch" })
  .addEdge("hatch", "consent")
  .addEdge("consent", END);

export const graph = sg.compile({ checkpointer: new MemorySaver() });

// Call this from your API
export async function runTurn(args: {
  threadId: string;
  user: string;
  history?: Msg[];
  enablePeerNotes?: boolean;
}) {
  const result = await graph.invoke(
    {
      user: args.user,
      messages: args.history ?? [],
      role: "PM",                // router will overwrite
      lastRole: undefined,       // continuity gets set automatically
      enablePeerNotes: !!args.enablePeerNotes,
    },
    { configurable: { thread_id: args.threadId } } // per-thread memory
  );

  const outMsgs = (result as any).messages as Msg[];
  const last = outMsgs[outMsgs.length - 1];

  return {
    messages: outMsgs,
    reply: last?.content ?? "",
    needsConsent: !!(result as any).needsConsent,
  };
}