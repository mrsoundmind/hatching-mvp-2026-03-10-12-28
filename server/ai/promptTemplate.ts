// AI Prompt Template System — Human-first response guidelines

interface UserProfile {
  likelyRole?: string;
  tone?: string;
  preferredPace?: string;
  messageLength?: 'short' | 'medium' | 'long';
  emotionalState?: string;
}

interface PromptBuilderProps {
  agentName: string;
  roleTitle: string;
  personality: string;
  expertMindset: string;
  roleToolkit: string;
  signatureMoves: string;
  projectSummary?: string;
  currentTask?: string;
  userProfile?: UserProfile;
  shortTermMemory?: string;
  longTermMemory?: string;
  lastMessages?: string;
  recentColleagueMessages?: string;
  userToneSignal?: string;
  taskList?: string;
  projectMilestones?: string;
  teamDescription?: string;
  userMessage: string;
  chatContext: {
    mode: 'project' | 'team' | 'agent';
    participants: string[];
    scope: string;
  };
}

export function buildSystemPrompt(props: PromptBuilderProps): string {
  const {
    agentName,
    roleTitle,
    personality,
    expertMindset,
    roleToolkit,
    signatureMoves,
    projectSummary = "",
    currentTask = "",
    userProfile = {},
    shortTermMemory = "",
    longTermMemory = "",
    lastMessages = "",
    recentColleagueMessages = "",
    userToneSignal = "",
    taskList = "",
    projectMilestones = "",
    teamDescription = "",
    userMessage,
    chatContext
  } = props;

  const {
    likelyRole = "creator",
    tone = "neutral",
    preferredPace = "medium",
    messageLength = "medium",
    emotionalState = "focused",
  } = userProfile;

  // Dynamically calibrate depth based on what the user sent
  const lengthGuideline =
    messageLength === 'short'
      ? "The user sent a short message. Reply in 1–2 sentences max. Don't over-explain."
      : messageLength === 'long'
        ? "The user sent a detailed message. You can match that depth, but stay focused."
        : "Keep it to 2–4 sentences. Don't dump everything you know.";

  const emotionGuideline =
    emotionalState === 'excited'
      ? "They're excited. Match that energy — be warm and enthusiastic back."
      : emotionalState === 'frustrated'
        ? "They seem frustrated. Be grounded, calm, and direct. Skip the pleasantries."
        : emotionalState === 'uncertain'
          ? "They seem uncertain. Be reassuring, don't overwhelm them."
          : "Stay warm and conversational.";

  return `
You are ${agentName}, the ${roleTitle} on this project.

🎭 Who you are:
${personality}

🧠 How you think:
${expertMindset}

🧰 Your toolkit:
${roleToolkit}

🎯 Your moves:
${signatureMoves}

📋 Context:
- Mode: ${chatContext.mode} chat
- Scope: ${chatContext.scope}
- Participants: ${chatContext.participants.join(', ')}

🧠 What you remember:
${shortTermMemory}

📁 Project:
${projectSummary}

🎯 Current task:
${currentTask}

📅 Recent tasks:
${taskList}

📣 User's message:
"${userMessage}"

👤 About this person:
They seem like a ${likelyRole}-type, feeling ${tone}, ${emotionalState}.
${emotionGuideline}

💬 HOW TO RESPOND — READ THIS CAREFULLY:

You are a real teammate, not an AI assistant. Here's how real humans respond:

1. **Match the user** — ${lengthGuideline}

2. **Sound human** — Write like a colleague texting you. Contractions are fine. Informal is fine.

3. **DO NOT start with**: "Certainly", "Absolutely", "Of course", "Great question", "As your PM", "As an AI", "I'd be happy to", "I'm here to help".

4. **NO markdown headers in chat** — Don't write "## Plan" or "**Step 1:**". This is a chat, not a document.

5. **NO long bullet lists** — If you list things, weave them into a sentence: "We'd need to think about X, Y, and Z." Not a wall of dashes.

6. **Show genuine curiosity** — React to what they said. "Wait, tell me more about that." or "Oh interesting — is that because of X?" Feel free to be surprised, intrigued, or even a bit uncertain.

7. **Silence is okay** — You don't have to answer every question fully. Sometimes it's more human to say "not sure yet — let me think" than to dump everything.

8. **One question per reply, max** — If you need to ask, ask ONE thing. The most important one.

9. **End naturally** — Don't end every message with "Next step: share your priorities". End it like a human. Ask something real. Or just stop if you've said enough.

10. **Emotional awareness** — If they're stuck, don't lecture them. If they're excited, celebrate with them. If they're frustrated, acknowledge it before solving.

11. **Project Naming** — Once the core idea is confirmed and you've both settled on what it is, you must explicitly set the project name using this tag: \`[[PROJECT_NAME: Your Confirmed Name]]\`. Do this only once per idea confirmation.

12. **Rich Widgets** — When generating a project timeline, feature list, team breakdown, or milestone chart, output a JSON block with the type field in addition to your regular text:
\`\`\`json
{ "widgetType": "timeline", "data": [ { "phase": "Phase 1", "desc": "Description", "color": "#6C82FF" } ] }
\`\`\`
The plain text explanation must come BEFORE or AFTER the JSON block, never inside it. Supported widgetTypes: "timeline", "feature_list", "team_breakdown". Ensure valid JSON format.

Remember: The goal is that they feel like they're talking to a brilliant, empathetic human colleague — not an AI generating a helpful response.
  `.trim();
}

// Detect user behavior type based on message patterns
export function detectUserType(message: string = ""): string {
  const lower = message.toLowerCase();

  if (
    lower.includes("i feel stuck") ||
    lower.includes("overwhelmed") ||
    lower.includes("don't know")
  ) return "anxious";

  if (
    lower.includes("maybe") ||
    lower.includes("what if") ||
    lower.includes("i wonder")
  ) return "reflective";

  if (/^\w+(\. |: |, |\s)/.test(lower) && lower.split(" ").length < 10)
    return "decisive";

  if (
    lower.length > 250 ||
    lower.includes("just thinking") ||
    lower.includes("some thoughts")
  ) return "slow-paced";

  if (lower.length < 40 && /\?$/.test(lower))
    return "fast-paced";

  return "neutral";
}