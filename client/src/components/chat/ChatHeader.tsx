import type { Team, Agent } from '@shared/schema';
import type { ChatMode } from '@/lib/chatMode';
import AgentAvatar from '@/components/avatars/AgentAvatar';

interface ChatHeaderProps {
  contextDisplay: {
    title: string;
    subtitle: string;
    participants: Agent[];
  };
  chatMode: ChatMode | undefined;
  activeProject: { id: string; name?: string; color?: string } | undefined;
  activeProjectTeams: Team[];
  activeProjectAgents: Agent[];
  onAddHatchClick: () => void;
}

export function ChatHeader({
  contextDisplay,
  chatMode,
  activeProject,
  activeProjectTeams,
  activeProjectAgents,
  onAddHatchClick,
}: ChatHeaderProps) {
  const stackAgents: Agent[] =
    chatMode === 'project'
      ? activeProjectAgents.slice(0, 3)
      : contextDisplay.participants.slice(0, 3);
  const totalCount =
    chatMode === 'project'
      ? activeProjectAgents.length
      : contextDisplay.participants.length;
  const extra = Math.max(0, totalCount - stackAgents.length);

  const modeLabel =
    chatMode === 'project'
      ? 'Everyone'
      : chatMode === 'agent'
        ? '1-on-1'
        : 'Team chat';

  return (
    <div className="h-11 px-4 flex items-center justify-between hatchin-border border-b shrink-0">
      {/* Left: title + subtle mode label */}
      <div className="min-w-0 flex items-center gap-2">
        <h1 className="font-semibold hatchin-text text-sm truncate">
          {contextDisplay.title}
        </h1>
        {chatMode && (
          <span className="hidden sm:inline text-micro hatchin-text-muted">
            · {modeLabel}
          </span>
        )}
      </div>

      {/* Right: avatar stack + Add Hatch */}
      <div className="flex items-center gap-3 shrink-0">
        {stackAgents.length > 0 && (
          <div
            className="flex items-center"
            title={stackAgents.map((a) => a.name).join(', ') + (extra ? ` +${extra} more` : '')}
          >
            {stackAgents.map((agent, idx) => (
              <div
                key={agent.id}
                className="rounded-full ring-2 ring-[var(--hatchin-bg)] bg-[var(--hatchin-surface)]"
                style={{ marginLeft: idx === 0 ? 0 : -6 }}
              >
                <AgentAvatar agentName={agent.name} role={agent.role} size={22} />
              </div>
            ))}
            {extra > 0 && (
              <div
                className="rounded-full ring-2 ring-[var(--hatchin-bg)] bg-[var(--hatchin-surface)] hatchin-text-muted text-xs font-semibold flex items-center justify-center"
                style={{ width: 22, height: 22, marginLeft: -6 }}
              >
                +{extra}
              </div>
            )}
          </div>
        )}

        <button
          onClick={onAddHatchClick}
          disabled={!activeProject}
          className="hit-target btn-primary-glow px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 btn-press disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Add Hatch"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12h8" />
            <path d="M12 8v8" />
          </svg>
          <span className="hidden sm:inline">Add Hatch</span>
        </button>
      </div>
    </div>
  );
}
