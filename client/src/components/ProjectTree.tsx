import { devLog } from '@/lib/devLog';
import React, { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, MoreHorizontal, FileText, Users, X, File, Folder, UserCircle, Edit, Trash2 } from "lucide-react";
import type { Project, Team, Agent } from "@shared/schema";
import { getAgentColors } from '@/lib/agentColors';
import { getRoleDefinition } from '@shared/roleRegistry';
import AgentAvatar from '@/components/avatars/AgentAvatar';

interface ProjectTreeProps {
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
  onDeleteTeam?: (teamId: string) => void;
  onDeleteAgent?: (agentId: string) => void;
  onDeleteProject?: (projectId: string) => Promise<void>;
  onUpdateProject?: (projectId: string, updates: Partial<Project>) => Promise<void>;
  onUpdateTeam?: (teamId: string, updates: Partial<Team>) => Promise<void>;
  onUpdateAgent?: (agentId: string, updates: Partial<Agent>) => Promise<void>;
  searchQuery?: string;
}

export function ProjectTree({
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
  onDeleteTeam,
  onDeleteAgent,
  onDeleteProject,
  onUpdateProject,
  onUpdateTeam,
  onUpdateAgent,
  searchQuery = "",
}: ProjectTreeProps) {
  // Helper function to highlight search matches
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <span key={index} className="bg-hatchin-blue/20 text-hatchin-blue rounded px-1">
          {part}
        </span>
      ) : part
    );
  };
  const getAgentColorClass = (color: string) => {
    switch (color) {
      case 'amber':
        return 'bg-[#FFB547]';
      case 'blue':
        return 'bg-hatchin-blue';
      case 'green':
        return 'bg-[#47DB9A]';
      case 'purple':
        return 'bg-[#9F7BFF]';
      case 'red':
        return 'bg-[#FF4E6A]';
      default:
        return 'bg-hatchin-blue';
    }
  };

  const getAgentInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getProjectIconColor = (color: string) => {
    switch (color) {
      case 'blue':
        return 'text-hatchin-blue';
      case 'green':
        return 'text-[#47DB9A]';
      case 'purple':
        return 'text-[#9F7BFF]';
      case 'amber':
        return 'text-[#FFB547]';
      case 'red':
        return 'text-[#FF4E6A]';
      default:
        return 'text-hatchin-blue';
    }
  };

  // State for inline editing
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // State for context menu and delete confirmations
  const [contextMenuOpen, setContextMenuOpen] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showTeamDeleteConfirm, setShowTeamDeleteConfirm] = useState<string | null>(null);
  const [showAgentDeleteConfirm, setShowAgentDeleteConfirm] = useState<string | null>(null);


  // Focus input when editing starts
  useEffect(() => {
    if (inputRef.current && (editingProject || editingTeam || editingAgent)) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingProject, editingTeam, editingAgent]);

  // Handle double-click to start editing
  const handleDoubleClick = (type: 'project' | 'team' | 'agent', id: string, currentName: string) => {
    if (type === 'project') {
      setEditingProject(id);
    } else if (type === 'team') {
      setEditingTeam(id);
    } else if (type === 'agent') {
      setEditingAgent(id);
    }
    setEditValue(currentName);
  };

  // Handle edit submission
  const handleEditSubmit = async () => {
    const trimmedValue = editValue.trim();
    if (!trimmedValue) return;

    try {
      if (editingProject && onUpdateProject) {
        await onUpdateProject(editingProject, { name: trimmedValue });
      } else if (editingTeam && onUpdateTeam) {
        await onUpdateTeam(editingTeam, { name: trimmedValue });
      } else if (editingAgent && onUpdateAgent) {
        await onUpdateAgent(editingAgent, { name: trimmedValue });
      }
    } catch (error) {
      console.error('Failed to update:', error);
    } finally {
      setEditingProject(null);
      setEditingTeam(null);
      setEditingAgent(null);
      setEditValue("");
    }
  };

  // Handle edit cancellation
  const handleEditCancel = () => {
    setEditingProject(null);
    setEditingTeam(null);
    setEditingAgent(null);
    setEditValue("");
  };

  // Handle key events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleEditCancel();
    }
  };

  // Context menu handlers
  const handleContextMenuToggle = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setContextMenuOpen(contextMenuOpen === projectId ? null : projectId);
    setShowDeleteConfirm(null);
  };

  const handleRenameProject = (projectId: string, currentName: string) => {
    setContextMenuOpen(null);
    handleDoubleClick('project', projectId, currentName);
  };

  const handleDeleteProject = async (projectId: string) => {
    devLog('handleDeleteProject called with projectId:', projectId);
    if (onDeleteProject) {
      try {
        devLog('Calling onDeleteProject...');
        await onDeleteProject(projectId);
        devLog('Project deleted successfully');

        setContextMenuOpen(null);
        setShowDeleteConfirm(null);

      } catch (error) {
        console.error('Failed to delete project:', error);
        setShowDeleteConfirm(null);
      }
    } else {
      console.error('onDeleteProject is not defined');
      setShowDeleteConfirm(null);
    }
  };


  // Team delete handlers
  const handleDeleteTeam = (teamId: string) => {
    devLog('handleDeleteTeam called with teamId:', teamId);
    if (onDeleteTeam) {
      try {
        devLog('Calling onDeleteTeam...');
        onDeleteTeam(teamId);
        devLog('Team deleted successfully');
        setShowTeamDeleteConfirm(null);
      } catch (error) {
        console.error('Failed to delete team:', error);
        setShowTeamDeleteConfirm(null); // Close dialog even on error
      }
    } else {
      console.error('onDeleteTeam is not defined');
      setShowTeamDeleteConfirm(null); // Close dialog if handler not available
    }
  };

  // Agent delete handlers
  const handleDeleteAgent = (agentId: string) => {
    devLog('handleDeleteAgent called with agentId:', agentId);
    if (onDeleteAgent) {
      try {
        devLog('Calling onDeleteAgent...');
        onDeleteAgent(agentId);
        devLog('Agent deleted successfully');
        setShowAgentDeleteConfirm(null);
      } catch (error) {
        console.error('Failed to delete agent:', error);
        setShowAgentDeleteConfirm(null); // Close dialog even on error
      }
    } else {
      console.error('onDeleteAgent is not defined');
      setShowAgentDeleteConfirm(null); // Close dialog if handler not available
    }
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenuOpen(null);
      setShowDeleteConfirm(null);
      setShowTeamDeleteConfirm(null);
      setShowAgentDeleteConfirm(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="space-y-1">
      {/* Premium empty state when no projects exist */}
      {projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 px-3 text-center">
          <div className="w-10 h-10 rounded-xl bg-hatchin-blue/15 flex items-center justify-center mb-3">
            <Folder className="w-5 h-5 text-hatchin-blue" />
          </div>
          <h4 className="font-medium hatchin-text text-xs mb-1">No projects yet</h4>
          <p className="text-xs hatchin-text-muted leading-relaxed mb-3 max-w-[160px]">
            Create a project or ask Maya to help you get started.
          </p>
        </div>
      )}
      {projects.map((project, index) => {
        const projectTeams = teams.filter(t => t.projectId === project.id);
        const isProjectActive = project.id === activeProjectId;

        const isProjectExpanded = expandedProjects.has(project.id);

        return (
          <div key={project.id} className="flex flex-col">
            {index > 0 && (
              <div className="h-px w-full bg-gradient-to-r from-transparent via-hatchin-blue/20 to-transparent my-1" />
            )}
            <div className="space-y-0.5">
              {/* Project Level */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 group">
                <div
                  className={`flex items-center gap-2 min-w-0 flex-1 cursor-pointer rounded-lg py-1.5 px-2 transition-all duration-200 hover:bg-hatchin-border hover:shadow-sm relative ${isProjectActive && !activeTeamId && !activeAgentId
                    ? 'bg-hatchin-blue/10 border-l-2 border-hatchin-blue'
                    : ''
                    }`}
                  onClick={() => onSelectProject(project.id)}
                >
                  <div
                    className="flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (projectTeams.length > 0) {
                        onToggleProjectExpanded(project.id);
                      }
                    }}
                  >
                    {projectTeams.length > 0 && (
                      isProjectExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 hatchin-text-muted hover:hatchin-text cursor-pointer" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 hatchin-text-muted hover:hatchin-text cursor-pointer" />
                      )
                    )}
                  </div>
                  <File className={`w-4 h-4 mr-2 ${getProjectIconColor(project.color)}`} />
                  {editingProject === project.id ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={handleEditSubmit}
                      className="font-medium hatchin-text text-sm bg-transparent border-none outline-none flex-1 min-w-0"
                      style={{ width: `${Math.max(editValue.length * 8, 60)}px` }}
                    />
                  ) : (
                    <span
                      className="font-medium hatchin-text truncate text-sm cursor-pointer hover:bg-hatchin-border/50 px-1 py-0.5 rounded"
                      onDoubleClick={() => handleDoubleClick('project', project.id, project.name)}
                    >
                      {highlightMatch(project.name, searchQuery)}
                    </span>
                  )}
                </div>
                <div className="relative flex-shrink-0">
                  <button
                    className="opacity-0 group-hover:opacity-100 hatchin-text-muted hover:hatchin-text transition-opacity"
                    onClick={(e) => handleContextMenuToggle(project.id, e)}
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>

                  {/* Context Menu */}
                  {contextMenuOpen === project.id && (
                    <div className="absolute right-2 top-6 z-50 bg-[#34373d] border border-gray-600 rounded-lg shadow-lg py-1 min-w-[120px]">
                      <button
                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#40444b] flex items-center gap-3 transition-colors"
                        onClick={() => handleRenameProject(project.id, project.name)}
                      >
                        <Edit className="w-4 h-4" />
                        Rename
                      </button>
                      <button
                        className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-3 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          devLog('Delete button clicked for project:', project.id);
                          setContextMenuOpen(null); // Close context menu first
                          setShowDeleteConfirm(project.id); // Then show delete confirmation
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  )}

                  {/* Delete Confirmation */}
                  {showDeleteConfirm === project.id && (
                    <div
                      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(null);
                      }}
                    >
                      <div
                        className="bg-[#34373d] border border-red-500/50 rounded-lg shadow-xl p-6 min-w-[300px] max-w-[400px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </div>
                          <h3 className="text-lg font-medium text-white">Delete Project</h3>
                        </div>
                        <p className="text-sm text-gray-300 mb-6">
                          Are you sure you want to delete <span className="font-medium text-white">"{project.name}"</span>?
                          This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                          <button
                            className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors rounded-md hover:bg-gray-700/50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(null);
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            className="px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors font-medium"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(project.id);
                            }}
                          >
                            Delete Project
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Teams and Individual Agents */}
              {isProjectExpanded && (
                <div className="ml-7 space-y-1">
                  {/* Teams */}
                  {projectTeams.map(team => {
                    const teamAgents = agents.filter(a => a.teamId === team.id);
                    const isTeamActive = team.id === activeTeamId;
                    const isTeamExpanded = expandedTeams.has(team.id);

                    return (
                      <div key={team.id} className="space-y-1">
                        {/* Team Level */}
                        <div
                          className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 group hover:bg-hatchin-border hover:shadow-sm relative ${isTeamActive && !activeAgentId
                            ? 'bg-hatchin-blue/10 border-l-2 border-hatchin-blue'
                            : ''
                            }`}
                          onClick={() => onSelectTeam(team.id)}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div
                              className="flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (teamAgents.length > 0) {
                                  onToggleTeamExpanded(team.id);
                                }
                              }}
                            >
                              {teamAgents.length > 0 && (
                                isTeamExpanded ? (
                                  <ChevronDown className="w-3 h-3 hatchin-text-muted hover:hatchin-text cursor-pointer" />
                                ) : (
                                  <ChevronRight className="w-3 h-3 hatchin-text-muted hover:hatchin-text cursor-pointer" />
                                )
                              )}
                            </div>
                            <Users className={`w-4 h-4 mr-2 ${getProjectIconColor(projects.find(p => p.id === team.projectId)?.color || 'blue')}`} />
                            {editingTeam === team.id ? (
                              <input
                                ref={inputRef}
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={handleEditSubmit}
                                className="hatchin-text text-xs bg-transparent border-none outline-none flex-1 min-w-0"
                                style={{ width: `${Math.max(editValue.length * 7, 50)}px` }}
                              />
                            ) : (
                              <span
                                className="hatchin-text text-xs truncate cursor-pointer hover:bg-hatchin-border/50 px-1 py-0.5 rounded"
                                onDoubleClick={() => handleDoubleClick('team', team.id, team.name)}
                              >
                                {highlightMatch(team.name, searchQuery)}
                              </span>
                            )}
                            <span className="text-xs hatchin-text-muted flex-shrink-0 ml-1">
                              ({teamAgents.length})
                            </span>
                          </div>
                          {onDeleteTeam && (
                            <button
                              className="opacity-0 group-hover:opacity-100 hatchin-text-muted hover:text-red-400 transition-all flex-shrink-0 p-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowTeamDeleteConfirm(team.id);
                              }}
                              data-testid={`button-delete-team-${team.id}`}
                              title="Delete team"
                              aria-label="Delete team"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}

                          {/* Team Delete Confirmation */}
                          {showTeamDeleteConfirm === team.id && (
                            <div
                              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowTeamDeleteConfirm(null);
                              }}
                            >
                              <div
                                className="bg-[#34373d] border border-red-500/50 rounded-lg shadow-xl p-6 min-w-[300px] max-w-[400px]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                  </div>
                                  <h3 className="text-lg font-medium text-white">Delete Team</h3>
                                </div>
                                <p className="text-sm text-gray-300 mb-6">
                                  Are you sure you want to delete <span className="font-medium text-white">"{team.name}"</span>?
                                  This action cannot be undone.
                                </p>
                                <div className="flex gap-3 justify-end">
                                  <button
                                    className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors rounded-md hover:bg-gray-700/50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowTeamDeleteConfirm(null);
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    className="px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors font-medium"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTeam(team.id);
                                    }}
                                  >
                                    Delete Team
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Team Agents */}
                        <AnimatePresence initial={false}>
                          {isTeamExpanded && (
                            <motion.div
                              key={`agents-${team.id}`}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.18, ease: 'easeInOut' }}
                              className="overflow-hidden"
                            >
                          <div className="ml-7 space-y-0.5">
                            {teamAgents.map(agent => {
                              const isAgentActive = agent.id === activeAgentId;

                              return (
                                <div
                                  key={agent.id}
                                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 relative group hover:bg-hatchin-border hover:shadow-sm ${isAgentActive
                                    ? 'bg-hatchin-blue/10 border-l-2 border-hatchin-blue'
                                    : ''
                                    }`}
                                  onClick={() => onSelectAgent(agent.id)}
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <React.Suspense fallback={<div className={`w-5 h-5 rounded-full flex-shrink-0 ${getAgentColors(agent.role).avatarBg}`} />}>
                                      <AgentAvatar role={agent.role} state="idle" size={20} />
                                    </React.Suspense>
                                    {editingAgent === agent.id ? (
                                      <input
                                        ref={inputRef}
                                        type="text"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        onBlur={handleEditSubmit}
                                        className="hatchin-text-muted text-xs bg-transparent border-none outline-none flex-1 min-w-0"
                                        style={{ width: `${Math.max(editValue.length * 7, 50)}px` }}
                                      />
                                    ) : (
                                      <span
                                        className="hatchin-text-muted text-xs truncate cursor-pointer hover:bg-hatchin-border/50 px-1 py-0.5 rounded"
                                        onDoubleClick={() => handleDoubleClick('agent', agent.id, agent.role || agent.name)}
                                      >
                                        {highlightMatch(getRoleDefinition(agent.role)?.characterName ?? agent.name, searchQuery)}
                                      </span>
                                    )}
                                  </div>
                                  {onDeleteAgent && (
                                    <button
                                      className="opacity-0 group-hover:opacity-100 hatchin-text-muted hover:text-red-400 transition-all flex-shrink-0 p-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowAgentDeleteConfirm(agent.id);
                                      }}
                                      data-testid={`button-delete-agent-${agent.id}`}
                                      title="Delete agent"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}

                                  {/* Agent Delete Confirmation */}
                                  {showAgentDeleteConfirm === agent.id && (
                                    <div
                                      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowAgentDeleteConfirm(null);
                                      }}
                                    >
                                      <div
                                        className="bg-[#34373d] border border-red-500/50 rounded-lg shadow-xl p-6 min-w-[300px] max-w-[400px]"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="flex items-center gap-3 mb-4">
                                          <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                                            <Trash2 className="w-4 h-4 text-red-400" />
                                          </div>
                                          <h3 className="text-lg font-medium text-white">Delete Agent</h3>
                                        </div>
                                        <p className="text-sm text-gray-300 mb-6">
                                          Are you sure you want to delete <span className="font-medium text-white">"{agent.role || agent.name}"</span>?
                                          This action cannot be undone.
                                        </p>
                                        <div className="flex gap-3 justify-end">
                                          <button
                                            className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors rounded-md hover:bg-gray-700/50"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setShowAgentDeleteConfirm(null);
                                            }}
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            className="px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors font-medium"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteAgent(agent.id);
                                            }}
                                          >
                                            Delete Agent
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}

                  {/* Individual Agents (not part of any team) */}
                  {(() => {
                    const individualAgents = agents.filter(a => a.projectId === project.id && !a.teamId);
                    return individualAgents.map(agent => {
                      const isAgentActive = agent.id === activeAgentId;

                      return (
                        <div
                          key={agent.id}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 relative group hover:bg-hatchin-border hover:shadow-sm ${isAgentActive
                            ? 'bg-hatchin-blue/10 border-l-2 border-hatchin-blue'
                            : ''
                            }`}
                          onClick={() => onSelectAgent(agent.id)}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <React.Suspense fallback={<div className={`w-5 h-5 rounded-full flex-shrink-0 ${getAgentColors(agent.role).avatarBg}`} />}>
                              <AgentAvatar role={agent.role} state="idle" size={20} />
                            </React.Suspense>
                            {editingAgent === agent.id ? (
                              <input
                                ref={inputRef}
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={handleEditSubmit}
                                className="hatchin-text-muted text-xs bg-transparent border-none outline-none flex-1 min-w-0"
                                style={{ width: `${Math.max(editValue.length * 7, 50)}px` }}
                              />
                            ) : (
                              <span
                                className="hatchin-text-muted text-xs truncate cursor-pointer hover:bg-hatchin-border/50 px-1 py-0.5 rounded"
                                onDoubleClick={() => handleDoubleClick('agent', agent.id, agent.name)}
                              >
                                {highlightMatch(getRoleDefinition(agent.role)?.characterName ?? agent.name, searchQuery)}
                              </span>
                            )}
                          </div>
                          {onDeleteAgent && (
                            <button
                              className="opacity-0 group-hover:opacity-100 hatchin-text-muted hover:text-red-400 transition-all flex-shrink-0 p-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowAgentDeleteConfirm(agent.id);
                              }}
                              data-testid={`button-delete-agent-${agent.id}`}
                              title="Delete agent"
                              aria-label="Delete agent"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}

                          {/* Individual Agent Delete Confirmation */}
                          {showAgentDeleteConfirm === agent.id && (
                            <div
                              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowAgentDeleteConfirm(null);
                              }}
                            >
                              <div
                                className="bg-[#34373d] border border-red-500/50 rounded-lg shadow-xl p-6 min-w-[300px] max-w-[400px]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                  </div>
                                  <h3 className="text-lg font-medium text-white">Delete Agent</h3>
                                </div>
                                <p className="text-sm text-gray-300 mb-6">
                                  Are you sure you want to delete <span className="font-medium text-white">"{agent.name}"</span>?
                                  This action cannot be undone.
                                </p>
                                <div className="flex gap-3 justify-end">
                                  <button
                                    className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors rounded-md hover:bg-gray-700/50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowAgentDeleteConfirm(null);
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    className="px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors font-medium"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteAgent(agent.id);
                                    }}
                                  >
                                    Delete Agent
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
