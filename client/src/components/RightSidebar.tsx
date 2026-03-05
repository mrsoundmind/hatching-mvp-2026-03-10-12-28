import * as React from "react";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { ProgressTimeline } from "@/components/ProgressTimeline";
import { useToast } from "@/hooks/use-toast";
import { useRightSidebarState } from "@/hooks/useRightSidebarState";
import { useRealTimeUpdates } from "@/hooks/useRealTimeUpdates";
import TaskManager from "./TaskManager";
import type { Project, Team, Agent } from "@shared/schema";

interface RightSidebarProps {
  activeProject: Project | undefined;
  activeTeam?: Team;
  activeAgent?: Agent;
}

export function RightSidebar({ activeProject, activeTeam, activeAgent }: RightSidebarProps) {
  const { toast } = useToast();
  const { state, actions } = useRightSidebarState(activeProject, activeTeam, activeAgent);

  // Local state for view switching
  const [currentView, setCurrentView] = React.useState<'overview' | 'tasks'>('overview');
  const [isPanelScrolling, setIsPanelScrolling] = React.useState(false);
  const panelScrollHideTimeoutRef = React.useRef<number | null>(null);

  // Real-time updates for sidebar data
  const [realTimeProgress, setRealTimeProgress] = React.useState(0);
  const [realTimeTimeline, setRealTimeTimeline] = React.useState<Array<any>>([]);
  const [realTimeMetrics, setRealTimeMetrics] = React.useState({
    messagesCount: 0,
    lastActivity: new Date(),
    activeParticipants: [] as string[],
    taskCompletions: 0,
    milestoneReaches: 0,
  });

  // Set up real-time updates
  const { isConnected } = useRealTimeUpdates({
    activeProject,
    activeTeam,
    activeAgent,
    onMetricsUpdate: (metrics) => {
      setRealTimeMetrics(metrics);
      console.log('📊 Right sidebar metrics updated:', metrics);
    },
    onProgressUpdate: (progressDelta) => {
      setRealTimeProgress(prev => Math.min(100, prev + progressDelta));
      console.log('📈 Progress updated by:', progressDelta);
    },
    onTimelineUpdate: (event) => {
      setRealTimeTimeline(prev => [event, ...prev].slice(0, 10)); // Keep last 10 events
      console.log('📅 Timeline updated:', event);
    },
    onTaskSuggestion: (suggestions) => {
      console.log('🤖 AI Task suggestions received:', suggestions);
      // This will be handled by the TaskManager component
    },
    debounceMs: 500
  });

  const schedulePanelScrollbarHide = React.useCallback(() => {
    if (panelScrollHideTimeoutRef.current) {
      window.clearTimeout(panelScrollHideTimeoutRef.current);
    }
    panelScrollHideTimeoutRef.current = window.setTimeout(() => {
      setIsPanelScrolling(false);
    }, 500);
  }, []);

  const showPanelScrollbarTemporarily = React.useCallback(() => {
    setIsPanelScrolling(true);
    schedulePanelScrollbarHide();
  }, [schedulePanelScrollbarHide]);

  React.useEffect(() => {
    return () => {
      if (panelScrollHideTimeoutRef.current) {
        window.clearTimeout(panelScrollHideTimeoutRef.current);
      }
    };
  }, []);

  const {
    coreDirection,
    executionRules,
    teamCulture,
    expandedSections,
    recentlySaved,
    activeView,
    isLoading,
    error,
  } = state;

  // Destructure actions from hook
  const {
    updateCoreDirection,
    updateExecutionRules,
    updateTeamCulture,
    toggleSection,
    setRecentlySaved,
  } = actions;
  const panelCardClass = "hatchin-bg-card rounded-xl border border-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";
  const asideClassName = `w-80 min-h-0 premium-column-bg rounded-2xl p-6 overflow-y-auto my-2.5 relative border border-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] right-sidebar-scroll ${isPanelScrolling ? 'is-scrolling' : ''}`;
  const computedProgress = Math.min(100, Math.max(0, (activeProject?.progress || 0) + realTimeProgress));
  const agentHealthScore = Math.min(99, Math.max(45, 62 + realTimeMetrics.taskCompletions * 3 + Math.min(25, realTimeMetrics.messagesCount) * 0.3));
  const roleSummary = activeAgent?.role || activeTeam?.name || activeProject?.name || 'Project';
  const timelineEvents = realTimeTimeline.length > 0
    ? realTimeTimeline
    : [{
      title: 'Waiting for new activity',
      date: new Date().toISOString(),
      status: 'Idle',
      color: '#A6A7AB'
    }];

  // FIX 13 — Brain-Sync visual progress indicator during saves
  const brainsyncBanner = (
    <>
      {isLoading && (
        <div className="mb-3 rounded-xl overflow-hidden border border-[#6C82FF]/20">
          <div className="px-3 py-2 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#6C82FF] animate-pulse flex-shrink-0" />
            <span className="text-xs text-[#A6A7AB]">Syncing to Project Brain...</span>
          </div>
          <div className="h-1 w-full brain-sync-bar" />
        </div>
      )}
      {!isLoading && recentlySaved.size > 0 && (
        <div
          className="mb-3 rounded-xl border border-[#47DB9A]/20 px-3 py-2 flex items-center gap-2"
          style={{ backgroundColor: 'rgba(71,219,154,0.07)' }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-[#47DB9A] flex-shrink-0" />
          <span className="text-xs text-[#47DB9A] font-medium">Brain Synced ✓</span>
        </div>
      )}
    </>
  );

  if (activeView === 'none') {
    return (
      <aside className="w-80 premium-column-bg rounded-2xl p-6 flex flex-col items-center justify-center my-2.5 relative overflow-hidden">
        <div className="ambient-glow-top" />
        <div className="text-center hatchin-text-muted">
          <div className="text-4xl mb-4">🧠</div>
          <p className="text-sm">
            Select a project to view its overview
          </p>
        </div>
      </aside>
    );
  }

  // Real save functionality that persists data
  const handleSave = async (section: string, data: any) => {
    try {
      actions.setLoading(true);

      // Determine what data to save based on section
      let saveData: any = {};
      let saveEndpoint: string | null = null;
      if (activeView === 'team' && activeTeam?.id) {
        saveEndpoint = `/api/teams/${activeTeam.id}`;
      } else if (activeView === 'agent' && activeAgent?.id) {
        saveEndpoint = `/api/agents/${activeAgent.id}`;
      } else if (activeProject?.id) {
        saveEndpoint = `/api/projects/${activeProject.id}`;
      }

      if (!saveEndpoint) {
        throw new Error('No active entity to save to');
      }

      switch (section) {
        case 'core-direction':
          saveData = {
            coreDirection: {
              whatBuilding: coreDirection.whatBuilding,
              whyMatters: coreDirection.whyMatters,
              whoFor: coreDirection.whoFor,
            }
          };
          break;
        case 'execution-rules':
          saveData = { executionRules: executionRules };
          break;
        case 'team-culture':
          saveData = { teamCulture: teamCulture };
          break;
        default:
          saveData = data;
      }

      // Make API call to save data
      const response = await fetch(saveEndpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(saveData),
      });

      if (!response.ok) {
        throw new Error(`Save failed: ${response.statusText}`);
      }

      // Mark as recently saved for UI feedback
      setRecentlySaved(section);

      // Get the correct sidebar name based on active view
      const getSidebarName = () => {
        if (activeView === 'agent') return 'Agent Profile';
        if (activeView === 'team') return 'Team Dashboard';
        if (activeView === 'project') return 'Project Overview';
        return 'sidebar';
      };

      // Show success toast
      toast({
        title: "Saved successfully",
        description: `${section.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} has been saved to ${getSidebarName()}.`,
        duration: 3000,
      });

    } catch (error) {
      console.error('Save error:', error);
      actions.setError(error instanceof Error ? error.message : 'Save failed');

      toast({
        title: "Save failed",
        description: "Unable to save changes. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      actions.setLoading(false);
    }
  };

  // Agent Profile View
  if (activeView === 'agent') {
    return (
      <aside
        className={asideClassName}
        onScroll={showPanelScrollbarTemporarily}
        onWheel={showPanelScrollbarTemporarily}
        onTouchMove={showPanelScrollbarTemporarily}
      >
        <div className="ambient-glow-top" />
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center">
            <span className="text-lg">👤</span>
          </div>
          <div>
            <h2 className="font-semibold hatchin-text text-[16px]">Hatch Profile</h2>
            <p className="text-xs hatchin-text-muted">{activeAgent?.name}</p>
          </div>
        </div>

        {brainsyncBanner}

        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-lg p-3 mb-4 border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-sm hatchin-text font-medium">{isConnected ? 'Live' : 'Offline'}</span>
            </div>
            <span className="text-xs hatchin-text-muted">{activeAgent?.role}</span>
          </div>
        </div>

        <div className={`${panelCardClass} mb-4`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[12px] font-semibold hatchin-text">Performance Snapshot</h3>
            <span className="text-xs text-emerald-400">{Math.round(agentHealthScore)} score</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/40 rounded-lg p-3">
              <div className="text-lg font-bold hatchin-text">{realTimeMetrics.messagesCount}</div>
              <div className="text-xs hatchin-text-muted">Messages</div>
            </div>
            <div className="bg-gray-800/40 rounded-lg p-3">
              <div className="text-lg font-bold text-green-400">{realTimeMetrics.taskCompletions}</div>
              <div className="text-xs hatchin-text-muted">Tasks done</div>
            </div>
            <div className="bg-gray-800/40 rounded-lg p-3">
              <div className="text-lg font-bold hatchin-text">{realTimeMetrics.milestoneReaches}</div>
              <div className="text-xs hatchin-text-muted">Milestones</div>
            </div>
            <div className="bg-gray-800/40 rounded-lg p-3">
              <div className="text-lg font-bold hatchin-text">{realTimeMetrics.activeParticipants.length}</div>
              <div className="text-xs hatchin-text-muted">Participants</div>
            </div>
          </div>
        </div>

        <div className={`${panelCardClass} mb-4`}>
          <h3 className="text-[12px] font-semibold hatchin-text mb-3">Role Focus</h3>
          <p className="text-xs hatchin-text-muted leading-relaxed">
            {activeAgent?.name || 'This Hatch'} is currently operating as <span className="hatchin-text">{roleSummary}</span>.
            Use chat to assign concrete deliverables, constraints, and deadlines for this role.
          </p>
        </div>

        <div className={panelCardClass}>
          <h3 className="text-[12px] font-semibold hatchin-text mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {timelineEvents.slice(0, 4).map((event, index) => (
              <div key={`${event.title}-${index}`} className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full mt-1.5" style={{ backgroundColor: event.color || '#47DB9A' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs hatchin-text truncate">{event.title}</p>
                  <p className="text-xs hatchin-text-muted">
                    {new Date(event.date || Date.now()).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  // Team Dashboard View
  if (activeView === 'team') {
    return (
      <aside
        className={asideClassName}
        onScroll={showPanelScrollbarTemporarily}
        onWheel={showPanelScrollbarTemporarily}
        onTouchMove={showPanelScrollbarTemporarily}
      >
        <div className="ambient-glow-top" />
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center">
            <span className="text-lg">{activeTeam?.emoji || '👥'}</span>
          </div>
          <div>
            <h2 className="font-semibold hatchin-text text-[16px]">Team Dashboard</h2>
            <p className="text-xs hatchin-text-muted">{activeTeam?.name}</p>
          </div>
        </div>

        {brainsyncBanner}

        <div className={`${panelCardClass} mb-4`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[12px] font-semibold hatchin-text">Team Health</h3>
            <span className="text-xs text-blue-400">{computedProgress}% progress</span>
          </div>
          <ProgressTimeline progress={computedProgress} />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-gray-800/40 rounded-lg p-3">
              <div className="text-lg font-bold hatchin-text">{realTimeMetrics.messagesCount}</div>
              <div className="text-xs hatchin-text-muted">Messages</div>
            </div>
            <div className="bg-gray-800/40 rounded-lg p-3">
              <div className="text-lg font-bold text-green-400">{realTimeMetrics.taskCompletions}</div>
              <div className="text-xs hatchin-text-muted">Completed tasks</div>
            </div>
          </div>
        </div>

        <div className={`${panelCardClass} mb-4`}>
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-semibold hatchin-text">Execution Ground Rules</h3>
            <button
              onClick={() => handleSave('execution-rules', null)}
              className={`text-sm hover:text-opacity-80 transition-all duration-200 flex items-center gap-1 ${recentlySaved.has('execution-rules') ? 'text-green-400' : 'hatchin-blue'
                }`}
            >
              {recentlySaved.has('execution-rules') ? (
                <>
                  <Check className="w-3 h-3" />
                  Saved
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
          <textarea
            value={executionRules}
            onChange={(e) => updateExecutionRules(e.target.value)}
            className="w-full hatchin-text placeholder-hatchin-text-muted resize-none focus:outline-none text-sm bg-[#212327] rounded-lg p-3 min-h-[100px] overflow-hidden mt-3"
            placeholder="Define how this team should execute work, validate assumptions, and escalate blockers."
          />
        </div>

        <div className={panelCardClass}>
          <h3 className="text-[12px] font-semibold hatchin-text mb-3">Activity Feed</h3>
          <div className="space-y-2">
            {timelineEvents.slice(0, 5).map((event, index) => (
              <div key={`${event.title}-${index}`} className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full mt-1.5" style={{ backgroundColor: event.color || '#47DB9A' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs hatchin-text truncate">{event.title}</p>
                  <p className="text-xs hatchin-text-muted">{event.status || 'Update'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  // Project Overview View with Task Manager
  return (
    <aside
      className={asideClassName}
      onScroll={showPanelScrollbarTemporarily}
      onWheel={showPanelScrollbarTemporarily}
      onTouchMove={showPanelScrollbarTemporarily}
    >
      <div className="ambient-glow-top" />
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center">
          <span className="text-lg">🧠</span>
        </div>
        <h2 className="font-semibold hatchin-text text-[16px]">Project Brain</h2>
      </div>
      {/* FIX 13 — Brain-sync save indicator */}
      {brainsyncBanner}
      {/* Tab Navigation */}
      <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-gray-700/60 bg-black/20 p-1">
        <button
          onClick={() => setCurrentView('overview')}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${currentView === 'overview'
            ? 'bg-[#6C82FF]/20 text-[#AAB5FF] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
            : 'hatchin-text-muted hover:hatchin-text hover:bg-white/5'
            }`}
          data-testid="tab-overview"
        >
          <span className="text-lg">📝</span>
          Overview
        </button>
        <button
          onClick={() => setCurrentView('tasks')}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${currentView === 'tasks'
            ? 'bg-[#6C82FF]/20 text-[#AAB5FF] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
            : 'hatchin-text-muted hover:hatchin-text hover:bg-white/5'
            }`}
          data-testid="tab-tasks"
        >
          <span className="text-lg">✅</span>
          Tasks
        </button>
      </div>
      {/* Content based on current view */}
      {currentView === 'tasks' ? (
        <>


          <div className="-mx-6 px-6">
            <TaskManager
              projectId={activeProject?.id || ''}
              teamId={activeTeam?.id}
              agentId={activeAgent?.id}
              isConnected={isConnected}
            />
          </div>
        </>
      ) : (
        <>
          <p className="hatchin-text-muted text-[12px] mb-6">
            A shared brain for your team to stay aligned.
          </p>
          <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/8 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs hatchin-text">Chat Sync</span>
              <span className="text-xs text-blue-400 font-medium">Auto-update active</span>
            </div>
            <p className="text-xs hatchin-text-muted mt-1">
              Chat can auto-update project details and suggest tasks. You can still edit every field manually.
            </p>
          </div>
          {/* Project Progress */}
          <div className="mt-[18px] mb-[18px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium hatchin-text text-[12px]">Project Progress</h3>
              {isConnected && realTimeProgress > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-400">Live</span>
                </div>
              )}
            </div>

            <div className={`${panelCardClass} mb-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className="hatchin-text-muted text-[12px]">
                  Time spent: {activeProject?.timeSpent || '0 hours'}
                </span>
                <span className="hatchin-text text-[#1cd979] font-bold text-[12px]">{computedProgress}% complete</span>
              </div>

              <div className="mb-4">
                <div className="hatchin-text-muted mb-2 text-[12px] flex justify-between">
                  <span>2.5 weeks — 3 working phases</span>
                  {realTimeMetrics.taskCompletions > 0 && (
                    <span className="text-green-400">+{realTimeMetrics.taskCompletions} tasks</span>
                  )}
                </div>

                <ProgressTimeline progress={computedProgress} />
              </div>

              <div className="text-xs hatchin-text-muted leading-relaxed">
                Expected effort: ~18 hours/week from user.<br />
                This timeline is estimated based on project complexity, goals, and required work hours.<br />
                You can request changes through chat or edit it manually if needed.
              </div>
            </div>
          </div>

          <div className={`${panelCardClass} mb-4`}>
            <h3 className="font-medium hatchin-text text-[12px] mb-3">Live Signals</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800/40 rounded-lg p-3">
                <div className="text-lg font-bold hatchin-text">{realTimeMetrics.messagesCount}</div>
                <div className="text-xs hatchin-text-muted">Messages</div>
              </div>
              <div className="bg-gray-800/40 rounded-lg p-3">
                <div className="text-lg font-bold text-green-400">{realTimeMetrics.taskCompletions}</div>
                <div className="text-xs hatchin-text-muted">Tasks done</div>
              </div>
              <div className="bg-gray-800/40 rounded-lg p-3">
                <div className="text-lg font-bold hatchin-text">{realTimeMetrics.activeParticipants.length}</div>
                <div className="text-xs hatchin-text-muted">Participants</div>
              </div>
              <div className="bg-gray-800/40 rounded-lg p-3">
                <div className="text-sm font-semibold hatchin-text truncate">{new Date(realTimeMetrics.lastActivity).toLocaleTimeString()}</div>
                <div className="text-xs hatchin-text-muted">Last activity</div>
              </div>
            </div>
          </div>
          {/* Core Direction - Always Visible */}
          <div className={`${panelCardClass} mb-4`}>
            <div className="flex items-center justify-between">
              <h3 className="font-medium hatchin-text text-[12px]">Core Direction</h3>
              <button
                onClick={() => handleSave('core-direction', null)}
                className={`text-sm hover:text-opacity-80 transition-all duration-200 flex items-center gap-1 ${recentlySaved.has('core-direction')
                  ? 'text-green-400'
                  : 'hatchin-blue'
                  }`}
              >
                {recentlySaved.has('core-direction') ? (
                  <>
                    <Check className="w-3 h-3" />
                    Saved
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>

            <div className="mt-4 space-y-6">
              <div>
                <h4 className="font-medium hatchin-text mb-3 text-[12px]">What are you building?</h4>
                <textarea
                  value={coreDirection.whatBuilding}
                  onChange={(e) => updateCoreDirection('whatBuilding', e.target.value)}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                  className="w-full hatchin-text placeholder-hatchin-text-muted resize-none focus:outline-none text-sm bg-[#212327] rounded-lg p-3 min-h-[80px] overflow-hidden"
                  style={{ height: 'auto' }}
                  placeholder="Describe the project in one clear sentence."
                />
              </div>

              <div>
                <h4 className="font-medium hatchin-text mb-3 text-[12px]">Why does this matter?</h4>
                <textarea
                  value={coreDirection.whyMatters}
                  onChange={(e) => updateCoreDirection('whyMatters', e.target.value)}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                  className="w-full hatchin-text placeholder-hatchin-text-muted resize-none focus:outline-none text-sm bg-[#212327] rounded-lg p-3 min-h-[80px] overflow-hidden"
                  style={{ height: 'auto' }}
                  placeholder="What's the core purpose or motivation?"
                />
              </div>

              <div>
                <h4 className="font-medium hatchin-text mb-3 text-[12px]">Who is this for?</h4>
                <textarea
                  value={coreDirection.whoFor}
                  onChange={(e) => updateCoreDirection('whoFor', e.target.value)}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                  className="w-full hatchin-text placeholder-hatchin-text-muted resize-none focus:outline-none text-sm bg-[#212327] rounded-lg p-3 min-h-[80px] overflow-hidden"
                  style={{ height: 'auto' }}
                  placeholder="Who's the target audience, customer, or beneficiary?"
                />
              </div>
            </div>
          </div>
          {/* Execution Ground Rules - Collapsible Card */}
          <div className={`${panelCardClass} mb-4`}>
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection('executionRules')}
            >
              <div className="flex items-center gap-2">
                {expandedSections.executionRules ?
                  <ChevronDown className="w-4 h-4 hatchin-text-muted" /> :
                  <ChevronRight className="w-4 h-4 hatchin-text-muted" />
                }
                <h3 className="font-medium hatchin-text text-[12px]">Execution Ground Rules</h3>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave('execution-rules', null);
                }}
                className={`text-sm hover:text-opacity-80 transition-all duration-200 flex items-center gap-1 ${recentlySaved.has('execution-rules')
                  ? 'text-green-400'
                  : 'hatchin-blue'
                  }`}
              >
                {recentlySaved.has('execution-rules') ? (
                  <>
                    <Check className="w-3 h-3" />
                    Saved
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>

            {expandedSections.executionRules && (
              <div className="mt-4">
                <textarea
                  value={executionRules}
                  onChange={(e) => updateExecutionRules(e.target.value)}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                  className="w-full hatchin-text placeholder-hatchin-text-muted resize-none focus:outline-none text-sm bg-[#212327] rounded-lg p-3 min-h-[100px] overflow-hidden"
                  style={{ height: 'auto' }}
                  placeholder="Define team principles, constraints, standards, deadlines, budget limits, and quality requirements that everyone must follow."
                />
              </div>
            )}
          </div>
          {/* Brand Guidelines & Team Culture - Collapsible Card */}
          <div className={panelCardClass}>
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection('brandCulture')}
            >
              <div className="flex items-center gap-2">
                {expandedSections.brandCulture ?
                  <ChevronDown className="w-4 h-4 hatchin-text-muted" /> :
                  <ChevronRight className="w-4 h-4 hatchin-text-muted" />
                }
                <h3 className="font-medium hatchin-text text-[12px]">Brand Guidelines & Culture</h3>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave('team-culture', null);
                }}
                className={`text-sm hover:text-opacity-80 transition-all duration-200 flex items-center gap-1 ${recentlySaved.has('team-culture')
                  ? 'text-green-400'
                  : 'hatchin-blue'
                  }`}
              >
                {recentlySaved.has('team-culture') ? (
                  <>
                    <Check className="w-3 h-3" />
                    Saved
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>

            {expandedSections.brandCulture && (
              <div className="mt-4">
                <textarea
                  value={teamCulture}
                  onChange={(e) => updateTeamCulture(e.target.value)}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                  className="w-full hatchin-text placeholder-hatchin-text-muted resize-none focus:outline-none text-sm bg-[#212327] rounded-lg p-3 min-h-[100px] overflow-hidden"
                  style={{ height: 'auto' }}
                  placeholder="Define brand voice, communication style, design preferences, cultural values, and how the team should interact with users and each other."
                />
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
