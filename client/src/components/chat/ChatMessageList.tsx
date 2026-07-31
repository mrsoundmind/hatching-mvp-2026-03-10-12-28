import { useState, useEffect } from 'react';
import { PauseCircle, PlayCircle, ShieldCheck, Sunrise, X } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import type { Agent } from '@shared/schema';
import type { ChatMode } from '@/lib/chatMode';
import type { ChatMessage } from '@/hooks/useChatMessages';
import { MessageBubble } from '../MessageBubble';
import { HandoffCard } from './HandoffCard';
import { DeliberationCard } from './DeliberationCard';
import { AutonomousApprovalCard } from '../AutonomousApprovalCard';
import AgentAvatar from '@/components/avatars/AgentAvatar';

/**
 * A finished piece of autonomous work, sourced from the task_execution_completed
 * WS payload. Drives the completion card (Phase 1.1).
 */
export interface CompletedWork {
  taskId: string;
  agentName: string;
  agentRole?: string | null;
  taskTitle?: string | null;
  summary?: string | null;
  peerReviewed?: boolean;
  reviewerName?: string | null;
  reviewerRole?: string | null;
}

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
  // Completed work (Phase 1.1 completion card)
  completedCards: CompletedWork[];
  onRefineCompleted: (work: CompletedWork) => void;
  onDismissCompleted: (taskId: string) => void;
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
  completedCards,
  onRefineCompleted,
  onDismissCompleted,
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
  // Phase 2.4 — return-briefing cards can be dismissed to a plain bubble (the
  // message itself stays in history).
  const [dismissedBriefings, setDismissedBriefings] = useState<Set<string>>(new Set());

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
              className="hit-target text-sm text-slate-400 hover:text-slate-200 transition-colors px-4 py-2 rounded-lg hover:bg-slate-800/50 disabled:opacity-50"
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

          // Return briefing -> render ReturnBriefingCard (Phase 2.4). Dismissing
          // falls through to the plain bubble below (message stays in history).
          const isBriefing = (message.metadata as any)?.isReturnBriefing === true;
          if (isBriefing && !dismissedBriefings.has(message.id)) {
            // A return briefing is always Maya's. If upstream name resolution fell
            // through to "You"/"AI"/empty (e.g. the briefing message arrived without a
            // resolvable agentId), force Maya so the card never reads as the user.
            const rawName = (message.senderName || '').trim();
            const briefingAuthor =
              rawName && rawName !== 'You' && !/^ai(\s|-|$)/i.test(rawName) ? rawName : 'Maya';
            return (
              <ReturnBriefingCard
                key={message.id}
                agentName={briefingAuthor}
                content={message.content}
                timestamp={message.timestamp}
                completedTasks={Number((message.metadata as any)?.completedTasks ?? 0)}
                failedTasks={Number((message.metadata as any)?.failedTasks ?? 0)}
                onDismiss={() => setDismissedBriefings((prev) => new Set(prev).add(message.id))}
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

        {/* Completion cards — the "done" moment (Phase 1.1). Reports what was made,
            who made it and who reviewed it; the human only judges (Refine / Looks good).
            Handoff is not offered here — it happens automatically and renders as its
            own handoff card. */}
        {completedCards.map((work) => (
          <TeamCompletionCard
            key={work.taskId}
            work={work}
            onRefine={onRefineCompleted}
            onDismiss={onDismissCompleted}
          />
        ))}

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

/**
 * TeamCompletionCard — the "done" moment for autonomous work.
 * Reports what was made, who made it, and who reviewed it (or that it was
 * auto-completed at low risk). The only actions are human judgment: Refine
 * (ask for changes) and Looks good (dismiss). No manual hand-off — handoff is
 * automatic and surfaces as its own card.
 */
function TeamCompletionCard({
  work,
  onRefine,
  onDismiss,
}: {
  work: CompletedWork;
  onRefine: (work: CompletedWork) => void;
  onDismiss: (taskId: string) => void;
}) {
  const reviewed = !!work.peerReviewed && !!work.reviewerName;

  return (
    <div
      className="mx-4 mb-2 rounded-xl px-4 py-4"
      style={{
        background: 'linear-gradient(180deg, var(--hatchin-surface), var(--hatchin-panel))',
        border: '1px solid var(--hatchin-border-subtle)',
      }}
      role="status"
      aria-live="polite"
    >
      {/* Header: green dot + Done + task title */}
      <div className="flex items-center gap-2 mb-3 min-w-0">
        <span
          className="w-2 h-2 rounded-full flex-none"
          style={{ background: 'var(--hatchin-green)', boxShadow: '0 0 0 4px hsla(158, 66%, 47%, 0.16)' }}
        />
        <span className="text-xs font-bold flex-none tracking-wide" style={{ color: 'var(--hatchin-green)' }}>
          Done
        </span>
        {work.taskTitle && (
          <>
            <span className="flex-none" style={{ color: 'var(--hatchin-text-muted)', opacity: 0.5 }}>·</span>
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--hatchin-text-bright)' }}>
              {work.taskTitle}
            </span>
          </>
        )}
      </div>

      {/* Summary preview */}
      {work.summary && (
        <div
          className="rounded-lg px-3 py-2.5 mb-3 text-sm leading-relaxed"
          style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--hatchin-border-subtle)', color: 'var(--hatchin-text)' }}
        >
          {work.summary}
        </div>
      )}

      {/* People: producer + reviewer (or auto-completed) */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center gap-2.5 text-sm">
          <AgentAvatar agentName={work.agentName} role={work.agentRole ?? undefined} size={24} />
          <span style={{ color: 'var(--hatchin-text)' }}>
            <span className="font-semibold" style={{ color: 'var(--hatchin-text-bright)' }}>{work.agentName}</span> made this
            {work.agentRole && (
              <span className="text-xs" style={{ color: 'var(--hatchin-text-muted)' }}> · {work.agentRole}</span>
            )}
          </span>
        </div>
        {reviewed ? (
          <div className="flex items-center gap-2.5 text-sm">
            <AgentAvatar agentName={work.reviewerName as string} role={work.reviewerRole ?? undefined} size={24} />
            <span style={{ color: 'var(--hatchin-text)' }}>
              <span className="font-semibold" style={{ color: 'var(--hatchin-text-bright)' }}>{work.reviewerName}</span> reviewed it
            </span>
            <span
              className="text-micro font-bold px-1.5 py-0.5 rounded-full flex-none"
              style={{ color: 'var(--hatchin-green)', background: 'hsla(158, 66%, 47%, 0.12)', border: '1px solid hsla(158, 66%, 47%, 0.25)' }}
            >
              CHECKED
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--hatchin-text-muted)' }}>
            <ShieldCheck className="w-3.5 h-3.5 opacity-70 flex-none" />
            Auto-completed, low risk, no review needed
          </div>
        )}
      </div>

      {/* Actions: judgment only */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onRefine(work)}
          className="hit-target text-xs font-semibold rounded-lg px-4 py-2 transition-colors hover:bg-white/5"
          style={{ color: 'var(--hatchin-text)', border: '1px solid var(--hatchin-border)' }}
        >
          Refine
        </button>
        <button
          onClick={() => onDismiss(work.taskId)}
          className="hit-target text-xs font-semibold rounded-lg px-3 py-2 transition-colors hover:text-white"
          style={{ color: 'var(--hatchin-text-muted)' }}
        >
          Looks good
        </button>
      </div>
    </div>
  );
}

/** Compact relative time for the briefing header ("2h ago", "just now"). */
function briefingTimeAgo(timestamp: string | Date): string {
  const t = new Date(timestamp).getTime();
  if (Number.isNaN(t)) return '';
  const secs = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * ReturnBriefingCard — Maya's "while you were away" summary, framed so it can't
 * be missed on return. Text is Maya's real briefing; the chips come from the
 * metadata counts the server already writes. Dismissible (collapses to a plain
 * bubble; the message stays in history).
 */
function ReturnBriefingCard({
  agentName,
  content,
  timestamp,
  completedTasks,
  failedTasks,
  onDismiss,
}: {
  agentName: string;
  content: string;
  timestamp: string | Date;
  completedTasks: number;
  failedTasks: number;
  onDismiss: () => void;
}) {
  return (
    <div
      className="mx-4 mb-3 rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, var(--hatchin-surface), var(--hatchin-panel))',
        border: '1px solid var(--hatchin-border-subtle)',
      }}
      role="status"
      aria-live="polite"
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--hatchin-border-subtle)', background: 'rgba(108, 130, 255, 0.06)' }}
      >
        <Sunrise className="w-4 h-4 flex-none" style={{ color: 'var(--hatchin-blue)' }} />
        <span className="text-micro font-bold uppercase tracking-wide" style={{ color: 'var(--hatchin-text-bright)' }}>
          While you were away
        </span>
        <span className="ml-auto text-xs" style={{ color: 'var(--hatchin-text-muted)' }}>
          {briefingTimeAgo(timestamp)}
        </span>
        <button
          onClick={onDismiss}
          className="hit-target ml-1 rounded-md p-0.5 hover:bg-white/5 transition-colors"
          aria-label="Dismiss briefing"
          style={{ color: 'var(--hatchin-text-muted)' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3.5">
        <div className="flex items-center gap-2.5 mb-2.5">
          <AgentAvatar characterName={agentName} agentName={agentName} size={26} />
          <span className="text-sm" style={{ color: 'var(--hatchin-text)' }}>
            <span className="font-semibold" style={{ color: 'var(--hatchin-text-bright)' }}>{agentName}</span>
          </span>
        </div>
        <p className="text-[15px] leading-relaxed" style={{ color: 'var(--hatchin-text)' }}>{content}</p>

        {(completedTasks > 0 || failedTasks > 0) && (
          <div className="flex items-center gap-2 flex-wrap mt-3.5">
            {completedTasks > 0 && (
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ color: 'var(--hatchin-green)', background: 'hsla(158, 66%, 47%, 0.12)', border: '1px solid hsla(158, 66%, 47%, 0.25)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
                {completedTasks} done
              </span>
            )}
            {failedTasks > 0 && (
              <>
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ color: 'var(--hatchin-working-amber)', background: 'hsla(41, 87%, 60%, 0.12)', border: '1px solid hsla(41, 87%, 60%, 0.28)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
                  {failedTasks} need{failedTasks === 1 ? 's' : ''} your review
                </span>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('hatchin:open-activity'))}
                  className="ml-auto text-xs font-semibold hover:underline"
                  style={{ color: 'var(--hatchin-working-amber)' }}
                >
                  Review &rarr;
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
