import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type AutonomyLevel = 'observe' | 'propose' | 'confirm' | 'autonomous';

interface AutonomySettingsPanelProps {
  projectId: string;
  executionRules: Record<string, unknown> | null | undefined;
}

const DIAL_POSITIONS: AutonomyLevel[] = ['observe', 'propose', 'confirm', 'autonomous'];

const DIAL_DESCRIPTIONS: Record<AutonomyLevel, string> = {
  observe: 'Hatches suggest actions but never act without you.',
  propose: 'Hatches draft plans and wait for your sign-off.',
  confirm: 'Hatches work and ask before anything high-risk.',
  autonomous: 'Hatches execute fully — you review completed work.',
};

const INACTIVITY_OPTIONS = [
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' },
  { value: '240', label: '4 hours' },
];

export function AutonomySettingsPanel({ projectId, executionRules }: AutonomySettingsPanelProps) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const panelRef = useRef<HTMLDivElement>(null);

  const [autonomyEnabled, setAutonomyEnabled] = useState(
    (executionRules?.autonomyEnabled as boolean | undefined) ?? false
  );
  const [autonomyLevel, setAutonomyLevel] = useState<AutonomyLevel>(
    (executionRules?.autonomyLevel as AutonomyLevel | undefined) ?? 'confirm'
  );
  const [inactivityTriggerMinutes, setInactivityTriggerMinutes] = useState(
    String((executionRules?.inactivityTriggerMinutes as number | undefined) ?? 120)
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const schedulePatch = (settings: {
    autonomyEnabled: boolean;
    autonomyLevel: AutonomyLevel;
    inactivityTriggerMinutes: number;
    inactivityAutonomyEnabled?: boolean;
  }) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ executionRules: settings }),
        });
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] });

        // Flash save border
        if (panelRef.current) {
          panelRef.current.classList.add('flash-save');
          setTimeout(() => panelRef.current?.classList.remove('flash-save'), 1000);
        }
      } catch {
        // Silent — user will see it on next load
      }
    }, 800);
  };

  const handleToggle = (checked: boolean) => {
    setAutonomyEnabled(checked);
    schedulePatch({
      autonomyEnabled: checked,
      autonomyLevel,
      inactivityTriggerMinutes: Number(inactivityTriggerMinutes),
    });
  };

  const handleDialChange = (level: AutonomyLevel) => {
    setAutonomyLevel(level);
    schedulePatch({
      autonomyEnabled,
      autonomyLevel: level,
      inactivityTriggerMinutes: Number(inactivityTriggerMinutes),
    });
  };

  const handleInactivityChange = (value: string) => {
    setInactivityTriggerMinutes(value);
    schedulePatch({
      autonomyEnabled,
      autonomyLevel,
      inactivityTriggerMinutes: Number(value),
      inactivityAutonomyEnabled: true,
    });
  };

  return (
    <div ref={panelRef} className="rounded-xl border border-[var(--hatchin-border-subtle)] p-4">
      {/* Section header */}
      <h3 className="text-[11px] font-semibold text-[var(--hatchin-text-muted)] uppercase tracking-wider mb-3">
        Autonomy Settings
      </h3>

      {/* Toggle row */}
      <div className="flex items-start gap-3 mb-4">
        <Switch
          checked={autonomyEnabled}
          onCheckedChange={handleToggle}
          aria-label="Autonomous execution toggle"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[var(--hatchin-text)]">
            Autonomous execution
          </p>
          <p className="text-[11px] text-[var(--hatchin-text-muted)]">
            Hatches can work in the background
          </p>
        </div>
      </div>

      {/* Inactivity trigger — only when enabled */}
      <AnimatePresence initial={false}>
        {autonomyEnabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[12px] text-[var(--hatchin-text-muted)]">
                Auto-start after
              </span>
              <Select
                value={inactivityTriggerMinutes}
                onValueChange={handleInactivityChange}
              >
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INACTIVITY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Autonomy Dial */}
      <div
        role="radiogroup"
        aria-label="Autonomy level"
        className={`grid grid-cols-4 gap-0.5 rounded-lg border border-[var(--hatchin-border-subtle)] bg-[var(--hatchin-surface)] p-0.5 mb-2 ${!autonomyEnabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {DIAL_POSITIONS.map(level => {
          const isActive = autonomyLevel === level;
          let activeClass = '';
          if (isActive) {
            activeClass = level === 'autonomous'
              ? 'bg-[var(--hatchin-green)] text-white'
              : 'bg-[var(--hatchin-blue)] text-white';
          }
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => handleDialChange(level)}
              className={`h-8 text-xs font-medium capitalize rounded transition-colors duration-150 ${isActive ? activeClass : 'text-[var(--hatchin-text-muted)] hover:text-[var(--hatchin-text)]'}`}
            >
              {level}
            </button>
          );
        })}
      </div>

      {/* Dial description */}
      <p
        className={`text-[12px] text-[var(--hatchin-text-muted)] italic ${!autonomyEnabled ? 'opacity-50' : ''}`}
      >
        {DIAL_DESCRIPTIONS[autonomyLevel]}
      </p>
    </div>
  );
}
