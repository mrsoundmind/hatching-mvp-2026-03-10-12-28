import { useState, useEffect } from 'react';
import { PauseCircle, PlayCircle } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import type { Agent } from '@shared/schema';
import type { ChatMode } from '@/lib/chatMode';
import type { ChatMessage } from '@/hooks/useChatMessages';
import { MessageBubble } from '../MessageBubble';
import { HandoffCard } from './HandoffCard';
import { DeliberationCard } from './DeliberationCard';
import { AutonomousApprovalCard } from '../AutonomousApprovalCard';

interface ChatMessageListProps {
  messages: ChatMessage[];
  messagesLoading: boolean;
  hasMoreMessages: boolean;
  loadingEarlier: boolean;
  onLoadEarlier: () => void;
  // Streaming/thinking state
  isStreaming: boolean;
  streamingAgent: string | null;
  streamingMessageId: string | null;
  isThinking: boolean;
  // Typing
  typingColleagues: string[];
  // Connection
  connectionStatus: string;
  connectionConfig: { text: string; bgColor: string };
  // Chat context
  chatMode: ChatMode | undefined;
  chatContextColor: string;
  activeProjectAgents: Agent[];
  activeProjectId: string | undefined;
  // Callbacks
  onReaction: (messageId: string, reactionType: 'thumbs_up' | 'thumbs_down') => void;
  onReply: (messageId: string, content: string, senderName: string) => void;
  // Team working
  isTeamWorking: boolean;
  teamWorkingTaskCount: number;
  workingAgentName: string | null;
  workingTaskTitle: string | null;
  workingStartedAt: number | null;
  isAutonomyPaused: boolean;
  onTogglePause: () => void;
  pauseLoading: boolean;
  // Deliberation
  deliberationState: {
    sessionId: string;
    agentNames: string[];
    roundCount: number;
    status: 'ongoing' | 'resolved';
    summary?: string;
  } | null;
  onDismissDeliberation: () => void;
  // Approvals
  approvalRequests: Array<{
    taskId: string;
    agentName: string;
    riskReasons: string[];
    projectId: string;
  }>;
  onApprove: (taskId: string) => void;
  onReject: (taskId: string) => void;
  approvalLoading: boolean;
  // Task suggestions
  suggestedTasks: any[];
  taskSuggestionContext: { conversationId: string; projectId: string } | null;
  isApprovingTasks: boolean;
  onApproveTaskSuggestions: () => void;
  onDismissTaskSuggestions: () => void;
}

export function ChatMessageList({
  messages,
  messagesLoading,
  hasMoreMessages,
  loadingEarlier,
  onLoadEarlier,
  isStreaming,
  streamingAgent,
  streamingMessageId,
  isThinking,
  typingColleagues,
  connectionStatus,
  connectionConfig,
  chatMode,
  chatContextColor,
  activeProjectAgents,
  activeProjectId,
  onReaction,
  onReply,
  isTeamWorking,
  teamWorkingTaskCount,
  workingAgentName,
  workingTaskTitle,
  workingStartedAt,
  isAutonomyPaused,
  onTogglePause,
  pauseLoading,
  deliberationState,
  onDismissDeliberation,
  approvalRequests,
  onApprove,
  onReject,
  approvalLoading,
  suggestedTasks,
  taskSuggestionContext,
  isApprovingTasks,
  onApproveTaskSuggestions,
  onDismissTaskSuggestions,
}: ChatMessageListProps) {
  return (
    <div className="relative flex-1 min-h-0">
      {/* Connection status banner */}
      {connectionStatus !== 'connected' && (
        <div className={`flex items-center justify-center gap-2 py-1.5 text-xs font-medium ${
          connectionStatus === 'connecting' ? 'bg-yellow-500/10 text-yellow-500' :
          connectionStatus === 'error' ? 'bg-red-500/10 text-red-500' :
          'bg-gray-500/10 text-gray-400'
        }`} role="status" aria-live="assertive">
          <div className={`w-2 h-2 rounded-full ${connectionConfig.bgColor}`} />
          {connectionConfig.text}
          {connectionStatus === 'disconnected' && (
            <span className="text-muted-foreground">— messages may not sync</span>
          )}
        </div>
      )}
      {/* Messages Container */}
      <div className="h-full overflow-y-auto hide-scrollbar p-6 space-y-4" role="log" aria-label="Chat messages" aria-live="polite">
        {messagesLoading && (
          <div className="flex items-center justify-center py-4">
            <div className="hatchin-text-muted text-sm">Loading conversation...</div>
          </div>
        )}

        {/* D1.2: Load earlier messages button */}
        {hasMoreMessages && (
          <div className="flex justify-center py-3">
            <button
              onClick={onLoadEarlier}
              disabled={loadingEarlier}
              className="text-sm text-slate-400 hover:text-slate-200 transition-colors px-4 py-2 rounded-lg hover:bg-slate-800/50 disabled:opacity-50"
            >
              {loadingEarlier ? 'Fetching earlier messages...' : 'Load earlier messages'}
            </button>
          </div>
        )}

        {/* Linear chat timeline */}
        {messages.map((message, index) => {
          const isGrouped = index > 0 &&
            messages[index - 1].messageType === message.messageType &&
            messages[index - 1].senderId === message.senderId &&
            (new Date(message.timestamp).getTime() - new Date(messages[index - 1].timestamp).getTime()) < 300000;

          // Handoff announcement -> render HandoffCard
          const isHandoff = (message.metadata as any)?.isHandoffAnnouncement === true;
          if (isHandoff) {
            const toAgent = activeProjectAgents.find(
              a => a.id === (message.metadata as any)?.nextAgentId
            );
            return (
              <HandoffCard
                key={message.id}
                fromAgentName={message.senderName}
                fromAgentRole={(message.metadata as any)?.agentRole}
                toAgentName={toAgent?.name ?? 'Team'}
                toAgentRole={toAgent?.role}
                taskTitle={(message.metadata as any)?.taskTitle ?? message.content}
                timestamp={message.timestamp}
              />
            );
          }

          return (
            <div key={message.id}>
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
                onReaction={onReaction}
                onReply={onReply}
                chatContext={{
                  mode: chatMode || 'project',
                  color: chatContextColor
                }}
              />
            </div>
          );
        })}

        {/* Typing Indicators - Show only if no streaming placeholder exists */}
        {(() => {
          const hasStreamingPlaceholder = messages.some(m => m.status === 'streaming' || m.metadata?.isStreaming);
          return isStreaming && streamingAgent && !hasStreamingPlaceholder && !streamingMessageId && !isThinking && typingColleagues.length === 0;
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
          <div className="mt-2 p-4 border border-hatchin-border-subtle rounded-xl bg-hatchin-surface-elevated">
            <div className="flex items-center justify-between mb-2">
              <div className="hatchin-text font-medium text-sm">Suggested tasks from this conversation</div>
              <span className="text-xs hatchin-text-muted">{suggestedTasks.length} item(s)</span>
            </div>
            <ul className="space-y-2 mb-3">
              {suggestedTasks.map((t: any, idx: number) => (
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
                onClick={onApproveTaskSuggestions}
                className="px-3 py-2 bg-blue-500 text-white rounded-md text-xs hover:bg-blue-600 disabled:opacity-60"
              >
                {isApprovingTasks ? 'Creating...' : 'Approve & Create'}
              </button>
              <button
                onClick={onDismissTaskSuggestions}
                className="px-3 py-2 bg-hatchin-surface text-foreground rounded-md text-xs hover:bg-hatchin-surface-elevated"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Team working indicator — designed waiting state (additive amber accent, honest data only) */}
        {isTeamWorking && (
          <TeamWorkingCard
            agentName={workingAgentName}
            taskTitle={workingTaskTitle}
            startedAt={workingStartedAt}
            taskCount={teamWorkingTaskCount}
            isAutonomyPaused={isAutonomyPaused}
            onTogglePause={onTogglePause}
            pauseLoading={pauseLoading}
          />
        )}

        {/* Deliberation indicator */}
        <AnimatePresence>
          {deliberationState && (
            <DeliberationCard
              key={deliberationState.sessionId}
              agentNames={deliberationState.agentNames}
              roundCount={deliberationState.roundCount}
              status={deliberationState.status}
              summary={deliberationState.summary}
              onDismiss={onDismissDeliberation}
            />
          )}
        </AnimatePresence>

        {/* UX-01: Inline approval cards */}
        <AnimatePresence>
          {approvalRequests
            .filter((r) => r.projectId === activeProjectId)
            .map((req) => (
              <AutonomousApprovalCard
                key={req.taskId}
                taskId={req.taskId}
                agentName={req.agentName}
                riskReasons={req.riskReasons}
                onApprove={onApprove}
                onReject={onReject}
                isLoading={approvalLoading}
              />
            ))}
        </AnimatePresence>

        {/* Auto-scroll helper */}
        <div ref={(el) => {
          if (el && (messages.length > 0 || typingColleagues.length > 0)) {
            el.scrollIntoView({ behavior: 'smooth' });
          }
        }} />
      </div>

    </div>
  );
}

/**
 * TeamWorkingCard — the "your team is working" waiting state.
 * Shows only honest signals: who is working, on what, and how long it has been running.
 * No invented percentage — the bar is an indeterminate shimmer, not a progress claim.
 */
function TeamWorkingCard({
  agentName,
  taskTitle,
  startedAt,
  taskCount,
  isAutonomyPaused,
  onTogglePause,
  pauseLoading,
}: {
  agentName: string | null;
  taskTitle: string | null;
  startedAt: number | null;
  taskCount: number;
  isAutonomyPaused: boolean;
  onTogglePause: () => void;
  pauseLoading: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (startedAt == null || isAutonomyPaused) return;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, isAutonomyPaused]);

  const showAgent = !!agentName && taskCount <= 1;
  const heading = isAutonomyPaused
    ? 'Autonomous execution paused'
    : showAgent
      ? `${agentName} is working`
      : `Your team is working on ${taskCount} task${taskCount !== 1 ? 's' : ''}`;
  const sub = !isAutonomyPaused && showAgent && taskTitle ? `on ${taskTitle}` : null;
  const elapsedLabel = `${Math.floor(elapsed / 60)}m ${String(elapsed % 60).padStart(2, '0')}s`;

  return (
    <div
      className="mx-4 mb-2 rounded-lg px-4 py-3"
      style={{
        background: 'linear-gradient(180deg, var(--hatchin-working-tint), var(--hatchin-working-tint-2))',
        border: '1px solid var(--hatchin-working-line)',
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {!isAutonomyPaused && (
            <span
              className="w-2 h-2 rounded-full flex-none animate-pulse"
              style={{ background: 'var(--hatchin-working-coral)' }}
            />
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight truncate" style={{ color: 'var(--hatchin-text-bright)' }}>
              {heading}
            </div>
            {sub && (
              <div className="text-xs truncate mt-0.5" style={{ color: 'var(--hatchin-text-muted)' }}>
                {sub}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-none">
          {!isAutonomyPaused && startedAt != null && (
            <span className="text-xs tabular-nums" style={{ color: 'var(--hatchin-text-muted)' }}>
              {elapsedLabel}
            </span>
          )}
          <button
            onClick={onTogglePause}
            disabled={pauseLoading}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors hover:bg-white/5 disabled:opacity-40"
            style={{ color: 'var(--hatchin-working-amber)' }}
          >
            {isAutonomyPaused ? (
              <><PlayCircle className="w-3.5 h-3.5" /> Resume</>
            ) : (
              <><PauseCircle className="w-3.5 h-3.5" /> Pause</>
            )}
          </button>
        </div>
      </div>
      {!isAutonomyPaused && (
        <div className="mt-3 h-1.5 rounded-full overflow-hidden relative" style={{ background: 'rgba(255, 255, 255, 0.09)' }}>
          <span
            className="team-working-shimmer"
            style={{ background: 'linear-gradient(90deg, var(--hatchin-working-coral), var(--hatchin-working-amber))' }}
          />
        </div>
      )}
    </div>
  );
}
