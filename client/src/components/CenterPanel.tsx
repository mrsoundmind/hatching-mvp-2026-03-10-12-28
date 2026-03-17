import { Send } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Project, Team, Agent } from "@shared/schema";
import { getRoleDefinition } from "@shared/roleRegistry";
import { useWebSocket, getWebSocketUrl, getConnectionStatusConfig } from '@/lib/websocket';
import { MessageBubble } from './MessageBubble';
import { MessageSkeleton } from './MessageSkeleton';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { AddHatchModal } from './AddHatchModal';
import { TaskApprovalModal } from './TaskApprovalModal';
import { buildConversationId } from '@/lib/conversationId';
import { devLog } from '@/lib/devLog';
import { deriveChatMode, type ChatMode } from '@/lib/chatMode';
import { useAuth } from "@/hooks/useAuth";
import { motion } from 'framer-motion';

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

  // Debug logging
  devLog('CenterPanel: projects.length =', projects.length);
  devLog('CenterPanel: projects =', projects);


  // === SUBTASK 2.1.1: Core State Integration ===

  // Chat mode state management
  const [chatMode, setChatMode] = useState<ChatMode>('project');
  const [currentChatContext, setCurrentChatContext] = useState<ChatContext | null>(null);

  // Add Hatch Modal state
  const [showAddHatchModal, setShowAddHatchModal] = useState(false);

  // Message input state (for deterministic send gating)
  const [inputValue, setInputValue] = useState('');
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Message state management - persistent across conversations
  const [allMessages, setAllMessages] = useState<Record<string, Array<{
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    messageType: 'user' | 'agent';
    timestamp: string;
    conversationId: string;
    status: 'sending' | 'sent' | 'delivered' | 'failed' | 'streaming';
    // Legacy thread fields kept for backward compatibility with stored messages.
    threadRootId?: string;
    threadDepth?: number;
    metadata?: any;
    isStreaming?: boolean;
  }>>>({});
  const [messageQueue, setMessageQueue] = useState<Array<any>>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [typingColleagues, setTypingColleagues] = useState<string[]>([]);
  const lastSendRef = useRef<{ conversationId: string; content: string; at: number } | null>(null);

  const resizeComposer = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = '0px';
    const nextHeight = Math.min(el.scrollHeight, 180);
    el.style.height = `${Math.max(48, nextHeight)}px`;
  };

  // B1: Streaming state management
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingMessageId = useRef<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingAgent, setStreamingAgent] = useState<string | null>(null);
  const [streamingConversationId, setStreamingConversationId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  // Task 10: Cycling thinking state text
  const thinkingPhrases = ['Thinking...', 'Reviewing context...', 'Forming a response...'];
  const [thinkingPhraseIdx, setThinkingPhraseIdx] = useState(0);
  const thinkingPhraseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (isThinking) {
      setThinkingPhraseIdx(0);
      thinkingPhraseTimerRef.current = setInterval(() => {
        setThinkingPhraseIdx((prev) => (prev + 1) % thinkingPhrases.length);
      }, 1800);
    } else {
      if (thinkingPhraseTimerRef.current) clearInterval(thinkingPhraseTimerRef.current);
    }
    return () => { if (thinkingPhraseTimerRef.current) clearInterval(thinkingPhraseTimerRef.current); };
  }, [isThinking]);
  const streamingTimeoutRef = useRef<number | null>(null);
  const pendingResponseTimeoutRef = useRef<number | null>(null);

  const clearStreamingTimeout = () => {
    if (streamingTimeoutRef.current) {
      clearTimeout(streamingTimeoutRef.current);
      streamingTimeoutRef.current = null;
    }
  };

  const resetStreamingTimeout = () => {
    clearStreamingTimeout();
    streamingTimeoutRef.current = window.setTimeout(() => {
      devLog('⏳ Streaming watchdog timeout - clearing streaming state');
      // Mark placeholder as failed if still present
      if (currentChatContext && streamingMessageId.current) {
        updateMessageInConversation(currentChatContext.conversationId, streamingMessageId.current, {
          status: 'failed',
          metadata: { isStreaming: false }
        });
      }
      setIsStreaming(false);
      streamingMessageId.current = null;
      setStreamingContent('');
      setStreamingAgent(null);
      setStreamingConversationId(null);
    }, 20000); // 20s watchdog
  };

  const clearPendingResponseTimeout = () => {
    if (pendingResponseTimeoutRef.current) {
      clearTimeout(pendingResponseTimeoutRef.current);
      pendingResponseTimeoutRef.current = null;
    }
  };

  const resetPendingResponseTimeout = (conversationId: string, tempMessageId: string) => {
    clearPendingResponseTimeout();
    pendingResponseTimeoutRef.current = window.setTimeout(() => {
      devLog('⏳ Pending response timeout - no streaming start received');
      updateMessageInConversation(conversationId, tempMessageId, {
        status: 'failed',
        metadata: { responseTimeout: true }
      });
      setIsThinking(false);
      setIsStreaming(false);
      setStreamingAgent(null);
      setStreamingContent('');
      setStreamingConversationId(null);
      streamingMessageId.current = null;
    }, 15000);
  };

  useEffect(() => {
    return () => {
      clearPendingResponseTimeout();
      clearStreamingTimeout();
    };
  }, []);

  // C1: Reply state management
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    content: string;
    senderName: string;
  } | null>(null);

  useEffect(() => {
    resizeComposer(messageInputRef.current);
  }, [inputValue, replyingTo, isStreaming, isThinking]);

  // === SUBTASK 3.1.1: Connect WebSocket to Chat UI ===

  // WebSocket connection for real-time messaging
  // Compute URL once per mount to prevent initialization instability
  const webSocketUrl = useMemo(() => {
    const url = getWebSocketUrl();
    // Validate URL is not empty or invalid
    if (!url || url.includes(':undefined') || url.trim() === '') {
      console.error('[WebSocket] Invalid URL generated:', url);
      // Return a safe fallback URL
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}/ws`;
    }
    return url;
  }, []); // Empty deps: compute once per mount only

  const { socket, connectionStatus, sendMessage: sendWebSocketMessage, lastMessage } = useWebSocket(webSocketUrl, {
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
      clearPendingResponseTimeout();
      clearStreamingTimeout();
      setIsThinking(false);
      setIsStreaming(false);
      setStreamingAgent(null);
      setStreamingContent('');
      setStreamingConversationId(null);
      streamingMessageId.current = null;
    },
    onError: (error) => {
      console.error('Chat messaging error:', error);
      clearPendingResponseTimeout();
      clearStreamingTimeout();
      setIsThinking(false);
      setIsStreaming(false);
      setStreamingAgent(null);
      setStreamingContent('');
      setStreamingConversationId(null);
      streamingMessageId.current = null;
    }
  });

  // Connection status configuration for UI display
  const connectionConfig = getConnectionStatusConfig(connectionStatus);

  // === SUBTASK 3.1.2: Real-time Message Sending ===

  // Shared helper: server only accepts project-/team-/agent- format
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
    if (
      last &&
      last.conversationId === conversationId &&
      last.content === normalized &&
      (now - last.at) < 1200
    ) {
      return true;
    }

    lastSendRef.current = {
      conversationId,
      content: normalized,
      at: now
    };
    return false;
  };

  // Message queuing for offline scenarios
  const queueMessage = (messageData: any) => {
    setMessageQueue(prev => [...prev, messageData]);
  };

  // Process queued messages when connection is restored (uses socket ref to avoid stale state)
  const processMessageQueue = (openSocket?: WebSocket) => {
    const ws = openSocket ?? socket;
    if (ws?.readyState === WebSocket.OPEN && messageQueue.length > 0) {
      messageQueue.forEach(messageData => {
        sendWebSocketMessage(messageData);
        if (currentChatContext) {
          updateMessageInConversation(currentChatContext.conversationId, messageData.tempId, { status: 'sent' });
        }
      });
      setMessageQueue([]);
    }
  };

  // Enhanced message sending: use socket.readyState (not connectionStatus) to avoid stale React state
  const sendMessageWithConfirmation = async (messageData: any, tempMessageId: string) => {
    try {
      if (socket?.readyState === WebSocket.OPEN) {
        const messageConversationId = messageData.message?.conversationId;
        const currentConversationId = currentChatContext?.conversationId;

        if (messageConversationId !== currentConversationId) {
          console.warn('🚫 Preventing message send - conversation context mismatch:', {
            messageConversation: messageConversationId,
            currentConversation: currentConversationId
          });
          return;
        }

        sendWebSocketMessage(messageData);

        await saveMessageToStorage(messageData.message);

        if (currentChatContext) {
          updateMessageInConversation(currentChatContext.conversationId, tempMessageId, { status: 'sent' });
        }

        devLog('Message sent successfully:', messageData);
      } else {
        queueMessage({ ...messageData, tempId: tempMessageId });

        if (currentChatContext) {
          updateMessageInConversation(currentChatContext.conversationId, tempMessageId, { status: 'sending' });
        }

        devLog('Message queued for delivery:', messageData);
      }
    } catch (error) {
      console.error('Failed to send message:', error);

      // Update message status to failed
      if (currentChatContext) {
        updateMessageInConversation(currentChatContext.conversationId, tempMessageId, { status: 'failed' });
      }
    }
  };

  // === SUBTASK 3.1.3: Real-time Message Receiving ===

  // Track processed message IDs to prevent duplicates
  const [, setProcessedMessageIds] = useState<Set<string>>(new Set());
  const processedMessageIdsRef = useRef<Set<string>>(new Set());

  // Task suggestion state (inline approval)
  const [suggestedTasks, setSuggestedTasks] = useState<any[]>([]);
  const [taskSuggestionContext, setTaskSuggestionContext] = useState<{
    conversationId: string;
    projectId: string;
  } | null>(null);
  const [isApprovingTasks, setIsApprovingTasks] = useState(false);
  const [showTaskApprovalModal, setShowTaskApprovalModal] = useState(false);

  // Handle incoming WebSocket messages
  const handleIncomingMessage = (message: any) => {
    devLog('🔔 Received WebSocket message:', message.type, message);
    devLog('🔍 Current chat context:', currentChatContext?.conversationId);

    if (message.type === 'new_message') {
      clearPendingResponseTimeout();
      setIsThinking(false);
      const messageId = message.message.id;
      const isUserMessage = message.message.messageType === 'user';

      // Enhanced duplicate prevention
      if (messageId) {
        // Skip if already processed
        if (processedMessageIdsRef.current.has(messageId)) {
          devLog('❌ Skipping already processed message:', messageId);
          return;
        }

        // Skip if this is an echo of our own message
        if (messageId.startsWith('temp-')) {
          devLog('Ignoring temp message echo:', messageId);
          return;
        }

        // Mark as processed immediately to prevent race conditions
        setProcessedMessageIds(prev => {
          const next = new Set(prev);
          next.add(messageId);
          if (next.size > 200) {
            const firstVal = next.values().next().value;
            if (firstVal) next.delete(firstVal);
          }
          processedMessageIdsRef.current = next;
          return next;
        });
      }

      // Get the actual agent name instead of defaulting to 'Colleague'
      const getActualAgentName = (agentId: string) => {
        const agent = activeProjectAgents.find(a => a.id === agentId);
        return agent ? agent.name : agentId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
      };

      const newMessage = {
        id: messageId || `msg-${Date.now()}`,
        content: message.message.content,
        senderId: message.message.messageType === 'system'
          ? 'system'
          : (message.message.agentId || message.message.userId),
        senderName: message.message.messageType === 'system'
          ? 'System'
          : (message.message.agentId
            ? getActualAgentName(message.message.agentId)
            : toDisplayText(message.message.senderName, 'You')),
        messageType: message.message.messageType === 'user' ? 'user' : 'agent',
        timestamp: message.message.timestamp || new Date().toISOString(),
        conversationId: message.message.conversationId,
        status: 'delivered' as const,
        // C1.3: Thread support for new messages
        parentMessageId: message.message.parentMessageId || undefined,
        threadRootId: message.message.threadRootId || undefined,
        threadDepth: message.message.threadDepth || 0,
        metadata: message.message.metadata
      };

      // Validate conversation context - only process messages for current context
      const isCurrentConversation = currentChatContext?.conversationId === newMessage.conversationId;

      if (!isCurrentConversation) {
        devLog('⚠️ Ignoring message from different conversation:', {
          messageConversation: newMessage.conversationId,
          currentConversation: currentChatContext?.conversationId
        });
        return;
      }

      const clientTempId = typeof message.message?.metadata?.clientTempId === 'string'
        ? message.message.metadata.clientTempId
        : undefined;

      setAllMessages(prev => {
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
            devLog('✅ Reconciled optimistic user message to persisted id:', newMessage.id);
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
          devLog('❌ Skipped duplicate message by id:', newMessage.id);
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
          devLog('❌ Skipped recent equivalent duplicate message', {
            id: newMessage.id,
            conversationId: newMessage.conversationId
          });
          return prev;
        }

        devLog('✅ Added new message to conversation:', newMessage.conversationId);
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
      // Update message status to delivered in appropriate conversation
      const conversationId = message.conversationId;
      if (conversationId) {
        updateMessageInConversation(conversationId, message.messageId, { status: 'delivered' });
      }
    }
    // B1.2: Handle streaming messages
    else if (message.type === 'streaming_started') {
      clearPendingResponseTimeout();
      // Intentionally DO NOT call setIsThinking(false) here. 
      // We want the primary thinking indicator to persist until the first real chunk arrives.
      devLog('🟢 Streaming started:', message.messageId, message.agentName);

      // Guard against duplicate placeholders for the same streaming message
      if (streamingMessageId.current === message.messageId) {
        devLog('⏭️ Skipping duplicate streaming_started for same messageId');
        return;
      }

      const convId = currentChatContext?.conversationId || '';
      const convMsgs = allMessages[convId] || [];
      const hasDuplicate = convMsgs.some(m =>
        m.id === message.messageId ||
        (m.status === 'streaming' && m.senderId === (message.agentId || 'ai-agent'))
      );
      if (hasDuplicate) {
        devLog('⏭️ Skipping streaming placeholder; duplicate detected');
        return;
      }

      setIsThinking(false);
      setIsStreaming(true);
      setTypingColleagues([]);  // clear WS-driven indicator — streaming has begun
      streamingMessageId.current = message.messageId;
      setStreamingContent('');
      setStreamingConversationId(currentChatContext?.conversationId || null);
      // Broadcast streaming state to sibling components (RightSidebar brain glow, etc.)
      window.dispatchEvent(new CustomEvent('ai_streaming_active', { detail: { active: true } }));

      // Get actual agent name for streaming and set it for the typing indicator
      const getActualAgentName = (agentId: string) => {
        const agent = activeProjectAgents.find(a => a.id === agentId);
        return agent ? agent.name : agentId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
      };

      // Use agentName directly from backend or fallback to processed agent name
      setStreamingAgent(message.agentName || getActualAgentName(message.agentId || 'ai-agent'));

      // Create placeholder message for streaming
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
        // C1.3: Thread support for streaming messages
        parentMessageId: message.parentMessageId || undefined,
        threadRootId: message.threadRootId || undefined,
        threadDepth: message.threadDepth || 0,
        metadata: { isStreaming: true }
      };

      devLog('Creating streaming placeholder message:', message.messageId, 'for agent:', message.agentName);
      addMessageToConversation(currentChatContext?.conversationId || '', streamingMessage);
      resetStreamingTimeout();
    }
    else if (message.type === 'token') {
      clearPendingResponseTimeout();
      setIsThinking(false);
      // Token-by-token streaming for real-time typing effect
      devLog('🔤 Token received:', message.content);

      // Use streamingConversationId if available, fallback to currentChatContext
      const conversationId = streamingConversationId || currentChatContext?.conversationId || '';

      if (!conversationId) {
        console.warn('⚠️ Token received but no conversation context');
        return;
      }

      setAllMessages(prev => {
        const messages = prev[conversationId] || [];

        // Find the streaming message (either by streamingMessageId or last assistant message)
        let messageIndex = -1;

        if (streamingMessageId.current) {
          // Prefer the tracked streaming message
          messageIndex = messages.findIndex(msg => msg.id === streamingMessageId.current);
        }

        // Fallback: find last assistant message if streaming message not found
        if (messageIndex === -1) {
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].messageType === 'agent' && (messages[i].isStreaming || messages[i].status === 'streaming')) {
              messageIndex = i;
              break;
            }
          }
        }

        if (messageIndex >= 0) {
          // Append token to existing streaming message (typing effect)
          const updatedMessages = [...messages];
          updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            content: updatedMessages[messageIndex].content + (message.content || ''), // APPEND token
            isStreaming: true,
            status: 'streaming' as const
          };
          devLog('✅ Appended token to streaming message:', updatedMessages[messageIndex].id, 'content length:', updatedMessages[messageIndex].content.length);
          return { ...prev, [conversationId]: updatedMessages };
        } else {
          // Create new streaming message if none exists
          const getActualAgentName = (agentId: string) => {
            const agent = activeProjectAgents.find(a => a.id === agentId);
            return agent ? agent.name : agentId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
          };

          const newStreamingMessage = {
            id: message.messageId || `streaming-${Date.now()}`,
            content: message.content || '',
            senderId: message.agentId || 'ai-agent',
            senderName: message.agentName || getActualAgentName(message.agentId || 'ai-agent'),
            messageType: 'agent' as const,
            timestamp: new Date().toISOString(),
            conversationId,
            status: 'streaming' as const,
            isStreaming: true,
            metadata: { isStreaming: true }
          };

          // Track this as the streaming message
          if (message.messageId && !streamingMessageId.current) {
            streamingMessageId.current = message.messageId;
            setIsStreaming(true);
            setStreamingConversationId(conversationId);
          }

          devLog('🆕 Created new streaming message for token:', newStreamingMessage.id);
          return { ...prev, [conversationId]: [...messages, newStreamingMessage] };
        }
      });

      // Update streaming content state
      setStreamingContent(prev => prev + (message.content || ''));
      resetStreamingTimeout();
    }
    else if (message.type === 'streaming_chunk') {
      clearPendingResponseTimeout();
      setIsThinking(false);
      devLog('📦 Streaming chunk:', message.chunk);
      if (message.messageId === streamingMessageId.current) {
        setStreamingContent(message.accumulatedContent);

        // Update the streaming message content with create-or-merge logic
        setAllMessages(prev => {
          // Use streamingConversationId if available, fallback to currentChatContext
          const conversationId = streamingConversationId || currentChatContext?.conversationId || '';
          devLog('📦 Updating streaming chunk for conversation:', conversationId, 'current context:', currentChatContext?.conversationId);
          const messages = prev[conversationId] || [];

          // Find existing message
          const messageIndex = messages.findIndex(msg => msg.id === message.messageId);

          if (messageIndex >= 0) {
            // Update existing message
            const updatedMessages = [...messages];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              content: message.accumulatedContent
            };
            devLog('✅ Updated existing streaming message:', message.messageId, 'content length:', message.accumulatedContent.length);
            return { ...prev, [conversationId]: updatedMessages };
          } else {
            // Create placeholder if message doesn't exist (handles race conditions)
            const getActualAgentName = (agentId: string) => {
              const agent = activeProjectAgents.find(a => a.id === agentId);
              return agent ? agent.name : agentId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
            };

            const placeholderMessage = {
              id: message.messageId,
              content: message.accumulatedContent,
              senderId: 'ai-agent',
              senderName: streamingAgent || 'AI',
              messageType: 'agent' as const,
              timestamp: new Date().toISOString(),
              conversationId,
              status: 'streaming' as const,
              isStreaming: true,
              metadata: { isStreaming: true }
            };

            return { ...prev, [conversationId]: [...messages, placeholderMessage] };
          }
        });
        resetStreamingTimeout();
      }
    }
    else if (message.type === 'streaming_completed') {
      clearPendingResponseTimeout();
      devLog('✅ Streaming completed');
      clearStreamingTimeout();
      setStreamingConversationId(null);
      // Signal sibling components that streaming has ended
      window.dispatchEvent(new CustomEvent('ai_streaming_active', { detail: { active: false } }));

      // Add the completed message to conversation
      if (message.message) {
        const getActualAgentName = (agentId: string) => {
          const agent = activeProjectAgents.find(a => a.id === agentId);
          return agent ? agent.name : agentId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        };

        const completedMessage = {
          id: message.message.id,
          content: message.message.content,
          senderId: message.message.agentId,
          senderName: getActualAgentName(message.message.agentId),
          messageType: 'agent' as const,
          timestamp: new Date().toISOString(),
          conversationId: message.message.conversationId,
          status: 'delivered' as const,
          parentMessageId: undefined,
          threadRootId: undefined,
          threadDepth: 0,
          metadata: {}
        };

        // CRITICAL FIX: Only update existing streaming message, never add new ones
        setAllMessages(prev => {
          const conversationId = message.message.conversationId;
          const messages = prev[conversationId] || [];

          // Find the existing streaming message to update
          devLog('Looking for streaming message with ID:', message.messageId);
          devLog('Current messages:', messages.map(m => ({ id: m.id, isStreaming: m.metadata?.isStreaming })));

          const messageIndex = messages.findIndex(msg =>
            msg.id === message.messageId && msg.metadata?.isStreaming
          );

          if (messageIndex >= 0) {
            // Update existing streaming message with final content
            const updatedMessages = [...messages];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              id: message.message.id, // Update to final message ID  
              content: message.message.content,
              senderName: getActualAgentName(message.message.agentId),
              status: 'delivered' as const,
              metadata: { ...updatedMessages[messageIndex].metadata, isStreaming: false }
            };
            return { ...prev, [conversationId]: updatedMessages };
          } else {
            // Log warning - this shouldn't happen if streaming started properly
            console.warn('Streaming completed but no streaming message found to update');
            return prev;
          }
        });

        // CRITICAL: Only clear streaming state AFTER message is updated
        setIsStreaming(false);
        streamingMessageId.current = null;
        setStreamingContent('');
        setStreamingAgent(null);
        setStreamingConversationId(null);

        devLog('Updated streaming message with final content:', message.message.conversationId);
      }
    }
    else if (message.type === 'streaming_cancelled') {
      clearPendingResponseTimeout();
      devLog('🛑 Streaming cancelled');
      setIsThinking(false);
      clearStreamingTimeout();
      setIsStreaming(false);
      streamingMessageId.current = null;
      setStreamingContent('');
      setStreamingAgent(null);
      setStreamingConversationId(null);
    }
    else if (message.type === 'streaming_error') {
      clearPendingResponseTimeout();
      devLog('❌ Streaming error received');
      setIsThinking(false);
      clearStreamingTimeout();
      const failedStreamingId = streamingMessageId.current;
      const normalizedErrorCode = typeof message.code === 'string' ? message.code : 'STREAMING_GENERATION_FAILED';
      const fallbackErrorMessageByCode: Record<string, string> = {
        OPENAI_NOT_CONFIGURED: 'I’m temporarily unavailable right now. Please retry in a moment.',
        OPENAI_RATE_LIMITED: 'I’m handling high traffic right now. Please retry in a minute.',
        OPENAI_AUTH_FAILED: 'I’m temporarily unavailable right now. Please retry in a moment.',
        OPENAI_MODEL_UNAVAILABLE: 'I’m temporarily unavailable right now. Please retry in a moment.',
        CONVERSATION_BUSY: 'I’m finishing the previous response. Please wait a moment and try again.',
        STREAMING_GENERATION_FAILED: 'I’m still here, but this reply could not be completed. Please try again.'
      };
      const normalizedErrorMessage = (typeof message.error === 'string' && message.error.trim().length > 0)
        ? message.error
        : (fallbackErrorMessageByCode[normalizedErrorCode] || 'Something went wrong while generating a reply. Please retry.');

      setIsStreaming(false);
      streamingMessageId.current = null;
      setStreamingContent('');
      setStreamingAgent(null);
      setStreamingConversationId(null);

      const targetConversationId = message.conversationId || streamingConversationId || currentChatContext?.conversationId;
      if (targetConversationId) {
        setAllMessages(prev => {
          const conversationId = targetConversationId;
          const messages = prev[conversationId] || [];
          const now = Date.now();

          const cleanedMessages = messages
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
              // Remove visual ghost bubbles from failed streams with no content
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
              senderId: 'system',
              senderName: 'System',
              messageType: 'agent' as const,
              timestamp: new Date().toISOString(),
              conversationId,
              status: 'delivered' as const,
              metadata: { systemNotice: true, errorCode: normalizedErrorCode }
            });
          }

          return {
            ...prev,
            [conversationId]: cleanedMessages
          };
        });
      }
    }
    else if (message.type === 'error') {
      clearPendingResponseTimeout();
      clearStreamingTimeout();
      setIsThinking(false);
      setIsStreaming(false);
      setStreamingContent('');
      setStreamingAgent(null);
      setStreamingConversationId(null);
      streamingMessageId.current = null;

      if (currentChatContext) {
        setAllMessages(prev => ({
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
      // Auto-clear after estimated duration + buffer
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
      // Final completed assistant message (alternative to streaming_completed)
      clearPendingResponseTimeout();
      devLog('✅ Assistant message completed:', message.messageId);
      clearStreamingTimeout();
      setStreamingConversationId(null);

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

        // Replace streaming message with final message
        setAllMessages(prev => {
          const conversationId = completedMessage.conversationId;
          const messages = prev[conversationId] || [];

          const messageIndex = messages.findIndex(msg =>
            (msg.id === message.messageId || msg.id === completedMessage.id) &&
            (msg.isStreaming || msg.status === 'streaming')
          );

          if (messageIndex >= 0) {
            const updatedMessages = [...messages];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              ...completedMessage,
              isStreaming: false,
              status: 'delivered' as const,
              metadata: { ...updatedMessages[messageIndex].metadata, isStreaming: false }
            };
            return { ...prev, [conversationId]: updatedMessages };
          } else {
            // Add as new message if streaming message not found
            return { ...prev, [conversationId]: [...messages, completedMessage] };
          }
        });

        setIsStreaming(false);
        streamingMessageId.current = null;
        setStreamingContent('');
        setStreamingAgent(null);
        setStreamingConversationId(null);

        devLog('✅ Replaced streaming message with final assistant message');
      }
    }
    else if (message.type === 'connection_confirmed') {
      devLog('🔌 WebSocket connection confirmed for:', message.conversationId);
    }
    else if (message.type === 'task_suggestions') {
      devLog('🎯 Received task suggestions:', message.tasks);
      setSuggestedTasks(message.tasks);
      setTaskSuggestionContext({
        conversationId: message.conversationId,
        projectId: message.projectId
      });
      setShowTaskApprovalModal(true);
      // Inline approval UI will render at the bottom of message list
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
    // ─── 🆕 Chat Intelligence Events ─────────────────────────────────────────
    else if (message.type === 'teams_auto_hatched') {
      devLog('✨ [AutoHatch] Teams created from chat:', message.teams, message.agents);
      // Refresh teams and agents in the sidebar
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${message.projectId}/agents`] });
      const agentCount = message.agents?.length || 0;
      if (agentCount > 0) {
        toast({ title: 'Team assembled', description: `${agentCount} AI teammate${agentCount !== 1 ? 's' : ''} added to your project` });
      }
      // Dispatch event to show animated notification
      try {
        window.dispatchEvent(new CustomEvent('teams_auto_hatched', {
          detail: {
            teams: message.teams,
            agents: message.agents,
            projectId: message.projectId,
          }
        }));
      } catch (e) {
        console.warn('Failed to dispatch teams_auto_hatched event');
      }
    }
    else if (message.type === 'task_created_from_chat') {
      devLog('✅ [ChatIntelligence] Task created from chat:', message.task);
      // Refresh tasks in the right sidebar
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
    else if (message.type === 'brain_updated_from_chat') {
      devLog('🧠 [ChatIntelligence] Project Brain updated from chat:', message.field, message.value);
      // Refresh project data in the right sidebar overview
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${message.projectId}`] });
      toast({ title: 'Project memory updated', description: `Captured: ${message.field || 'new insight'}` });
      try {
        window.dispatchEvent(new CustomEvent('brain_updated_from_chat', {
          detail: {
            field: message.field,
            value: message.value,
            updatedBy: message.updatedBy,
            projectId: message.projectId,
          }
        }));
      } catch (e) {
        console.warn('Failed to dispatch brain_updated_from_chat event');
      }
    }
    // ─── END Chat Intelligence Events ────────────────────────────────────────
  };

  // === SUBTASK 3.1.4: Message Persistence Integration ===

  // Save message to storage
  const saveMessageToStorage = async (messageData: any) => {
    try {
      // TODO: optional API persistence for messages
      devLog('Message saved to storage:', messageData);
    } catch (error) {
      console.error('Failed to save message to storage:', error);
      throw error;
    }
  };

  // Get current conversation messages - memoized for reactivity
  const getCurrentMessages = () => {
    if (!currentChatContext) return [];
    return allMessages[currentChatContext.conversationId] || [];
  };

  // Memoized current messages for reactivity - ensure it updates when messages change
  const currentMessages = useMemo(() => {
    const messages = getCurrentMessages();
    // Log for debugging
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      devLog('🔄 Current messages updated:', messages.length, 'last:', lastMsg.id, lastMsg.content?.slice(0, 30));
    }
    return messages;
  }, [currentChatContext?.conversationId, allMessages]);

  // D1.1 & D1.2: Enhanced message loading with pagination
  const { data: apiMessages, isLoading: messagesLoading } = useQuery({
    queryKey: [`/api/conversations/${currentChatContext?.conversationId}/messages`],
    enabled: !!currentChatContext?.conversationId,
    staleTime: 0, // D1.x Fix: Show messages instantly instead of caching for 30s
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
  });

  const { data: runtimeHealth } = useQuery({
    queryKey: ['/health'],
    queryFn: async () => {
      const response = await fetch('/health', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch runtime health');
      }
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

  // Process API messages when they load
  useEffect(() => {
    if (apiMessages && currentChatContext && Array.isArray(apiMessages)) {
      devLog(`📥 Loaded ${apiMessages.length} messages from API for ${currentChatContext.conversationId}`);
      // Transform API messages to match our format
      const transformedMessages = apiMessages.map((msg: any) => {
        const agentRoleFromId = msg.agentId
          ? activeProjectAgents.find((a: any) => a.id === msg.agentId)?.role
          : undefined;
        return {
          id: msg.id,
          content: msg.content,
          senderId: msg.messageType === 'system' ? 'system' : (msg.agentId || msg.userId || 'unknown'),
          senderName: msg.messageType === 'system' ? 'System' : (msg.agentId ? (() => {
            const agent = activeProjectAgents.find(a => a.id === msg.agentId);
            return agent ? agent.name : msg.agentId.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
          })() : 'You'),
          messageType: msg.messageType,
          timestamp: msg.createdAt,
          conversationId: msg.conversationId,
          status: 'delivered' as const,
          parentMessageId: msg.parentMessageId,
          threadRootId: msg.threadRootId,
          threadDepth: msg.threadDepth || 0,
          metadata: { ...(msg.metadata || {}), agentRole: msg.metadata?.agentRole ?? agentRoleFromId ?? null }
        };
      });

      // Merge messages instead of replacing to preserve in-flight streaming
      setAllMessages(prev => {
        const convoId = currentChatContext.conversationId;
        const existing = prev[convoId] || [];

        // Find existing messages that are streaming or sending
        const activeMessages = existing.filter(m => m.status === 'streaming' || m.status === 'sending');
        const activeIds = new Set(activeMessages.map(m => m.id));

        // Filter out API messages whose IDs are currently actively streaming/sending locally
        const newMessages = transformedMessages.filter(m => !activeIds.has(m.id));

        // Merge without losing active ones that might exist local-only
        const merged = [...newMessages, ...activeMessages].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        return {
          ...prev,
          [convoId]: merged
        };
      });
    }
  }, [apiMessages, currentChatContext]);

  // Cleanup processed message IDs when conversation changes
  useEffect(() => {
    setProcessedMessageIds(new Set());
    devLog('🧹 Cleaned up processed message IDs for new conversation');
  }, [currentChatContext?.conversationId]);

  // TEST: Log message structure for debugging
  devLog('📊 Current messages in linear timeline:', currentMessages.length);
  devLog('💾 API Messages loaded:', Array.isArray(apiMessages) ? apiMessages.length : 0);



  // Add message to specific conversation
  const addMessageToConversation = (conversationId: string, message: any) => {
    setAllMessages(prev => {
      const existing = prev[conversationId] || [];

      // Hard id-based dedupe.
      if (message?.id && existing.some(msg => msg.id === message.id)) {
        return prev;
      }

      // Soft dedupe for local race conditions (same content, same type, near-identical time).
      const normalizedIncoming = (message?.content || '').trim();
      if (normalizedIncoming) {
        const incomingTime = new Date(message?.timestamp || Date.now()).getTime();
        const hasEquivalent = existing.some(msg => {
          if ((msg.messageType || '') !== (message?.messageType || '')) return false;
          if ((msg.content || '').trim() !== normalizedIncoming) return false;

          // For user echoes, tolerate senderId differences between temp local user and persisted user id.
          if (message?.messageType !== 'user' && (msg.senderId || '') !== (message?.senderId || '')) {
            return false;
          }

          const msgTime = new Date(msg.timestamp || 0).getTime();
          if (!Number.isFinite(msgTime)) return false;
          return Math.abs(msgTime - incomingTime) < 10000;
        });

        if (hasEquivalent) {
          return prev;
        }
      }

      return {
        ...prev,
        [conversationId]: [...existing, message]
      };
    });
  };

  // Update message status in specific conversation
  const updateMessageInConversation = (conversationId: string, messageId: string, updates: any) => {
    setAllMessages(prev => ({
      ...prev,
      [conversationId]: (prev[conversationId] || []).map(msg =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      )
    }));
  };

  const normalizeSelectionId = (id: string | null | undefined): string | null => {
    if (typeof id !== 'string') return null;
    const normalized = id.trim();
    if (!normalized || normalized === 'undefined' || normalized === 'null') {
      return null;
    }
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


  // === END TASK 3.1 ===

  // useEffect to listen to activeProjectId, activeTeamId, activeAgentId changes
  useEffect(() => {
    if (!activeProject) {
      setCurrentChatContext(null);
      return;
    }

    // CRITICAL: Reset streaming/thinking state when changing conversation context
    // This prevents state leaks (e.g., "Thinking..." persisting) between projects
    setIsStreaming(false);
    setIsThinking(false);
    streamingMessageId.current = null;
    setStreamingContent('');
    setStreamingAgent(null);
    setStreamingConversationId(null);
    clearStreamingTimeout();
    clearPendingResponseTimeout();

    devLog('CHAT_CONTEXT_COMPUTING', {
      activeProjectId: activeProject.id,
      activeTeamId,
      activeAgentId
    });

    // Derive mode only from selections that are valid in the active project.
    const newMode: ChatMode = deriveChatMode({
      activeAgentId: hasValidAgentSelection ? normalizedAgentId : null,
      activeTeamId: hasValidTeamSelection ? normalizedTeamId : null
    });
    let participantIds: string[];
    let conversationId: string;

    if (newMode === 'agent' && selectedAgent) {
      // Agent mode: Talk to specific agent (1-on-1)
      participantIds = [selectedAgent.id];
      conversationId = buildConversationId('agent', activeProject.id, selectedAgent.id);
    } else if (newMode === 'team' && selectedTeam) {
      // Team mode: Talk to all agents under specific team
      participantIds = activeProjectAgents
        .filter(agent => agent.teamId === selectedTeam.id)
        .map(agent => agent.id);
      conversationId = buildConversationId('team', activeProject.id, selectedTeam.id);
    } else {
      // Project mode: Talk to all teams and agents under project
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

    // Update chat mode and context
    setChatMode(newMode);
    const newChatContext = {
      mode: newMode,
      participantIds,
      conversationId,
      projectId: activeProject.id
    };

    // Initialize conversation if it doesn't exist
    if (!allMessages[conversationId]) {
      setAllMessages(prev => ({
        ...prev,
        [conversationId]: []
      }));
    }

    setCurrentChatContext(newChatContext);

    // Join new conversation room via WebSocket when connected
    if (connectionStatus === 'connected') {
      sendWebSocketMessage({
        type: 'join_conversation',
        conversationId: conversationId
      });
    }

    // Debug logging for development
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

  // === END SUBTASK 2.1.1 ===

  // === SUBTASK 2.1.2: Context Calculation Logic ===

  // Get participants for current chat context
  const getCurrentChatParticipants = (): Agent[] => {
    if (!activeProject || !currentChatContext) return [];

    switch (currentChatContext.mode) {
      case 'project':
        // Project mode: Return all agents under activeProject
        return activeProjectAgents;

      case 'team':
        // Team mode: Return all agents under activeTeam
        return selectedTeam
          ? activeProjectAgents.filter(agent => agent.teamId === selectedTeam.id)
          : [];

      case 'agent':
        // Agent mode: Return single activeAgent
        return selectedAgent ? [selectedAgent] : [];

      default:
        return [];
    }
  };

  // Get shared project memory context
  const getSharedProjectMemory = () => {
    if (!activeProject) return null;

    return {
      projectId: activeProject.id,
      projectName: activeProject.name,
      projectGoal: activeProject.description || '',
      teams: activeProjectTeams,
      agents: activeProjectAgents,
      // All participants share this memory regardless of chat mode
      sharedContext: `Project: ${activeProject.name}`,
      memoryScope: 'project-wide' // Same memory for all team/agent chats
    };
  };

  // Generate conversation ID based on chat context (already implemented in useEffect)
  const generateConversationId = (mode: ChatMode, projectId: string, contextId?: string): string => {
    switch (mode) {
      case 'project':
        return `project:${projectId}`;
      case 'team':
        return `team:${projectId}:${contextId}`;
      case 'agent':
        return `agent:${projectId}:${contextId}`;
      default:
        return `project:${projectId}`;
    }
  };

  // === END SUBTASK 2.1.2 ===

  // === SUBTASK 2.1.3: Automatic Mode Switching ===

  // Get chat context display information
  const getChatContextDisplay = () => {
    if (!currentChatContext) return { title: 'Loading...', subtitle: '', participants: [] };

    const participants = getCurrentChatParticipants();

    switch (currentChatContext.mode) {
      case 'project':
        return {
          // Header identity in project mode is hard-locked to PM Maya
          // and derived ONLY from mode (not from agents list).
          title: 'Maya',
          subtitle: 'Project Manager',
          participants,
          placeholder: "Message your team...",
          welcomeTitle: 'Talk to your entire project team',
          welcomeSubtitle: 'Get insights and coordination across all teams and roles.',
          welcomeIcon: '🚀'
        };

      case 'team':
        const teamName = toDisplayText(selectedTeam?.name, 'Team');
        return {
          title: teamName,
          subtitle: `Team Chat • ${participants.length} Colleagues`,
          participants,
          placeholder: `Message ${teamName} team...`,
          welcomeTitle: `Collaborate with ${teamName}`,
          welcomeSubtitle: 'Focus on team-specific goals and coordination.',
          welcomeIcon: selectedTeam?.emoji || '👥'
        };

      case 'agent': {
        const agentRole = toDisplayText(selectedAgent?.role, 'Product Manager');
        // Show character name (e.g. "Alex") from registry, not the DB name field
        const agentName = getRoleDefinition(selectedAgent?.role)?.characterName
          ?? toDisplayText(selectedAgent?.name, agentRole);
        return {
          title: agentName,
          subtitle: `1-on-1 Chat • ${agentRole}`,
          participants,
          placeholder: `Message ${agentName}...`,
          welcomeTitle: `Chat with ${agentName}`,
          welcomeSubtitle: `Get specialized help with ${agentRole.toLowerCase()} tasks.`,
          welcomeIcon: getRoleDefinition(selectedAgent?.role)?.emoji ?? '🤖'
        };
      }

      default:
        return {
          title: 'Loading...',
          subtitle: '',
          participants: [],
          placeholder: 'Loading...',
          welcomeTitle: 'Loading...',
          welcomeSubtitle: '',
          welcomeIcon: '⏳'
        };
    }
  };

  const contextDisplay = getChatContextDisplay();

  // Dev-only UI invariant check: in project mode, header must be Maya (PM)
  useEffect(() => {
    if (
      import.meta.env.DEV &&
      typeof window !== 'undefined' &&
      (window as any).HATCHIN_UI_AUDIT &&
      currentChatContext?.mode === 'project'
    ) {
      if (contextDisplay.title !== 'Maya' || contextDisplay.subtitle !== 'Project Manager') {
        devLog('HEADER_INVARIANT_VIOLATION', {
          mode: currentChatContext.mode,
          title: contextDisplay.title,
          subtitle: contextDisplay.subtitle
        });
      }
    }
  }, [currentChatContext?.mode, contextDisplay.title, contextDisplay.subtitle]);

  // Get chat context color for bubble styling
  const getChatContextColor = () => {
    if (!currentChatContext) return 'blue';

    switch (currentChatContext.mode) {
      case 'project':
        // Use project color from schema
        return activeProject?.color || 'blue';
      case 'team':
        // Teams use green color (as per sidebar specification)
        return 'green';
      case 'agent':
        // Use agent color from schema
        return selectedAgent?.color || 'purple';
      default:
        return 'blue';
    }
  };

  const chatContextColor = getChatContextColor();

  // === END SUBTASK 2.1.3 ===

  // === SUBTASK 2.1.4: Memory Architecture Setup ===

  // Get memory context for current chat
  const getCurrentMemoryContext = () => {
    const sharedMemory = getSharedProjectMemory();
    if (!sharedMemory || !currentChatContext) return null;

    return {
      ...sharedMemory,
      // Chat-specific context
      currentMode: currentChatContext.mode,
      conversationId: currentChatContext.conversationId,
      activeParticipants: getCurrentChatParticipants(),
      // Memory scope - all participants share the same project memory
      memoryAccess: {
        canRead: sharedMemory.projectId ? true : false,
        canWrite: sharedMemory.projectId ? true : false,
        scope: 'project-wide'
      }
    };
  };

  // Connect chat context to memory system
  const chatMemoryContext = getCurrentMemoryContext();

  // Memory persistence check
  const isMemoryContextValid = () => {
    return chatMemoryContext &&
      chatMemoryContext.projectId &&
      chatMemoryContext.activeParticipants.length > 0;
  };

  // === END SUBTASK 2.1.4 ===

  // === TASK 2.3: Message Context Filtering & Participant Logic ===

  // Filter messages by current chat context
  const getFilteredMessages = () => {
    if (!currentChatContext) return [];

    // For now, return empty array - will be populated with actual messages from storage
    // Messages will be filtered by conversationId which already encodes the context
    const conversationId = currentChatContext.conversationId;

    // Future implementation will fetch from storage:
    // return messages.filter(msg => msg.conversationId === conversationId);
    return [];
  };

  // Message routing logic - determines who receives the message
  const getMessageRecipients = () => {
    if (!currentChatContext) return {
      type: 'unknown',
      recipients: [],
      scope: '',
      conversationId: ''
    };

    const participants = getCurrentChatParticipants();

    switch (currentChatContext.mode) {
      case 'project':
        // Project chat: message goes to all teams and agents under project
        return {
          type: 'project',
          recipients: participants,
          scope: `All ${activeProjectTeams.length} teams in ${activeProject?.name}`,
          conversationId: currentChatContext.conversationId
        };

      case 'team':
        // Team chat: message goes to all agents under specific team
        const activeTeam = activeProjectTeams.find(t => t.id === activeTeamId);
        return {
          type: 'team',
          recipients: participants,
          scope: `${activeTeam?.name} team (${participants.length} colleagues)`,
          conversationId: currentChatContext.conversationId
        };

      case 'agent':
        // Agent chat: message goes to specific agent only
        const activeAgent = activeProjectAgents.find(a => a.id === activeAgentId);
        return {
          type: 'agent',
          recipients: participants,
          scope: `1-on-1 with ${activeAgent?.name}`,
          conversationId: currentChatContext.conversationId
        };

      default:
        return { type: 'unknown', recipients: [], scope: '', conversationId: '' };
    }
  };

  // Conversation switching logic when context changes
  const handleConversationSwitch = (newContext: typeof currentChatContext) => {
    if (!newContext) return;

    // Save current conversation state if needed
    const currentMessages = getFilteredMessages();

    // Switch to new conversation
    const newConversationId = newContext.conversationId;
    const recipients = getMessageRecipients();

    devLog('Conversation switched:', {
      from: currentChatContext?.conversationId,
      to: newConversationId,
      mode: newContext.mode,
      recipients: recipients.scope,
      sharedMemory: chatMemoryContext?.memoryAccess?.scope
    });

    // Future: Load messages for new conversation from storage
    // loadMessagesForConversation(newConversationId);
  };

  // Memory context validation for message routing
  const validateMessageContext = () => {
    const recipients = getMessageRecipients();
    const memoryContext = getCurrentMemoryContext();

    return {
      canSendMessage: recipients.recipients.length > 0 && (memoryContext?.memoryAccess?.canWrite ?? false),
      messageScope: recipients.scope,
      memoryScope: memoryContext?.memoryAccess?.scope ?? 'unknown',
      participantCount: recipients.recipients.length
    };
  };

  // === END TASK 2.3 ===

  // A1.1 & A1.4: Handle message reactions for AI training
  const reactionMutation = useMutation({
    mutationFn: async ({ messageId, reactionType, agentId }: {
      messageId: string;
      reactionType: 'thumbs_up' | 'thumbs_down';
      agentId?: string;
    }) => {
      return await apiRequest(`/api/messages/${messageId}/reactions`, 'POST', {
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
    // Find the message to get agent ID for training
    const conversationMessages = currentChatContext ? allMessages[currentChatContext.conversationId] || [] : [];
    const message = conversationMessages.find(m => m.id === messageId);
    const agentId = message?.messageType === 'agent' ? message.senderId : undefined;

    reactionMutation.mutate({ messageId, reactionType, agentId });
  };

  // C1.1: Handle reply to message
  const handleReplyToMessage = (messageId: string, content: string, senderName: string) => {
    setReplyingTo({
      id: messageId,
      content,
      senderName
    });
    // Focus the composer after setting reply
    setTimeout(() => {
      const input = messageInputRef.current ?? (document.querySelector('[data-testid="input-message"]') as HTMLTextAreaElement | null);
      if (input) {
        input.focus();
      }
    }, 100);
  };

  // Clear reply state
  const clearReply = () => {
    setReplyingTo(null);
  };


  const handleActionClick = async (action: string) => {
    if (!currentChatContext) return;

    let message = '';
    const mode = currentChatContext.mode;

    // Generate context-appropriate messages
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
        const activeAgent = activeProjectAgents.find(a => a.id === activeAgentId);
        message = `What tasks and priorities should I focus on? What would you recommend as the next steps in your area of expertise?`;
      }
    }

    if (message) {
      try {
        // Send message through chat submit flow directly.
        // Send gating: input + context existence.
        // Must have: non-empty input, conversationId, and activeProject.
        // Connection state is handled inside sendMessageWithConfirmation (queues if offline).
        // Must NOT depend on: recipients count, agent availability, memory write permissions.
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
            devLog('🚫 Duplicate send suppressed (action click)', { conversationId: validConversationId });
            return;
          }

          setIsThinking(true);
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
            metadata: {
              clientTempId: tempMessageId
            }
          };

          addMessageToConversation(validConversationId, userMessage);

          const wsMessage = {
            type: 'send_message_streaming',
            conversationId: validConversationId,
            message: {
              ...userMessage,
              userId: user?.id || 'user',
              metadata: {
                clientTempId: tempMessageId,
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
          resetPendingResponseTimeout(validConversationId, tempMessageId);
          devLog(`Sent ${action} prompt:`, message);
          devLog('SEND_DISPATCHED', {
            mode: currentChatContext.mode,
            conversationId: validConversationId
          });
        } else {
          // Dev-only log if audit flag enabled
          devLog('SEND_BLOCKED', {
            reason: !message || message.trim().length === 0 ? 'empty_input' :
              !currentChatContext?.conversationId ? 'missing_conversationId' :
                !activeProject?.id ? 'missing_activeProjectId' :
                  'unknown',
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

  const handleChatSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    devLog('📤 Form submit triggered');
    const trimmed = inputValue.trim();
    devLog('📤 Input value:', trimmed, 'Length:', trimmed.length);

    if (trimmed) {
      const recipients = getMessageRecipients();

      devLog('SEND_ATTEMPT', {
        mode: currentChatContext?.mode,
        conversationId: currentChatContext?.conversationId,
        messageLength: inputValue.length,
        messagePreview: inputValue.substring(0, 30),
        connectionStatus
      });

      // Send gating: input + context existence.
      // Must have: non-empty input and conversationId (or allow general chat without project).
      // Connection state is handled inside sendMessageWithConfirmation (queues if offline).
      // Must NOT depend on: recipients count, agent availability, memory write permissions.
      // Allow sending in general chat (no project) OR when project + conversationId exist.
      const canSend =
        trimmed.length > 0 &&
        (
          // General chat mode (no project) - allow sending
          (!activeProject && !currentChatContext) ||
          // Project chat mode - require conversationId
          (currentChatContext?.conversationId && currentChatContext.conversationId.trim().length > 0)
        );

      if (canSend) {
        setIsThinking(true);
        const tempMessageId = `temp-${Date.now()}`;
        const timestamp = new Date().toISOString();

        // Determine conversationId: use current context or create fallback
        let conversationId = currentChatContext?.conversationId;
        if (!conversationId && activeProject) {
          conversationId = `project:${activeProject.id}`;
          console.warn('⚠️ Using fallback conversationId:', conversationId);
        } else if (!conversationId) {
          conversationId = 'general-chat';
          console.warn('⚠️ Using general chat conversationId');
        }

        const validConversationId = getValidConversationIdForSend(conversationId, activeProject);
        if (!validConversationId) {
          console.warn('Cannot send: no valid conversationId (select a project to chat)');
          return;
        }
        conversationId = validConversationId;

        if (isDuplicateSendAttempt(conversationId, trimmed)) {
          devLog('🚫 Duplicate send suppressed (chat submit)', { conversationId });
          return;
        }

        // Create user message in linear chat timeline (with optional reply reference metadata)
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

        // Add message to current conversation
        addMessageToConversation(conversationId, userMessage);

        // Prepare WebSocket message data
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

        // No need to track sent IDs anymore - we filter by userId instead

        // Send with confirmation and retry logic
        // B1.1: Send streaming message instead of regular message
        const streamingMessageData = {
          ...messageData,
          type: 'send_message_streaming'
        };

        sendMessageWithConfirmation(streamingMessageData, tempMessageId);
        resetPendingResponseTimeout(conversationId, tempMessageId);

        devLog('SEND_DISPATCHED', {
          mode: currentChatContext?.mode,
          conversationId: currentChatContext?.conversationId
        });

        // Clear input and reply state immediately after sending
        setInputValue('');
        resizeComposer(messageInputRef.current);
        if (replyingTo) {
          clearReply();
        }

        // NOTE: AI responses are handled by WebSocket streaming from server (handleStreamingColleagueResponse)
        // The simulateColleagueResponse fallback is DISABLED because we're using real OpenAI streaming
        // Server will send streaming_started, streaming_chunk, and streaming_completed events
        devLog('✅ Message sent via WebSocket - waiting for server streaming response');
      } else {
        // Always log to console for debugging - user needs to see why send failed
        const reason = !trimmed || trimmed.length === 0 ? 'empty_input' :
          (!activeProject && !currentChatContext) ? 'general_chat_allowed_but_failed' :
            (activeProject && !currentChatContext?.conversationId) ? 'missing_conversationId' :
              'unknown';

        console.error('❌ Send blocked:', reason, {
          hasInput: trimmed.length > 0,
          hasConversationId: !!currentChatContext?.conversationId,
          conversationId: currentChatContext?.conversationId,
          hasActiveProject: !!activeProject?.id,
          activeProjectId: activeProject?.id,
          connectionStatus,
          currentChatContext: currentChatContext ? 'exists' : 'null'
        });

        // Dev-only log if audit flag enabled
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

  // Show empty state when no projects exist
  if (projects.length === 0) {
    devLog('CenterPanel: Showing empty state');
    return (
      <main className="flex-1 min-h-0 premium-column-bg rounded-2xl flex flex-col my-2.5 relative overflow-hidden">
        <div className="ambient-glow-top" />
        {/* Empty State Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="max-w-lg">
            {/* Chicken hatching emoji */}
            <div className="text-[48px] mb-4">🐣</div>

            {/* Subtitle */}
            <h2 className="font-semibold hatchin-text text-lg mb-2">
              Create your first project
            </h2>

            {/* Tagline */}
            <p className="hatchin-text-muted text-sm mb-8">
              Your dreams await
            </p>

            {/* Add Project Button - at the bottom, no icon */}
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
          <div className="animate-spin w-8 h-8 border-2 border-[#6C82FF] border-t-transparent rounded-full mb-4"></div>
          <p className="hatchin-text-muted text-sm anim-pulse">Select a project to get started</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 min-h-0 premium-column-bg rounded-2xl flex flex-col my-2.5 relative overflow-hidden">
      <div className="ambient-glow-top" />
      {/* Enhanced Chat Header */}
      <div className="px-6 py-4 hatchin-border border-b">
        {/* Main Header Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold hatchin-text text-lg">
              {contextDisplay.title}
            </h1>
            {currentChatContext?.mode && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/8 text-gray-400 border border-white/10">
                {currentChatContext.mode === 'project' ? '🌐 All agents' :
                 currentChatContext.mode === 'agent' ? `💬 1-on-1` :
                 '👥 Team chat'}
              </span>
            )}
          </div>

          <button
            onClick={() => setShowAddHatchModal(true)}
            disabled={!activeProject}
            className="hatchin-bg-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-opacity-90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12h8" />
              <path d="M12 8v8" />
            </svg>
            Add Hatch
          </button>
        </div>

        {/* Subtitle and Participants Row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <span className="hatchin-text-muted font-medium text-[12px]">
            {contextDisplay.subtitle}
          </span>

          {/* Project Mode: Show Teams */}
          {currentChatContext?.mode === 'project' && activeProjectTeams.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 text-[12px]">
              {activeProjectTeams.map(team => {
                const teamAgentCount = activeProjectAgents.filter(a => a.teamId === team.id).length;
                return (
                  <div key={team.id} className="flex items-center gap-1.5 hatchin-text text-sm bg-hatchin-bg-card px-2 py-1 rounded-md">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-hatchin-text-muted">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span>{team.name}</span>
                    <span className="text-hatchin-text-muted">({teamAgentCount})</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Team Mode: Show Agents */}
          {currentChatContext?.mode === 'team' && contextDisplay.participants.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              {contextDisplay.participants.map(agent => (
                <div key={agent.id} className="flex items-center gap-1.5 hatchin-text text-sm bg-hatchin-bg-card px-2 py-1 rounded-md">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-hatchin-text-muted">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>{agent.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Message Display Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isTestMode && (
          <div className="px-6 py-2 border-b hatchin-border bg-amber-500/10 text-amber-200 text-xs">
            Test Mode: Local AI model ({runtimeProviderLabel}). Responses are for system testing only.
          </div>
        )}
        {getCurrentMessages().length === 0 && !isStreaming && !isThinking ? (
          /* Welcome Screen - Show when no messages */
          (<div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="max-w-lg">
              <div className="text-[36px] mt-[0px] mb-[0px]">{contextDisplay.welcomeIcon}</div>
              <h2 className="font-semibold hatchin-text mt-[2px] mb-[2px] text-[16px]">{contextDisplay.welcomeTitle}</h2>
              <p className="hatchin-text-muted text-[14px] mt-[0px] mb-[0px]">
                {contextDisplay.welcomeSubtitle}
              </p>

              <div className="flex flex-wrap gap-3 justify-center pt-[11px] pb-[11px]">
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
          </div>)
        ) : (
          /* Message List - Show when messages exist */
          (<>
            <div className="relative flex-1 min-h-0">
              {/* Messages Container */}
              <div className="h-full overflow-y-auto hide-scrollbar p-6 space-y-4">
                {messagesLoading && (
                  <div className="flex items-center justify-center py-4">
                    <div className="hatchin-text-muted text-sm">Loading conversation...</div>
                  </div>
                )}

                {/* Linear chat timeline (ChatGPT-style): always render chronologically */}
                {currentMessages.map((message, index) => {
                  const isGrouped = index > 0 &&
                    currentMessages[index - 1].messageType === message.messageType &&
                    currentMessages[index - 1].senderId === message.senderId &&
                    (new Date(message.timestamp).getTime() - new Date(currentMessages[index - 1].timestamp).getTime()) < 300000;

                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <MessageBubble
                        message={{
                          id: message.id,
                          content: message.content,
                          senderId: message.senderId,
                          senderName: message.senderName,
                          messageType: message.messageType,
                          timestamp: message.timestamp,
                          isStreaming: message.isStreaming,
                          status: message.status,
                          replyTo: message.metadata?.replyTo,
                          metadata: {
                            agentRole: message.metadata?.role || message.metadata?.agentRole,
                            isStreaming: message.isStreaming,
                            llm: message.metadata?.llm,
                            replyTo: message.metadata?.replyTo
                          }
                        }}
                        isGrouped={isGrouped}
                        showReactions={message.messageType === 'agent'}
                        onReaction={handleMessageReaction}
                        onReply={handleReplyToMessage}
                        chatContext={{
                          mode: currentChatContext?.mode || 'project',
                          color: chatContextColor
                        }}
                      />
                    </motion.div>
                  );
                })}

                {/* Typing Indicators - Show only if no streaming placeholder exists */}
                {(() => {
                  const currentMsgs = getCurrentMessages();
                  const hasStreamingPlaceholder = currentMsgs.some(m => m.status === 'streaming' || m.metadata?.isStreaming);
                  // Hide banner if a placeholder exists OR a placeholder is about to be created (streamingMessageId already set)
                  return isStreaming && streamingAgent && !hasStreamingPlaceholder && !streamingMessageId.current && !isThinking;
                })() && (
                    <div className="flex justify-start">
                      <div className="flex items-start gap-3 max-w-[85%]">
                        <div className="w-8 h-8 rounded-full bg-hatchin-text-muted flex items-center justify-center flex-shrink-0 mt-1">
                          <span className="text-xs font-medium text-white">{streamingAgent?.charAt(0) || '?'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium hatchin-text mb-1">
                            {streamingAgent}
                          </span>
                          <div className="bg-hatchin-colleague hatchin-text border hatchin-border rounded-2xl px-4 py-3 shadow-sm">
                            <div className="flex items-center gap-1">
                              <div className="flex gap-1">
                                <div className="w-2 h-2 bg-hatchin-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 bg-hatchin-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 bg-hatchin-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Inline Task Approval UI */}
                {suggestedTasks.length > 0 && taskSuggestionContext && (
                  <div className="mt-2 p-4 border border-gray-700 rounded-xl bg-[#2b2f36]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="hatchin-text font-medium text-sm">Suggested tasks from this conversation</div>
                      <span className="text-xs hatchin-text-muted">{suggestedTasks.length} item(s)</span>
                    </div>
                    <ul className="space-y-2 mb-3">
                      {suggestedTasks.map((t, idx) => (
                        <li key={idx} className="text-sm">
                          <span className="font-medium hatchin-text">{t.title}</span>
                          {t.description && (
                            <span className="hatchin-text-muted"> — {t.description}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <button
                        disabled={isApprovingTasks}
                        onClick={async () => {
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
                        }}
                        className="px-3 py-2 bg-blue-500 text-white rounded-md text-xs hover:bg-blue-600 disabled:opacity-60"
                      >
                        {isApprovingTasks ? 'Creating…' : 'Approve & Create'}
                      </button>
                      <button
                        onClick={() => {
                          setSuggestedTasks([]);
                          setTaskSuggestionContext(null);
                          setShowTaskApprovalModal(false);
                        }}
                        className="px-3 py-2 bg-gray-700 text-white rounded-md text-xs hover:bg-gray-600"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}


                {/* Auto-scroll helper */}
                <div ref={(el) => {
                  if (el && (getCurrentMessages().length > 0 || typingColleagues.length > 0)) {
                    el.scrollIntoView({ behavior: 'smooth' });
                  }
                }} />
              </div>

              {/* Bottom fade to separate long chat history from input composer */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#171A21] via-[#171A21]/85 to-transparent" />
            </div>
          </>)
        )}
      </div>
      {/* Typing Indicator Bar */}
      {typingColleagues.length > 0 && !isStreaming && (
        <div className="flex items-center gap-2 px-6 py-1.5 text-xs text-gray-400 border-t hatchin-border">
          <div className="flex gap-0.5">
            <span className="animate-bounce" style={{ animationDelay: '0ms' }}>·</span>
            <span className="animate-bounce" style={{ animationDelay: '75ms' }}>·</span>
            <span className="animate-bounce" style={{ animationDelay: '150ms' }}>·</span>
          </div>
          <span>
            {typingColleagues.join(', ')} {typingColleagues.length === 1 ? 'is' : 'are'} typing...
          </span>
        </div>
      )}
      {/* Chat Input */}
      <div className="p-6 hatchin-border border-t">
        {/* C1.2: Reply preview */}
        {replyingTo && (
          <div className="mb-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wide text-blue-300">Replying to {replyingTo.senderName}</div>
                <div className="mt-1 text-sm text-gray-200 truncate">
                  {replyingTo.content.length > 100 ? `${replyingTo.content.substring(0, 100)}...` : replyingTo.content}
                </div>
              </div>
              <button
                type="button"
                onClick={clearReply}
                className="rounded-md p-1 text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
                aria-label="Clear reply target"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleChatSubmit} className={`relative rounded-lg ${isStreaming || isThinking ? 'ai-thinking-ring' : ''}`}>
          <textarea
            ref={messageInputRef}
            data-testid="input-message"
            name="message"
            placeholder={contextDisplay.placeholder}
            autoComplete="off"
            value={inputValue}
            rows={1}
            onChange={(e) => {
              setInputValue(e.target.value);
              resizeComposer(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            aria-label="Message input"
            className="w-full hatchin-bg-card hatchin-border border rounded-lg px-4 pr-14 py-3 text-sm hatchin-text placeholder-hatchin-text-muted focus:outline-none focus:ring-2 focus:ring-hatchin-blue focus:border-transparent resize-none min-h-[48px] max-h-[180px] overflow-y-auto"
          />
          {/* B1.3: Show stop button during streaming, send button otherwise */}
          {isStreaming ? (
            <button
              type="button"
              onClick={() => {
                if (streamingMessageId.current) {
                  sendWebSocketMessage({
                    type: 'cancel_streaming',
                    messageId: streamingMessageId.current
                  });
                }
              }}
              className="absolute right-3 bottom-2 w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-colors"
              aria-label="Stop generating"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              aria-label="Send message"
              className="absolute right-3 bottom-2 w-8 h-8 rounded-full hatchin-blue hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>
      {/* Add Hatch Modal */}
      <AddHatchModal
        isOpen={showAddHatchModal}
        onClose={() => setShowAddHatchModal(false)}
        onAddAgent={onAddAgent}
        activeProject={activeProject || null}
        existingAgents={activeProjectAgents}
        activeTeamId={activeTeamId}
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
            // Create tasks via API
            const response = await fetch('/api/task-suggestions/approve', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                approvedTasks,
                projectId: taskSuggestionContext?.projectId
              })
            });

            if (response.ok) {
              devLog('✅ Tasks created successfully');
              // Close modal
              setShowTaskApprovalModal(false);
              setSuggestedTasks([]);
              setTaskSuggestionContext(null);
            } else {
              console.error('❌ Failed to create tasks');
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
