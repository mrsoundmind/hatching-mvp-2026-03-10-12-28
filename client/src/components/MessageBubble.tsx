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
import { SourceChips } from './chat/SourceChips';
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

  const safeContent = toDisplayText(message.content, '')
    // Strip action block comments that may leak through during streaming
    .replace(/<!--(?:TASK_SUGGESTION|HATCH_SUGGESTION|BRAIN_UPDATE):[\s\S]*?-->/g, '')
    // Strip partial action blocks (streaming in progress, closing --> not yet received)
    .replace(/<!--(?:TASK_SUGGESTION|HATCH_SUGGESTION|BRAIN_UPDATE):[\s\S]*$/g, '')
    .trim();
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
    const isDark = document.documentElement.classList.contains('dark');

    if (isUser) {
      return {
        className: 'text-foreground rounded-br-sm chat-bubble-user',
        style: { backgroundColor: 'var(--hatchin-card)' }
      };
    }

    if (isAgent) {
      // Boost agent bubble opacity in light mode (0.12 → 0.22) for better contrast
      const bg = !isDark ? agentColors.bg.replace(/,\s*0\.12\)/, ', 0.22)') : agentColors.bg;
      const border = !isDark ? agentColors.border.replace(/,\s*0\.35\)/, ', 0.5)') : agentColors.border;
      return {
        className: 'text-foreground rounded-bl-sm',
        style: {
          backgroundColor: bg,
          border: `1px solid ${border}`,
        }
      };
    }

    return {
      className: 'bg-hatchin-surface text-foreground rounded-bl-sm border border-hatchin-border-subtle',
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
              <p className="text-xs font-semibold text-foreground mb-1">{item.phase}</p>
              <p className="text-xs text-muted-foreground leading-snug">{item.desc}</p>
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
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold mt-0.5">
                {i + 1}
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground mb-0.5">{feature.title || feature.name}</p>
                <p className="text-xs text-muted-foreground leading-snug">{feature.desc || feature.description}</p>
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
              <span className="text-xs font-medium text-foreground">{member.role}</span>
              {member.name && <span className="text-xs text-muted-foreground">· {member.name}</span>}
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
                  <span className="text-sm font-medium text-muted-foreground">{safeSenderName}</span>
                  {isAgent && agentRole && (
                    <span className="text-xs text-muted-foreground ml-1">· {roleDef?.role ?? agentRole}</span>
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
                {/* Force readable near-white message text so it never depends on a
                    possibly-broken --foreground var (dark-on-dark bug). */}
                <div className="text-sm leading-relaxed" style={{ color: '#F5F6FA' }}>
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
                                className="bg-hatchin-panel text-green-400 px-1 py-0.5 rounded text-xs font-mono"
                                {...props}
                              >
                                {children}
                              </code>
                            ) : (
                              <pre className="bg-hatchin-panel p-3 rounded-lg overflow-x-auto my-2 max-h-[400px] overflow-y-auto">
                                <code className="text-green-400 text-xs font-mono" {...props}>
                                  {children}
                                </code>
                              </pre>
                            );
                          },
                          h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-foreground">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-base font-bold mb-2 text-foreground">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-bold mb-1 text-foreground">{children}</h3>,
                          ul: ({ children }) => <ul className="list-disc list-inside mb-2 text-foreground">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 text-foreground">{children}</ol>,
                          li: ({ children }) => <li className="mb-1">{children}</li>,
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                          em: ({ children }) => <em className="italic text-foreground">{children}</em>,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-2 border-hatchin-border-subtle pl-3 my-2 text-muted-foreground italic">
                              {children}
                            </blockquote>
                          ),
                        }}
                      >
                        {cleanText}
                      </ReactMarkdown>

                      {/* Render parsed Generative UI Widget if present */}
                      {renderWidget(widget)}

                      {/* v2.3 Per-role RAG: Sources chips from the reply's inline citations (agent replies only) */}
                      {isAgent && <SourceChips content={cleanText} />}
                    </>
                  )}
                </div>
              </div>



              {/* Timestamp - moved outside bubble */}
              <div className={`text-xs mt-1 px-1 ${isUser ? 'text-right text-muted-foreground' : 'text-left text-muted-foreground'}`}>
                {formatRelativeTime(message.timestamp)}
              </div>

              {/* Failed-response indicator. The old inline "Retry" button was a no-op
                  stub (it only logged), so it read as a broken control; removed and
                  replaced with a plain-language nudge. A real re-send is a future wiring
                  that needs the originating user message. */}
              {message.status === 'failed' && (
                <div className="flex items-center space-x-2 text-red-400 text-xs mt-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>Failed to generate response. Try sending your message again.</span>
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
                            className="h-8 w-8 p-0 rounded-full hover:bg-green-500/20 text-muted-foreground hover:text-green-400 transition-transform duration-150 hover:scale-110"
                            onClick={() => handleReaction('thumbs_up')}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
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
                            className="h-8 w-8 p-0 rounded-full hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-transform duration-150 hover:scale-110"
                            onClick={() => handleReaction('thumbs_down')}
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
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
                          className="h-8 w-8 p-0 rounded-full hover:bg-blue-500/20 text-muted-foreground hover:text-blue-400 transition-transform duration-150 hover:scale-110"
                          onClick={handleReplyToMessage}
                        >
                          <Reply className="h-3.5 w-3.5" />
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
                        className="h-8 w-8 p-0 rounded-full hover:bg-blue-500/20 text-muted-foreground hover:text-blue-400 transition-transform duration-150 hover:scale-110"
                        onClick={handleCopyMessage}
                      >
                        <Copy className="h-3.5 w-3.5" />
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
