import { useState, useEffect, useCallback, useReducer } from 'react';
import type { 
  RightSidebarState, 
  RightSidebarUserPreferences, 
  RightSidebarExpandedSections,
  Project,
  Team,
  Agent
} from '@shared/schema';

// Action types for the state reducer
type RightSidebarAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ACTIVE_VIEW'; payload: 'project' | 'team' | 'agent' | 'none' }
  | { type: 'TOGGLE_SECTION'; payload: keyof RightSidebarExpandedSections }
  | { type: 'UPDATE_CORE_DIRECTION'; payload: Partial<RightSidebarState['coreDirection']> }
  | { type: 'UPDATE_EXECUTION_RULES'; payload: string }
  | { type: 'UPDATE_TEAM_CULTURE'; payload: string }
  | { type: 'SET_RECENTLY_SAVED'; payload: string }
  | { type: 'CLEAR_RECENTLY_SAVED'; payload: string }
  | { type: 'UPDATE_PREFERENCES'; payload: Partial<RightSidebarUserPreferences> }
  | { type: 'UPDATE_LAST_SAVED'; payload: { section: string; timestamp: number } }
  | { type: 'LOAD_PREFERENCES'; payload: RightSidebarUserPreferences }
  | { type: 'RESET_STATE' };

// State reducer function
function rightSidebarReducer(state: RightSidebarState, action: RightSidebarAction): RightSidebarState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'SET_ACTIVE_VIEW':
      return { ...state, activeView: action.payload };
    
    case 'TOGGLE_SECTION':
      const newExpandedSections = {
        ...state.expandedSections,
        [action.payload]: !state.expandedSections[action.payload]
      };
      return {
        ...state,
        expandedSections: newExpandedSections,
        preferences: {
          ...state.preferences,
          expandedSections: newExpandedSections
        }
      };
    
    case 'UPDATE_CORE_DIRECTION':
      return {
        ...state,
        coreDirection: { ...state.coreDirection, ...action.payload }
      };
    
    case 'UPDATE_EXECUTION_RULES':
      return { ...state, executionRules: action.payload };
    
    case 'UPDATE_TEAM_CULTURE':
      return { ...state, teamCulture: action.payload };
    
    case 'SET_RECENTLY_SAVED':
      const newRecentlySaved = new Set(state.recentlySaved);
      newRecentlySaved.add(action.payload);
      return { ...state, recentlySaved: newRecentlySaved };
    
    case 'CLEAR_RECENTLY_SAVED':
      const clearedRecentlySaved = new Set(state.recentlySaved);
      clearedRecentlySaved.delete(action.payload);
      return { ...state, recentlySaved: clearedRecentlySaved };
    
    case 'UPDATE_PREFERENCES':
      const updatedPreferences = { ...state.preferences, ...action.payload };
      return {
        ...state,
        preferences: updatedPreferences,
        expandedSections: updatedPreferences.expandedSections || state.expandedSections
      };
    
    case 'UPDATE_LAST_SAVED':
      return {
        ...state,
        lastSaved: {
          ...state.lastSaved,
          [action.payload.section]: new Date(action.payload.timestamp)
        }
      };
    
    case 'LOAD_PREFERENCES':
      return {
        ...state,
        preferences: { ...defaultPreferences, ...action.payload },
        expandedSections: { ...defaultPreferences.expandedSections, ...action.payload.expandedSections }
      };
    
    case 'RESET_STATE':
      return { ...defaultState };
    
    default:
      return state;
  }
}

const STORAGE_KEY = 'hatchin_right_sidebar_preferences';

const defaultPreferences: RightSidebarUserPreferences = {
  expandedSections: {
    coreDirection: true,
    targetAudience: false,
    executionRules: false,
    brandCulture: false,
    performance: true,
    skills: true,
    activity: false,
    // Team Dashboard sections
    teamGoal: false,
    strategyPhase: false,
    uiPolish: false,
    mvpRelease: false,
  },
  defaultView: 'project',
  autoSave: true,
  autoSaveDelay: 2000, // 2 seconds
  showTimestamps: true,
  compactMode: false,
};

const defaultState: RightSidebarState = {
  coreDirection: {
    whatBuilding: '',
    whyMatters: '',
    whoFor: '',
  },
  executionRules: '',
  teamCulture: '',
  expandedSections: defaultPreferences.expandedSections,
  recentlySaved: new Set(),
  activeView: 'none',
  preferences: defaultPreferences,
  isLoading: false,
  error: null,
  lastSaved: {},
};

export function useRightSidebarState(
  activeProject?: Project,
  activeTeam?: Team,
  activeAgent?: Agent
) {
  const [state, dispatch] = useReducer(rightSidebarReducer, defaultState);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const preferences = JSON.parse(stored) as RightSidebarUserPreferences;
        dispatch({ type: 'LOAD_PREFERENCES', payload: preferences });
      }
    } catch (error) {
      console.warn('Failed to load right sidebar preferences from localStorage:', error);
    }
  }, []);

  // Save preferences to localStorage when they change
  const savePreferences = useCallback((preferences: RightSidebarUserPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.warn('Failed to save right sidebar preferences to localStorage:', error);
    }
  }, []);

  // Update active view based on selections
  useEffect(() => {
    let newView: RightSidebarState['activeView'] = 'none';
    if (activeAgent) {
      newView = 'agent';
    } else if (activeTeam) {
      newView = 'team';
    } else if (activeProject) {
      newView = 'project';
    }

    dispatch({ type: 'SET_ACTIVE_VIEW', payload: newView });
  }, [activeProject, activeTeam, activeAgent]);

  // Update project data when activeProject changes
  useEffect(() => {
    if (activeProject) {
      dispatch({ 
        type: 'UPDATE_CORE_DIRECTION', 
        payload: {
          whatBuilding: activeProject.coreDirection?.whatBuilding || '',
          whyMatters: activeProject.coreDirection?.whyMatters || '',
          whoFor: activeProject.coreDirection?.whoFor || '',
        }
      });
      dispatch({ type: 'UPDATE_EXECUTION_RULES', payload: (activeProject.executionRules as any)?.rules || '' });
      dispatch({ type: 'UPDATE_TEAM_CULTURE', payload: activeProject.teamCulture || '' });
    }
  }, [activeProject]);

  // Auto-sync right sidebar state from chat-driven project brain patches
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        projectId?: string;
        patch?: {
          coreDirection?: Partial<RightSidebarState['coreDirection']>;
          executionRules?: string;
          teamCulture?: string;
        };
      };

      if (!detail?.projectId || !activeProject?.id || detail.projectId !== activeProject.id || !detail.patch) {
        return;
      }

      if (detail.patch.coreDirection) {
        dispatch({
          type: 'UPDATE_CORE_DIRECTION',
          payload: detail.patch.coreDirection
        });
        dispatch({ type: 'SET_RECENTLY_SAVED', payload: 'core-direction' });
        setTimeout(() => dispatch({ type: 'CLEAR_RECENTLY_SAVED', payload: 'core-direction' }), 2500);
      }

      if (typeof detail.patch.executionRules === 'string') {
        dispatch({ type: 'UPDATE_EXECUTION_RULES', payload: detail.patch.executionRules });
        dispatch({ type: 'SET_RECENTLY_SAVED', payload: 'execution-rules' });
        setTimeout(() => dispatch({ type: 'CLEAR_RECENTLY_SAVED', payload: 'execution-rules' }), 2500);
      }

      if (typeof detail.patch.teamCulture === 'string') {
        dispatch({ type: 'UPDATE_TEAM_CULTURE', payload: detail.patch.teamCulture });
        dispatch({ type: 'SET_RECENTLY_SAVED', payload: 'team-culture' });
        setTimeout(() => dispatch({ type: 'CLEAR_RECENTLY_SAVED', payload: 'team-culture' }), 2500);
      }
    };

    window.addEventListener('project_brain_updated', handler as EventListener);
    return () => {
      window.removeEventListener('project_brain_updated', handler as EventListener);
    };
  }, [activeProject?.id]);

  // Actions
  const updateCoreDirection = useCallback((field: keyof RightSidebarState['coreDirection'], value: string) => {
    dispatch({ 
      type: 'UPDATE_CORE_DIRECTION', 
      payload: { [field]: value } 
    });
  }, []);

  const updateExecutionRules = useCallback((value: string) => {
    dispatch({ type: 'UPDATE_EXECUTION_RULES', payload: value });
  }, []);

  const updateTeamCulture = useCallback((value: string) => {
    dispatch({ type: 'UPDATE_TEAM_CULTURE', payload: value });
  }, []);

  const toggleSection = useCallback((section: keyof RightSidebarExpandedSections) => {
    dispatch({ type: 'TOGGLE_SECTION', payload: section });
    
    // Save updated preferences to localStorage
    // Note: This will be handled by a separate effect that watches for preference changes
    setTimeout(() => {
      savePreferences(state.preferences);
    }, 0);
  }, [savePreferences, state.preferences]);

  const setRecentlySaved = useCallback((section: string) => {
    dispatch({ type: 'SET_RECENTLY_SAVED', payload: section });
    dispatch({ type: 'UPDATE_LAST_SAVED', payload: { section, timestamp: Date.now() } });

    // Clear the "recently saved" indicator after 3 seconds
    setTimeout(() => {
      dispatch({ type: 'CLEAR_RECENTLY_SAVED', payload: section });
    }, 3000);
  }, []);

  const clearRecentlySaved = useCallback((section: string) => {
    dispatch({ type: 'CLEAR_RECENTLY_SAVED', payload: section });
  }, []);

  const updatePreferences = useCallback((newPreferences: Partial<RightSidebarUserPreferences>) => {
    dispatch({ type: 'UPDATE_PREFERENCES', payload: newPreferences });
    
    // Save to localStorage - use timeout to ensure state has updated
    setTimeout(() => {
      const updatedPreferences = { ...state.preferences, ...newPreferences };
      savePreferences(updatedPreferences);
    }, 0);
  }, [savePreferences, state.preferences]);

  const resetPreferences = useCallback(() => {
    dispatch({ type: 'LOAD_PREFERENCES', payload: defaultPreferences });
    savePreferences(defaultPreferences);
  }, [savePreferences]);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  return {
    state,
    actions: {
      updateCoreDirection,
      updateExecutionRules,
      updateTeamCulture,
      toggleSection,
      setRecentlySaved,
      clearRecentlySaved,
      updatePreferences,
      resetPreferences,
      setLoading,
      setError,
    },
  };
}
