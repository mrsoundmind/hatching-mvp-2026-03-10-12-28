import { devLog } from '@/lib/devLog';
import { useState, useEffect, useRef } from "react";
import { ProjectTree } from "@/components/ProjectTree";
import { ChevronDown, Search, Settings, LogOut, User, X, Brain } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Project, Team, Agent } from "@shared/schema";

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
  onCreateTeam?: (name: string, projectId: string) => Promise<any> | void;
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
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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


  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const projectListRef = useRef<HTMLDivElement>(null);
  const projectScrollHideTimeoutRef = useRef<number | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [searchQuery]);

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

    setIsCreatingProject(true);

    try {
      if (selectedTemplate && onCreateProjectFromTemplate) {
        await onCreateProjectFromTemplate(selectedTemplate, name, description);
      } else if (selectedTemplate === null && onCreateIdeaProject) {
        // This is the "Start with an idea" flow
        await onCreateIdeaProject(name, description);
      } else if (onCreateProject) {
        await onCreateProject(name, description);
      }

      // Close all modals and reset state
      setShowProjectName(false);
      setSelectedTemplate(null);
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
      await onDeleteProject(projectId);
    }
    setShowUndoPopup(true);

    // Auto-hide popup after 5 seconds
    setTimeout(() => {
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
      if (deletedEntityData.type === 'project' && onCreateProject) {
        devLog('🔄 Starting project restoration...');

        // Restore project first and get the new project ID
        const newProject = await onCreateProject(
          (deletedEntityData.entity as Project).name,
          (deletedEntityData.entity as Project).description || undefined
        );

        devLog('🔄 Project created with new ID:', newProject?.id);

        // Small delay to ensure project is created before restoring teams and agents
        await new Promise(resolve => setTimeout(resolve, 200));

        // Restore teams with the NEW project ID and track new team IDs
        const teamIdMap = new Map(); // Map old team IDs to new team IDs
        if (deletedEntityData.relatedData?.teams && onCreateTeam) {
          devLog('🔄 Restoring teams...');
          for (const team of deletedEntityData.relatedData.teams) {
            try {
              const newTeam = await onCreateTeam(team.name, newProject?.id || team.projectId);
              if (newTeam) {
                teamIdMap.set(team.id, newTeam.id);
                devLog(`✅ Team "${team.name}" restored with new ID: ${newTeam.id}`);
              }
            } catch (error) {
              console.error(`❌ Failed to restore team "${team.name}":`, error);
            }
          }
        }

        // Small delay before restoring agents
        await new Promise(resolve => setTimeout(resolve, 200));

        // Restore agents with the NEW project ID and NEW team IDs
        if (deletedEntityData.relatedData?.agents && onCreateAgent) {
          devLog('🔄 Restoring agents...');
          for (const agent of deletedEntityData.relatedData.agents) {
            try {
              // Get the new team ID if the agent belonged to a team
              const newTeamId = agent.teamId ? teamIdMap.get(agent.teamId) : undefined;
              const { id, ...agentData } = agent;

              await onCreateAgent({
                ...agentData,
                projectId: newProject?.id || agent.projectId,
                teamId: newTeamId || null
              });
              devLog(`✅ Agent "${agent.name}" restored`);
            } catch (error) {
              console.error(`❌ Failed to restore agent "${agent.name}":`, error);
            }
          }
        }

        devLog('✅ Project fully restored with all teams and agents');

      } else if (deletedEntityData.type === 'team' && onCreateTeam) {
        // Restore team
        const newTeam = await onCreateTeam(
          (deletedEntityData.entity as Team).name,
          (deletedEntityData.entity as Team).projectId
        );

        // Small delay to ensure team is created before restoring agents
        await new Promise(resolve => setTimeout(resolve, 100));

        // Restore team's agents
        if (deletedEntityData.relatedData?.agents && onCreateAgent) {
          for (const agent of deletedEntityData.relatedData.agents) {
            try {
              const teamIdToUse = newTeam?.id || agent.teamId || null;
              const { id, ...agentData } = agent;
              await onCreateAgent({
                ...agentData,
                projectId: agent.projectId,
                teamId: teamIdToUse
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



  return (
    <aside
      className="w-[260px] min-h-0 premium-column-bg overflow-hidden p-3 pl-6 rounded-r-2xl rounded-l-none ml-[-10px] relative flex flex-col"
      onWheel={handleSidebarWheel}
    >
      <div className="ambient-glow-top" />

      {/* Welcome Header */}
      <div ref={dropdownRef} className="relative mb-3 pb-3 hatchin-border border-b">
        <div
          className="flex items-center justify-between cursor-pointer hover:bg-hatchin-border rounded-lg p-2 transition-colors"
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">{user?.name?.charAt(0).toUpperCase() || 'U'}</span>
            </div>
            <span className="text-sm hatchin-text">Welcome, {user?.name || 'User'}</span>
          </div>
          <ChevronDown className={`w-3 h-3 hatchin-text-muted transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
        </div>
        {/* User Dropdown Menu */}
        {isUserMenuOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 hatchin-bg-card border hatchin-border rounded-lg shadow-lg z-50 overflow-hidden">
            <div className="py-1">
              <button className="w-full flex items-center gap-3 px-3 py-2 text-sm hatchin-text hover:bg-hatchin-border transition-colors">
                <User className="w-4 h-4" />
                Profile Settings
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 text-sm hatchin-text hover:bg-hatchin-border transition-colors">
                <Settings className="w-4 h-4" />
                Preferences
              </button>
              <ThemeToggle />

              <div className="border-t hatchin-border my-1"></div>
              <button
                onClick={signOut}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hatchin-text hover:bg-hatchin-border transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 hatchin-text-muted" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search projects or hatches (⌘K)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full hatchin-bg-card hatchin-border border rounded-lg py-2.5 text-sm hatchin-text placeholder-hatchin-text-muted focus:outline-none focus:ring-2 focus:ring-hatchin-blue focus:border-transparent pl-[32px] pr-[32px]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 hatchin-text-muted hover:hatchin-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {/* Projects Section */}
      <div className="mb-4 min-h-0 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium hatchin-text-muted uppercase tracking-wide text-[12px]">
            Projects
          </h2>
          <button
            onClick={handleAddProjectClick}
            className="px-2.5 py-1 bg-hatchin-blue/20 text-hatchin-blue rounded-full text-xs font-semibold hover:bg-hatchin-blue/30 transition-all border border-hatchin-blue/30"
          >
            + New
          </button>
        </div>

        <div
          ref={projectListRef}
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
          ) : (
            <div className="flex flex-col items-center py-6 px-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-hatchin-blue/15 border border-hatchin-blue/20 flex items-center justify-center mb-3">
                <span className="text-lg">🥚</span>
              </div>
              <p className="text-[11px] hatchin-text-muted leading-relaxed mb-3">
                Nothing here yet. Press <span className="text-hatchin-blue font-medium">+ New</span> and tell Maya what you want to build.
              </p>
            </div>
          )}
        </div>
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
    </aside>
  );
}
