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
      const personalityIdentity = context.projectId
        ? `${context.projectId}:${context.agentId || agentRole}`
        : (context.agentId || agentRole);

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
        recentMessages: context.conversationHistory.slice(-5)
      },
      roleProfile,
      userBehaviorProfile,
      messageAnalysis
    });

    const enhancedPrompt = trainingSystem.generateEnhancedPrompt(agentRole, userMessage, basePrompt.systemPrompt);

    // Create system prompt based on role and context
    const systemPrompt = `${enhancedPrompt}

${sharedMemory ? `\n--- SHARED PROJECT MEMORY ---\n${sharedMemory}\n--- END MEMORY ---\n` : ''}

${personalityPrompt}

--- ROLE BRAIN ---
${roleBrainContext}
--- END ROLE BRAIN ---

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
        recentMessages: context.conversationHistory.slice(-5) // Last 5 messages for context
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

  const systemPrompt = `You are ${roleProfile.name}, a ${role} working on the "${context.projectName}" project.

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
- Respond as ${roleProfile.name} with your specific expertise and personality
- Keep responses concise (2-3 sentences max)
- Be helpful and actionable based on your role
- Match the conversational tone
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

Respond as ${roleProfile.name} with your expertise in ${role}:`;

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
