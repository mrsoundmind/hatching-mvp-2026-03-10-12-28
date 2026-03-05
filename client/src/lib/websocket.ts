import { useCallback, useEffect, useRef, useState } from 'react';
import { devLog } from './devLog';
import { wsClientMessageSchema, wsServerMessageSchema } from '@shared/dto/wsSchemas';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface WebSocketHook {
  socket: WebSocket | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  sendMessage: (message: WebSocketMessage) => void;
  lastMessage: WebSocketMessage | null;
  manualReconnect: () => void;
}

export function useWebSocket(url: string, options?: {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: (socket: WebSocket) => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
}): WebSocketHook {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const socketRef = useRef<WebSocket | null>(null);
  const shouldReconnectRef = useRef(true);
  const onMessageRef = useRef(options?.onMessage);
  const onConnectRef = useRef(options?.onConnect);
  const onDisconnectRef = useRef(options?.onDisconnect);
  const onErrorRef = useRef(options?.onError);

  const retryCountRef = useRef(0);
  const maxRetries = 10;
  const joinedConversationsRef = useRef<Set<string>>(new Set());

  onMessageRef.current = options?.onMessage;
  onConnectRef.current = options?.onConnect;
  onDisconnectRef.current = options?.onDisconnect;
  onErrorRef.current = options?.onError;

  const connect = useCallback(() => {
    if (!shouldReconnectRef.current) return;

    try {
      setConnectionStatus('connecting');
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        if (socketRef.current !== ws) {
          ws.close();
          return;
        }
        devLog('WebSocket connected');
        retryCountRef.current = 0;
        devLog('WEBSOCKET_CONNECTED', {
          url,
          readyState: ws.readyState
        });
        setConnectionStatus('connected');
        setSocket(ws);

        joinedConversationsRef.current.forEach(conversationId => {
          ws.send(JSON.stringify({ type: 'join_conversation', conversationId }));
        });

        onConnectRef.current?.(ws);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const validated = wsServerMessageSchema.safeParse(parsed);
          if (!validated.success) {
            console.warn('WebSocket payload shape error:', validated.error.issues);
            return;
          }
          setLastMessage(validated.data);
          onMessageRef.current?.(validated.data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        const isActiveSocket = socketRef.current === ws;
        if (isActiveSocket) {
          socketRef.current = null;
          setSocket(null);
          setConnectionStatus('disconnected');
          onDisconnectRef.current?.();
        }

        devLog('WebSocket disconnected');

        if (!shouldReconnectRef.current) return;
        if (!isActiveSocket) return;

        if (retryCountRef.current < maxRetries) {
          const backoffDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
          retryCountRef.current++;
          devLog(`WebSocket reconnecting in ${backoffDelay}ms (Attempt ${retryCountRef.current} of ${maxRetries})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, backoffDelay);
        } else {
          console.error('WebSocket max retries reached. Stopping auto-reconnect.');
          setConnectionStatus('error');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
        onErrorRef.current?.(error);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
    }
  }, [url]);

  const manualReconnect = useCallback(() => {
    shouldReconnectRef.current = true;
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    const validated = wsClientMessageSchema.safeParse(message);
    if (!validated.success) {
      console.warn('Blocked outbound websocket payload due to schema violation:', validated.error.issues);
      return;
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      if (validated.data.type === 'join_conversation' && (validated.data as any).conversationId) {
        joinedConversationsRef.current.add((validated.data as any).conversationId);
      }
      const conversationId = (validated.data as any).conversationId || (validated.data as any).message?.conversationId || null;
      devLog('🚀 Sending active message:', validated.data.type, conversationId ?? '');
      devLog('WEBSOCKET_SEND', {
        messageType: validated.data.type,
        conversationId,
        readyState: socketRef.current.readyState
      });
      socketRef.current.send(JSON.stringify(validated.data));
    } else {
      const conversationId = (validated.data as any).conversationId || (validated.data as any).message?.conversationId || null;
      devLog('WEBSOCKET_SEND_BLOCKED', {
        messageType: validated.data.type,
        conversationId,
        readyState: socketRef.current?.readyState,
        reason: 'not_connected'
      });
      console.warn('Socket not open, message not sent:', validated.data.type);
    }
  }, []);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [url]);

  return {
    socket,
    connectionStatus,
    sendMessage,
    lastMessage,
    manualReconnect
  };
}

// WebSocket URL helper — strictly relative (same host/port that served the page)
export function getWebSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

// Message type definitions for type safety
export interface JoinConversationMessage {
  type: 'join_conversation';
  conversationId: string;
}

export interface SendMessageData {
  type: 'send_message';
  conversationId: string;
  message: {
    conversationId: string;
    userId?: string;
    agentId?: string;
    content: string;
    messageType: 'user' | 'agent' | 'system';
    metadata?: Record<string, any>;
  };
}

export interface StartTypingMessage {
  type: 'start_typing';
  conversationId: string;
  agentId: string;
  estimatedDuration?: number;
}

export interface StopTypingMessage {
  type: 'stop_typing';
  conversationId: string;
  agentId: string;
}

// Connection status indicator component (to be used in React components)
export interface ConnectionStatusProps {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export const getConnectionStatusConfig = (status: ConnectionStatusProps['status']) => {
  const statusConfig = {
    connecting: { color: 'text-yellow-500', text: 'Connecting...', bgColor: 'bg-yellow-500 animate-pulse' },
    connected: { color: 'text-green-500', text: 'Connected', bgColor: 'bg-green-500' },
    disconnected: { color: 'text-gray-500', text: 'Disconnected', bgColor: 'bg-gray-500' },
    error: { color: 'text-red-500', text: 'Connection Error', bgColor: 'bg-red-500' }
  };
  return statusConfig[status];
};
