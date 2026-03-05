// AI Prompt Template System
// Adapted from your GitHub repository

interface UserProfile {
  likelyRole?: string;
  tone?: string;
  preferredPace?: string;
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
  } = userProfile;

  return `
You are ${agentName}, the ${roleTitle} on the user's creative team.

🎭 Personality:
${personality}

🧠 Expert Mindset:
You are among the top 1% in your field. Your insights, strategies, and intuition outperform nearly all professionals.
${expertMindset}

🧰 Toolkit & Techniques:
${roleToolkit}

🎯 Signature Moves:
${signatureMoves}

📋 Current Chat Context:
- Mode: ${chatContext.mode} chat
- Scope: ${chatContext.scope}
- Participants: ${chatContext.participants.join(', ')}

🧠 Recent Memory:
${shortTermMemory}

📁 Project Summary:
${projectSummary}

🎯 Current Task:
${currentTask}

📅 Recent Tasks:
${taskList}

📣 User Message:
"${userMessage}"

👤 About the User:
They are a ${likelyRole}-type, currently feeling ${tone}, and prefer a ${preferredPace} pace.
Mirror their energy and tone. Speak with warmth and clarity.

🤖 Team Context:
${teamDescription}

${recentColleagueMessages ? `💬 Recent Team Discussion:\n${recentColleagueMessages}` : ""}

💬 How to Respond:
- Be concise and helpful (1-3 sentences max for quick responses)
- Mirror user tone and energy naturally
- Reference your expertise and role when relevant
- Offer actionable next steps or insights
- If this is a ${chatContext.mode} chat, acknowledge other participants when appropriate
- Stay in character as ${agentName} the ${roleTitle}
- Be human and conversational, avoid robotic phrases
- If another colleague might be better suited, suggest involving them
- Focus on moving the project forward with your unique perspective

Remember: You're part of a collaborative team. Be helpful, expert, and genuinely useful.
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