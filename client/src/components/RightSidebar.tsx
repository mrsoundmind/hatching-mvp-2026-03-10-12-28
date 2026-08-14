import * as React from "react";
import { useRightSidebarState } from "@/hooks/useRightSidebarState";
import { useAutonomyFeed } from "@/hooks/useAutonomyFeed";
import { useQuery } from "@tanstack/react-query";
import { SidebarTabBar } from "./sidebar/SidebarTabBar";
import { ActivityTab } from "./sidebar/ActivityTab";
import { TasksTab } from "./sidebar/TasksTab";
import { BrainDocsTab } from "./sidebar/BrainDocsTab";
import { isApprovalExpired } from "./sidebar/approvalUtils";
import { ErrorBoundary } from "react-error-boundary";
import { PanelErrorFallback } from "@/components/ErrorFallbacks";
import type { Project, Team, Agent, Task } from "@shared/schema";

interface RightSidebarProps {
  activeProject: Project | undefined;
  activeTeam?: Team;
  activeAgent?: Agent;
  /** Optional: open on a specific tab (used by the mobile bottom bar). */
  initialTab?: 'activity' | 'brain' | 'tasks';
  /** Fill the parent (mobile in-panel use) instead of the fixed desktop column width/height. */
  fill?: boolean;
}

export function RightSidebar({ activeProject, activeTeam, activeAgent, initialTab, fill }: RightSidebarProps) {
  const { state, actions } = useRightSidebarState(activeProject, activeTeam, activeAgent);
  const { unreadCount, clearUnread } = useAutonomyFeed(activeProject?.id);

  // Fetch project agents for ActivityTab filter dropdown
  const { data: projectAgents } = useQuery<Agent[]>({
    queryKey: ['/api/projects', activeProject?.id, 'agents'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${activeProject!.id}/agents`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeProject?.id,
    staleTime: 60_000,
  });

  // Fetch all tasks to drive the pending-approvals amber dot on the Tasks tab badge.
  // Must match TasksTab queryKey exactly for TanStack deduplication.
  const { data: allTasks } = useQuery<Task[]>({
    queryKey: ['/api/tasks', `?projectId=${activeProject?.id}`],
    queryFn: async () => {
      const res = await fetch(`/api/tasks?projectId=${activeProject!.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeProject?.id,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const hasPendingApprovals = React.useMemo(
    () =>
      (allTasks ?? []).some(t => {
        const meta = t.metadata as Record<string, unknown>;
        return (
          meta?.awaitingApproval === true &&
          !meta?.approvedAt &&
          !meta?.rejectedAt &&
          !isApprovalExpired(t)
        );
      }),
    [allTasks]
  );

  const { activeTab } = state;
  const { setActiveTab } = actions;

  const handleTabChange = (tab: 'activity' | 'brain' | 'tasks') => {
    setActiveTab(tab);
    if (tab === 'activity') clearUnread();
  };

  // When opened to a specific tab (mobile bottom bar), honor it.
  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      if (initialTab === 'activity') clearUnread();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  // Delegation entrance (Phase 1.2): the "Autonomy is off" hint jumps here.
  React.useEffect(() => {
    const handler = () => setActiveTab('brain');
    window.addEventListener('hatchin:open-brain', handler);
    return () => window.removeEventListener('hatchin:open-brain', handler);
  }, [setActiveTab]);

  // Return-briefing (Phase 2.4): the "Review ->" jump opens the Activity tab
  // where approvals live.
  React.useEffect(() => {
    const handler = () => { setActiveTab('activity'); clearUnread(); };
    window.addEventListener('hatchin:open-activity', handler);
    return () => window.removeEventListener('hatchin:open-activity', handler);
  }, [setActiveTab, clearUnread]);

  // Business-in-a-Box: land a project ON its Journey when the plan is fresh. The first
  // time a project with a staged plan becomes active this session, open the Tasks tab so
  // a new pack/idea project shows its plan instead of the empty Activity feed. Guarded to
  // a plan that is still untouched (every staged task is 'todo'), so a project the user has
  // already worked in keeps whatever tab they last chose. Self-contained (no home.tsx
  // dependency), fires at most once per project id.
  const journeyShownFor = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    const pid = activeProject?.id;
    if (!pid || journeyShownFor.current.has(pid)) return;
    const staged = (allTasks ?? []).filter(
      (t) => (t.metadata as { stage?: string } | null)?.stage,
    );
    if (staged.length === 0) return; // no plan yet (still loading, or a chat-only project)
    journeyShownFor.current.add(pid);
    const untouched = staged.every((t) => !t.status || t.status === 'todo');
    if (untouched) setActiveTab('tasks');
  }, [activeProject?.id, allTasks, setActiveTab]);

  const [isPanelScrolling, setIsPanelScrolling] = React.useState(false);
  const panelScrollHideTimeoutRef = React.useRef<number | null>(null);

  // Task notification badge: pulse the Tasks tab when agent creates a task
  const [hasNewTasks, setHasNewTasks] = React.useState(false);
  React.useEffect(() => { setHasNewTasks(false); }, [activeProject?.id]);
  React.useEffect(() => {
    const handler = () => {
      if (activeTab !== 'tasks') setHasNewTasks(true);
    };
    window.addEventListener('tasks_updated', handler);
    window.addEventListener('task_created_from_chat', handler);
    return () => {
      window.removeEventListener('tasks_updated', handler);
      window.removeEventListener('task_created_from_chat', handler);
    };
  }, [activeTab]);

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

  const { activeView } = state;
  // Responsive width + padding. This was a hard `w-80` with no breakpoints and no
  // shrink-0, so on a ~1280px laptop with the 480px artifact panel open the centre
  // chat was crushed while the sidebar stayed rigid. p-6 inside 320px also left
  // only ~272px of usable content, which is what made every card feel cramped.
  const asideClassName = fill
    ? `w-full h-full min-h-0 premium-column-bg p-4 overflow-y-auto hide-scrollbar relative right-sidebar-scroll ${isPanelScrolling ? 'is-scrolling' : ''}`
    : `w-72 xl:w-80 2xl:w-[22rem] shrink-0 h-[calc(100vh-20px)] min-h-0 premium-column-bg rounded-2xl p-4 xl:p-6 overflow-y-auto hide-scrollbar my-2.5 relative right-sidebar-scroll ${isPanelScrolling ? 'is-scrolling' : ''}`;

  if (activeView === 'none') {
    return (
      <aside className={fill
        ? "w-full h-full premium-column-bg p-4 flex flex-col items-center justify-center relative overflow-hidden"
        : "w-72 xl:w-80 2xl:w-[22rem] shrink-0 h-[calc(100vh-20px)] min-h-0 premium-column-bg rounded-2xl p-4 xl:p-6 flex flex-col items-center justify-center my-2.5 relative overflow-hidden"}>
        <div className="ambient-glow-top" />
        <div className="text-center max-w-[220px]">
          <div className="text-4xl mb-4">🧠</div>
          <p className="text-sm font-medium hatchin-text-bright mb-1">Nothing selected yet</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Pick a project on the left to see its overview here.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={asideClassName}
      onScroll={showPanelScrollbarTemporarily}
      onWheel={showPanelScrollbarTemporarily}
      onTouchMove={showPanelScrollbarTemporarily}
    >
      <div className="ambient-glow-top" />

      {/* Top-level 3-tab bar: Activity | Tasks | Brain */}
      <SidebarTabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadActivityCount={unreadCount}
        hasPendingApprovals={hasPendingApprovals || hasNewTasks}
      />

      {/* Activity tab panel (CSS-hidden, never unmounted) */}
      <div
        role="tabpanel"
        id="sidebar-tabpanel-activity"
        aria-labelledby="sidebar-tab-activity"
        style={{ display: activeTab === 'activity' ? 'flex' : 'none' }}
        aria-hidden={activeTab !== 'activity'}
        className="flex-1 flex flex-col overflow-y-auto hide-scrollbar"
      >
        <ErrorBoundary FallbackComponent={PanelErrorFallback}>
          <ActivityTab
            projectId={activeProject?.id}
            agents={projectAgents?.map(a => ({ id: a.id, name: a.name, role: a.role })) || []}
            executionRules={activeProject?.executionRules as Record<string, unknown> | null | undefined}
          />
        </ErrorBoundary>
      </div>

      {/* Tasks tab panel (CSS-hidden, never unmounted) */}
      <div
        role="tabpanel"
        id="sidebar-tabpanel-tasks"
        aria-labelledby="sidebar-tab-tasks"
        style={{ display: activeTab === 'tasks' ? 'flex' : 'none' }}
        aria-hidden={activeTab !== 'tasks'}
        className="flex-1 flex flex-col overflow-y-auto hide-scrollbar"
      >
        <ErrorBoundary FallbackComponent={PanelErrorFallback}>
          <TasksTab projectId={activeProject?.id} executionRules={activeProject?.executionRules as Record<string, unknown> | null | undefined} />
        </ErrorBoundary>
      </div>

      {/* Brain tab panel (CSS-hidden, never unmounted) */}
      <div
        role="tabpanel"
        id="sidebar-tabpanel-brain"
        aria-labelledby="sidebar-tab-brain"
        style={{ display: activeTab === 'brain' ? 'flex' : 'none' }}
        aria-hidden={activeTab !== 'brain'}
        className="flex-1 flex flex-col overflow-y-auto hide-scrollbar"
      >
        <ErrorBoundary FallbackComponent={PanelErrorFallback}>
          <BrainDocsTab projectId={activeProject?.id} project={activeProject} />
        </ErrorBoundary>
      </div>
    </aside>
  );
}
