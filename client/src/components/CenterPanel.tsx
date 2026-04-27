import { useState, useEffect, useRef, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Project, Team, Agent } from "@shared/schema";
import { getRoleDefinition } from "@shared/roleRegistry";
import { useWebSocket, getWebSocketUrl, getConnectionStatusConfig } from '@/lib/websocket';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { AddHatchModal } from './AddHatchModal';
import { TaskApprovalModal } from './TaskApprovalModal';
import { buildConversationId } from '@/lib/conversationId';
import { devLog } from '@/lib/devLog';
import { deriveChatMode, type ChatMode } from '@/lib/chatMode';
import { useAuth } from "@/hooks/useAuth";
import UpgradeModal from './UpgradeModal';
import { DeliverableProposalCard } from '@/components/DeliverableChatCard';
import { dispatchAutonomyEvent, AUTONOMY_EVENTS } from '@/lib/autonomyEvents';
import type { HandoffAnnouncedPayload } from '@/lib/autonomyEvents';
import { useChatStreaming } from '@/hooks/useChatStreaming';
import { useChatMessages } from '@/hooks/useChatMessages';
import { ChatHeader } from './chat/ChatHeader';
import { ChatMessageList } from './chat/ChatMessageList';
import { ChatInput } from './chat/ChatInput';


interface ChatContext {
  mode: ChatMode;
  participantIds: string[];
  conversationId: string;
  projectId: string;
}

interface CenterPanelProps {
  activeProject: Project | undefined;
  activeProjectTeams: Team[];
  activeProjectAgents: Agent[];
  activeTeamId: string | null;
  activeAgentId: string | null;
  onAddAgent: (agent: Omit<Agent, 'id'>) => void;
  // Add props for empty state functionality
  projects: Project[];
  onCreateProject: (name: string, description?: string) => void;
  onCreateProjectFromTemplate: (templateData: any, name: string, description: string) => void;
  onCreateIdeaProject: (name: string, description: string) => void;
  onAddProjectClick: () => void;
}

export function CenterPanel({
  activeProject,
  activeProjectTeams,
  activeProjectAgents,
  activeTeamId,
  activeAgentId,
  onAddAgent,
  projects,
  onCreateProject,
  onCreateProjectFromTemplate,
  onCreateIdeaProject,
  onAddProjectClick,
}: CenterPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const toDisplayText = (value: unknown, fallback = ''): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (typeof obj.name === 'string') return obj.name;
      if (typeof obj.role === 'string') return obj.role;
      try {
        return JSON.stringify(obj);
      } catch {
        return fallback;
      }
    }
    return fallback;
  };

  // === EMPTY STATE LOGIC ===
  devLog('CenterPanel: projects.length =', projects.length);
  devLog('CenterPanel: projects =', projects);

  // === Core State ===
  const [chatMode, setChatMode] = useState<ChatMode>('project');
  const [currentChatContext, setCurrentChatContext] = useState<ChatContext | null>(null);
  const [showAddHatchModal, setShowAddHatchModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>();
  const [inputValue, setInputValue] = useState('');
  const [messageQueue, setMessageQueue] = useState<Array<any>>([]);
  const [typingColleagues, setTypingColleagues] = useState<string[]>([]);
  const [isTeamWorking, setIsTeamWorking] = useState(false);
  const [teamWorkingTaskCount, setTeamWorkingTaskCount] = useState(0);
  const [isAutonomyPaused, setIsAutonomyPaused] = useState(false);
  const [approvalRequests, setApprovalRequests] = useState<Array<{
    taskId: string;
    agentName: string;
    riskReasons: string[];
    projectId: string;
  }>>([]);
  const lastSendRef = useRef<{ conversationId: string; content: string; at: number } | null>(null);

  // Deliberation state
  const [deliberationState, setDeliberationState] = useState<{
    sessionId: string;
    agentNames: string[];
    roundCount: number;
    status: 'ongoing' | 'resolved';
    summary?: string;
  } | null>(null);
  const deliberationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deliverable proposal state (v2.0)
  const [deliverableProposal, setDeliverableProposal] = useState<{
    type: string; title: string; agentName: string; agentRole: string;
    confidence: number; conversationId: string; projectId: string;
  } | null>(null);

  // C1: Reply state
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    content: string;
    senderName: string;
  } | null>(null);

  // Task suggestion state
  const [suggestedTasks, setSuggestedTasks] = useState<any[]>([]);
  const [taskSuggestionContext, setTaskSuggestionContext] = useState<{
    conversationId: string;
    projectId: string;
  } | null>(null);
  const [isApprovingTasks, setIsApprovingTasks] = useState(false);
  const [showTaskApprovalModal, setShowTaskApprovalModal] = useState(false);

  // === Extracted Hooks ===

  const streaming = useChatStreaming({
    getCurrentConversationId: () => currentChatContext?.conversationId,
    onStreamingTimeout: (conversationId, messageId) => {
      messages.updateMessageInConversation(conversationId, messageId, {
        status: 'failed',
        metadata: { isStreaming: false }
      });
    },
    onPendingResponseTimeout: (conversationId, messageId) => {
      messages.updateMessageInConversation(conversationId, messageId, {
        status: 'failed',
        metadata: { responseTimeout: true }
      });
    },
  });

  const messages = useChatMessages({
    conversationId: currentChatContext?.conversationId,
    activeProjectAgents,
  });

  // Cleanup deliberation timeout on unmount
  useEffect(() => {
    return () => {
      if (deliberationTimeoutRef.current) {
        clearTimeout(deliberationTimeoutRef.current);
      }
    };
  }, []);

  // === WebSocket Connection ===
  const webSocketUrl = useMemo(() => {
    const url = getWebSocketUrl();
    if (!url || url.includes(':undefined') || url.trim() === '') {
      console.error('[WebSocket] Invalid URL generated:', url);
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}/ws`;
    }
    return url;
  }, []);

  const { socket, connectionStatus, sendMessage: sendWebSocketMessage } = useWebSocket(webSocketUrl, {
    onMessage: (message) => {
      devLog('Received WebSocket message:', message);
      handleIncomingMessage(message);
    },
    onConnect: (openSocket) => {
      devLog('Chat connected to real-time messaging');
      processMessageQueue(openSocket);
      if (currentChatContext) {
        sendWebSocketMessage({
          type: 'join_conversation',
          conversationId: currentChatContext.conversationId
        });
      }
    },
    onDisconnect: () => {
      devLog('Chat disconnected from real-time messaging');
      streaming.clearPendingResponseTimeout();
      streaming.clearStreamingTimeout();
      streaming.clearAllStreamingState();
    },
    onError: (error) => {
      console.error('Chat messaging error:', error);
      streaming.clearPendingResponseTimeout();
      streaming.clearStreamingTimeout();
      streaming.clearAllStreamingState();
    }
  });

  const connectionConfig = getConnectionStatusConfig(connectionStatus);

  // === Message Sending Helpers ===

  const getValidConversationIdForSend = (
    conversationId: string | undefined,
    activeProject: { id: string } | null | undefined
  ): string | undefined => {
    if (!conversationId || conversationId === 'general-chat' || conversationId.startsWith('temp-')) {
      return activeProject ? `project:${activeProject.id}` : undefined;
    }
    return conversationId;
  };

  const isDuplicateSendAttempt = (conversationId: string, rawContent: string): boolean => {
    const normalized = rawContent.trim();
    if (!normalized) return false;
    const now = Date.now();
    const last = lastSendRef.current;
    if (last && last.conversationId === conversationId && last.content === normalized && (now - last.at) < 1200) {
      return true;
    }
    lastSendRef.current = { conversationId, content: normalized, at: now };
    return false;
  };

  const queueMessage = (messageData: any) => {
    setMessageQueue(prev => [...prev, messageData]);
  };

  const processMessageQueue = (openSocket?: WebSocket) => {
    const ws = openSocket ?? socket;
    if (ws?.readyState === WebSocket.OPEN && messageQueue.length > 0) {
      messageQueue.forEach(messageData => {
        sendWebSocketMessage(messageData);
        if (currentChatContext) {
          messages.updateMessageInConversation(currentChatContext.conversationId, messageData.tempId, { status: 'sent' });
        }
      });
      setMessageQueue([]);
    }
  };

  const sendMessageWithConfirmation = async (messageData: any, tempMessageId: string) => {
    try {
      if (socket?.readyState === WebSocket.OPEN) {
        const messageConversationId = messageData.message?.conversationId;
        const currentConversationId = currentChatContext?.conversationId;

        if (messageConversationId !== currentConversationId) {
          console.warn('Preventing message send - conversation context mismatch:', {
            messageConversation: messageConversationId,
            currentConversation: currentConversationId
          });
          return;
        }

        sendWebSocketMessage(messageData);
        await saveMessageToStorage(messageData.message);
        if (currentChatContext) {
          messages.updateMessageInConversation(currentChatContext.conversationId, tempMessageId, { status: 'sent' });
        }
        devLog('Message sent successfully:', messageData);
      } else {
        queueMessage({ ...messageData, tempId: tempMessageId });
        if (currentChatContext) {
          messages.updateMessageInConversation(currentChatContext.conversationId, tempMessageId, { status: 'sending' });
        }
        devLog('Message queued for delivery:', messageData);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      if (currentChatContext) {
        messages.updateMessageInConversation(currentChatContext.conversationId, tempMessageId, { status: 'failed' });
      }
    }
  };

  // === Streaming state truth-enforcer ===
  // isStreaming=true must imply a placeholder message with status='streaming' exists.
  // Events can be lost (mobile flaky WS, server emitting chat_message instead of
  // streaming_completed). If the placeholder is gone but isStreaming is still true,
  // clear it — the stop button has no valid thing to stop.
  useEffect(() => {
    if (!streaming.isStreaming) return;
    const convId = currentChatContext?.conversationId;
    if (!convId) return;
    const msgs = messages.allMessages[convId] || [];
    const hasLiveStream = msgs.some(m =>
      m.status === 'streaming' ||
      (m.metadata && (m.metadata as any).isStreaming === true)
    );
    if (hasLiveStream) return;
    // 0ms timeout = microtask tick, lets React commit the messages.allMessages
    // update first so we observe the final state, then clear isStreaming.
    const t = window.setTimeout(() => {
      streaming.setIsStreaming(false);
      streaming.streamingMessageId.current = null;
    }, 0);
    return () => window.clearTimeout(t);
  }, [messages.allMessages, currentChatContext?.conversationId, streaming.isStreaming]);

  // === WebSocket Message Handler ===

  const handleIncomingMessage = (message: any) => {
    devLog('Received WebSocket message:', message.type, message);
    devLog('Current chat context:', currentChatContext?.conversationId);

    if (message.type === 'new_message' || message.type === 'chat_message') {
      streaming.clearPendingResponseTimeout();
      streaming.setIsThinking(false);
      const messageId = message.message.id;
      const isUserMessage = message.message.messageType === 'user';
      const isAgentMessage = message.message.messageType === 'agent' || message.message.messageType === 'system';
      const matchesActiveStream = streaming.isStreaming &&
        streaming.streamingMessageId.current === messageId;
      if (isAgentMessage && matchesActiveStream) {
        streaming.clearAllStreamingState();
      }
      // Non-streaming agent reply arrived while we're still marked as streaming
      // (e.g. canned/fallback message that skipped streaming lifecycle) — clear state.
      else if (isAgentMessage && streaming.isStreaming) {
        streaming.clearAllStreamingState();
      }

      // Enhanced duplicate prevention
      if (messageId) {
        if (messages.isMessageProcessed(messageId)) {
          devLog('Skipping already processed message:', messageId);
          return;
        }
        if (messageId.startsWith('temp-')) {
          devLog('Ignoring temp message echo:', messageId);
          return;
        }
        messages.markMessageProcessed(messageId);
      }

      const getActualAgentName = (agentId: string) => {
        const agent = activeProjectAgents.find(a => a.id === agentId);
        return agent ? agent.name : agentId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
      };

      const newMessage = {
        id: messageId || `msg-${Date.now()}`,
        content: message.message.content,
        senderId: message.message.messageType === 'system'
          ? 'maya-fallback'
          : (message.message.agentId || message.message.userId),
        senderName: message.message.messageType === 'system'
          ? 'Maya'
          : (message.message.agentId
            ? getActualAgentName(message.message.agentId)
            : toDisplayText(message.message.senderName, 'You')),
        messageType: message.message.messageType === 'user' ? 'user' : 'agent',
        timestamp: message.message.timestamp || new Date().toISOString(),
        conversationId: message.message.conversationId,
        status: 'delivered' as const,
        parentMessageId: message.message.parentMessageId || undefined,
        threadRootId: message.message.threadRootId || undefined,
        threadDepth: message.message.threadDepth || 0,
        metadata: {
          ...((message.message.metadata as any) || {}),
          isStreaming: false,  // BUG-06: force-clear regardless of server payload — this is a delivered message
        }
      };

      // Dispatch handoff event to sidebar activity feed
      if ((message.message.metadata as any)?.isHandoffAnnouncement === true) {
        const toAgent = activeProjectAgents.find(
          a => a.id === (message.message.metadata as any)?.nextAgentId
        );
        dispatchAutonomyEvent<HandoffAnnouncedPayload>(AUTONOMY_EVENTS.HANDOFF_ANNOUNCED, {
          fromAgentId: message.message.agentId || '',
          fromAgentName: newMessage.senderName,
          toAgentId: (message.message.metadata as any)?.nextAgentId || '',
          toAgentName: toAgent?.name ?? 'Team',
          taskTitle: (message.message.metadata as any)?.taskTitle ?? message.message.content,
          traceId: (message.message.metadata as any)?.traceId ?? message.message.id,
          projectId: activeProject?.id || '',
        });
      }

      const isCurrentConversation = currentChatContext?.conversationId === newMessage.conversationId;
      if (!isCurrentConversation) {
        devLog('Ignoring message from different conversation:', {
          messageConversation: newMessage.conversationId,
          currentConversation: currentChatContext?.conversationId
        });
        return;
      }

      const clientTempId = typeof message.message?.metadata?.clientTempId === 'string'
        ? message.message.metadata.clientTempId
        : undefined;

      messages.setAllMessages(prev => {
        const conversationMessages = prev[newMessage.conversationId] || [];

        if (isUserMessage) {
          const optimisticByClientId = clientTempId
            ? conversationMessages.find(msg => msg.id === clientTempId && msg.messageType === 'user')
            : undefined;
          const optimisticByContent = [...conversationMessages].reverse().find(msg =>
            msg.messageType === 'user' &&
            String(msg.id).startsWith('temp-') &&
            (msg.status === 'sending' || msg.status === 'sent' || msg.status === 'delivered') &&
            (msg.content || '').trim() === (newMessage.content || '').trim()
          );
          const optimisticMessage = optimisticByClientId || optimisticByContent;

          if (optimisticMessage) {
            devLog('Reconciled optimistic user message to persisted id:', newMessage.id);
            return {
              ...prev,
              [newMessage.conversationId]: conversationMessages.map(msg =>
                msg.id === optimisticMessage.id
                  ? { ...msg, ...newMessage, status: 'delivered' as const }
                  : msg
              )
            };
          }
        }

        if (conversationMessages.some(msg => msg.id === newMessage.id)) {
          devLog('Skipped duplicate message by id:', newMessage.id);
          return prev;
        }

        const incomingTs = new Date(newMessage.timestamp || Date.now()).getTime();
        const hasRecentEquivalent = conversationMessages.some(msg => {
          if (msg.messageType !== newMessage.messageType) return false;
          if ((msg.content || '').trim() !== (newMessage.content || '').trim()) return false;
          if (newMessage.messageType !== 'user' && (msg.senderId || '') !== (newMessage.senderId || '')) {
            return false;
          }
          const msgTs = new Date(msg.timestamp || 0).getTime();
          if (!Number.isFinite(msgTs)) return false;
          return Math.abs(msgTs - incomingTs) < 10000;
        });

        if (hasRecentEquivalent) {
          devLog('Skipped recent equivalent duplicate message', {
            id: newMessage.id,
            conversationId: newMessage.conversationId
          });
          return prev;
        }

        devLog('Added new message to conversation:', newMessage.conversationId);
        return {
          ...prev,
          [newMessage.conversationId]: [...conversationMessages, newMessage]
        };
      });
    } else if (message.type === 'project_brain_updated') {
      try {
        window.dispatchEvent(new CustomEvent('project_brain_updated', { detail: message }));
      } catch (error) {
        console.warn('Failed to dispatch project_brain_updated event', error);
      }
    } else if (message.type === 'message_delivered') {
      const conversationId = message.conversationId;
      if (conversationId) {
        messages.updateMessageInConversation(conversationId, message.messageId, { status: 'delivered' });
      }
    }
    // B1.2: Handle streaming messages
    else if (message.type === 'streaming_started') {
      streaming.clearPendingResponseTimeout();
      devLog('Streaming started:', message.messageId, message.agentName);

      if (streaming.streamingMessageId.current === message.messageId) {
        devLog('Skipping duplicate streaming_started for same messageId');
        return;
      }

      const convId = currentChatContext?.conversationId;
      if (!convId) {
        devLog('Skipping streaming_started — no active conversation');
        return;
      }
      const convMsgs = messages.allMessages[convId] || [];
      const hasDuplicate = convMsgs.some(m =>
        m.id === message.messageId ||
        (m.status === 'streaming' && m.senderId === (message.agentId || 'ai-agent'))
      );
      if (hasDuplicate) {
        devLog('Skipping streaming placeholder; duplicate detected');
        return;
      }

      streaming.setIsThinking(false);
      streaming.setIsStreaming(true);
      setTypingColleagues([]);
      streaming.streamingMessageId.current = message.messageId;
      streaming.setStreamingContent('');
      streaming.setStreamingConversationId(currentChatContext?.conversationId || null);
      window.dispatchEvent(new CustomEvent('ai_streaming_active', { detail: { active: true } }));

      const getActualAgentName = (agentId: string) => {
        const agent = activeProjectAgents.find(a => a.id === agentId);
        return agent ? agent.name : agentId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
      };

      streaming.setStreamingAgent(message.agentName || getActualAgentName(message.agentId || 'ai-agent'));

      const streamingMessage = {
        id: message.messageId,
        content: '',
        senderId: message.agentId || 'ai-agent',
        senderName: message.agentName || getActualAgentName(message.agentId || 'ai-agent'),
        messageType: 'agent' as const,
        timestamp: new Date().toISOString(),
        conversationId: currentChatContext?.conversationId || '',
        status: 'streaming' as const,
        isStreaming: true,
        parentMessageId: message.parentMessageId || undefined,
        threadRootId: message.threadRootId || undefined,
        threadDepth: message.threadDepth || 0,
        metadata: {
          isStreaming: true,
          agentRole: (() => {
            const agent = activeProjectAgents.find(a => a.id === (message.agentId || ''));
            return agent?.role ?? null;
          })()
        }
      };

      devLog('Creating streaming placeholder message:', message.messageId, 'for agent:', message.agentName);
      messages.addMessageToConversation(currentChatContext?.conversationId || '', streamingMessage);
      streaming.resetStreamingTimeout();
    }
    else if (message.type === 'streaming_chunk') {
      streaming.clearPendingResponseTimeout();
      streaming.setIsThinking(false);
      devLog('Streaming chunk:', message.chunk);
      if (message.messageId === streaming.streamingMessageId.current) {
        streaming.setStreamingContent(message.accumulatedContent ?? '');

        messages.setAllMessages(prev => {
          const conversationId = streaming.streamingConversationId || currentChatContext?.conversationId || '';
          devLog('Updating streaming chunk for conversation:', conversationId, 'current context:', currentChatContext?.conversationId);
          const msgs = prev[conversationId] || [];
          const messageIndex = msgs.findIndex(msg => msg.id === message.messageId);

          if (messageIndex >= 0) {
            const updatedMessages = [...msgs];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              content: message.accumulatedContent
            };
            devLog('Updated existing streaming message:', message.messageId, 'content length:', message.accumulatedContent.length);
            return { ...prev, [conversationId]: updatedMessages };
          } else {
            const placeholderMessage = {
              id: message.messageId,
              content: message.accumulatedContent,
              senderId: 'ai-agent',
              senderName: streaming.streamingAgent || 'AI',
              messageType: 'agent' as const,
              timestamp: new Date().toISOString(),
              conversationId,
              status: 'streaming' as const,
              isStreaming: true,
              metadata: { isStreaming: true }
            };
            return { ...prev, [conversationId]: [...msgs, placeholderMessage] };
          }
        });
        streaming.resetStreamingTimeout();
      }
    }
    else if (message.type === 'streaming_completed') {
      streaming.clearPendingResponseTimeout();
      devLog('Streaming completed');
      streaming.clearStreamingTimeout();
      window.dispatchEvent(new CustomEvent('ai_streaming_active', { detail: { active: false } }));

      if (message.message) {
        const getActualAgentName = (agentId: string) => {
          const agent = activeProjectAgents.find(a => a.id === agentId);
          return agent ? agent.name : agentId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        };

        messages.setAllMessages(prev => {
          const conversationId = message.message.conversationId;
          const msgs = prev[conversationId] || [];

          devLog('Looking for streaming message with ID:', message.messageId);
          const messageIndex = msgs.findIndex(msg =>
            msg.id === message.messageId && msg.metadata?.isStreaming
          );

          if (messageIndex >= 0) {
            const updatedMessages = [...msgs];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              id: message.message.id,
              content: message.message.content,
              senderName: getActualAgentName(message.message.agentId),
              status: 'delivered' as const,
              metadata: { ...updatedMessages[messageIndex].metadata, isStreaming: false }
            };
            return { ...prev, [conversationId]: updatedMessages };
          } else {
            console.warn('Streaming completed but no streaming message found to update');
            return prev;
          }
        });

        devLog('Updated streaming message with final content:', message.message.conversationId);
      }

      streaming.setIsStreaming(false);
      streaming.setIsThinking(false);
      streaming.streamingMessageId.current = null;
      streaming.setStreamingContent('');
      streaming.setStreamingAgent(null);
      streaming.setStreamingConversationId(null);
    }
    else if (message.type === 'streaming_cancelled') {
      streaming.clearPendingResponseTimeout();
      devLog('Streaming cancelled');
      streaming.setIsThinking(false);
      streaming.clearStreamingTimeout();
      streaming.setIsStreaming(false);
      streaming.streamingMessageId.current = null;
      streaming.setStreamingContent('');
      streaming.setStreamingAgent(null);
      streaming.setStreamingConversationId(null);
    }
    else if (message.type === 'streaming_error') {
      streaming.clearPendingResponseTimeout();
      devLog('Streaming error received');
      streaming.setIsThinking(false);
      streaming.clearStreamingTimeout();
      const failedStreamingId = streaming.streamingMessageId.current;
      const normalizedErrorCode = typeof message.code === 'string' ? message.code : 'STREAMING_GENERATION_FAILED';
      const fallbackErrorMessageByCode: Record<string, string> = {
        OPENAI_NOT_CONFIGURED: "Hmm, I couldn't connect to my brain for a second there. Give it another try?",
        OPENAI_RATE_LIMITED: "We're getting a lot of traffic right now - give me a minute and try again.",
        OPENAI_AUTH_FAILED: "Something's off on my end. Try again in a moment - I'll be right here.",
        OPENAI_MODEL_UNAVAILABLE: "My thinking engine is temporarily offline. Try again in a sec.",
        CONVERSATION_BUSY: "Still working on my last thought - give me a moment to finish up.",
        STREAMING_GENERATION_FAILED: "I started a reply but it didn't come through. Mind sending that again?"
      };
      const normalizedErrorMessage = (typeof message.error === 'string' && message.error.trim().length > 0)
        ? message.error
        : (fallbackErrorMessageByCode[normalizedErrorCode] || "Something tripped me up - try sending that again?");

      streaming.setIsStreaming(false);
      streaming.streamingMessageId.current = null;
      streaming.setStreamingContent('');
      streaming.setStreamingAgent(null);
      streaming.setStreamingConversationId(null);

      const targetConversationId = message.conversationId || streaming.streamingConversationId || currentChatContext?.conversationId;
      if (targetConversationId) {
        messages.setAllMessages(prev => {
          const conversationId = targetConversationId;
          const msgs = prev[conversationId] || [];
          const now = Date.now();

          const cleanedMessages = msgs
            .map(msg => {
              if (failedStreamingId && msg.id === failedStreamingId) {
                return {
                  ...msg,
                  status: 'failed' as const,
                  metadata: { ...msg.metadata, isStreaming: false }
                };
              }
              return msg;
            })
            .filter(msg => {
              if (!failedStreamingId || msg.id !== failedStreamingId) return true;
              return (msg.content || '').trim().length > 0;
            });

          const hasRecentNotice = [...cleanedMessages].reverse().some(msg => {
            if (msg.metadata?.errorCode !== normalizedErrorCode) return false;
            const ts = new Date(msg.timestamp || 0).getTime();
            return Number.isFinite(ts) && (now - ts) < 5000;
          });

          if (!hasRecentNotice) {
            cleanedMessages.push({
              id: `sys-streaming-error-${normalizedErrorCode}-${Date.now()}`,
              content: normalizedErrorMessage,
              senderId: 'maya-fallback',
              senderName: 'Maya',
              messageType: 'agent' as const,
              timestamp: new Date().toISOString(),
              conversationId,
              status: 'delivered' as const,
              metadata: { systemNotice: true, errorCode: normalizedErrorCode, agentRole: 'pm' }
            });
          }

          return { ...prev, [conversationId]: cleanedMessages };
        });
      }
    }
    else if (message.type === 'error') {
      streaming.clearPendingResponseTimeout();
      streaming.clearStreamingTimeout();
      streaming.clearAllStreamingState();

      if (currentChatContext) {
        messages.setAllMessages(prev => ({
          ...prev,
          [currentChatContext.conversationId]: (prev[currentChatContext.conversationId] || []).map(msg =>
            msg.status === 'sending'
              ? { ...msg, status: 'failed', metadata: { ...msg.metadata, wsError: message.code || 'unknown_error' } }
              : msg
          )
        }));
      }

      console.error('WebSocket server error:', message.code, message.message);
    }
    else if (message.type === 'typing_started') {
      const agentName = message.agentName || message.agentId || 'Agent';
      setTypingColleagues(prev => prev.includes(agentName) ? prev : [...prev, agentName]);
      const clearAfter = (message.estimatedDuration || 3000) + 500;
      setTimeout(() => {
        setTypingColleagues(prev => prev.filter(n => n !== agentName));
      }, clearAfter);
    }
    else if (message.type === 'typing_stopped') {
      const agentName = message.agentName || message.agentId || 'Agent';
      setTypingColleagues(prev => prev.filter(n => n !== agentName));
    }
    else if (message.type === 'assistant_message') {
      streaming.clearPendingResponseTimeout();
      devLog('Assistant message completed:', message.messageId);
      streaming.clearStreamingTimeout();

      if (message.message) {
        const getActualAgentName = (agentId: string) => {
          const agent = activeProjectAgents.find(a => a.id === agentId);
          return agent ? agent.name : agentId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        };

        const completedMessage = {
          id: message.message.id || message.messageId,
          content: message.message.content,
          senderId: message.message.agentId,
          senderName: getActualAgentName(message.message.agentId),
          messageType: 'agent' as const,
          timestamp: new Date().toISOString(),
          conversationId: message.message.conversationId || currentChatContext?.conversationId || '',
          status: 'delivered' as const,
          parentMessageId: message.message.parentMessageId || undefined,
          threadRootId: message.message.threadRootId || undefined,
          threadDepth: message.message.threadDepth || 0,
          metadata: {}
        };

        messages.setAllMessages(prev => {
          const conversationId = completedMessage.conversationId;
          const msgs = prev[conversationId] || [];

          const messageIndex = msgs.findIndex(msg =>
            (msg.id === message.messageId || msg.id === completedMessage.id) &&
            (msg.isStreaming || msg.status === 'streaming')
          );

          if (messageIndex >= 0) {
            const updatedMessages = [...msgs];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              ...completedMessage,
              isStreaming: false,
              status: 'delivered' as const,
              metadata: { ...updatedMessages[messageIndex].metadata, isStreaming: false }
            };
            return { ...prev, [conversationId]: updatedMessages };
          } else {
            return { ...prev, [conversationId]: [...msgs, completedMessage] };
          }
        });

        devLog('Replaced streaming message with final assistant message');
      }

      streaming.setIsStreaming(false);
      streaming.setIsThinking(false);
      streaming.streamingMessageId.current = null;
      streaming.setStreamingContent('');
      streaming.setStreamingAgent(null);
      streaming.setStreamingConversationId(null);
    }
    else if (message.type === 'connection_confirmed') {
      devLog('WebSocket connection confirmed for:', message.conversationId);
    }
    else if (message.type === 'task_suggestions') {
      devLog('Received task suggestions:', message.tasks);
      setSuggestedTasks(message.tasks);
      setTaskSuggestionContext({
        conversationId: message.conversationId,
        projectId: message.projectId
      });
      setShowTaskApprovalModal(true);
    }
    else if (message.type === 'task_created') {
      try {
        const evt = new CustomEvent('tasks_updated', { detail: { projectId: message.data?.projectId } });
        window.dispatchEvent(evt);
      } catch (e) {
        console.warn('Failed to dispatch tasks_updated');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      const taskTitle = message.data?.tasks?.[0]?.title || message.data?.title;
      if (taskTitle) {
        toast({ title: 'Task created', description: taskTitle });
      }
    }
    else if (message.type === 'teams_auto_hatched') {
      devLog('[AutoHatch] Teams created from chat:', message.teams, message.agents);
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${message.projectId}/agents`] });
      const agentCount = message.agents?.length || 0;
      if (agentCount > 0) {
        toast({ title: 'Team assembled', description: `${agentCount} AI teammate${agentCount !== 1 ? 's' : ''} added to your project` });
      }
      try {
        window.dispatchEvent(new CustomEvent('teams_auto_hatched', {
          detail: { teams: message.teams, agents: message.agents, projectId: message.projectId }
        }));
      } catch (e) {
        console.warn('Failed to dispatch teams_auto_hatched event');
      }
    }
    else if (message.type === 'task_created_from_chat') {
      devLog('[ChatIntelligence] Task created from chat:', message.task);
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${message.projectId}/tasks`] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      try {
        window.dispatchEvent(new CustomEvent('task_created_from_chat', {
          detail: { task: message.task, projectId: message.projectId }
        }));
      } catch (e) {
        console.warn('Failed to dispatch task_created_from_chat event');
      }
    }
    else if (message.type === 'task_lifecycle_result') {
      devLog('[TaskLifecycle] Result:', message.result);
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${message.projectId}/tasks`] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      if (message.result?.success && message.result?.message) {
        toast({ title: 'Task updated', description: message.result.message });
      }
    }
    else if (message.type === 'task_completion_suggested') {
      devLog('[TaskCompletion] Suggested:', message.task, message.phrase);
      fetch(`/api/tasks/${message.task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', completedAt: new Date().toISOString() }),
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${message.projectId}/tasks`] });
        toast({ title: 'Task complete', description: `"${message.task.title}" marked done` });
      }).catch(() => { /* non-critical */ });
    }
    else if (message.type === 'deliverable_proposal') {
      devLog('[Deliverable] Proposal received:', message);
      setDeliverableProposal({
        type: message.proposalType,
        title: message.title,
        agentName: message.agentName,
        agentRole: message.agentRole,
        confidence: message.confidence,
        conversationId: message.conversationId,
        projectId: message.projectId,
      });
    }
    else if (message.type === 'deliverable_created') {
      devLog('[Deliverable] Created:', message);
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${message.deliverable?.projectId || activeProject?.id}/deliverables`] });
      window.dispatchEvent(new CustomEvent('open_deliverable', { detail: { deliverableId: message.deliverable?.id } }));
      setDeliverableProposal(null);
    }
    else if (message.type === 'background_execution_started') {
      setIsTeamWorking(true);
      if (message.taskCount != null) {
        setTeamWorkingTaskCount(message.taskCount);
      }
      setIsAutonomyPaused(false);
      streaming.requestNotificationPermission();
      if (document.hidden) {
        document.title = '\u2728 Team working... | Hatchin';
      }
      dispatchAutonomyEvent(AUTONOMY_EVENTS.TASK_EXECUTING, {
        agentId: message.agentId ?? '',
        agentName: message.agentName ?? 'Agent',
        taskTitle: message.taskTitle ?? '',
        traceId: message.traceId ?? '',
        projectId: activeProject?.id ?? '',
      });
      if (message.agentId) {
        dispatchAutonomyEvent(AUTONOMY_EVENTS.AGENT_WORKING_STATE, {
          agentId: message.agentId,
          isWorking: true,
          projectId: activeProject?.id ?? '',
        });
      }
    }
    else if (message.type === 'background_execution_completed' || message.type === 'task_execution_completed') {
      setIsTeamWorking(false);
      setTeamWorkingTaskCount(0);
      if (document.hidden) {
        const count = message.completedCount ?? message.taskCount ?? 1;
        streaming.startFlashingTitle(count, 'Work complete');
        const projectName = activeProject?.name ?? 'Hatchin';
        const pendingCount = (message as any).pendingApprovalCount ?? 0;
        const summary = pendingCount > 0
          ? `${count} task${count > 1 ? 's' : ''} completed, ${pendingCount} need${pendingCount > 1 ? '' : 's'} review`
          : `${count} task${count > 1 ? 's' : ''} completed`;
        streaming.fireCompletionNotification(projectName, summary);
      }
      dispatchAutonomyEvent(AUTONOMY_EVENTS.TASK_COMPLETED, {
        agentId: message.agentId ?? '',
        agentName: message.agentName ?? 'Agent',
        taskTitle: message.taskTitle ?? '',
        traceId: message.traceId ?? '',
        projectId: activeProject?.id ?? '',
      });
      if (message.agentId) {
        dispatchAutonomyEvent(AUTONOMY_EVENTS.AGENT_WORKING_STATE, {
          agentId: message.agentId,
          isWorking: false,
          projectId: activeProject?.id ?? '',
        });
      }
    }
    else if (message.type === 'task_requires_approval') {
      devLog('[Autonomy] Task requires approval:', message.taskId, message.riskReasons);
      const currentProjectId = activeProject?.id;
      if (!currentProjectId) return;
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setApprovalRequests((prev) => [
        ...prev.filter((r) => r.taskId !== message.taskId),
        {
          taskId: message.taskId ?? '',
          agentName: message.agentName ?? 'Agent',
          riskReasons: message.riskReasons ?? [],
          projectId: currentProjectId,
        },
      ]);
      dispatchAutonomyEvent(AUTONOMY_EVENTS.APPROVAL_REQUIRED, {
        traceId: message.traceId ?? '',
        agentId: message.agentId ?? '',
        agentName: message.agentName ?? 'Agent',
        taskTitle: message.taskTitle ?? '',
        riskScore: message.riskScore ?? 0,
        projectId: activeProject?.id ?? '',
      });
    }
    else if (message.type === 'task_approval_rejected') {
      setApprovalRequests((prev) => prev.filter((r) => r.taskId !== message.taskId));
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    }
    else if (message.type === 'task_execution_failed') {
      setIsTeamWorking(false);
      toast({
        title: 'Task failed',
        description: `${message.agentName ?? 'Agent'} couldn't complete the task: ${message.error ?? 'Unknown error'}`,
        duration: 8000,
      });
    }
    else if (message.type === 'brain_updated_from_chat') {
      devLog('[ChatIntelligence] Project Brain updated from chat:', message.field, message.value);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${message.projectId}`] });
      toast({ title: 'Project memory updated', description: `Captured: ${message.field || 'new insight'}` });
      try {
        window.dispatchEvent(new CustomEvent('project_brain_updated', {
          detail: {
            projectId: message.projectId,
            patch: {
              coreDirection: message.field === 'coreDirection' ? message.value : undefined,
              executionRules: message.field === 'executionRules' ? message.value : undefined,
              teamCulture: message.field === 'teamCulture' ? message.value : undefined,
            },
          }
        }));
      } catch (e) {
        console.warn('Failed to dispatch project_brain_updated event');
      }
    }
    else if (message.type === 'upgrade_required') {
      if (message.reason === 'rate_limit') {
        toast({ title: 'Slow down', description: message.message || 'You\'re sending messages too fast.', duration: 4000 });
      } else {
        setUpgradeReason(message.reason);
        setShowUpgradeModal(true);
      }
    }
    else if (message.type === 'conductor_decision') {
      const payload = message as any;
      if (payload.reviewRequired || (payload.reviewerCount && payload.reviewerCount >= 1)) {
        const agentNames: string[] = [];
        if (payload.selectedAgent) agentNames.push(payload.selectedAgent);
        if (payload.reviewers) agentNames.push(...(payload.reviewers as string[]));

        if (deliberationTimeoutRef.current) {
          clearTimeout(deliberationTimeoutRef.current);
        }

        setDeliberationState(prev => ({
          sessionId: payload.traceId || `delib-${Date.now()}`,
          agentNames: agentNames.length > 0 ? agentNames : prev?.agentNames || ['Agents'],
          roundCount: (prev?.roundCount || 0) + 1,
          status: 'ongoing',
        }));

        deliberationTimeoutRef.current = setTimeout(() => {
          setDeliberationState(prev => prev ? { ...prev, status: 'resolved' } : null);
        }, 30000);
      }
    } else if (message.type === 'synthesis_completed') {
      if (deliberationTimeoutRef.current) {
        clearTimeout(deliberationTimeoutRef.current);
      }
      setDeliberationState(prev => prev ? {
        ...prev,
        status: 'resolved',
        summary: (message as any).synthesis || 'Coordination complete',
      } : null);
    }
  };

  // === Message Persistence ===
  const saveMessageToStorage = async (messageData: any) => {
    try {
      devLog('Message saved to storage:', messageData);
    } catch (error) {
      console.error('Failed to save message to storage:', error);
      throw error;
    }
  };

  // Runtime health check
  const { data: runtimeHealth } = useQuery({
    queryKey: ['/health'],
    queryFn: async () => {
      const response = await fetch('/health', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch runtime health');
      return response.json();
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const isTestMode = runtimeHealth?.provider?.mode === 'test';
  const runtimeProviderLabel =
    runtimeHealth?.provider?.resolvedProvider === 'ollama-test'
      ? 'Ollama'
      : runtimeHealth?.provider?.resolvedProvider === 'mock'
        ? 'Mock'
        : runtimeHealth?.provider?.resolvedProvider || 'Test Provider';

  // === Selection Normalization ===

  const normalizeSelectionId = (id: string | null | undefined): string | null => {
    if (typeof id !== 'string') return null;
    const normalized = id.trim();
    if (!normalized || normalized === 'undefined' || normalized === 'null') return null;
    return normalized;
  };

  const normalizedTeamId = normalizeSelectionId(activeTeamId);
  const normalizedAgentId = normalizeSelectionId(activeAgentId);
  const selectedTeam = normalizedTeamId
    ? activeProjectTeams.find(team => team.id === normalizedTeamId)
    : undefined;
  const selectedAgent = normalizedAgentId
    ? activeProjectAgents.find(agent => agent.id === normalizedAgentId)
    : undefined;
  const hasValidTeamSelection = Boolean(selectedTeam);
  const hasValidAgentSelection = Boolean(selectedAgent);

  // === Approval/Autonomy Effects ===

  useEffect(() => {
    if (activeProject?.id) {
      setApprovalRequests((prev) => prev.filter((r) => r.projectId === activeProject.id));
    } else {
      setApprovalRequests([]);
    }
  }, [activeProject?.id]);

  useEffect(() => {
    setIsAutonomyPaused((activeProject?.executionRules as any)?.autonomyPaused ?? false);
  }, [activeProject?.id, activeProject?.executionRules]);

  // === Chat Context Effect ===

  useEffect(() => {
    if (!activeProject) {
      setCurrentChatContext(null);
      return;
    }

    // Reset streaming state when changing conversation context
    streaming.clearAllStreamingState();

    devLog('CHAT_CONTEXT_COMPUTING', {
      activeProjectId: activeProject.id,
      activeTeamId,
      activeAgentId
    });

    const newMode: ChatMode = deriveChatMode({
      activeAgentId: hasValidAgentSelection ? normalizedAgentId : null,
      activeTeamId: hasValidTeamSelection ? normalizedTeamId : null
    });
    let participantIds: string[];
    let conversationId: string;

    if (newMode === 'agent' && selectedAgent) {
      participantIds = [selectedAgent.id];
      conversationId = buildConversationId('agent', activeProject.id, selectedAgent.id);
    } else if (newMode === 'team' && selectedTeam) {
      participantIds = activeProjectAgents
        .filter(agent => agent.teamId === selectedTeam.id)
        .map(agent => agent.id);
      conversationId = buildConversationId('team', activeProject.id, selectedTeam.id);
    } else {
      participantIds = activeProjectAgents.map(agent => agent.id);
      conversationId = buildConversationId('project', activeProject.id);
    }

    devLog('CHAT_CONTEXT_COMPUTED', {
      mode: newMode,
      conversationId,
      projectId: activeProject.id,
      teamId: selectedTeam?.id || null,
      agentId: selectedAgent?.id || null
    });

    setChatMode(newMode);
    const newChatContext = {
      mode: newMode,
      participantIds,
      conversationId,
      projectId: activeProject.id
    };

    if (!messages.allMessages[conversationId]) {
      messages.setAllMessages(prev => ({
        ...prev,
        [conversationId]: []
      }));
    }

    setCurrentChatContext(newChatContext);
    setInputValue('');

    if (connectionStatus === 'connected') {
      sendWebSocketMessage({
        type: 'join_conversation',
        conversationId: conversationId
      });
    }

    devLog('Chat context updated with persistence:', {
      mode: newMode,
      participants: participantIds.length,
      conversationId,
      projectId: activeProject.id
    });

  }, [
    activeProject?.id,
    normalizedTeamId,
    normalizedAgentId,
    hasValidTeamSelection,
    hasValidAgentSelection,
    selectedTeam?.id,
    selectedAgent?.id,
    activeProjectAgents
  ]);

  // === Context Calculation ===

  const getCurrentChatParticipants = (): Agent[] => {
    if (!activeProject || !currentChatContext) return [];
    switch (currentChatContext.mode) {
      case 'project': return activeProjectAgents;
      case 'team': return selectedTeam ? activeProjectAgents.filter(agent => agent.teamId === selectedTeam.id) : [];
      case 'agent': return selectedAgent ? [selectedAgent] : [];
      default: return [];
    }
  };

  const getSharedProjectMemory = () => {
    if (!activeProject) return null;
    return {
      projectId: activeProject.id,
      projectName: activeProject.name,
      projectGoal: activeProject.description || '',
      teams: activeProjectTeams,
      agents: activeProjectAgents,
      sharedContext: `Project: ${activeProject.name}`,
      memoryScope: 'project-wide'
    };
  };

  const getCurrentMemoryContext = () => {
    const sharedMemory = getSharedProjectMemory();
    if (!sharedMemory || !currentChatContext) return null;
    return {
      ...sharedMemory,
      currentMode: currentChatContext.mode,
      conversationId: currentChatContext.conversationId,
      activeParticipants: getCurrentChatParticipants(),
      memoryAccess: {
        canRead: sharedMemory.projectId ? true : false,
        canWrite: sharedMemory.projectId ? true : false,
        scope: 'project-wide'
      }
    };
  };

  const chatMemoryContext = getCurrentMemoryContext();

  // === Context Display ===

  const getChatContextDisplay = () => {
    if (!currentChatContext) return { title: 'Loading...', subtitle: '', participants: [] as Agent[] };

    const participants = getCurrentChatParticipants();

    switch (currentChatContext.mode) {
      case 'project':
        return {
          title: 'Maya',
          subtitle: 'Idea Partner',
          participants,
          placeholder: "Message your team...",
          welcomeTitle: 'Talk to your entire project team',
          welcomeSubtitle: 'Get insights and coordination across all teams and roles.',
          welcomeIcon: '\uD83D\uDE80'
        };
      case 'team': {
        const teamName = toDisplayText(selectedTeam?.name, 'Team');
        return {
          title: teamName,
          subtitle: `Team Chat \u2022 ${participants.length} Colleagues`,
          participants,
          placeholder: `Message ${teamName} team...`,
          welcomeTitle: `Collaborate with ${teamName}`,
          welcomeSubtitle: 'Focus on team-specific goals and coordination.',
          welcomeIcon: selectedTeam?.emoji || '\uD83D\uDC65'
        };
      }
      case 'agent': {
        const agentRole = toDisplayText(selectedAgent?.role, 'Product Manager');
        const agentName = getRoleDefinition(selectedAgent?.role)?.characterName
          ?? toDisplayText(selectedAgent?.name, agentRole);
        const isMaya = selectedAgent?.isSpecialAgent || selectedAgent?.name === 'Maya';
        return {
          title: isMaya ? (activeProject?.name || agentName) : agentName,
          subtitle: `1-on-1 Chat \u2022 ${agentRole}`,
          participants,
          placeholder: `Message ${agentName}...`,
          welcomeTitle: `Chat with ${agentName}`,
          welcomeSubtitle: `Get specialized help with ${agentRole.toLowerCase()} tasks.`,
          welcomeIcon: getRoleDefinition(selectedAgent?.role)?.emoji ?? '\uD83E\uDD16'
        };
      }
      default:
        return {
          title: 'Loading...',
          subtitle: '',
          participants: [] as Agent[],
          placeholder: 'Loading...',
          welcomeTitle: 'Loading...',
          welcomeSubtitle: '',
          welcomeIcon: '\u23F3'
        };
    }
  };

  const contextDisplay = getChatContextDisplay();

  // Dev-only UI invariant check
  useEffect(() => {
    if (
      import.meta.env.DEV &&
      typeof window !== 'undefined' &&
      (window as any).HATCHIN_UI_AUDIT &&
      currentChatContext?.mode === 'project'
    ) {
      if (contextDisplay.title !== 'Maya' || contextDisplay.subtitle !== 'Idea Partner') {
        devLog('HEADER_INVARIANT_VIOLATION', {
          mode: currentChatContext.mode,
          title: contextDisplay.title,
          subtitle: contextDisplay.subtitle
        });
      }
    }
  }, [currentChatContext?.mode, contextDisplay.title, contextDisplay.subtitle]);

  const getChatContextColor = () => {
    if (!currentChatContext) return 'blue';
    switch (currentChatContext.mode) {
      case 'project': return activeProject?.color || 'blue';
      case 'team': return 'green';
      case 'agent': return selectedAgent?.color || 'purple';
      default: return 'blue';
    }
  };

  const chatContextColor = getChatContextColor();

  // === Message Routing ===

  const getMessageRecipients = () => {
    if (!currentChatContext) return { type: 'unknown', recipients: [] as Agent[], scope: '', conversationId: '' };
    const participants = getCurrentChatParticipants();
    switch (currentChatContext.mode) {
      case 'project':
        return {
          type: 'project',
          recipients: participants,
          scope: `All ${activeProjectTeams.length} teams in ${activeProject?.name}`,
          conversationId: currentChatContext.conversationId
        };
      case 'team': {
        const activeTeam = activeProjectTeams.find(t => t.id === activeTeamId);
        return {
          type: 'team',
          recipients: participants,
          scope: `${activeTeam?.name} team (${participants.length} colleagues)`,
          conversationId: currentChatContext.conversationId
        };
      }
      case 'agent': {
        const activeAgent = activeProjectAgents.find(a => a.id === activeAgentId);
        return {
          type: 'agent',
          recipients: participants,
          scope: `1-on-1 with ${activeAgent?.name}`,
          conversationId: currentChatContext.conversationId
        };
      }
      default:
        return { type: 'unknown', recipients: [] as Agent[], scope: '', conversationId: '' };
    }
  };

  // === Mutations ===

  const approveMutation = useMutation({
    mutationFn: (taskId: string) => apiRequest('POST', `/api/tasks/${taskId}/approve`, {}),
    onSuccess: (_data, taskId) => {
      setApprovalRequests((prev) => prev.filter((r) => r.taskId !== taskId));
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
    onError: (_err, taskId) => {
      setApprovalRequests((prev) => prev.filter((r) => r.taskId !== taskId));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (taskId: string) => apiRequest('POST', `/api/tasks/${taskId}/reject`, {}),
    onSuccess: (_data, taskId) => {
      setApprovalRequests((prev) => prev.filter((r) => r.taskId !== taskId));
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
    onError: (_err, taskId) => {
      setApprovalRequests((prev) => prev.filter((r) => r.taskId !== taskId));
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (paused: boolean) =>
      apiRequest('PATCH', `/api/projects/${activeProject?.id}`, {
        executionRules: { ...((activeProject?.executionRules as any) ?? {}), autonomyPaused: paused },
      }),
    onSuccess: (_data, paused) => {
      setIsAutonomyPaused(paused);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
  });

  const reactionMutation = useMutation({
    mutationFn: async ({ messageId, reactionType, agentId }: {
      messageId: string;
      reactionType: 'thumbs_up' | 'thumbs_down';
      agentId?: string;
    }) => {
      return await apiRequest('POST', `/api/messages/${messageId}/reactions`, {
        reactionType,
        agentId,
        feedbackData: {
          responseQuality: reactionType === 'thumbs_up' ? 5 : 2,
          helpfulness: reactionType === 'thumbs_up' ? 5 : 2
        }
      });
    }
  });

  const handleMessageReaction = (messageId: string, reactionType: 'thumbs_up' | 'thumbs_down') => {
    const conversationMessages = currentChatContext ? messages.allMessages[currentChatContext.conversationId] || [] : [];
    const message = conversationMessages.find(m => m.id === messageId);
    const agentId = message?.messageType === 'agent' ? message.senderId : undefined;
    reactionMutation.mutate({ messageId, reactionType, agentId });
  };

  const handleReplyToMessage = (messageId: string, content: string, senderName: string) => {
    setReplyingTo({ id: messageId, content, senderName });
    setTimeout(() => {
      const input = document.querySelector('[data-testid="input-message"]') as HTMLTextAreaElement | null;
      if (input) input.focus();
    }, 100);
  };

  const clearReply = () => { setReplyingTo(null); };

  // Handoff
  const handoffableAgents = useMemo(() => {
    const focusedAgentId = currentChatContext?.mode === 'agent' ? currentChatContext?.participantIds[0] : null;
    return activeProjectAgents.filter((agent) => {
      if ((agent as unknown as { isSpecialAgent?: boolean; is_special_agent?: boolean }).isSpecialAgent ||
          (agent as unknown as { isSpecialAgent?: boolean; is_special_agent?: boolean }).is_special_agent) return false;
      if (focusedAgentId && agent.id === focusedAgentId) return false;
      return true;
    });
  }, [activeProjectAgents, currentChatContext]);

  const handleHandoff = (agent: { id: string; name: string; role: string }) => {
    setInputValue(`@${agent.name} `);
    const input = document.querySelector('[data-testid="input-message"]') as HTMLTextAreaElement | null;
    input?.focus();
  };

  // === Action Click Handler ===

  const handleActionClick = async (action: string) => {
    if (!currentChatContext) return;

    let message = '';
    const mode = currentChatContext.mode;

    if (action === 'generateRoadmap') {
      if (mode === 'project') {
        message = 'Can you create a comprehensive product roadmap for our SaaS startup? Include key milestones, feature priorities, and timeline recommendations.';
      } else if (mode === 'team') {
        const activeTeam = activeProjectTeams.find(t => t.id === activeTeamId);
        message = `Can you create a roadmap specifically for the ${activeTeam?.name} team? Focus on our team's deliverables and objectives.`;
      } else if (mode === 'agent') {
        const activeAgent = activeProjectAgents.find(a => a.id === activeAgentId);
        message = `From your perspective as ${activeAgent?.role}, what should our roadmap priorities be?`;
      }
    } else if (action === 'setGoals') {
      if (mode === 'project') {
        message = 'Help me set clear, measurable goals for each team in our project. What SMART goals would you recommend for our SaaS startup?';
      } else if (mode === 'team') {
        const activeTeam = activeProjectTeams.find(t => t.id === activeTeamId);
        message = `What specific goals should the ${activeTeam?.name} team focus on? Help me define clear objectives and success metrics.`;
      } else if (mode === 'agent') {
        const activeAgent = activeProjectAgents.find(a => a.id === activeAgentId);
        message = `As our ${activeAgent?.role}, what goals should we prioritize? What would success look like from your perspective?`;
      }
    } else if (action === 'summarizeTasks') {
      if (mode === 'project') {
        message = 'Can you summarize the current tasks and responsibilities for each team? Give me an overview of what everyone should be working on.';
      } else if (mode === 'team') {
        const activeTeam = activeProjectTeams.find(t => t.id === activeTeamId);
        message = `What are the key tasks and priorities the ${activeTeam?.name} team should focus on right now?`;
      } else if (mode === 'agent') {
        message = `What tasks and priorities should I focus on? What would you recommend as the next steps in your area of expertise?`;
      }
    }

    if (message) {
      try {
        const validConversationId = getValidConversationIdForSend(currentChatContext.conversationId, activeProject);
        if (!validConversationId) {
          console.warn('Cannot send action: no valid conversationId (select a project to chat)');
          return;
        }

        const canSend =
          message.trim().length > 0 &&
          currentChatContext?.conversationId &&
          currentChatContext.conversationId.trim().length > 0 &&
          activeProject?.id &&
          activeProject.id.trim().length > 0;

        if (canSend && currentChatContext) {
          if (isDuplicateSendAttempt(validConversationId, message)) {
            devLog('Duplicate send suppressed (action click)', { conversationId: validConversationId });
            return;
          }

          streaming.setIsThinking(true);
          setTypingColleagues([]);
          const tempMessageId = `temp-${Date.now()}`;
          const timestamp = new Date().toISOString();

          const userMessage = {
            id: tempMessageId,
            content: message,
            senderId: 'user',
            senderName: 'You',
            messageType: 'user' as const,
            timestamp,
            conversationId: validConversationId,
            status: 'sending' as const,
            metadata: { clientTempId: tempMessageId }
          };

          messages.addMessageToConversation(validConversationId, userMessage);

          const wsMessage = {
            type: 'send_message_streaming',
            conversationId: validConversationId,
            message: {
              ...userMessage,
              userId: user?.id || 'user',
              metadata: {
                clientTempId: tempMessageId,
                idempotencyKey: `${tempMessageId}-${Date.now()}`,
                routing: {
                  mode: currentChatContext.mode,
                  projectId: activeProject?.id,
                  teamId: activeTeamId,
                  agentId: activeAgentId
                },
                memory: getSharedProjectMemory()
              }
            }
          };

          sendWebSocketMessage(wsMessage);
          streaming.resetPendingResponseTimeout(validConversationId, tempMessageId);
          devLog(`Sent ${action} prompt:`, message);
          devLog('SEND_DISPATCHED', { mode: currentChatContext.mode, conversationId: validConversationId });
        } else {
          devLog('SEND_BLOCKED', {
            reason: !message || message.trim().length === 0 ? 'empty_input' :
              !currentChatContext?.conversationId ? 'missing_conversationId' :
                !activeProject?.id ? 'missing_activeProjectId' : 'unknown',
            connectionStatus,
            hasInput: message.trim().length > 0,
            hasConversationId: !!currentChatContext?.conversationId,
            hasActiveProject: !!activeProject?.id
          });
        }
      } catch (error) {
        console.error('Error sending action message:', error);
      }
    }
  };

  // === Chat Submit Handler ===

  const handleChatSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    devLog('Form submit triggered');
    const trimmed = inputValue.trim();
    devLog('Input value:', trimmed, 'Length:', trimmed.length);

    if (trimmed) {
      const recipients = getMessageRecipients();

      devLog('SEND_ATTEMPT', {
        mode: currentChatContext?.mode,
        conversationId: currentChatContext?.conversationId,
        messageLength: inputValue.length,
        messagePreview: inputValue.substring(0, 30),
        connectionStatus
      });

      const canSend =
        trimmed.length > 0 &&
        (
          (!activeProject && !currentChatContext) ||
          (currentChatContext?.conversationId && currentChatContext.conversationId.trim().length > 0)
        );

      if (canSend) {
        streaming.setIsThinking(true);
        setTypingColleagues([]);
        const tempMessageId = `temp-${Date.now()}`;
        const timestamp = new Date().toISOString();

        let conversationId = currentChatContext?.conversationId;
        if (!conversationId && activeProject) {
          conversationId = `project:${activeProject.id}`;
          console.warn('Using fallback conversationId:', conversationId);
        } else if (!conversationId) {
          conversationId = 'general-chat';
          console.warn('Using general chat conversationId');
        }

        const validConversationId = getValidConversationIdForSend(conversationId, activeProject);
        if (!validConversationId) {
          console.warn('Cannot send: no valid conversationId (select a project to chat)');
          return;
        }
        conversationId = validConversationId;

        if (isDuplicateSendAttempt(conversationId, trimmed)) {
          devLog('Duplicate send suppressed (chat submit)', { conversationId });
          return;
        }

        const userMessage = {
          id: tempMessageId,
          content: trimmed,
          senderId: 'user',
          senderName: 'You',
          messageType: 'user' as const,
          timestamp,
          conversationId: conversationId,
          status: 'sending' as const,
          metadata: {
            clientTempId: tempMessageId,
            routing: recipients,
            memory: chatMemoryContext,
            replyTo: replyingTo ? {
              id: replyingTo.id,
              content: replyingTo.content,
              senderName: replyingTo.senderName
            } : undefined
          }
        };

        messages.addMessageToConversation(conversationId, userMessage);

        const messageData = {
          type: 'send_message_streaming',
          conversationId: conversationId,
          message: {
            id: tempMessageId,
            conversationId: conversationId,
            userId: user?.id || 'user',
            content: trimmed,
            messageType: 'user' as const,
            timestamp,
            senderName: 'You',
            metadata: {
              clientTempId: tempMessageId,
              idempotencyKey: `${tempMessageId}-${Date.now()}`,
              routing: {
                type: recipients.type,
                scope: recipients.scope,
                participantCount: recipients.recipients.length,
                recipients: recipients.recipients.map((p: any) => p.name)
              },
              memory: {
                projectMemory: chatMemoryContext?.sharedContext,
                memoryScope: chatMemoryContext?.memoryAccess?.scope,
                canWrite: chatMemoryContext?.memoryAccess?.canWrite
              },
              replyTo: userMessage.metadata.replyTo
            }
          }
        };

        const streamingMessageData = {
          ...messageData,
          type: 'send_message_streaming'
        };

        sendMessageWithConfirmation(streamingMessageData, tempMessageId);
        streaming.resetPendingResponseTimeout(conversationId, tempMessageId);

        devLog('SEND_DISPATCHED', {
          mode: currentChatContext?.mode,
          conversationId: currentChatContext?.conversationId
        });

        setInputValue('');
        if (replyingTo) {
          clearReply();
        }

        devLog('Message sent via WebSocket - waiting for server streaming response');
      } else {
        const reason = !trimmed || trimmed.length === 0 ? 'empty_input' :
          (!activeProject && !currentChatContext) ? 'general_chat_allowed_but_failed' :
            (activeProject && !currentChatContext?.conversationId) ? 'missing_conversationId' :
              'unknown';

        console.error('Send blocked:', reason, {
          hasInput: trimmed.length > 0,
          hasConversationId: !!currentChatContext?.conversationId,
          conversationId: currentChatContext?.conversationId,
          hasActiveProject: !!activeProject?.id,
          activeProjectId: activeProject?.id,
          connectionStatus,
          currentChatContext: currentChatContext ? 'exists' : 'null'
        });

        devLog('SEND_BLOCKED', {
          reason,
          connectionStatus,
          hasInput: trimmed.length > 0,
          hasConversationId: !!currentChatContext?.conversationId,
          hasActiveProject: !!activeProject?.id
        });
      }
    }
  };

  // === Task Suggestion Handlers ===

  const handleApproveTaskSuggestions = async () => {
    if (!taskSuggestionContext) return;
    setIsApprovingTasks(true);
    try {
      const response = await fetch('/api/task-suggestions/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvedTasks: suggestedTasks,
          projectId: taskSuggestionContext.projectId
        })
      });
      if (response.ok) {
        try {
          const evt = new CustomEvent('tasks_updated', { detail: { projectId: taskSuggestionContext.projectId } });
          window.dispatchEvent(evt);
        } catch { }
        setSuggestedTasks([]);
        setTaskSuggestionContext(null);
        setShowTaskApprovalModal(false);
      } else {
        console.error('Failed to approve tasks');
      }
    } catch (e) {
      console.error('Approve tasks error', e);
    } finally {
      setIsApprovingTasks(false);
    }
  };

  const handleDismissTaskSuggestions = () => {
    setSuggestedTasks([]);
    setTaskSuggestionContext(null);
    setShowTaskApprovalModal(false);
  };

  // === Render ===

  // Show empty state when no projects exist
  if (projects.length === 0) {
    devLog('CenterPanel: Showing empty state');
    return (
      <main className="flex-1 min-h-0 premium-column-bg rounded-2xl flex flex-col my-2.5 relative overflow-hidden">
        <div className="ambient-glow-top" />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="max-w-lg">
            <div className="text-5xl mb-4">🐣</div>
            <h2 className="font-semibold hatchin-text text-lg mb-2">
              Create your first project
            </h2>
            <p className="hatchin-text-muted text-sm mb-8">
              Your dreams await
            </p>
            <button
              onClick={onAddProjectClick}
              className="hatchin-bg-blue text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-opacity-90 transition-colors"
            >
              Add Project
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!activeProject) {
    return (
      <main className="flex-1 min-h-0 premium-column-bg rounded-2xl flex flex-col my-2.5 relative overflow-hidden">
        <div className="ambient-glow-top" />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-hatchin-blue border-t-transparent rounded-full mb-4"></div>
          <p className="hatchin-text-muted text-sm anim-pulse">Select a project to get started</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 min-h-0 bg-[var(--hatchin-bg-card)] rounded-2xl flex flex-col my-2.5 relative overflow-hidden border border-[var(--hatchin-border-subtle)]">

      {/* Chat Header */}
      <ChatHeader
        contextDisplay={contextDisplay}
        chatMode={currentChatContext?.mode}
        activeProject={activeProject}
        activeProjectTeams={activeProjectTeams}
        activeProjectAgents={activeProjectAgents}
        onAddHatchClick={() => setShowAddHatchModal(true)}
      />

      {/* Message Display Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {messages.currentMessages.length === 0 && !streaming.isStreaming && !streaming.isThinking ? (
          /* Welcome Screen */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="max-w-lg">
              <div className="text-4xl">{contextDisplay.welcomeIcon}</div>
              <h2 className="font-semibold hatchin-text mt-0.5 mb-0.5 text-base">{contextDisplay.welcomeTitle}</h2>
              <p className="hatchin-text-muted text-sm">
                {contextDisplay.welcomeSubtitle}
              </p>
              <div className="flex flex-wrap gap-3 justify-center py-3">
                <button
                  onClick={() => handleActionClick('generateRoadmap')}
                  className="hatchin-bg-card hover:bg-hatchin-border hatchin-text px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {currentChatContext?.mode === 'project' ? 'Give me a product roadmap' :
                    currentChatContext?.mode === 'team' ? 'Create our team roadmap' : 'What should our roadmap priorities be?'}
                </button>
                <button
                  onClick={() => handleActionClick('setGoals')}
                  className="hatchin-bg-card hover:bg-hatchin-border hatchin-text px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {currentChatContext?.mode === 'project' ? 'Set team goals' :
                    currentChatContext?.mode === 'team' ? 'Define our team goals' : 'What goals should we prioritize?'}
                </button>
                <button
                  onClick={() => handleActionClick('summarizeTasks')}
                  className="hatchin-bg-card hover:bg-hatchin-border hatchin-text px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {currentChatContext?.mode === 'project' ? 'Summarize each team\'s tasks' :
                    currentChatContext?.mode === 'team' ? 'What should our team focus on?' : 'What are my next steps?'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Message List */
          <ChatMessageList
            messages={messages.currentMessages}
            messagesLoading={messages.messagesLoading}
            hasMoreMessages={messages.hasMoreMessages}
            loadingEarlier={messages.loadingEarlier}
            onLoadEarlier={messages.loadEarlierMessages}
            isStreaming={streaming.isStreaming}
            streamingAgent={streaming.streamingAgent}
            streamingMessageId={streaming.streamingMessageId.current}
            isThinking={streaming.isThinking}
            typingColleagues={typingColleagues}
            connectionStatus={connectionStatus}
            connectionConfig={connectionConfig}
            chatMode={currentChatContext?.mode}
            chatContextColor={chatContextColor}
            activeProjectAgents={activeProjectAgents}
            activeProjectId={activeProject?.id}
            onReaction={handleMessageReaction}
            onReply={handleReplyToMessage}
            isTeamWorking={isTeamWorking}
            teamWorkingTaskCount={teamWorkingTaskCount}
            isAutonomyPaused={isAutonomyPaused}
            onTogglePause={() => pauseMutation.mutate(!isAutonomyPaused)}
            pauseLoading={pauseMutation.isPending}
            deliberationState={deliberationState}
            onDismissDeliberation={() => setDeliberationState(null)}
            approvalRequests={approvalRequests}
            onApprove={(id) => approveMutation.mutate(id)}
            onReject={(id) => rejectMutation.mutate(id)}
            approvalLoading={approveMutation.isPending || rejectMutation.isPending}
            suggestedTasks={suggestedTasks}
            taskSuggestionContext={taskSuggestionContext}
            isApprovingTasks={isApprovingTasks}
            onApproveTaskSuggestions={handleApproveTaskSuggestions}
            onDismissTaskSuggestions={handleDismissTaskSuggestions}
          />
        )}
      </div>

      {/* Deliverable Proposal Card */}
      {deliverableProposal && (
        <div className="px-3 py-1.5">
          <DeliverableProposalCard
            type={deliverableProposal.type}
            title={deliverableProposal.title}
            agentName={deliverableProposal.agentName}
            agentRole={deliverableProposal.agentRole}
            onAccept={async () => {
              try {
                const res = await fetch('/api/deliverables/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    projectId: deliverableProposal.projectId,
                    type: deliverableProposal.type,
                    title: deliverableProposal.title,
                    description: '',
                  }),
                });
                if (res.ok) {
                  const data = await res.json();
                  window.dispatchEvent(new CustomEvent('open_deliverable', { detail: { deliverableId: data.deliverable?.id } }));
                  queryClient.invalidateQueries({ queryKey: [`/api/projects/${deliverableProposal.projectId}/deliverables`] });
                }
              } catch (err) {
                console.error('Failed to generate deliverable:', err);
              }
              setDeliverableProposal(null);
            }}
            onDismiss={() => setDeliverableProposal(null)}
          />
        </div>
      )}

      {/* Chat Input Area */}
      <ChatInput
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSubmit={handleChatSubmit}
        placeholder={contextDisplay.placeholder || 'Message your team...'}
        isStreaming={(() => {
          // Derived: the button can only show "stop" if a message in the active
          // conversation is literally streaming right now. No amount of event
          // loss or state drift can leave this stuck.
          const convId = currentChatContext?.conversationId;
          if (!convId) return false;
          const msgs = messages.allMessages[convId] || [];
          return streaming.isStreaming && msgs.some(m =>
            m.status === 'streaming' ||
            (m.metadata && (m.metadata as any).isStreaming === true)
          );
        })()}
        streamingMessageId={streaming.streamingMessageId.current}
        onCancelStreaming={() => {
          const msgId = streaming.streamingMessageId.current;
          if (msgId) {
            sendWebSocketMessage({
              type: 'cancel_streaming',
              messageId: msgId
            });
          }
          // Optimistic local reset — don't wait for server ack (mobile networks drop it)
          streaming.clearAllStreamingState();
          streaming.setIsStreaming(false);
          streaming.setIsThinking(false);
        }}
        replyingTo={replyingTo}
        onClearReply={clearReply}
        activeProject={activeProject}
        handoffableAgents={handoffableAgents}
        onHandoff={handleHandoff}
        typingColleagues={typingColleagues}
      />

      {/* Add Hatch Modal */}
      <AddHatchModal
        isOpen={showAddHatchModal}
        onClose={() => setShowAddHatchModal(false)}
        onAddAgent={onAddAgent}
        activeProject={activeProject || null}
        existingAgents={activeProjectAgents}
        activeTeamId={activeTeamId}
      />

      {/* Upgrade Modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason={upgradeReason}
      />

      {/* Task Approval Modal */}
      <TaskApprovalModal
        isOpen={showTaskApprovalModal}
        onClose={() => {
          setShowTaskApprovalModal(false);
          setSuggestedTasks([]);
          setTaskSuggestionContext(null);
        }}
        tasks={suggestedTasks}
        onApproveTasks={async (approvedTasks) => {
          try {
            const response = await fetch('/api/task-suggestions/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                approvedTasks,
                projectId: taskSuggestionContext?.projectId
              })
            });
            if (response.ok) {
              devLog('Tasks created successfully');
              try {
                window.dispatchEvent(new CustomEvent('tasks_updated', { detail: { projectId: taskSuggestionContext?.projectId } }));
              } catch { }
              setShowTaskApprovalModal(false);
              setSuggestedTasks([]);
              setTaskSuggestionContext(null);
            } else {
              console.error('Failed to create tasks');
            }
          } catch (error) {
            console.error('Error creating tasks:', error);
          }
        }}
        projectName={activeProject?.name || 'Project'}
      />
    </main>
  );
}
