import { ErrorBoundary } from 'react-error-boundary';
import { PanelErrorFallback } from '@/components/ErrorFallbacks';
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { LeftSidebar } from "@/components/LeftSidebar";
import { CenterPanel } from "@/components/CenterPanel";
import { RightSidebar } from "@/components/RightSidebar";
import { EggHatchingAnimation } from "@/components/EggHatchingAnimation";
import { OnboardingManager } from "@/components/OnboardingManager";
import QuickStartModal from "@/components/QuickStartModal";
import StarterPacksModal from "@/components/StarterPacksModal";
import ProjectNameModal from "@/components/ProjectNameModal";
import type { Project, Team, Agent } from "@shared/schema";
import { devLog } from "@/lib/devLog";

export default function Home() {
  const queryClient = useQueryClient();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  // All projects should always be expanded, and teams should be expanded by default
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [isEggHatching, setIsEggHatching] = useState(false);
  const [ideaProjectData, setIdeaProjectData] = useState<{
    name: string;
    description?: string;
  } | null>(null);
  const [starterPackProjectData, setStarterPackProjectData] = useState<{
    name: string;
    description?: string;
    starterPackId: string;
    starterPackTitle: string;
  } | null>(null);
  const [isPackHatching, setIsPackHatching] = useState(false);

  // Shared modal state for project creation (used by both LeftSidebar and CenterPanel)
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [showStarterPacks, setShowStarterPacks] = useState(false);
  const [showProjectName, setShowProjectName] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const { data: projects = [], refetch: refetchProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: teams = [], refetch: refetchTeams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: agents = [], refetch: refetchAgents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) : undefined;
  const activeProjectTeams = activeProjectId ? teams.filter(t => t.projectId === activeProjectId) : [];
  const activeProjectAgents = activeProjectId ? agents.filter(a => a.projectId === activeProjectId) : [];

  // Keep projects query cache in sync when chat auto-updates project brain fields.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        projectId?: string;
        patch?: Partial<Project>;
      };
      if (!detail?.projectId || !detail.patch) return;

      queryClient.setQueryData<Project[]>(["/api/projects"], (prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((project) =>
          project.id === detail.projectId
            ? { ...project, ...detail.patch }
            : project
        );
      });
    };

    window.addEventListener('project_brain_updated', handler as EventListener);
    return () => {
      window.removeEventListener('project_brain_updated', handler as EventListener);
    };
  }, [queryClient]);

  const normalizeSelectionId = (id: string | null | undefined): string | null => {
    if (typeof id !== 'string') return null;
    const normalized = id.trim();
    if (!normalized || normalized === 'undefined' || normalized === 'null') {
      return null;
    }
    return normalized;
  };

  // Auto-expand all projects and teams when data loads
  useEffect(() => {
    if (projects.length > 0) {
      setExpandedProjects(new Set(projects.map(p => p.id)));
    }
  }, [projects]);

  useEffect(() => {
    if (teams.length > 0) {
      setExpandedTeams(new Set(teams.map(t => t.id)));
    }
  }, [teams]);

  // FIX 17: Auto-select first project if none is active
  useEffect(() => {
    if (projects && projects.length > 0 && !activeProjectId) {
      devLog('Auto-selecting first project:', projects[0].id);
      setActiveProjectId(projects[0].id);
      setActiveTeamId(null);
      setActiveAgentId(null);
    }
  }, [projects, activeProjectId]);

  // Keep sidebar/chat selection coherent when IDs are stale or invalid.
  useEffect(() => {
    const normalizedProjectId = normalizeSelectionId(activeProjectId);
    if (normalizedProjectId !== activeProjectId) {
      setActiveProjectId(normalizedProjectId);
      return;
    }

    const normalizedTeamId = normalizeSelectionId(activeTeamId);
    if (normalizedTeamId !== activeTeamId) {
      setActiveTeamId(normalizedTeamId);
      return;
    }

    const normalizedAgentId = normalizeSelectionId(activeAgentId);
    if (normalizedAgentId !== activeAgentId) {
      setActiveAgentId(normalizedAgentId);
      return;
    }

    if (projects.length === 0) {
      if (activeProjectId !== null) setActiveProjectId(null);
      if (activeTeamId !== null) setActiveTeamId(null);
      if (activeAgentId !== null) setActiveAgentId(null);
      return;
    }

    if (!activeProjectId) {
      if (activeTeamId !== null) setActiveTeamId(null);
      if (activeAgentId !== null) setActiveAgentId(null);
      return;
    }

    const projectExists = projects.some((project) => project.id === activeProjectId);
    if (!projectExists) {
      setActiveProjectId(projects[0].id);
      setActiveTeamId(null);
      setActiveAgentId(null);
      return;
    }

    if (activeTeamId) {
      const teamExists = teams.some((team) => team.id === activeTeamId && team.projectId === activeProjectId);
      if (!teamExists) {
        setActiveTeamId(null);
      }
    }

    if (activeAgentId) {
      const agentExists = agents.some((agent) => agent.id === activeAgentId && agent.projectId === activeProjectId);
      if (!agentExists) {
        setActiveAgentId(null);
      }
    }
  }, [activeProjectId, activeTeamId, activeAgentId, projects, teams, agents]);

  // Toggle functions for expand/collapse
  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const toggleTeamExpanded = (teamId: string) => {
    setExpandedTeams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  };

  // Selection handlers - ensure users can switch between projects
  const handleSelectProject = (projectId: string) => {
    const normalizedProjectId = normalizeSelectionId(projectId);
    if (!normalizedProjectId) {
      return;
    }

    devLog('Selecting project:', projectId);

    devLog('PROJECT_SELECTED', {
      nextProjectId: normalizedProjectId,
      previousProjectId: activeProjectId,
      previousTeamId: activeTeamId,
      previousAgentId: activeAgentId,
      selectionReason: 'user_click'
    });

    setActiveProjectId(normalizedProjectId);
    setActiveTeamId(null);
    setActiveAgentId(null);
  };

  const handleSelectTeam = (teamId: string | null) => {
    const normalizedTeamId = normalizeSelectionId(teamId);

    devLog('TEAM_SELECTED', {
      nextTeamId: normalizedTeamId,
      previousTeamId: activeTeamId,
      previousAgentId: activeAgentId,
      projectId: activeProjectId,
      selectionReason: 'user_click'
    });

    setActiveTeamId(normalizedTeamId);
    setActiveAgentId(null);
  };

  const handleSelectAgent = (agentId: string | null) => {
    const normalizedAgentId = normalizeSelectionId(agentId);

    devLog('AGENT_SELECTED', {
      nextAgentId: normalizedAgentId,
      previousAgentId: activeAgentId,
      projectId: activeProjectId,
      teamId: activeTeamId,
      selectionReason: 'user_click'
    });

    setActiveAgentId(normalizedAgentId);
  };

  // Project creation handlers
  const handleCreateProject = async (name: string, description?: string) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description: description || `${name} project`,
          emoji: '🚀',
          color: 'blue'
        }),
      });

      if (response.ok) {
        const newProject = await response.json();
        devLog('Project created successfully:', newProject);

        devLog('PROJECT_CREATED', {
          projectId: newProject.id,
          projectName: newProject.name,
          creationType: 'normal'
        });

        // ============================================================
        // INVARIANT: Routing Invariant (Phase 1.4)
        // New projects must start in PROJECT scope by default.
        // Do NOT set activeAgentId here.
        // ============================================================
        setActiveProjectId(newProject.id);
        setActiveTeamId(null);
        setActiveAgentId(null); // MUST be null - enforces project scope

        devLog('POST_CREATE_AUTO_SELECTION', {
          projectId: newProject.id,
          activeTeamId: null,
          activeAgentId: null,
          selectionReason: 'newly_created_project'
        });

        // Auto-expand the new project 
        setExpandedProjects(prev => {
          const newSet = new Set(prev);
          newSet.add(newProject.id);
          return newSet;
        });

        // Optimistically update the projects cache so the UI updates immediately
        queryClient.setQueryData(["/api/projects"], (oldData: any) => {
          return oldData ? [...oldData, newProject] : [newProject];
        });

        // Trigger data refresh just in case
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });

        // Return the created project for undo functionality
        return newProject;
      } else {
        console.error('Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  // Idea project creation handler
  const handleCreateIdeaProject = async (name: string, description?: string) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description: description || `${name} project`,
          emoji: '🚀',
          color: 'purple',
          projectType: 'idea' // This triggers Maya agent creation and brain initialization
        }),
      });

      if (response.ok) {
        const newProject = await response.json();
        devLog('Idea project created successfully:', newProject);

        devLog('IDEA_PROJECT_CREATED', {
          projectId: newProject.id,
          projectName: newProject.name,
          creationType: 'idea'
        });

        // Store project data for the egg hatching animation
        setIdeaProjectData({ name, description });

        // Start the egg hatching animation
        setIsEggHatching(true);

        // Optimistically update the query cache
        queryClient.setQueryData(["/api/projects"], (oldData: any) => {
          return oldData ? [...oldData, newProject] : [newProject];
        });

        // Trigger data refresh
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });

        return newProject;
      } else {
        console.error('Failed to create idea project');
      }
    } catch (error) {
      console.error('Error creating idea project:', error);
    }
  };

  // Handle egg hatching completion
  const handleEggHatchingComplete = async () => {
    setIsEggHatching(false);

    // Wait a moment for data to sync, then find the most recent project with Maya
    setTimeout(async () => {
      try {
        // Refresh all data first
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
        queryClient.invalidateQueries({ queryKey: ["/api/agents"] });

        // Get the latest projects data
        const [projectsRes, teamsRes, agentsRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/teams'),
          fetch('/api/agents')
        ]);

        const latestProjects = await projectsRes.json();
        const latestTeams = await teamsRes.json();
        const latestAgents = await agentsRes.json();

        // Find the most recently created project (highest timestamp or by name match)
        const newProject = latestProjects.find((p: any) =>
          ideaProjectData && p.name === ideaProjectData.name
        ) || latestProjects[latestProjects.length - 1];

        if (newProject) {
          // Find Maya agent for this project
          const mayaAgent = latestAgents.find((a: any) =>
            a.projectId === newProject.id && a.name === "Maya" && a.isSpecialAgent
          );

          // Find the Core Team for this project
          const coreTeam = latestTeams.find((t: any) =>
            t.projectId === newProject.id && t.name === "Core Team"
          );

          // ============================================================
          // INVARIANT: Routing Invariant (Phase 1.4)
          // New projects must start in PROJECT scope by default.
          // Do NOT set activeAgentId here, even if mayaAgent exists.
          // User must explicitly select an agent to enter agent scope.
          // ============================================================
          setActiveProjectId(newProject.id);
          setActiveTeamId(null);
          setActiveAgentId(null); // MUST be null - enforces project scope

          devLog('POST_CREATE_AUTO_SELECTION', {
            projectId: newProject.id,
            activeTeamId: null,
            activeAgentId: null,
            mayaAgentFound: !!mayaAgent,
            coreTeamFound: !!coreTeam,
            selectionReason: 'egg_hatching_complete_project_scope'
          });

          // Expand both project and core team to show Maya
          setExpandedProjects(prev => {
            const newSet = new Set(prev);
            newSet.add(newProject.id);
            return newSet;
          });

          if (coreTeam) {
            setExpandedTeams(prev => {
              const newSet = new Set(prev);
              newSet.add(coreTeam.id);
              return newSet;
            });
          }
        }

        setIdeaProjectData(null);
      } catch (error) {
        console.error('Error in handleEggHatchingComplete:', error);
        setIdeaProjectData(null);
      }
    }, 500);
  };

  const handleCreateProjectFromTemplate = async (pack: any, name: string, description?: string) => {
    try {
      setStarterPackProjectData({
        name,
        description,
        starterPackId: pack.id,
        starterPackTitle: pack.title
      });
      setIsPackHatching(true);

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description: description || pack.description,
          emoji: pack.emoji,
          color: pack.color,
          starterPackId: pack.id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const project = await response.json();
      devLog("Project created from template:", project);

      // Optimistically update the projects cache so it appears immediately
      queryClient.setQueryData(["/api/projects"], (oldData: any) => {
        return oldData ? [...oldData, project] : [project];
      });

      // Immediately refresh all data to get the new teams and agents
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });

    } catch (error) {
      console.error('Error creating project from template:', error);
      setIsPackHatching(false);
      setStarterPackProjectData(null);
    }
  };

  // Pack hatching completion handler
  const handlePackHatchingComplete = async () => {
    setTimeout(async () => {
      try {
        // Close animation first
        setIsPackHatching(false);

        if (starterPackProjectData) {
          // Refresh all data to get the new project with teams and agents
          queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
          queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
          queryClient.invalidateQueries({ queryKey: ["/api/agents"] });

          // Find the newly created project
          const projects = (await fetch('/api/projects').then(res => res.json())) as Project[];
          const newProject = projects.find(p => p.name === starterPackProjectData.name);

          if (newProject) {
            // Set the new project as active and expand it
            setActiveProjectId(newProject.id);
            setActiveTeamId(null);
            setActiveAgentId(null);

            // Auto-expand the new project and all its teams
            setExpandedProjects(prev => {
              const newSet = new Set(prev);
              newSet.add(newProject.id);
              return newSet;
            });

            // Get teams for this project and auto-expand them
            const teams = (await fetch(`/api/projects/${newProject.id}/teams`).then(res => res.json())) as Team[];
            setExpandedTeams(prev => {
              const newSet = new Set(prev);
              teams.forEach(team => newSet.add(team.id));
              return newSet;
            });
          }
        }

        // Reset the starter pack project data
        setStarterPackProjectData(null);
      } catch (error) {
        console.error('Error in handlePackHatchingComplete:', error);
        setStarterPackProjectData(null);
      }
    }, 500);
  };

  // Agent creation handler
  const handleCreateAgent = async (agentData: Omit<Agent, 'id'>) => {
    try {
      devLog('Creating agent with data:', agentData);
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentData),
      });

      if (response.ok) {
        const newAgent = await response.json();
        devLog('Agent created successfully:', newAgent);
        devLog('Current agents before refresh:', agents);

        // Refresh both agents and teams data (in case agent was added to a new team)
        queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
        queryClient.invalidateQueries({ queryKey: ["/api/teams"] });

        devLog('Agents data refreshed');

        // Set the new agent as active and ensure its team is expanded
        setActiveAgentId(newAgent.id);
        if (newAgent.teamId) {
          setExpandedTeams(prev => {
            const newSet = new Set(prev);
            newSet.add(newAgent.teamId);
            return newSet;
          });
        }

        // Return the created agent for undo functionality
        return newAgent;
      } else {
        const errorText = await response.text();
        console.error('Failed to create agent:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error creating agent:', error);
    }
  };

  // Team creation handler
  const handleCreateTeam = async (name: string, projectId: string) => {
    try {
      devLog('Creating team with data:', { name, projectId });
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, projectId }),
      });

      if (response.ok) {
        const newTeam = await response.json();
        devLog('Team created successfully:', newTeam);

        // Refresh data
        queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
        devLog('Teams refetched');

        // Return the created team for undo functionality
        return newTeam;
      } else {
        const errorText = await response.text();
        console.error('Failed to create team:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error creating team:', error);
    }
  };

  // Delete handlers
  const handleDeleteTeam = async (teamId: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        devLog('Team deleted successfully');

        // Clear active selections if the deleted team was active
        if (activeTeamId === teamId) {
          setActiveTeamId(null);
          setActiveAgentId(null);
        }

        // Refresh data
        queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
        queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      } else {
        console.error('Failed to delete team');
      }
    } catch (error) {
      console.error('Error deleting team:', error);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        devLog('Agent deleted successfully');

        // Clear active selection if the deleted agent was active
        if (activeAgentId === agentId) {
          setActiveAgentId(null);
        }

        // Refresh agents data
        queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      } else {
        console.error('Failed to delete agent');
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    devLog('🚀 handleDeleteProject called with projectId:', projectId);
    try {
      devLog('📡 Making DELETE request to:', `/api/projects/${projectId}`);
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      devLog('📡 Response status:', response.status);
      devLog('📡 Response ok:', response.ok);

      if (response.ok) {
        devLog('✅ Project deleted successfully');
        // Clear active project if it was the deleted one
        if (activeProjectId === projectId) {
          devLog('🔄 Clearing active project');
          setActiveProjectId(null);
        }
        devLog('🔄 Refetching projects...');
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        devLog('✅ Projects refetched');
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to delete project. Status:', response.status);
        console.error('❌ Error response:', errorText);
      }
    } catch (error) {
      console.error('❌ Error deleting project:', error);
    }
  };

  const handleUpdateProject = async (projectId: string, updates: Partial<Project>) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        devLog('Project updated successfully');
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      } else {
        console.error('Failed to update project');
      }
    } catch (error) {
      console.error('Error updating project:', error);
    }
  };

  const handleUpdateTeam = async (teamId: string, updates: Partial<Team>) => {
    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        devLog('Team updated successfully');
        queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      } else {
        console.error('Failed to update team');
      }
    } catch (error) {
      console.error('Error updating team:', error);
    }
  };

  const handleUpdateAgent = async (agentId: string, updates: Partial<Agent>) => {
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        devLog('Agent updated successfully');
        queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      } else {
        console.error('Failed to update agent');
      }
    } catch (error) {
      console.error('Error updating agent:', error);
    }
  };

  // Shared modal handlers for project creation
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

  const handleTemplateSelect = (pack: any) => {
    setSelectedTemplate(pack);
    setShowStarterPacks(false);
    setShowProjectName(true);
  };

  const handleProjectNameSubmit = async (name: string, description?: string) => {
    setShowProjectName(false);
    setIsCreatingProject(true);

    try {
      if (selectedTemplate) {
        await handleCreateProjectFromTemplate(selectedTemplate, name, description || '');
      } else {
        await handleCreateProject(name, description);
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsCreatingProject(false);
      setSelectedTemplate(null);
    }
  };

  const handleCloseModals = () => {
    setShowQuickStart(false);
    setShowStarterPacks(false);
    setShowProjectName(false);
    setSelectedTemplate(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        devLog('🔄 Sidebar toggle shortcut activated');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        devLog('🔍 Search focus shortcut activated');
      }
      // Debug shortcut to reset onboarding and auth
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        localStorage.removeItem('hasCompletedOnboarding');
        localStorage.removeItem('hatchin_user');
        devLog('🔄 Onboarding and auth reset! Refresh to see onboarding modal.');
        window.location.reload();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, []);

  return (
    <div className="hatchin-bg-dark min-h-screen overflow-hidden">
      {/* Onboarding System */}
      <OnboardingManager
        onComplete={(path, templateData) => {
          if (path === 'idea') {
            // Handle idea path - create Maya project
            handleCreateIdeaProject('My Idea', 'Developing and structuring my raw idea with Maya\'s help');
          } else if (path === 'template' && templateData) {
            // Handle template path - create project from template
            handleCreateProjectFromTemplate(templateData, templateData.title, templateData.description);
          } else if (path === 'scratch') {
            // Handle scratch path - just continue with existing projects
            devLog('User chose to figure it out as they go');
          }
        }}
      />

      <div className="h-screen min-h-0 flex gap-3">
        <ErrorBoundary FallbackComponent={PanelErrorFallback}>
          <LeftSidebar
            projects={projects}
            teams={teams}
            agents={agents}
            activeProjectId={activeProjectId}
            activeTeamId={activeTeamId}
            activeAgentId={activeAgentId}
            expandedProjects={expandedProjects}
            expandedTeams={expandedTeams}
            onSelectProject={handleSelectProject}
            onSelectTeam={handleSelectTeam}
            onSelectAgent={handleSelectAgent}
            onToggleProjectExpanded={toggleProjectExpanded}
            onToggleTeamExpanded={toggleTeamExpanded}
            onCreateProject={handleCreateProject}
            onCreateProjectFromTemplate={handleCreateProjectFromTemplate}
            onCreateIdeaProject={handleCreateIdeaProject}
            onCreateTeam={handleCreateTeam}
            onCreateAgent={handleCreateAgent}
            onDeleteTeam={handleDeleteTeam}
            onDeleteAgent={handleDeleteAgent}
            onDeleteProject={handleDeleteProject}
            onUpdateProject={handleUpdateProject}
            onUpdateTeam={handleUpdateTeam}
            onUpdateAgent={handleUpdateAgent}
          />
        </ErrorBoundary>

        <ErrorBoundary FallbackComponent={PanelErrorFallback}>
          <CenterPanel
            activeProject={activeProject}
            activeProjectTeams={activeProjectTeams}
            activeProjectAgents={activeProjectAgents}
            activeTeamId={activeTeamId}
            activeAgentId={activeAgentId}
            onAddAgent={handleCreateAgent}
            projects={projects}
            onCreateProject={handleCreateProject}
            onCreateProjectFromTemplate={handleCreateProjectFromTemplate}
            onCreateIdeaProject={handleCreateIdeaProject}
            onAddProjectClick={handleAddProjectClick}
          />
        </ErrorBoundary>

        <ErrorBoundary FallbackComponent={PanelErrorFallback}>
          <RightSidebar
            activeProject={activeProject}
            activeTeam={teams.find(t => t.id === activeTeamId)}
            activeAgent={agents.find(a => a.id === activeAgentId)}
          />
        </ErrorBoundary>
      </div>

      {/* Egg Hatching Animation */}
      {isEggHatching && ideaProjectData && (
        <EggHatchingAnimation
          projectName={ideaProjectData.name}
          onComplete={handleEggHatchingComplete}
        />
      )}

      {/* Starter Pack Hatching Animation */}
      {isPackHatching && starterPackProjectData && (
        <EggHatchingAnimation
          projectName={starterPackProjectData.name}
          completionTitle={`${starterPackProjectData.starterPackTitle} is Ready!`}
          completionSubtitle="Your team is assembled and ready to work."
          onComplete={handlePackHatchingComplete}
        />
      )}

      {/* Shared Project Creation Modals */}
      <QuickStartModal
        isOpen={showQuickStart}
        onClose={handleCloseModals}
        onStartWithIdea={handleStartWithIdea}
        onUseStarterPack={handleUseStarterPack}
      />

      <StarterPacksModal
        isOpen={showStarterPacks}
        onClose={handleCloseModals}
        onSelectTemplate={handleTemplateSelect}
      />

      <ProjectNameModal
        isOpen={showProjectName}
        onClose={handleCloseModals}
        onConfirm={handleProjectNameSubmit}
        templateName={selectedTemplate?.title || ''}
        templateDescription={selectedTemplate?.description || ''}
        isLoading={isCreatingProject}
      />
    </div>
  );
}
