import { motion } from 'framer-motion';
import { Activity, BookOpen, ShieldCheck } from 'lucide-react';

export type SidebarTab = 'activity' | 'brain' | 'approvals';

interface SidebarTabBarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  unreadActivityCount: number;
  hasPendingApprovals?: boolean;
}

const TABS: Array<{ id: SidebarTab; label: string; icon: typeof Activity }> = [
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'brain', label: 'Brain & Docs', icon: BookOpen },
  { id: 'approvals', label: 'Approvals', icon: ShieldCheck },
];

export function SidebarTabBar({
  activeTab,
  onTabChange,
  unreadActivityCount,
  hasPendingApprovals = false,
}: SidebarTabBarProps) {
  return (
    <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-[var(--hatchin-border-subtle)] bg-[var(--hatchin-surface)] p-1 relative">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative z-10 flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors duration-200 ${
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
              <Icon className="w-3.5 h-3.5" />
              {tab.id === 'activity' && unreadActivityCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[var(--hatchin-orange)] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadActivityCount > 99 ? '99+' : unreadActivityCount}
                </span>
              )}
              {tab.id === 'approvals' && hasPendingApprovals && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full animate-pulse"
                  aria-label="Pending approvals"
                />
              )}
            </span>
            <span className="relative">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
