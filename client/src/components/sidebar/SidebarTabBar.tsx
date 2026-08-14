import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Activity, BookOpen, CheckSquare } from 'lucide-react';

export type SidebarTab = 'activity' | 'brain' | 'tasks';

interface SidebarTabBarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  unreadActivityCount: number;
  hasPendingApprovals?: boolean;
}

const TABS: Array<{ id: SidebarTab; label: string; icon: typeof Activity }> = [
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'brain', label: 'Brain', icon: BookOpen },
];

export function SidebarTabBar({
  activeTab,
  onTabChange,
  unreadActivityCount,
  hasPendingApprovals = false,
}: SidebarTabBarProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // ARIA tabs keyboard pattern: arrow keys move focus between tabs (and activate,
  // since these tabs use automatic activation), Home/End jump to the ends. Without
  // this, the roving tabindex leaves the non-active tabs keyboard-unreachable.
  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    const count = TABS.length;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % count;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + count) % count;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    else return;
    e.preventDefault();
    onTabChange(TABS[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label="Sidebar tabs" className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-[var(--hatchin-border-subtle)] bg-[var(--hatchin-surface)] p-1 relative">
      {TABS.map((tab, index) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[index] = el; }}
            role="tab"
            id={`sidebar-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`sidebar-tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onClick={() => onTabChange(tab.id)}
            className={`relative z-10 flex items-center justify-center gap-2 rounded-lg px-2 py-2 min-h-[44px] lg:min-h-0 text-micro uppercase tracking-wider font-bold transition-colors duration-200 ${
              isActive
                ? 'text-[var(--hatchin-blue)]'
                : 'hatchin-text-muted hover:hatchin-text'
            }`}
            data-testid={`sidebar-tab-${tab.id}`}
          >
            {isActive && (
              <motion.div
                layoutId="sidebar-tab"
                className="absolute inset-0 rounded-lg bg-[var(--glass-frosted-strong)] elevation-1"
                style={{ borderRadius: 8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            
            <span className="relative">
              {tab.label}
              {tab.id === 'activity' && unreadActivityCount > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[6px] h-1.5 px-0.5 bg-[var(--hatchin-orange)] rounded-full" />
              )}
              {tab.id === 'tasks' && hasPendingApprovals && (
                <span
                  className="absolute -top-1 -right-2 w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"
                  aria-label="Pending approvals"
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
