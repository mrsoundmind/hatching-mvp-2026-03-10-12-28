import { useRef, useEffect } from 'react';
import { ArrowRightLeft, ArrowUpIcon, Paperclip } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import AgentAvatar from '@/components/avatars/AgentAvatar';
import { useAttachments } from '@/hooks/useAttachments';
import { AttachmentChip } from './AttachmentChip';

interface ChatInputProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  placeholder: string;
  isStreaming: boolean;
  streamingMessageId: string | null;
  onCancelStreaming: () => void;
  // Reply
  replyingTo: { id: string; content: string; senderName: string } | null;
  onClearReply: () => void;
  // Handoff
  activeProject: { id: string } | undefined;
  handoffableAgents: Array<{ id: string; name: string; role: string }>;
  onHandoff: (agent: { id: string; name: string; role: string }) => void;
  // Typing indicator bar
  typingColleagues: string[];
  // Delegation hint (Phase 1.2) — shown only when the team can actually be delegated to.
  showDelegateHint?: boolean;
  // Chat Attachments — the current conversation (used to scope file uploads). Attach is disabled without it.
  conversationId?: string;
}

export function ChatInput({
  inputValue,
  onInputChange,
  onSubmit,
  placeholder,
  isStreaming,
  streamingMessageId,
  onCancelStreaming,
  replyingTo,
  onClearReply,
  activeProject,
  handoffableAgents,
  onHandoff,
  typingColleagues,
  showDelegateHint,
  conversationId,
}: ChatInputProps) {
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { attachments, upload, remove, addToBrain } = useAttachments(conversationId);

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => upload(f));
    e.target.value = ''; // allow re-picking the same file
  };

  const resizeComposer = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = '0px';
    const nextHeight = Math.min(el.scrollHeight, 180);
    el.style.height = `${Math.max(32, nextHeight)}px`;
  };

  useEffect(() => {
    resizeComposer(messageInputRef.current);
  }, [inputValue, replyingTo, isStreaming]);

  return (
    <>
      {/* Chat Input */}
      <div className="px-3 pt-2 pb-3">
        {/* C1.2: Reply preview */}
        {replyingTo && (
          <div className="mb-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-micro uppercase tracking-wide text-blue-300">Replying to {replyingTo.senderName}</div>
                <div className="mt-1 text-sm text-foreground truncate">
                  {replyingTo.content.length > 100 ? `${replyingTo.content.substring(0, 100)}...` : replyingTo.content}
                </div>
              </div>
              <button
                type="button"
                onClick={onClearReply}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                aria-label="Clear reply target"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Delegation hint (Phase 1.2) — teaches the trigger phrase; only when the
            team can be delegated to, only while the composer is empty and idle. */}
        {showDelegateHint && !replyingTo && !isStreaming && !inputValue.trim() && (
          <div className="mb-2 flex items-center gap-2 text-micro text-[var(--hatchin-text-muted)]">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
              style={{ color: 'var(--hatchin-blue)', background: 'hsla(230, 100%, 71%, 0.1)', border: '1px solid hsla(230, 100%, 71%, 0.25)' }}
            >
              ✦ Tip
            </span>
            Say <b className="font-semibold text-[var(--hatchin-text)]">&ldquo;go ahead&rdquo;</b> and the team starts on your to-do list.
          </div>
        )}

        {/* Chat Attachments — tray of files attached to this conversation (one tap, stays in this chat). */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2" data-testid="attachment-tray">
            {attachments.map((att) => (
              <AttachmentChip key={att.localId} att={att} onRemove={remove} onAddToBrain={addToBrain} />
            ))}
          </div>
        )}

        {/* Hidden native file picker driven by the paperclip button. */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          multiple
          onChange={onPickFiles}
          className="hidden"
          data-testid="attachment-file-input"
        />

        <form onSubmit={onSubmit} className="relative bg-[var(--hatchin-surface)]/60 backdrop-blur-md rounded-xl border border-[var(--hatchin-border)]">
          {/* Hand off to... dropdown */}
          {activeProject && handoffableAgents.length > 0 && (
            <div className="flex items-center px-3 pt-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="hit-target flex items-center gap-1 px-2 py-1 text-micro text-[var(--hatchin-text-muted)] hover:text-[var(--hatchin-text)] hover:bg-[var(--hatchin-surface-elevated)] rounded-md transition-colors"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    Hand off to...
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[200px]">
                  {handoffableAgents.map((agent) => (
                    <DropdownMenuItem
                      key={agent.id}
                      onClick={() => onHandoff(agent)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <AgentAvatar agentName={agent.name} role={agent.role} size={20} />
                      <span className="text-sm">{agent.name}</span>
                      <span className="text-xs text-[var(--hatchin-text-muted)]">{agent.role}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          <textarea
            ref={messageInputRef}
            data-testid="input-message"
            name="message"
            placeholder={placeholder}
            autoComplete="off"
            value={inputValue}
            rows={1}
            onChange={(e) => {
              onInputChange(e.target.value);
              resizeComposer(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            aria-label="Message input"
            className="w-full bg-transparent px-3 py-2 text-sm text-[var(--hatchin-text)] placeholder:text-[var(--hatchin-text-muted)] focus:outline-none focus-visible:ring-0 resize-none min-h-[32px] max-h-[180px] overflow-y-auto border-none"
            style={{ overflow: 'hidden' }}
          />
          {/* Footer with attach + typing indicator + send/stop */}
          <div className="flex items-center justify-between px-2 pb-1.5 pt-0 min-h-[26px]">
            <div className="flex items-center gap-1 min-w-0">
              {/* Chat Attachments — paperclip opens the native file picker. Needs a conversation to scope to. */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!conversationId}
                title={conversationId ? 'Attach a file (PDF, DOCX, TXT, MD)' : 'Open a chat to attach a file'}
                aria-label="Attach a file"
                data-testid="attachment-button"
                className="hit-target flex-none rounded-lg p-1.5 text-[var(--hatchin-text-muted)] hover:text-[var(--hatchin-orange)] hover:bg-[var(--hatchin-surface-elevated)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <div className="text-micro text-muted-foreground truncate pr-2">
                {typingColleagues.length > 0 && !isStreaming && (
                  <span>
                    <span className="animate-pulse">•</span>{' '}
                    {typingColleagues.join(', ')} {typingColleagues.length === 1 ? 'is' : 'are'} typing…
                  </span>
                )}
              </div>
            </div>
            {isStreaming ? (
              <button
                type="button"
                onClick={onCancelStreaming}
                className="hit-target flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                aria-label="Stop generating"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="6" width="12" height="12" />
                </svg>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputValue.trim()}
                aria-label="Send message"
                className={`hit-target flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors ${
                  inputValue.trim()
                    ? 'bg-[var(--hatchin-surface-elevated)] text-[var(--hatchin-text)] hover:bg-[var(--hatchin-border)]'
                    : 'bg-[var(--hatchin-surface-elevated)] text-[var(--hatchin-text-muted)] cursor-not-allowed opacity-50'
                }`}
              >
                <ArrowUpIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
