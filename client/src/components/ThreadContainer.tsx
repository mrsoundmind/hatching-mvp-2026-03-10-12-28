import { devLog } from '@/lib/devLog';
import { useState } from 'react';
import { ChevronDown, ChevronRight, MessageSquare, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface ThreadMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  messageType: 'user' | 'agent';
  timestamp: string;
  isStreaming?: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'failed' | 'streaming';
  metadata?: {
    agentRole?: string;
    replyTo?: {
      id: string;
      content: string;
      senderName: string;
    };
  };
  parentMessageId?: string;
  threadRootId?: string;
  threadDepth: number;
}

interface ThreadContainerProps {
  rootMessage: ThreadMessage;
  replies: ThreadMessage[];
  isCollapsed: boolean;
  onToggleCollapse: (threadId: string) => void;
  onReaction?: (messageId: string, reactionType: 'thumbs_up' | 'thumbs_down') => void;
  onReply?: (messageId: string, content: string, senderName: string) => void;
  onMarkRead?: (threadId: string) => void;
  chatContext?: {
    mode: 'project' | 'team' | 'agent';
    color: string;
  };
  children: React.ReactNode; // MessageBubble components
  // C1.4.1: Thread notification properties
  unreadCount?: number;
  hasUnreadReplies?: boolean;
  lastActivityTimestamp?: string;
}

export function ThreadContainer({
  rootMessage,
  replies,
  isCollapsed,
  onToggleCollapse,
  children,
  chatContext,
  onMarkRead,
  // C1.4.1: Thread notification properties
  unreadCount = 0,
  hasUnreadReplies = false,
  lastActivityTimestamp
}: ThreadContainerProps) {
  const [isHovered, setIsHovered] = useState(false);

  const toDisplayText = (value: unknown, fallback = ''): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value && typeof value === 'object') {
      const obj = value as Record<string, any>;
      if (typeof obj.name === 'string') return obj.name;
      if (typeof obj.content === 'string') return obj.content;
      try {
        return JSON.stringify(obj);
      } catch {
        return fallback;
      }
    }
    return fallback;
  };

  const totalReplies = replies.length;
  const uniqueParticipants = new Set([
    toDisplayText(rootMessage.senderName, 'Unknown'),
    ...replies.map(r => toDisplayText(r.senderName, 'Unknown'))
  ]).size;

  const hasReplies = totalReplies > 0;

  // TEST: Log badge visibility conditions
  devLog(`🎯 Thread ${rootMessage.id}: hasReplies=${hasReplies}, unreadCount=${unreadCount}, hasUnreadReplies=${hasUnreadReplies}`);



  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thread indicator line */}
      {hasReplies && !isCollapsed && (
        <div
          className="absolute left-6 top-16 bottom-4 w-0.5 bg-gray-600 opacity-60"
          style={{
            background: `linear-gradient(to bottom, 
              hsla(158, 66%, 57%, 0.3) 0%, 
              hsla(158, 66%, 57%, 0.1) 100%)`
          }}
        />
      )}

      {/* Root message */}
      <div className="relative">
        {children}

        {/* Thread controls - only show if there are replies */}
        {hasReplies && (
          <AnimatePresence>
            {(isHovered || isCollapsed) && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="absolute -bottom-1 left-12 flex items-center gap-2"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleCollapse(rootMessage.id)}
                  className="h-6 px-2 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-600/50 text-xs text-gray-300 hover:text-white relative"
                  data-testid={`thread-toggle-${rootMessage.id}`}
                >
                  {isCollapsed ? (
                    <>
                      <ChevronRight className="w-3 h-3 mr-1" />
                      <MessageSquare className="w-3 h-3 mr-1" />
                      {totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}

                      {/* C1.4.2: Unread count badge when collapsed */}
                      {hasUnreadReplies && unreadCount > 0 && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{
                            scale: 1,
                            opacity: 1,
                            // Subtle pulse animation for attention
                            boxShadow: [
                              "0 0 0 0 rgba(59, 130, 246, 0.4)",
                              "0 0 0 4px rgba(59, 130, 246, 0)",
                              "0 0 0 0 rgba(59, 130, 246, 0)"
                            ]
                          }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{
                            duration: 0.2,
                            ease: "easeOut",
                            boxShadow: {
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onMarkRead) onMarkRead(rootMessage.id);
                          }}
                          className="cursor-pointer z-10 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 ml-1.5
                                   bg-gradient-to-r from-blue-500 to-blue-600 text-white text-[10px] font-medium rounded-full
                                   shadow-lg border border-blue-400/30 backdrop-blur-sm hover:from-blue-400 hover:to-blue-500 transition-colors"
                          data-testid={`badge-unread-${rootMessage.id}`}
                        >
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </motion.div>
                      )}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 mr-1" />
                      Hide thread
                    </>
                  )}
                </Button>

                {/* Participant count */}
                {uniqueParticipants > 1 && (
                  <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800/60 px-2 py-1 rounded border border-gray-600/30">
                    <Users className="w-3 h-3" />
                    {uniqueParticipants}
                  </div>
                )}

                {/* C1.4.2: Mark as read button when there are unread messages */}
                {hasUnreadReplies && unreadCount > 0 && !isCollapsed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Mark this thread as read
                      devLog(`📖 Marking thread ${rootMessage.id} as read`);
                      if (onMarkRead) onMarkRead(rootMessage.id);
                    }}
                    className="h-6 px-2 bg-blue-800/50 hover:bg-blue-700/60 border border-blue-600/40 text-xs text-blue-300 hover:text-blue-200"
                    data-testid={`button-mark-read-${rootMessage.id}`}
                  >
                    Mark read ({unreadCount})
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Thread replies */}
      {hasReplies && !isCollapsed && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="ml-8 relative"
            data-testid={`thread-replies-${rootMessage.id}`}
          >
            {/* Thread replies will be rendered here by parent component */}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Collapsed thread preview */}
      {hasReplies && isCollapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="ml-8 mt-2 p-3 bg-gray-800/30 border border-gray-600/30 rounded-lg"
          data-testid={`thread-preview-${rootMessage.id}`}
        >
          <div className="text-xs text-gray-400 mb-1 flex items-center gap-2">
            <span>
              Thread collapsed • {totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}
              {uniqueParticipants > 1 && ` • ${uniqueParticipants} participants`}
            </span>

            {/* C1.4.2: Unread indicator in collapsed preview */}
            {hasUnreadReplies && unreadCount > 0 && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  // Gentle glow effect
                  boxShadow: [
                    "0 0 0 0 rgba(59, 130, 246, 0.3)",
                    "0 0 6px 2px rgba(59, 130, 246, 0.1)",
                    "0 0 0 0 rgba(59, 130, 246, 0.3)"
                  ]
                }}
                transition={{
                  duration: 0.2,
                  ease: "easeOut",
                  boxShadow: {
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onMarkRead) onMarkRead(rootMessage.id);
                }}
                className="cursor-pointer z-10 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1
                         bg-gradient-to-r from-blue-500 to-blue-600 text-white text-[10px] font-medium rounded-full
                         shadow-lg border border-blue-400/30 backdrop-blur-sm hover:from-blue-400 hover:to-blue-500 transition-colors"
                data-testid={`badge-unread-preview-${rootMessage.id}`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </motion.div>
            )}
          </div>
          {replies.length > 0 && (
            <div className="text-sm text-gray-300 truncate">
              <span className="font-medium">{toDisplayText(replies[replies.length - 1].senderName, 'Unknown')}:</span>{' '}
              {toDisplayText(replies[replies.length - 1].content, '').substring(0, 80)}...
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
