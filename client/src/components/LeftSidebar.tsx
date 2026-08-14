import { devLog } from '@/lib/devLog';
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { ProjectTree } from "@/components/ProjectTree";
import { ChevronDown, Search, LogOut, X, CreditCard, Plus, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAgentWorkingState } from "@/hooks/useAgentWorkingState";
import { useIsFetching } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { Project, Team, Agent } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/** Skeleton placeholder shown while project data is loading */
function ProjectTreeSkeleton() {
  return (
    <div className="space-y-3 px-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-hatchin-surface animate-pulse" />
            <div className="h-4 rounded bg-hatchin-surface animate-pulse flex-1" />
          </div>
          {i === 1 && (
            <div className="pl-9 space-y-1.5">
              <div className="h-3 rounded bg-hatchin-surface animate-pulse w-3/4" />
              <div className="h-3 rounded bg-hatchin-surface animate-pulse w-1/2" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Interface for complete undo data
interface DeletedEntityData {
  type: 'project' | 'team' | 'agent';
  entity: Project | Team | Agent;
  relatedData?: {
    teams?: Team[];
    agents?: Agent[];
  };
}
import { ThemeToggle } from "./ThemeToggle";
import QuickStartModal from "@/components/QuickStartModal";
import StarterPacksModal from "@/components/StarterPacksModal";
import ProjectNameModal from "@/components/ProjectNameModal";

// Temporary type definition until import issues are resolved
interface StarterPack {
  id: string;
  title: string;
  description: string;
  emoji: string;
  color: string;
  members: string[];
  welcomeMessage: string;
}

interface LeftSidebarProps {
  projects: Project[];
  teams: Team[];
  agents: Agent[];
  activeProjectId: string | null;
  activeTeamId: string | null;
  activeAgentId: string | null;
  expandedProjects: Set<string>;
  expandedTeams: Set<string>;
  onSelectProject: (projectId: string) => void;
  onSelectTeam: (teamId: string | null) => void;
  onSelectAgent: (agentId: string | null) => void;
  onToggleProjectExpanded: (projectId: string) => void;
  onToggleTeamExpanded: (teamId: string) => void;
  onCreateProject?: (name: string, description?: string) => Promise<any> | void;
  onCreateProjectFromTemplate?: (pack: StarterPack, name: string, description?: string) => Promise<any> | void;
  onCreateIdeaProject?: (name: string, description?: string) => Promise<any> | void;
  onCreateTeam?: (name: string, projectId: string, emoji?: string) => Promise<any> | void;
  onCreateAgent?: (agentData: Omit<Agent, 'id'>) => Promise<any> | void;
  onDeleteTeam?: (teamId: string) => void;
  onDeleteAgent?: (agentId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onUpdateProject?: (projectId: string, updates: Partial<Project>) => Promise<void>;
  onUpdateTeam?: (teamId: string, updates: Partial<Team>) => Promise<void>;
  onUpdateAgent?: (agentId: string, updates: Partial<Agent>) => Promise<void>;
}

export function LeftSidebar({
  projects,
  teams,
  agents,
  activeProjectId,
  activeTeamId,
  activeAgentId,
  expandedProjects,
  expandedTeams,
  onSelectProject,
  onSelectTeam,
  onSelectAgent,
  onToggleProjectExpanded,
  onToggleTeamExpanded,
  onCreateProject,
  onCreateProjectFromTemplate,
  onCreateIdeaProject,
  onCreateTeam,
  onCreateAgent,
  onDeleteTeam,
  onDeleteAgent,
  onDeleteProject,
  onUpdateProject,
  onUpdateTeam,
  onUpdateAgent,
}: LeftSidebarProps) {
  const { user, signOut } = useAuth();
  const projectsFetching = useIsFetching({ queryKey: ['/api/projects'] });
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Which agents are executing background work right now (live via WS). Used by the
  // collapsed rail to glow a project folder amber even when you're not looking at it.
  const workingAgents = useAgentWorkingState();

  // Focus mode — collapse the nav to a thin rail so the chat/work gets the room.
  // Remembered across sessions. Only ever active on desktop (the mobile drawer, which
  // mounts this same component, must always show the full sidebar).
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('hatchin_sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const persistCollapsed = (next: boolean) => {
    try { localStorage.setItem('hatchin_sidebar_collapsed', String(next)); } catch { /* private mode */ }
  };
  // Manual collapse only. The sidebar NEVER auto-collapses (the old team-start auto-focus
  // was removed 2026-08-12 per user: "always at uncollapse state"). It only auto-EXPANDS
  // when a new project/pack is added (see the effect below), so an addition is always seen.
  const prevProjectCountRef = useRef<number | null>(null);
  const expandSidebar = useCallback(() => { setCollapsed(false); persistCollapsed(false); }, []);
  const collapseSidebar = useCallback(() => { setCollapsed(true); persistCollapsed(true); }, []);
  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => { const next = !prev; persistCollapsed(next); return next; });
  }, []);
  // Hover-to-peek: while collapsed on desktop, hovering the rail expands the sidebar in place.
  // The layout is a SINGLE structure at a fixed 260px — the aside just animates its width and
  // clips it. When narrow, only the text hides; every icon (avatar, search, folder) stays exactly
  // where it is, so opening moves nothing (Aceternity pattern: anchor the icon, fade the label).
  const [peeking, setPeeking] = useState(false);
  const peekTimerRef = useRef<number | null>(null);
  const railActive = collapsed && isDesktop;   // aside is a thin rail (60px) until hovered/pinned
  const startPeek = () => {
    if (!railActive) return;
    if (peekTimerRef.current) window.clearTimeout(peekTimerRef.current);
    // small hover-intent delay so brushing past the rail doesn't pop it open
    peekTimerRef.current = window.setTimeout(() => setPeeking(true), 120);
  };
  const endPeek = () => {
    if (peekTimerRef.current) { window.clearTimeout(peekTimerRef.current); peekTimerRef.current = null; }
    setPeeking(false);
  };
  useEffect(() => () => { if (peekTimerRef.current) window.clearTimeout(peekTimerRef.current); }, []);
  // Never leave a stale peek when we exit the rail zone (manual expand, resize to mobile).
  useEffect(() => { if (!railActive) setPeeking(false); }, [railActive]);
  // Wide when pinned open, hover-peeking, or on mobile. `labelsShown` drives every text fade and
  // the tree's compact mode; the width animates between 60 and 260 off the same signal.
  const railOpen = !railActive || peeking;
  const labelsShown = !isDesktop || railOpen;

  // Add Project flow modals
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [showStarterPacks, setShowStarterPacks] = useState(false);
  const [showProjectName, setShowProjectName] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<StarterPack | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isProjectListScrolling, setIsProjectListScrolling] = useState(false);
  // Enhanced undo state management
  const [deletedEntityData, setDeletedEntityData] = useState<DeletedEntityData | null>(null);
  const [showUndoPopup, setShowUndoPopup] = useState(false);

  // Debug logging for undo popup
  useEffect(() => {
    devLog('🔧 Undo popup state changed:', { showUndoPopup, deletedEntityData: !!deletedEntityData, type: deletedEntityData?.type });
  }, [showUndoPopup, deletedEntityData]);


  const searchInputRef = useRef<HTMLInputElement>(null);
  const projectListRef = useRef<HTMLDivElement>(null);
  const projectScrollHideTimeoutRef = useRef<number | null>(null);

  // Radix DropdownMenu handles outside-click + Escape; isUserMenuOpen is kept in sync
  // via onOpenChange only for the chevron rotation.

  // Keyboard shortcuts: ⌘K search, ⌘\ collapse/expand, Esc clears search
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        // Search input only exists when expanded — open the rail first.
        if (railActive) {
          expandSidebar();
          requestAnimationFrame(() => searchInputRef.current?.focus());
        } else {
          searchInputRef.current?.focus();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        toggleCollapsed();
      }
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [searchQuery, railActive, expandSidebar, toggleCollapsed]);

  // Auto-EXPAND when a new project (or pack) is added, so the addition is always visible
  // even if the user had collapsed the sidebar to the rail. Baselines on first run so it
  // never fires on initial load; only reacts to a genuine increase in the project count.
  useEffect(() => {
    const count = projects.length;
    const prev = prevProjectCountRef.current;
    prevProjectCountRef.current = count;
    if (prev !== null && count > prev && collapsed) {
      setCollapsed(false);
      persistCollapsed(false);
    }
  }, [projects.length, collapsed]);

  useEffect(() => {
    return () => {
      if (projectScrollHideTimeoutRef.current) {
        window.clearTimeout(projectScrollHideTimeoutRef.current);
      }
    };
  }, []);

  const scheduleProjectScrollbarHide = () => {
    if (projectScrollHideTimeoutRef.current) {
      window.clearTimeout(projectScrollHideTimeoutRef.current);
    }

    projectScrollHideTimeoutRef.current = window.setTimeout(() => {
      setIsProjectListScrolling(false);
    }, 500);
  };

  const showProjectScrollbarTemporarily = () => {
    setIsProjectListScrolling(true);
    scheduleProjectScrollbarHide();
  };

  const handleProjectListScroll = () => {
    showProjectScrollbarTemporarily();
  };

  const handleProjectListMouseLeave = () => {
    if (projectScrollHideTimeoutRef.current) {
      window.clearTimeout(projectScrollHideTimeoutRef.current);
      projectScrollHideTimeoutRef.current = null;
    }
    setIsProjectListScrolling(false);
  };

  const handleSidebarWheel = (event: React.WheelEvent<HTMLElement>) => {
    const listEl = projectListRef.current;
    if (!listEl) return;

    // If user is already scrolling inside the project list, let native scroll behavior run.
    if (listEl.contains(event.target as Node)) {
      return;
    }

    if (listEl.scrollHeight <= listEl.clientHeight) {
      return;
    }

    listEl.scrollTop += event.deltaY;
    showProjectScrollbarTemporarily();
  };

  // Filter projects, teams, and agents based on search
  const filterData = () => {
    if (!searchQuery.trim()) {
      return { filteredProjects: projects, filteredTeams: teams, filteredAgents: agents };
    }

    const query = searchQuery.toLowerCase();

    const filteredAgents = agents.filter(agent =>
      agent.name.toLowerCase().includes(query) ||
      agent.role.toLowerCase().includes(query)
    );

    const filteredTeams = teams.filter(team =>
      team.name.toLowerCase().includes(query) ||
      filteredAgents.some(agent => agent.teamId === team.id)
    );

    const filteredProjects = projects.filter(project =>
      project.name.toLowerCase().includes(query) ||
      filteredTeams.some(team => team.projectId === project.id)
    );

    return { filteredProjects, filteredTeams, filteredAgents };
  };

  const { filteredProjects, filteredTeams, filteredAgents } = filterData();

  // Add Project flow handlers
  const handleAddProjectClick = () => {
    setShowQuickStart(true);
  };

  const handleStartWithIdea = () => {
    setShowQuickStart(false);
    setShowProjectName(true);
    setSelectedTemplate(null);
  };

  const handleUseStarterPack = () => {
    setShowQuickStart(false);
    setShowStarterPacks(true);
  };

  const handleTemplateSelect = (pack: StarterPack) => {
    setSelectedTemplate(pack);
    setShowStarterPacks(false);
    setShowProjectName(true);
  };

  const handleProjectNameConfirm = async (name: string, description?: string) => {
    if (!name.trim()) return;

    // Close the modal IMMEDIATELY, then create. Seeding a pack in DB mode (12 agents
    // + 20 tasks + 14 docs to Supabase) takes several seconds; the old flow closed the
    // modal only after that await, so it sat stuck on "Creating…" the whole time. The
    // pack-hatching animation in home.tsx is the real creation feedback. Mirrors
    // home.tsx's handleProjectNameSubmit. Capture the template first since we clear it.
    const template = selectedTemplate;
    setShowProjectName(false);
    setSelectedTemplate(null);
    setIsCreatingProject(true);

    try {
      if (template && onCreateProjectFromTemplate) {
        await onCreateProjectFromTemplate(template, name, description);
      } else if (template === null && onCreateIdeaProject) {
        // This is the "Start with an idea" flow
        await onCreateIdeaProject(name, description);
      } else if (onCreateProject) {
        await onCreateProject(name, description);
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleCloseModals = () => {
    setShowQuickStart(false);
    setShowStarterPacks(false);
    setShowProjectName(false);
    setSelectedTemplate(null);
  };

  // Helper — hard-delete (purge) a soft-deleted project. Called when the undo
  // window closes without the user clicking Undo. Idempotent + best-effort: if
  // the request fails (network blip, browser closing), the server-side cron
  // safety net in server/index.ts cleans up within 10 min.
  // - 409 = project was restored before purge fired (Undo clicked)
  // - 404 = project already purged (e.g., ✕ click + auto-hide timer both fired)
  // Both are benign no-ops; only warn on truly unexpected statuses.
  const purgeSoftDeletedProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/purge`, { method: 'POST' });
      if (!res.ok && res.status !== 409 && res.status !== 404) {
        console.warn(`Purge of ${projectId} returned ${res.status} — cron will retry`);
      }
    } catch (err) {
      console.warn('Purge request failed; cron will retry', err);
    }
  };

  // Enhanced undo functionality for all entities
  const handleDeleteProjectWithUndo = async (projectId: string) => {
    // Find the project and all its related data
    const projectToDelete = projects.find(p => p.id === projectId);
    const projectTeams = teams.filter(t => t.projectId === projectId);
    const projectAgents = agents.filter(a => a.projectId === projectId);

    if (projectToDelete) {
      setDeletedEntityData({
        type: 'project',
        entity: projectToDelete,
        relatedData: {
          teams: projectTeams,
          agents: projectAgents
        }
      });
    }

    if (onDeleteProject) {
      await onDeleteProject(projectId); // server soft-deletes (sets deletedAt)
    }
    setShowUndoPopup(true);

    // Auto-hide popup after 5 seconds. Fire purge BEFORE clearing entity data so
    // we still have the projectId. The /restore path (Undo click) cancels this
    // implicitly by closing the popup before this timer fires — but if the user
    // already clicked Undo, the project is no longer soft-deleted and purge will
    // 409 (handled silently inside purgeSoftDeletedProject).
    setTimeout(() => {
      void purgeSoftDeletedProject(projectId);
      setShowUndoPopup(false);
      setDeletedEntityData(null);
    }, 5000);
  };

  const handleDeleteTeamWithUndo = async (teamId: string) => {
    devLog('🔧 handleDeleteTeamWithUndo called for teamId:', teamId);

    // Find the team and its agents
    const teamToDelete = teams.find(t => t.id === teamId);
    const teamAgents = agents.filter(a => a.teamId === teamId);

    devLog('🔧 Found team:', teamToDelete?.name, 'with agents:', teamAgents.length);

    if (teamToDelete) {
      setDeletedEntityData({
        type: 'team',
        entity: teamToDelete,
        relatedData: {
          agents: teamAgents
        }
      });
      devLog('🔧 Set deletedEntityData for team');
    }

    if (onDeleteTeam) {
      devLog('🔧 Calling onDeleteTeam...');
      onDeleteTeam(teamId);
      devLog('🔧 Team deleted successfully');
    }

    devLog('🔧 Setting showUndoPopup to true');
    setShowUndoPopup(true);

    // Auto-hide popup after 5 seconds
    setTimeout(() => {
      devLog('🔧 Auto-hiding undo popup');
      setShowUndoPopup(false);
      setDeletedEntityData(null);
    }, 5000);
  };

  const handleDeleteAgentWithUndo = async (agentId: string) => {
    devLog('🔧 handleDeleteAgentWithUndo called for agentId:', agentId);

    // Find the agent
    const agentToDelete = agents.find(a => a.id === agentId);

    devLog('🔧 Found agent:', agentToDelete?.name);

    if (agentToDelete) {
      setDeletedEntityData({
        type: 'agent',
        entity: agentToDelete
      });
      devLog('🔧 Set deletedEntityData for agent');
    }

    if (onDeleteAgent) {
      devLog('🔧 Calling onDeleteAgent...');
      onDeleteAgent(agentId);
      devLog('🔧 Agent deleted successfully');
    }

    devLog('🔧 Setting showUndoPopup to true');
    setShowUndoPopup(true);

    // Auto-hide popup after 5 seconds
    setTimeout(() => {
      devLog('🔧 Auto-hiding undo popup');
      setShowUndoPopup(false);
      setDeletedEntityData(null);
    }, 5000);
  };

  const handleUndoDelete = async () => {
    if (!deletedEntityData) return;

    try {
      if (deletedEntityData.type === 'project') {
        // Soft-delete-aware undo: just POST /restore. Server unsets deletedAt on the
        // SAME row, so all teams/agents/conversations/messages/deliverables that
        // referenced this project ID stay attached — chat history is preserved.
        const entity = deletedEntityData.entity as Project;
        devLog('🔄 Restoring project (server-side undelete)…', entity.id);
        const res = await fetch(`/api/projects/${entity.id}/restore`, { method: 'POST' });
        if (!res.ok) {
          console.error('❌ Project restore failed', res.status, await res.text());
          throw new Error(`Restore failed: ${res.status}`);
        }
        // Invalidate everything that the deleted project touched so the UI rehydrates.
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
        queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
        queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
        queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
        devLog('✅ Project restored with chat history intact');

      } else if (deletedEntityData.type === 'team' && onCreateTeam) {
        // Restore team — pass emoji (server requires it)
        const teamEntity = deletedEntityData.entity as Team;
        const newTeam = await onCreateTeam(
          teamEntity.name,
          teamEntity.projectId,
          teamEntity.emoji || '🚀',
        );

        // Small delay to ensure team is created before restoring agents
        await new Promise(resolve => setTimeout(resolve, 100));

        // Restore team's agents — skip Maya, skip if team creation failed.
        if (deletedEntityData.relatedData?.agents && onCreateAgent) {
          for (const agent of deletedEntityData.relatedData.agents) {
            if (agent.isSpecialAgent) {
              devLog(`Skipping special agent "${agent.name}"`);
              continue;
            }
            if (!newTeam?.id) {
              console.warn(`Cannot restore agent "${agent.name}" — team failed to restore`);
              continue;
            }
            try {
              const { id, ...agentData } = agent;
              await onCreateAgent({
                ...agentData,
                projectId: agent.projectId,
                teamId: newTeam.id,
              });
              devLog(`Agent "${agent.name}" restored`);
            } catch (error) {
              console.error(`Failed to restore agent "${agent.name}":`, error);
            }
          }
        }

        devLog('Team fully restored with all agents');

      } else if (deletedEntityData.type === 'agent' && onCreateAgent) {
        // Restore agent
        const agent = deletedEntityData.entity as Agent;
        const { id, ...agentData } = agent;
        await onCreateAgent({
          ...agentData,
          projectId: agent.projectId,
          teamId: agent.teamId || ''
        });

        devLog('Agent restored');
      }

      setShowUndoPopup(false);
      setDeletedEntityData(null);
    } catch (error) {
      console.error('Failed to restore entity:', error);
    }
  };



  // Account menu — one persistent row. The avatar is always shown and anchored; the "Welcome, X"
  // text and chevron fade with `labelsShown`, so nothing about the circle moves when the sidebar
  // opens or closes. (Aceternity principle: anchor the icon, fade the label.)
  const renderAccountMenu = () => (
    <DropdownMenu onOpenChange={setIsUserMenuOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          title={`Welcome, ${user?.name || 'User'}`}
          className="w-full flex items-center gap-3 cursor-pointer hover:bg-hatchin-border rounded-lg p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hatchin-blue)]"
        >
          <div className="w-8 h-8 shrink-0 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-sm">{user?.name?.charAt(0).toUpperCase() || 'U'}</span>
          </div>
          <motion.span
            className="text-sm hatchin-text whitespace-nowrap overflow-hidden flex-1 text-left"
            initial={false}
            animate={{ opacity: labelsShown ? 1 : 0 }}
            transition={{ duration: 0.15 }}
          >
            Welcome, {user?.name || 'User'}
          </motion.span>
          <motion.span
            className="shrink-0"
            initial={false}
            animate={{ opacity: labelsShown ? 1 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronDown className={`w-3 h-3 hatchin-text-muted transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
          </motion.span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem asChild>
          <a href="/account" className="flex items-center gap-3 cursor-pointer">
            <CreditCard className="w-4 h-4" />
            Account &amp; Billing
          </a>
        </DropdownMenuItem>
        <div className="px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
          <ThemeToggle />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="flex items-center gap-3 cursor-pointer">
          <LogOut className="w-4 h-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // The sidebar body below the account row — search + project tree. ONE definition, rendered once.
  // When narrow, the search field and header labels fade and the tree runs in `compact` mode; every
  // icon keeps its place so nothing shifts as the width animates.
  const fullBody = (
    <>
      {/* Search — the magnifier is always visible and anchored; the field itself fades in. */}
      <div className="relative mb-4 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 hatchin-text-muted z-10 pointer-events-none" />
        <motion.input
          ref={searchInputRef}
          type="text"
          placeholder="Search projects or hatches (⌘K)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          initial={false}
          animate={{ opacity: labelsShown ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          style={{ pointerEvents: labelsShown ? 'auto' : 'none' }}
          tabIndex={labelsShown ? 0 : -1}
          className="w-full premium-input rounded-lg py-2.5 text-sm hatchin-text placeholder-hatchin-text-muted focus:outline-none pl-[32px] pr-[32px]"
        />
        {searchQuery && labelsShown && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 hatchin-text-muted hover:hatchin-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {/* Actions — the icon lives in the left column so it stays visible (and put) in the rail;
          the label fades in when the sidebar opens. Rows, so nothing moves between the two states. */}
      <div className="shrink-0 mb-2 space-y-0.5">
        {isDesktop && (
          <button
            type="button"
            onClick={collapsed ? expandSidebar : collapseSidebar}
            aria-label={collapsed ? 'Keep sidebar open' : 'Collapse sidebar'}
            title={collapsed ? 'Keep open (⌘\\)' : 'Collapse (⌘\\)'}
            className="hit-target w-full flex items-center gap-3 p-2 rounded-lg hover:bg-hatchin-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hatchin-blue)]"
          >
            <span className="w-8 h-8 flex items-center justify-center shrink-0">
              {collapsed
                ? <PanelLeftOpen className="w-[18px] h-[18px] hatchin-text-muted" />
                : <PanelLeftClose className="w-[18px] h-[18px] hatchin-text-muted" />}
            </span>
            <motion.span
              className="text-sm hatchin-text-muted whitespace-nowrap overflow-hidden"
              initial={false}
              animate={{ opacity: labelsShown ? 1 : 0 }}
              transition={{ duration: 0.15 }}
            >
              {collapsed ? 'Keep open' : 'Collapse'}
            </motion.span>
          </button>
        )}
        <button
          type="button"
          onClick={handleAddProjectClick}
          aria-label="New project"
          title="New project"
          className="hit-target w-full flex items-center gap-3 p-2 rounded-lg hover:bg-hatchin-blue/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hatchin-blue)]"
        >
          <span className="w-8 h-8 flex items-center justify-center shrink-0">
            <Plus className="w-[18px] h-[18px] text-hatchin-blue" />
          </span>
          <motion.span
            className="text-sm font-medium text-hatchin-blue whitespace-nowrap overflow-hidden"
            initial={false}
            animate={{ opacity: labelsShown ? 1 : 0 }}
            transition={{ duration: 0.15 }}
          >
            New project
          </motion.span>
        </button>
      </div>
      {/* Projects Section */}
      <div className="mb-4 min-h-0 flex-1 flex flex-col">
        <div className="flex items-center mb-3 shrink-0 pl-2">
          <motion.h2
            className="font-medium hatchin-text-muted uppercase tracking-wide text-xs"
            initial={false}
            animate={{ opacity: labelsShown ? 1 : 0 }}
            transition={{ duration: 0.15 }}
          >
            Projects
          </motion.h2>
        </div>

        <div
          ref={projectListRef}
          data-tour="team"
          onScroll={handleProjectListScroll}
          onWheel={showProjectScrollbarTemporarily}
          onTouchMove={showProjectScrollbarTemporarily}
          onMouseLeave={handleProjectListMouseLeave}
          className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden hide-scrollbar pr-1 left-sidebar-scroll ${isProjectListScrolling ? 'is-scrolling' : ''}`}
        >
          {filteredProjects.length > 0 ? (
            <ProjectTree
              projects={filteredProjects}
              teams={filteredTeams}
              agents={filteredAgents}
              activeProjectId={activeProjectId}
              activeTeamId={activeTeamId}
              activeAgentId={activeAgentId}
              expandedProjects={expandedProjects}
              expandedTeams={expandedTeams}
              onSelectProject={onSelectProject}
              onSelectTeam={onSelectTeam}
              onSelectAgent={onSelectAgent}
              onToggleProjectExpanded={onToggleProjectExpanded}
              onToggleTeamExpanded={onToggleTeamExpanded}
              onDeleteProject={handleDeleteProjectWithUndo}
              onDeleteTeam={handleDeleteTeamWithUndo}
              onDeleteAgent={handleDeleteAgentWithUndo}
              onUpdateProject={onUpdateProject}
              onUpdateTeam={onUpdateTeam}
              onUpdateAgent={onUpdateAgent}
              searchQuery={searchQuery}
              compact={!labelsShown}
            />
          ) : searchQuery ? (
            <div className="text-center py-8">
              <div className="hatchin-text-muted text-sm">
                No results for &ldquo;{searchQuery}&rdquo;
              </div>
              <button
                onClick={() => setSearchQuery("")}
                className="text-hatchin-blue text-xs hover:underline mt-2"
              >
                Clear search
              </button>
            </div>
          ) : projectsFetching > 0 ? (
            <ProjectTreeSkeleton />
          ) : (
            <div className="flex flex-col items-center py-6 px-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-hatchin-blue/15 border border-hatchin-blue/20 flex items-center justify-center mb-3">
                <span className="text-lg">🥚</span>
              </div>
              <p className="text-micro hatchin-text-muted leading-relaxed mb-3">
                Nothing here yet. Press <span className="text-hatchin-blue font-medium">+ New</span> and tell Maya what you want to build.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <motion.aside
      className="h-[calc(100vh-20px)] min-h-0 premium-column-bg rounded-2xl ml-2.5 my-2.5 relative flex flex-col overflow-hidden z-30"
      initial={false}
      animate={{ width: labelsShown ? 260 : 68 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      onWheel={handleSidebarWheel}
      onMouseEnter={startPeek}
      onMouseLeave={endPeek}
    >
      <div className="ambient-glow-top" />

      {/* ONE structure at a fixed 260px, clipped by the animating aside width. When narrow, only the
          text fades (driven by `labelsShown`) — the avatar, the search magnifier and every folder
          icon keep their exact positions, so opening the sidebar moves nothing. The chat/right panel
          shift smoothly because the aside's own width animates in flow. */}
      <div className="w-[260px] h-full p-3 flex flex-col min-h-0">
        <div className="relative mb-3 pb-3 hatchin-border border-b shrink-0">
          {renderAccountMenu()}
        </div>
        {fullBody}
      </div>

      {/* Add Project Modals */}
      <QuickStartModal
        isOpen={showQuickStart}
        onClose={handleCloseModals}
        onStartWithIdea={handleStartWithIdea}
        onUseStarterPack={handleUseStarterPack}
      />
      <StarterPacksModal
        isOpen={showStarterPacks}
        onClose={handleCloseModals}
        onBack={() => {
          setShowStarterPacks(false);
          setShowQuickStart(true);
        }}
        onSelectTemplate={handleTemplateSelect}
        isLoading={isCreatingProject}
      />
      <ProjectNameModal
        isOpen={showProjectName}
        onClose={handleCloseModals}
        onBack={() => {
          setShowProjectName(false);
          if (selectedTemplate) {
            setShowStarterPacks(true);
          } else {
            setShowQuickStart(true);
          }
        }}
        onConfirm={handleProjectNameConfirm}
        templateName={selectedTemplate?.title}
        templateDescription={selectedTemplate?.description}
        isLoading={isCreatingProject}
      />

      {/* Enhanced Undo Popup — Dark themed */}
      {showUndoPopup && deletedEntityData && (
        <div className="fixed bottom-4 left-4 z-50 bg-card border border-hatchin-border rounded-xl shadow-2xl p-4 max-w-sm">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-500/15 rounded-full flex items-center justify-center">
                <span className="text-sm">🗑️</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {deletedEntityData.type === 'project' && `"${(deletedEntityData.entity as Project).name}" deleted`}
                {deletedEntityData.type === 'team' && `"${(deletedEntityData.entity as Team).name}" deleted`}
                {deletedEntityData.type === 'agent' && `"${(deletedEntityData.entity as Agent).name}" deleted`}
              </p>
              <p className="text-xs text-muted-foreground">
                {deletedEntityData.type === 'project' && deletedEntityData.relatedData && (
                  `${deletedEntityData.relatedData.teams?.length || 0} teams, ${deletedEntityData.relatedData.agents?.length || 0} agents included`
                )}
                {deletedEntityData.type === 'team' && deletedEntityData.relatedData && (
                  `${deletedEntityData.relatedData.agents?.length || 0} agents included`
                )}
                {deletedEntityData.type === 'agent' && 'Click undo to restore'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleUndoDelete}
                className="px-3 py-1 bg-hatchin-blue text-white text-xs rounded-lg hover:bg-hatchin-blue/90 transition-colors font-medium"
              >
                Undo
              </button>
              <button
                onClick={() => {
                  // Explicit dismiss = permanent. Same purge path as auto-hide.
                  if (deletedEntityData?.type === 'project') {
                    void purgeSoftDeletedProject((deletedEntityData.entity as Project).id);
                  }
                  setShowUndoPopup(false);
                  setDeletedEntityData(null);
                }}
                className="px-3 py-1 bg-muted text-muted-foreground text-xs rounded-lg hover:bg-hatchin-surface transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.aside>
  );
}
