import { devLog } from '@/lib/devLog';
import { getAgentColors } from '@/lib/agentColors';
import { getRoleDefinition } from '@shared/roleRegistry';
import AgentAvatar from '@/components/avatars/AgentAvatar';
import { ThumbsUp, ThumbsDown, Copy, Reply, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface MessageBubbleProps {
  message: {
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
      isStreaming?: boolean;
      llm?: {
        provider?: string;
        mode?: string;
        model?: string;
      };
      replyTo?: {
        id: string;
        content: string;
        senderName: string;
      };
    };
    replyTo?: {
      id: string;
      content: string;
      senderName: string;
    };
  };
  isGrouped?: boolean; // whether this message is grouped with previous message from same sender
  showReactions?: boolean; // only show reactions for agent messages
  onReaction?: (messageId: string, reactionType: 'thumbs_up' | 'thumbs_down') => void;
  onReply?: (messageId: string, content: string, senderName: string) => void;
  chatContext?: {
    mode: 'project' | 'team' | 'agent';
    color: string;
  };
}

export function MessageBubble({
  message,
  isGrouped = false,
  showReactions = false,
  onReaction,
  onReply,
  chatContext
}: MessageBubbleProps) {
  const { toast } = useToast();

  const isUser = message.messageType === 'user';
  const isAgent = message.messageType === 'agent';

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

  const safeContent = toDisplayText(message.content, '');
  // P8: Role-aware bubble colors + character name from registry
  const agentRole = message.metadata?.agentRole;
  const agentColors = getAgentColors(agentRole);
  const roleDef = agentRole ? getRoleDefinition(agentRole) : undefined;
  // Show character name (e.g. "Alex") instead of DB name (e.g. "Product Manager")
  const displayName = isAgent
    ? (roleDef?.characterName ?? toDisplayText(message.senderName, 'Agent'))
    : toDisplayText(message.senderName, 'You');
  const safeSenderName = displayName;

  const getBubbleStyles = () => {
    if (isUser) {
      return {
        className: 'text-gray-100 rounded-br-sm',
        style: { backgroundColor: 'hsl(216, 8%, 18%)' }
      };
    }

    if (isAgent) {
      return {
        className: 'text-gray-100 rounded-bl-sm',
        style: {
          backgroundColor: agentColors.bg,
          border: `1px solid ${agentColors.border}`,
        }
      };
    }

    return {
      className: 'bg-gray-700 text-gray-100 rounded-bl-sm border border-gray-600',
      style: {}
    };
  };

  // A1.1: Relative time formatting  
  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - messageTime.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  };

  // A2.1: Copy message to clipboard
  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(safeContent);
      toast({
        description: "Message copied to clipboard",
        duration: 2000,
      });
    } catch (error) {
      toast({
        description: "Failed to copy message",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  // A1.1: Handle reaction button clicks
  const handleReaction = (reactionType: 'thumbs_up' | 'thumbs_down') => {
    if (onReaction) {
      onReaction(message.id, reactionType);
      toast({
        description: `Feedback sent! This helps improve AI responses.`,
        duration: 3000,
      });
    }
  };

  // C1.1: Handle reply to message
  const handleReplyToMessage = () => {
    if (onReply) {
      onReply(message.id, safeContent, safeSenderName);
    }
  };

  // A3.2: Message grouping logic - don't show sender name/avatar if grouped
  const showSenderInfo = !isGrouped && isAgent;
  const shouldShowActionRow = Boolean(onReply) || (showReactions && isAgent);

  // 15b: Extract widget JSON if present
  const extractWidget = (content: string): { widget: any | null; text: string } => {
    const jsonFenceRegex = /```json\s*({[\s\S]*?widgetType[\s\S]*?})\s*```/;
    const match = content.match(jsonFenceRegex);
    if (!match) return { widget: null, text: content };
    try {
      const widget = JSON.parse(match[1]);
      const text = content.replace(match[0], '').trim();
      return { widget, text };
    } catch {
      return { widget: null, text: content };
    }
  };

  const { widget, text: cleanText } = extractWidget(safeContent);

  // 15c: Map widget data to rich UI components
  const renderWidget = (widget: any) => {
    if (!widget) return null;

    // Timeline Widget
    if (widget.widgetType === 'timeline' && Array.isArray(widget.data)) {
      return (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2 custom-scrollbar hide-scrollbar">
          {widget.data.map((item: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex-shrink-0 w-44 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors cursor-default"
            >
              <div className="w-3 h-3 rounded-full mb-2" style={{ backgroundColor: item.color || '#6C82FF' }} />
              <p className="text-xs font-semibold text-gray-200 mb-1">{item.phase}</p>
              <p className="text-xs text-gray-400 leading-snug">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      );
    }

    // Feature List Widget
    if (widget.widgetType === 'feature_list' && Array.isArray(widget.data)) {
      return (
        <div className="mt-4 grid gap-2">
          {widget.data.map((feature: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-3 p-2.5 rounded-lg bg-white/5 border border-white/10"
            >
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold mt-0.5">
                {i + 1}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-200 mb-0.5">{feature.title || feature.name}</p>
                <p className="text-xs text-gray-400 leading-snug">{feature.desc || feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      );
    }

    // Team Breakdown Widget
    if (widget.widgetType === 'team_breakdown' && Array.isArray(widget.data)) {
      return (
        <div className="mt-4 flex flex-wrap gap-2">
          {widget.data.map((member: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: member.color || '#A855F7' }} />
              <span className="text-xs font-medium text-gray-200">{member.role}</span>
              {member.name && <span className="text-[10px] text-gray-500">· {member.name}</span>}
            </motion.div>
          ))}
        </div>
      );
    }

    return null;
  };


  return (
    <TooltipProvider>
      <ContextMenu>
        <ContextMenuTrigger>
          <motion.div
            className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-1' : 'mt-4'}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className={`max-w-[70%] ${isUser ? 'ml-auto' : 'mr-auto'}`}>
              {/* Agent sender info (only if not grouped) */}
              {showSenderInfo && (
                <div className="flex items-center gap-2 mb-2 px-1">
                  {isAgent ? (
                    <AgentAvatar
                      role={agentRole}
                      agentName={safeSenderName}
                      state={message.isStreaming ? 'thinking' : 'idle'}
                      size={26}
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
                      {safeSenderName.charAt(0)}
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-300">{safeSenderName}</span>
                  {isAgent && agentRole && (
                    <span className="text-xs text-gray-500 ml-1">· {roleDef?.role ?? agentRole}</span>
                  )}
                </div>
              )}

              {/* Message bubble */}
              <div
                className={`p-3 rounded-lg ${getBubbleStyles().className} ${isAgent ? 'ai-bubble-border' : ''}`}
                style={getBubbleStyles().style}
              >
                {/* C1.1: Render reply context if exists */}
                {(message.replyTo || message.metadata?.replyTo) && (
                  <div className="mb-2 p-2 rounded bg-white/5 border-l-2 border-green-400/50 text-xs opacity-80 line-clamp-2">
                    <div className="font-semibold text-green-400/90 mb-0.5">
                      Replying to {(message.replyTo || message.metadata?.replyTo)?.senderName}
                    </div>
                    <div className="truncate italic">
                      {(message.replyTo || message.metadata?.replyTo)?.content}
                    </div>
                  </div>
                )}

                {/* C4.3: Markdown support for message content */}
                <div className="text-sm leading-relaxed">
                  {/* Show role-specific thinking phrase when streaming with empty content */}
                  {isAgent && message.isStreaming && safeContent.trim() === '' ? (
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs ${agentColors.text}`}>{agentColors.thinkingPhrase || 'Thinking'}</span>
                      <div className="flex items-end space-x-1" style={{ height: '14px' }}>
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-1.5 h-1.5 bg-hatchin-blue rounded-full block"
                            style={{
                              animation: `wave-bounce 1.2s ease-in-out infinite`,
                              animationDelay: `${i * 0.18}s`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                          // Custom styling for markdown elements
                          code: ({ node, className, children, ...props }) => {
                            const inline = !className?.includes('language-');
                            return inline ? (
                              <code
                                className="bg-gray-800 text-green-400 px-1 py-0.5 rounded text-xs font-mono"
                                {...props}
                              >
                                {children}
                              </code>
                            ) : (
                              <pre className="bg-gray-800 p-3 rounded-lg overflow-x-auto my-2">
                                <code className="text-green-400 text-xs font-mono" {...props}>
                                  {children}
                                </code>
                              </pre>
                            );
                          },
                          h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-gray-100">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-base font-bold mb-2 text-gray-100">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-bold mb-1 text-gray-100">{children}</h3>,
                          ul: ({ children }) => <ul className="list-disc list-inside mb-2 text-gray-200">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 text-gray-200">{children}</ol>,
                          li: ({ children }) => <li className="mb-1">{children}</li>,
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold text-gray-100">{children}</strong>,
                          em: ({ children }) => <em className="italic text-gray-200">{children}</em>,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-2 border-gray-600 pl-3 my-2 text-gray-300 italic">
                              {children}
                            </blockquote>
                          ),
                        }}
                      >
                        {cleanText}
                      </ReactMarkdown>

                      {/* Render parsed Generative UI Widget if present */}
                      {renderWidget(widget)}
                    </>
                  )}
                </div>
              </div>

              {isAgent && message.metadata?.llm?.mode === 'test' && (
                <div className="mt-2 text-xs text-amber-300/90">
                  Test Mode (Local Model)
                </div>
              )}

              {/* Timestamp - moved outside bubble */}
              <div className={`text-xs mt-1 px-1 ${isUser ? 'text-right text-gray-400' : 'text-left text-gray-500'}`}>
                {formatRelativeTime(message.timestamp)}
              </div>

              {/* B1.4: Enhanced error handling UI */}
              {message.status === 'failed' && (
                <div className="flex items-center space-x-2 text-red-400 text-xs mt-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>Failed to generate response</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 px-1 text-xs hover:text-red-600"
                    onClick={() => {
                      // Retry logic would go here
                      devLog('Retry streaming for message:', message.id);
                    }}
                  >
                    Retry
                  </Button>
                </div>
              )}

              {/* Actions row: always visible for reply/copy and feedback controls */}
              {shouldShowActionRow && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className={`flex items-center gap-1 mt-2 ${isUser ? 'justify-end mr-1' : 'ml-1'}`}
                >
                  {showReactions && isAgent && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-green-500/20 text-gray-400 hover:text-green-400"
                            onClick={() => handleReaction('thumbs_up')}
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Good response</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                            onClick={() => handleReaction('thumbs_down')}
                          >
                            <ThumbsDown className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Could be better</p>
                        </TooltipContent>
                      </Tooltip>
                    </>
                  )}

                  {onReply && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400"
                          onClick={handleReplyToMessage}
                        >
                          <Reply className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Reply to message</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400"
                        onClick={handleCopyMessage}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copy message</p>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              )}
            </div>
          </motion.div>
        </ContextMenuTrigger>

        {/* A2.2: Context menu for additional actions */}
        <ContextMenuContent>
          <ContextMenuItem onClick={handleCopyMessage}>
            <Copy className="w-4 h-4 mr-2" />
            Copy message
          </ContextMenuItem>
          {/* C1.1: Reply option in context menu */}
          <ContextMenuItem onClick={handleReplyToMessage}>
            <Reply className="w-4 h-4 mr-2" />
            Reply to message
          </ContextMenuItem>
          {showReactions && isAgent && (
            <>
              <ContextMenuItem onClick={() => handleReaction('thumbs_up')}>
                <ThumbsUp className="w-4 h-4 mr-2" />
                Good response
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleReaction('thumbs_down')}>
                <ThumbsDown className="w-4 h-4 mr-2" />
                Could be better
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </TooltipProvider>
  );
}
