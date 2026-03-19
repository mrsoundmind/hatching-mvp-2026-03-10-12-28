import { Client } from "langsmith";
import { roleProfiles } from './roleProfiles.js';
import { trainingSystem } from './trainingSystem.js';
import { executeColleagueLogic } from './colleagueLogic.js';
import { UserBehaviorAnalyzer, type UserBehaviorProfile, type MessageAnalysis } from './userBehaviorAnalyzer.js';
import { personalityEngine } from './personalityEvolution.js';
import {
  generateChatWithRuntimeFallback,
  getCurrentRuntimeConfig,
  streamChatWithRuntimeFallback,
} from '../llm/providerResolver.js';
import type { LLMResponseMetadata } from '../llm/providerTypes.js';
import { loadRoleBrain, renderRoleBrainContext } from '../knowledge/roleBrains/loader.js';
import { getCharacterProfile } from './characterProfiles.js';
import { loadRoleSkillsWithUpdates } from '../knowledge/skillUpdates/skillUpdateStore.js';
import { extractAndStoreMemory } from './memoryExtractor.js';
import { detectEmotionalState } from './responsePostProcessing.js';

export class OpenAIConfigurationError extends Error {
  code: string;

  constructor(message = 'OpenAI is not configured. Set OPENAI_API_KEY and restart the server.') {
    super(message);
    this.name = 'OpenAIConfigurationError';
    this.code = 'OPENAI_API_KEY_MISSING';
  }
}

// Initialize LangSmith client for tracing
const langsmith = process.env.LANGSMITH_API_KEY ? new Client({
  apiKey: process.env.LANGSMITH_API_KEY,
}) : null;

interface ChatContext {
  mode: 'project' | 'team' | 'agent';
  projectName: string;
  projectId?: string;
  conversationId?: string;
  teamName?: string;
  agentRole: string;
  agentId?: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    senderId?: string;
    messageType?: 'user' | 'agent';
  }>;
  userId?: string;
  // P3 — Project context injected from routes.ts
  projectDirection?: { whatBuilding?: string | null; whyMatters?: string | null; whoFor?: string | null } | null;
  teamMembers?: Array<{ name: string; role: string }> | null;
  projectMemories?: string | null;
  userDesignation?: string | null;
  // GAP-8: Role of the last agent who spoke (enables handoff acknowledgment)
  handoffFrom?: string | null;
  // P3: Injected by routes.ts to enable real memory storage (fire-and-forget)
  createConversationMemory?: (data: { conversationId: string; memoryType: string; content: string; importance: number; agentId?: string | null }) => Promise<unknown>;
}

interface ColleagueResponse {
  content: string;
  reasoning?: string;
  confidence: number;
  metadata?: LLMResponseMetadata;
}

function resolveRuntimeModel(preferred?: string): string | undefined {
  const runtime = getCurrentRuntimeConfig();
  if (runtime.provider !== 'openai') {
    // In test modes, let providerResolver inject provider-specific defaults (ollama/mock).
    return undefined;
  }
  return preferred || process.env.OPENAI_MODEL || runtime.model || 'gpt-4o-mini';
}

// B1.1: Add streaming response generation with LangSmith tracing
export async function* generateStreamingResponse(
  userMessage: string,
  agentRole: string,
  context: ChatContext,
  sharedMemory?: string,
  abortSignal?: AbortSignal,
  onMetadata?: (metadata: LLMResponseMetadata) => void
): AsyncGenerator<string, void, unknown> {
  let runId: string | null = null;

  try {
    // Start LangSmith trace for streaming response
    if (langsmith) {
      try {
        const run = await langsmith.createRun({
          name: `Streaming Response - ${agentRole}`,
          run_type: "chain",
          inputs: {
            userMessage,
            agentRole,
            context: {
              mode: context.mode,
              projectName: context.projectName,
              teamName: context.teamName
            },
            sharedMemory: sharedMemory || "None"
          },
          project_name: process.env.LANGSMITH_PROJECT || "hatchin-chat"
        });
        runId = (run as any)?.id;
      } catch (error) {
        console.warn('LangSmith trace failed, continuing without tracing:', (error as any).message);
        runId = null;
      }
    }

    // B2.1: Analyze user behavior from conversation history
    let userBehaviorProfile: UserBehaviorProfile | null = null;
    let messageAnalysis: MessageAnalysis | null = null;
    let personalityPrompt = '';

    if (context.userId && context.conversationHistory.length > 0) {
      // Bug 5 fix: always use bare agentId as key (never composite projectId:agentId)
      const personalityIdentity = context.agentId || agentRole;

      const messagesForAnalysis = context.conversationHistory.map(msg => ({
        content: msg.content,
        messageType: (msg.role === 'user' ? 'user' : 'agent') as 'user' | 'agent',
        timestamp: msg.timestamp,
        senderId: msg.senderId || (msg.role === 'user' ? context.userId! : agentRole)
      }));

      messagesForAnalysis.push({
        content: userMessage,
        messageType: 'user',
        timestamp: new Date().toISOString(),
        senderId: context.userId
      });

      userBehaviorProfile = UserBehaviorAnalyzer.analyzeUserBehavior(messagesForAnalysis, context.userId);
      messageAnalysis = UserBehaviorAnalyzer.analyzeMessage(userMessage, new Date().toISOString());

      // B4.1: Adapt personality based on user behavior
      if (userBehaviorProfile && messageAnalysis) {
        personalityEngine.adaptPersonalityFromBehavior(personalityIdentity, context.userId, userBehaviorProfile, messageAnalysis);
        personalityPrompt = personalityEngine.generatePersonalityPrompt(personalityIdentity, context.userId);
      }
    }

    const logicResult = executeColleagueLogic(agentRole, userMessage);
    const roleProfile = roleProfiles[agentRole] || roleProfiles['Product Manager'];
    const roleBrain = await loadRoleBrain(agentRole);
    const roleBrainContext = renderRoleBrainContext(roleBrain);

    // Use the same prompt architecture as non-streaming responses for consistency
    const basePrompt = createPromptTemplate({
      role: agentRole,
      userMessage,
      context: {
        chatMode: context.mode,
        projectName: context.projectName,
        teamName: context.teamName,
        recentMessages: context.conversationHistory.slice(-15) // P3: extended from 5 → 15
      },
      roleProfile,
      userBehaviorProfile,
      messageAnalysis
    });

    const enhancedPrompt = trainingSystem.generateEnhancedPrompt(agentRole, userMessage, basePrompt.systemPrompt);

    // P1: Character voice injection
    const characterProfile = getCharacterProfile(agentRole);
    const characterSection = characterProfile ? `\n--- CHARACTER VOICE ---\n${characterProfile.voicePrompt}\nVerbal tendencies: ${characterProfile.tendencies.join('. ')}\nNever say: ${characterProfile.neverSays.slice(0, 3).join(', ')}\n--- END CHARACTER VOICE ---` : '';

    // GAP 2: Emotional signature injection
    const currentEmotionalState = detectEmotionalState(userMessage);
    const emotionalSignatureMap: Record<string, keyof NonNullable<typeof characterProfile>['emotionalSignature']> = {
      'excited': 'excited',
      'frustrated': 'challenged',
      'uncertain': 'uncertain',
      'casual': 'celebrating', // no direct match, skip
      'focused': 'excited',    // no direct match, skip
    };
    const sigKey = emotionalSignatureMap[currentEmotionalState];
    const emotionalSignaturePhrase = characterProfile?.emotionalSignature?.[sigKey];
    const emotionalSignatureSection = (emotionalSignaturePhrase && (currentEmotionalState === 'excited' || currentEmotionalState === 'frustrated' || currentEmotionalState === 'uncertain'))
      ? `\n--- EMOTIONAL RESONANCE ---\nUser's current state: ${currentEmotionalState}.\nYour authentic character response for this state: "${emotionalSignaturePhrase}"\nLet this inform your energy and word choice naturally — don't quote it directly.\n--- END EMOTIONAL RESONANCE ---`
      : '';

    // P1: Practitioner skills injection (base Canon + living updates merged)
    const skillsSection = `\n--- PRACTITIONER SKILLS ---\n${loadRoleSkillsWithUpdates(agentRole)}\n--- END PRACTITIONER SKILLS ---`;

    // P3: Project context injection
    const projectContextSection = context.projectDirection ? `\n--- PROJECT CONTEXT ---\nBuilding: ${context.projectDirection.whatBuilding || 'Not specified'}\nFor: ${context.projectDirection.whoFor || 'Not specified'}\nWhy it matters: ${context.projectDirection.whyMatters || 'Not specified'}${context.teamMembers?.length ? `\nTeam: ${context.teamMembers.map(a => `${a.name} (${a.role})`).join(', ')}` : ''}\n--- END PROJECT CONTEXT ---` : '';

    // P3: Project memory injection (cross-agent, cross-session facts)
    const projectMemorySection = context.projectMemories ? `\n--- PROJECT MEMORY ---\nThings established in this project:\n${context.projectMemories}\n--- END PROJECT MEMORY ---` : '';

    // GAP 6: Open question surfacing — surface unresolved questions separately
    const openQuestionsSection = context.projectMemories && context.projectMemories.includes('Open question:')
      ? (() => {
          const openQs = context.projectMemories!
            .split('\n')
            .filter((l: string) => l.includes('Open question:'))
            .slice(0, 2)
            .join('\n');
          return openQs
            ? `\n--- OPEN THREADS ---\nPreviously unresolved questions from this project:\n${openQs}\nIf the user's current message relates to one of these, you can reference it naturally.\n--- END OPEN THREADS ---`
            : '';
        })()
      : '';

    // P6: User designation injection
    const userDesignationSection = context.userDesignation ? `\n--- USER CONTEXT ---\nThe user's role on this project: ${context.userDesignation}\nCalibrate your explanations, assumptions, and collaboration style for someone in this role.\n--- END USER CONTEXT ---` : '';

    // GAP 8: Handoff acknowledgment — when routed from another agent
    const handoffSection = context.handoffFrom
      ? `\n--- HANDOFF ---\nYou were just looped in from ${context.handoffFrom}. Acknowledge this naturally in your opening — "Alex was right to bring me in here..." or "Good call from the PM side — let me look at this from the ${agentRole} angle..." Keep it brief (half a sentence). Don't make it formal or announce it; just weave it in naturally.\n--- END HANDOFF ---`
      : '';

    // GAP 4: First-message opener intelligence
    const isFirstMessage = context.conversationHistory.length === 0;
    const hasProjectContext = !!(context.projectDirection?.whatBuilding || context.projectMemories);
    const firstMessageSection = (isFirstMessage && hasProjectContext)
      ? `\n--- FIRST MESSAGE ---\nThis is the FIRST exchange with this user. You already know their project from context above. Open by demonstrating you've absorbed it — reference something specific before responding to their question. Make them feel you've been waiting to work on this together.\n--- END FIRST MESSAGE ---`
      : '';

    // GAP 5: Opinion and disagreement instruction
    const opinionSection = `\n--- CONVICTION ---\nWhen you see a decision with clear risks or a better alternative, say so once, briefly, without lecturing. "That could work, but here's what I'd watch for..." is more valuable than agreement. Real teammates push back. Don't manufacture disagreement — but don't suppress genuine ones either.\n--- END CONVICTION ---`;

    // Build Maya-specific or generic Hatch intelligence instructions
    const isMaya = agentRole === 'AI Idea Partner' || agentRole === 'Maya';
    const conversationTurnCount = context.conversationHistory.length;

    const mayaTeamSuggestionInstructions = isMaya && conversationTurnCount >= 2 ? `
--- MAYA: TEAM AUTO-HATCH INTELLIGENCE ---
You are Maya, an AI Idea Partner. You have been analyzing the user's idea across the conversation.
If you now have enough context to suggest what kind of team the user needs (e.g., a designer, a developer, a marketer), append the following block AT THE VERY END of your response, AFTER all your conversational text. This block will be hidden from the user automatically.

Format (replace example values with real recommendations based on the user's idea):
<!--HATCH_SUGGESTION:{"teams":[{"name":"Core Team","emoji":"⭐","agents":[{"name":"Alex","role":"Product Designer","color":"orange"},{"name":"Sam","role":"Backend Developer","color":"blue"}]}],"trigger":"user_agreement"}-->

Important rules:
- ONLY include this block if you genuinely have enough context to make a real recommendation.
- ALWAYS mention to the user in plain text first: "Based on what you've described, I'd suggest building a team with [X, Y, Z]. Should I add them to your project?"
- Use realistic role names that match the idea (e.g., for a food app: Product Designer, Backend Developer, Marketing Strategist).
- Maximum 3-4 agents total across all teams.
--- END MAYA TEAM INTELLIGENCE ---
` : '';

    const hatchTaskInstructions = !isMaya ? `
--- HATCH TASK INTELLIGENCE ---
You can suggest creating tasks in the project's task list. When your response includes a clear, actionable next step that should be tracked, append this block AT THE VERY END of your response. It will be hidden from the user automatically.

Format:
<!--TASK_SUGGESTION:{"title":"<concise task name>","priority":"<low|medium|high>","assignee":"<your name>"}-->

Important rules:
- ONLY suggest a task if it is genuinely a trackable action item (not vague advice).
- ALWAYS mention it in plain text first: "Should I add this to your task list?" or "I can track this as a task — want me to?"
--- END HATCH TASK INTELLIGENCE ---

--- HATCH BRAIN UPDATE INTELLIGENCE ---
You can suggest updating the Project Brain with key insights you've learned. Only offer this after a substantive discussion (5+ meaningful exchanges).

Format:
<!--BRAIN_UPDATE:{"field":"coreDirection","value":"<concise description>"}-->

Valid fields: coreDirection, executionRules, teamCulture, goals, summary.

Important rules:
- ONLY suggest an update when you have genuinely learned something significant about the project.
- ALWAYS ask first: "I think I have a good picture of [X]. Should I update the Project Brain with this?"
--- END HATCH BRAIN UPDATE INTELLIGENCE ---
` : '';

    // Create system prompt based on role and context
    const systemPrompt = `${enhancedPrompt}
${characterSection}
${emotionalSignatureSection}
${skillsSection}
${projectContextSection}
${projectMemorySection}
${openQuestionsSection}
${userDesignationSection}
${handoffSection}
${firstMessageSection}
${sharedMemory ? `\n--- SHARED PROJECT MEMORY ---\n${sharedMemory}\n--- END MEMORY ---\n` : ''}

${personalityPrompt}

--- ROLE BRAIN ---
${roleBrainContext}
--- END ROLE BRAIN ---

${opinionSection}
${mayaTeamSuggestionInstructions}
${hatchTaskInstructions}

Respond as this specific role with appropriate expertise and personality. Keep responses concise and actionable.`;

    const streamResult = await streamChatWithRuntimeFallback({
      model: resolveRuntimeModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: basePrompt.userPrompt }
      ],
      temperature: 0.7,
      maxTokens: userBehaviorProfile?.communicationStyle === 'anxious' ? 150 : 500,
      timeoutMs: Number(process.env.HARD_RESPONSE_TIMEOUT_MS || 45000),
      seed: process.env.LLM_MODE === "test" ? 42 : undefined,
    });

    onMetadata?.(streamResult.metadata);

    // Stream the response word by word
    let fullResponse = '';
    for await (const chunk of streamResult.stream) {
      if (abortSignal?.aborted) {
        break;
      }
      fullResponse += chunk;
      yield chunk;
    }

    // P3: Fire-and-forget memory extraction — never awaited, never blocks streaming
    if (context.projectId && context.conversationId && context.userId && fullResponse.length > 20) {
      extractAndStoreMemory(
        {
          projectId: context.projectId,
          conversationId: context.conversationId,
          userMessage,
          agentResponse: fullResponse,
          agentRole,
          userId: context.userId,
        },
        {
          createConversationMemory: context.createConversationMemory ?? (async () => {}),
        }
      ).catch(() => { /* fire-and-forget — never throw */ });
    }

    // Update LangSmith trace with successful streaming response
    if (langsmith && runId) {
      try {
        await langsmith.updateRun(runId, {
          outputs: {
            response: fullResponse,
            method: "streaming",
            confidence: calculateConfidence(fullResponse, userMessage, roleProfile),
            tokens: fullResponse.length
          }
        });
      } catch (error) {
        console.warn('LangSmith update failed:', (error as any).message);
      }
    }

    console.log(`✅ ${streamResult.metadata.provider} streaming completed, total length:`, fullResponse.length);
  } catch (error: any) {
    // Update LangSmith trace with error
    if (langsmith && runId) {
      try {
        await langsmith.updateRun(runId, {
          outputs: {
            error: (error as any).message,
            method: "streaming"
          }
        });
      } catch (updateError) {
        console.warn('LangSmith error update failed:', (updateError as any).message);
      }
    }

    if (error?.code === "OPENAI_API_KEY_MISSING") {
      throw new OpenAIConfigurationError();
    }

    if (error.name === 'AbortError') {
      console.log('Streaming response cancelled by user');
      return;
    }
    console.error('Error generating streaming response:', error);
    throw error;
  }
}

export async function generateIntelligentResponse(
  userMessage: string,
  agentRole: string,
  context: ChatContext
): Promise<ColleagueResponse> {
  let runId: string | null = null;

  try {
    // Start LangSmith trace for intelligent response
    if (langsmith) {
      const run = await langsmith.createRun({
        name: `Intelligent Response - ${agentRole}`,
        run_type: "chain",
        inputs: {
          userMessage,
          agentRole,
          context: {
            mode: context.mode,
            projectName: context.projectName,
            teamName: context.teamName,
            conversationHistory: context.conversationHistory.length
          }
        },
        project_name: process.env.LANGSMITH_PROJECT || "hatchin-chat"
      });
      runId = (run as any).id;
    }

    // B2.1: Analyze user behavior from conversation history
    let userBehaviorProfile: UserBehaviorProfile | null = null;
    let messageAnalysis: MessageAnalysis | null = null;

    if (context.userId && context.conversationHistory.length > 0) {
      // Convert conversation history to the format expected by analyzer
      const messagesForAnalysis = context.conversationHistory.map(msg => ({
        content: msg.content,
        messageType: (msg.role === 'user' ? 'user' : 'agent') as 'user' | 'agent',
        timestamp: msg.timestamp,
        senderId: msg.senderId || (msg.role === 'user' ? context.userId! : agentRole)
      }));

      // Add current message to analysis
      messagesForAnalysis.push({
        content: userMessage,
        messageType: 'user',
        timestamp: new Date().toISOString(),
        senderId: context.userId
      });

      userBehaviorProfile = UserBehaviorAnalyzer.analyzeUserBehavior(messagesForAnalysis, context.userId);
      messageAnalysis = UserBehaviorAnalyzer.analyzeMessage(userMessage, new Date().toISOString());
    }

    // Execute custom logic for this colleague type
    const logicResult = executeColleagueLogic(agentRole, userMessage);

    // Get role profile for the responding colleague
    const roleProfile = roleProfiles[agentRole] || roleProfiles['Product Manager'];
    const roleBrain = await loadRoleBrain(agentRole);
    const roleBrainContext = renderRoleBrainContext(roleBrain);

    // Create context-aware prompt using our template system
    const basePrompt = createPromptTemplate({
      role: agentRole,
      userMessage,
      context: {
        chatMode: context.mode,
        projectName: context.projectName,
        teamName: context.teamName,
        recentMessages: context.conversationHistory.slice(-15) // P3: extended from 5 → 15
      },
      roleProfile,
      userBehaviorProfile,
      messageAnalysis
    });

    // Enhance prompt with training data
    const enhancedPrompt = trainingSystem.generateEnhancedPrompt(agentRole, userMessage, basePrompt.systemPrompt);

    const generation = await generateChatWithRuntimeFallback({
      model: resolveRuntimeModel(),
      messages: [
        {
          role: 'system',
          content: `${enhancedPrompt}\n\n--- ROLE BRAIN ---\n${roleBrainContext}\n--- END ROLE BRAIN ---`
        },
        {
          role: 'user',
          content: basePrompt.userPrompt
        }
      ],
      maxTokens: 300,
      temperature: 0.7,
      timeoutMs: Number(process.env.HARD_RESPONSE_TIMEOUT_MS || 45000),
      seed: process.env.LLM_MODE === "test" ? 42 : undefined,
    });

    let responseContent = generation.content || '';

    // Enhance response with custom logic results if available
    if (logicResult.shouldExecute && logicResult.enhancedResponse) {
      responseContent = `${logicResult.enhancedResponse}\n\n${responseContent}`;
    }

    // Calculate confidence based on response quality
    const confidence = calculateConfidence(responseContent, userMessage, roleProfile);

    // Update LangSmith trace with successful response
    if (langsmith && runId) {
      await langsmith.updateRun(runId, {
        outputs: {
          content: responseContent,
          confidence,
          reasoning: `Generated using ${agentRole} expertise and conversation context${logicResult.shouldExecute ? ' with custom logic' : ''}`,
          method: "intelligent"
        },
        // status: "success"
      });
    }

    return {
      content: responseContent,
      confidence,
      reasoning: `Generated using ${agentRole} expertise and conversation context${logicResult.shouldExecute ? ' with custom logic' : ''}`,
      metadata: generation.metadata,
    };

  } catch (error: any) {
    // Update LangSmith trace with error
    if (langsmith && runId) {
      try {
        await langsmith.updateRun(runId, {
          outputs: {
            error: (error as any).message,
            method: "intelligent"
          },
          // status: "error"
        });
      } catch (updateError) {
        console.warn('LangSmith error update failed:', (updateError as any).message);
      }
    }

    if (error?.code === "OPENAI_API_KEY_MISSING") {
      throw new OpenAIConfigurationError();
    }

    console.error('LLM API Error:', error);
    throw error;
  }
}

// Enhanced prompt template creation
function createPromptTemplate(params: {
  role: string;
  userMessage: string;
  context: any;
  roleProfile: any;
  userBehaviorProfile?: UserBehaviorProfile | null;
  messageAnalysis?: MessageAnalysis | null;
}): { systemPrompt: string; userPrompt: string } {
  const { role, userMessage, context, roleProfile, userBehaviorProfile, messageAnalysis } = params;

  const agentDisplayName = roleProfile.characterName || role;
  const systemPrompt = `You are ${agentDisplayName}, a ${role} working on the "${context.projectName}" project.

PERSONALITY: ${roleProfile.personality}
EXPERTISE: ${roleProfile.expertMindset}
SIGNATURE STYLE: ${roleProfile.signatureMoves}

CONTEXT:
- Chat Mode: ${context.chatMode} (${context.chatMode === 'project' ? 'talking to entire project team' : context.chatMode === 'team' ? `talking to ${context.teamName} team` : 'one-on-one conversation'})
- Project: ${context.projectName}
${context.teamName ? `- Team: ${context.teamName}` : ''}

CONVERSATION HISTORY:
${context.recentMessages.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n')}

INSTRUCTIONS:
- Respond as ${agentDisplayName} with your specific expertise and personality
- Keep responses concise (2-3 sentences max)
- Be helpful and actionable based on your role
- Match the conversational tone
- Never say "As a [Role]" or announce your role in the first sentence
- Ask at most one clarification question
- End with a clear next step line
- Don't mention you're an AI - you're a colleague

${userBehaviorProfile && messageAnalysis ? `
USER COMMUNICATION PROFILE (Confidence: ${(userBehaviorProfile.confidence * 100).toFixed(0)}%):
- Style: ${userBehaviorProfile.communicationStyle} (${userBehaviorProfile.responsePreference} responses preferred)
- Decision Making: ${userBehaviorProfile.decisionMaking}
- Current Message: ${messageAnalysis.emotionalTone} tone, ${messageAnalysis.urgencyLevel > 0.5 ? 'urgent' : 'normal'} priority
- Adapt your response accordingly: ${UserBehaviorAnalyzer.getResponseAdaptation(userBehaviorProfile, messageAnalysis).tone}
- Response Length: ${UserBehaviorAnalyzer.getResponseAdaptation(userBehaviorProfile, messageAnalysis).length}
` : ''}`;

  const userPrompt = `User message: "${userMessage}"

Respond as ${agentDisplayName} with your expertise in ${role}:`;

  return { systemPrompt, userPrompt };
}

// Calculate response confidence based on quality metrics
function calculateConfidence(response: string, userMessage: string, roleProfile: any): number {
  let confidence = 0.5; // Base confidence

  // Check if response is substantive (not too short)
  if (response.length > 50) confidence += 0.2;

  // Check if response includes role-specific keywords
  const roleKeywords = roleProfile.roleToolkit?.toLowerCase().split(' ') || [];
  const hasRoleKeywords = roleKeywords.some((keyword: string) =>
    response.toLowerCase().includes(keyword)
  );
  if (hasRoleKeywords) confidence += 0.2;

  // Check if response addresses user message contextually
  const userKeywords = userMessage.toLowerCase().split(' ').filter(word => word.length > 3);
  const addressesUser = userKeywords.some(keyword =>
    response.toLowerCase().includes(keyword)
  );
  if (addressesUser) confidence += 0.1;

  return Math.min(confidence, 1.0);
}

export { ChatContext, ColleagueResponse };
