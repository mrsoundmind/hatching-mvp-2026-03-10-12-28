import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { devLog } from '@/lib/devLog';
import type { Agent } from '@shared/schema';

export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  messageType: 'user' | 'agent';
  timestamp: string;
  conversationId: string;
  status: 'sending' | 'sent' | 'delivered' | 'failed' | 'streaming';
  threadRootId?: string;
  threadDepth?: number;
  metadata?: any;
  isStreaming?: boolean;
}

export interface ChatMessagesState {
  allMessages: Record<string, ChatMessage[]>;
  currentMessages: ChatMessage[];
  messagesLoading: boolean;
  hasMoreMessages: boolean;
  loadingEarlier: boolean;
  processedMessageIdsRef: React.MutableRefObject<Set<string>>;
}

export interface ChatMessagesActions {
  setAllMessages: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  addMessageToConversation: (conversationId: string, message: any) => void;
  updateMessageInConversation: (conversationId: string, messageId: string, updates: any) => void;
  loadEarlierMessages: () => Promise<void>;
  markMessageProcessed: (messageId: string) => void;
  isMessageProcessed: (messageId: string) => boolean;
  clearProcessedMessageIds: () => void;
}

interface UseChatMessagesOptions {
  conversationId: string | undefined;
  activeProjectAgents: Agent[];
}

export function useChatMessages(options: UseChatMessagesOptions): ChatMessagesState & ChatMessagesActions {
  const { conversationId, activeProjectAgents } = options;

  // Message state management - persistent across conversations
  const [allMessages, setAllMessages] = useState<Record<string, ChatMessage[]>>({});

  // D1.2 Pagination state
  const [earlierMessages, setEarlierMessages] = useState<any[]>([]);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextMessageCursor, setNextMessageCursor] = useState<string | null>(null);

  // Track processed message IDs to prevent duplicates
  const [, setProcessedMessageIds] = useState<Set<string>>(new Set());
  const processedMessageIdsRef = useRef<Set<string>>(new Set());

  // D1.1 & D1.2: Enhanced message loading with pagination
  const { data: apiMessagesResponse, isLoading: messagesLoading } = useQuery<{
    messages: any[];
    hasMore: boolean;
    nextCursor: string | null;
  }>({
    queryKey: [`/api/conversations/${conversationId}/messages`],
    enabled: !!conversationId,
    staleTime: 0,
    refetchOnWindowFocus: false,
    select: (data: any) => {
      if (Array.isArray(data)) {
        return { messages: data, hasMore: false, nextCursor: null };
      }
      return data;
    },
  });

  // Process API messages when they load
  useEffect(() => {
    if (apiMessagesResponse && conversationId) {
      const apiMessages = apiMessagesResponse.messages;
      if (!apiMessages || !Array.isArray(apiMessages)) return;
      // Guard: if activeProject has no agents loaded yet, defer transform
      if (activeProjectAgents.length === 0) return;

      // Sync pagination state from response envelope
      setHasMoreMessages(apiMessagesResponse.hasMore);
      setNextMessageCursor(apiMessagesResponse.nextCursor);
      // Reset earlier messages on conversation change
      setEarlierMessages([]);

      devLog(`Loaded ${apiMessages.length} messages from API for ${conversationId}`);

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
        const convoId = conversationId;
        const existing = prev[convoId] || [];

        // Keep in-flight streaming placeholders, AND any just-sent optimistic message that this
        // refetch's payload doesn't include yet. Without the second clause, a refetch that resolves
        // before the server has persisted the user's message (e.g. the reconnect refetch fired when
        // returning from being away) rebuilds the list from the API alone and silently drops the
        // user's own message — it only reappears on the next refetch. A user message is 'sending'
        // for only a few ms before it's bumped to 'sent'/'delivered', so status alone isn't enough;
        // gate on "not in the API window yet" so the API stays authoritative once it catches up
        // (dedup by id below), and WS reconciliation still collapses a temp id into its real one.
        const apiIds = new Set(transformedMessages.map((m: any) => m.id));
        const activeMessages = existing.filter(m =>
          m.status === 'streaming' ||
          m.status === 'sending' ||
          (!apiIds.has(m.id) && (m.status === 'sent' || m.status === 'delivered' || m.status === 'failed'))
        );
        const activeIds = new Set(activeMessages.map(m => m.id));

        const newMessages = transformedMessages.filter((m: any) => !activeIds.has(m.id));

        const merged = [...newMessages, ...activeMessages].sort(
          (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        return {
          ...prev,
          [convoId]: merged
        };
      });
    }
  }, [apiMessagesResponse, conversationId, activeProjectAgents]);

  // Cleanup processed message IDs when conversation changes
  useEffect(() => {
    setProcessedMessageIds(new Set());
    processedMessageIdsRef.current = new Set();
    devLog('Cleaned up processed message IDs for new conversation');
  }, [conversationId]);

  // Memoized current messages
  const currentMessages = useMemo(() => {
    if (!conversationId) return [];
    const apiWindow = allMessages[conversationId] || [];

    const transformed = earlierMessages.map((msg: any) => {
      const agentRoleFromId = msg.agentId
        ? activeProjectAgents.find((a: any) => a.id === msg.agentId)?.role
        : undefined;
      return {
        id: msg.id,
        content: msg.content,
        senderId: msg.messageType === 'system' ? 'maya-fallback' : (msg.agentId || msg.userId || 'unknown'),
        senderName: msg.messageType === 'system' ? 'Maya' : (msg.agentId ? (() => {
          const agent = activeProjectAgents.find((a: any) => a.id === msg.agentId);
          return agent ? agent.name : msg.agentId.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        })() : 'You'),
        messageType: msg.messageType,
        timestamp: msg.createdAt,
        conversationId: msg.conversationId,
        status: 'delivered' as const,
        isStreaming: false,
        metadata: { ...(msg.metadata || {}), agentRole: msg.metadata?.agentRole ?? agentRoleFromId ?? null },
      };
    });

    const messages = [...transformed, ...apiWindow];
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      devLog('Current messages updated:', messages.length, 'last:', lastMsg.id, lastMsg.content?.slice(0, 30));
    }
    return messages;
  }, [conversationId, allMessages, earlierMessages, activeProjectAgents]);

  // D1.2: Load earlier messages via cursor pagination
  const loadEarlierMessages = useCallback(async () => {
    if (!nextMessageCursor || !conversationId || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages?before=${encodeURIComponent(nextMessageCursor)}&limit=50`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to load earlier messages');
      const data = await response.json();
      const olderMsgs: any[] = Array.isArray(data) ? data : (data.messages || []);
      const olderHasMore: boolean = Array.isArray(data) ? false : (data.hasMore ?? false);
      const olderCursor: string | null = Array.isArray(data) ? null : (data.nextCursor ?? null);
      setEarlierMessages(prev => [...olderMsgs, ...prev]);
      setHasMoreMessages(olderHasMore);
      setNextMessageCursor(olderCursor);
    } catch (err) {
      console.error('Failed to load earlier messages:', err);
    } finally {
      setLoadingEarlier(false);
    }
  }, [nextMessageCursor, conversationId, loadingEarlier]);

  // Add message to specific conversation
  const addMessageToConversation = useCallback((conversationId: string, message: any) => {
    setAllMessages(prev => {
      const existing = prev[conversationId] || [];

      if (message?.id && existing.some(msg => msg.id === message.id)) {
        return prev;
      }

      const normalizedIncoming = (message?.content || '').trim();
      if (normalizedIncoming) {
        const incomingTime = new Date(message?.timestamp || Date.now()).getTime();
        const hasEquivalent = existing.some(msg => {
          if ((msg.messageType || '') !== (message?.messageType || '')) return false;
          if ((msg.content || '').trim() !== normalizedIncoming) return false;
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
  }, []);

  // Update message status in specific conversation
  const updateMessageInConversation = useCallback((conversationId: string, messageId: string, updates: any) => {
    setAllMessages(prev => ({
      ...prev,
      [conversationId]: (prev[conversationId] || []).map(msg =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      )
    }));
  }, []);

  const markMessageProcessed = useCallback((messageId: string) => {
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
  }, []);

  const isMessageProcessed = useCallback((messageId: string) => {
    return processedMessageIdsRef.current.has(messageId);
  }, []);

  const clearProcessedMessageIds = useCallback(() => {
    setProcessedMessageIds(new Set());
    processedMessageIdsRef.current = new Set();
  }, []);

  return {
    // State
    allMessages,
    currentMessages,
    messagesLoading,
    hasMoreMessages,
    loadingEarlier,
    processedMessageIdsRef,
    // Actions
    setAllMessages,
    addMessageToConversation,
    updateMessageInConversation,
    loadEarlierMessages,
    markMessageProcessed,
    isMessageProcessed,
    clearProcessedMessageIds,
  };
}
