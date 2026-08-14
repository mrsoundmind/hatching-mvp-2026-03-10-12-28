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

const DIAL_CONFIG: Record<AutonomyLevel, { description: string; gradient: string; textColor: string }> = {
  observe: {
    description: 'Hatches suggest actions but never act without you.',
    gradient: 'linear-gradient(135deg, #4b5563, #6b7280)',
    textColor: '#d1d5db',
  },
  propose: {
    description: 'Hatches draft plans and wait for your sign-off.',
    gradient: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
    textColor: '#93c5fd',
  },
  confirm: {
    description: 'Hatches work and ask before anything high-risk.',
    gradient: 'linear-gradient(135deg, #4338ca, #6366f1)',
    textColor: '#a5b4fc',
  },
  autonomous: {
    description: 'Hatches execute fully — you review completed work.',
    gradient: 'linear-gradient(135deg, #065f46, #10b981)',
    textColor: '#6ee7b7',
  },
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

  useEffect(() => {
    setAutonomyEnabled((executionRules?.autonomyEnabled as boolean | undefined) ?? false);
    setAutonomyLevel((executionRules?.autonomyLevel as AutonomyLevel | undefined) ?? 'confirm');
    setInactivityTriggerMinutes(String((executionRules?.inactivityTriggerMinutes as number | undefined) ?? 120));
  }, [executionRules]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
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
        if (panelRef.current) {
          panelRef.current.classList.add('flash-save');
          setTimeout(() => panelRef.current?.classList.remove('flash-save'), 1000);
        }
      } catch { /* silent */ }
    }, 800);
  };

  const handleToggle = (checked: boolean) => {
    setAutonomyEnabled(checked);
    schedulePatch({ autonomyEnabled: checked, autonomyLevel, inactivityTriggerMinutes: Number(inactivityTriggerMinutes) });
  };

  const handleDialChange = (level: AutonomyLevel) => {
    setAutonomyLevel(level);
    schedulePatch({ autonomyEnabled, autonomyLevel: level, inactivityTriggerMinutes: Number(inactivityTriggerMinutes) });
  };

  const handleInactivityChange = (value: string) => {
    setInactivityTriggerMinutes(value);
    schedulePatch({ autonomyEnabled, autonomyLevel, inactivityTriggerMinutes: Number(value), inactivityAutonomyEnabled: true });
  };

  const config = DIAL_CONFIG[autonomyLevel];
  const levelIndex = DIAL_POSITIONS.indexOf(autonomyLevel);

  return (
    <div ref={panelRef} data-tour="autonomy" className="premium-card p-4 space-y-4">
      {/* Contextual Description — the outer "Autonomy" SectionDivider in BrainDocsTab
          is the header now; the old inner "Autonomy Settings" title was a redundant
          second header for one control (P1-B). */}
      <p className="text-micro text-[var(--hatchin-text-muted)] leading-relaxed bg-[var(--hatchin-blue)]/5 p-2.5 rounded-lg border border-[var(--hatchin-blue)]/10">
        Controls how much Hatches can do without your approval—from observation to fully independent execution.
      </p>

      {/* Toggle row */}
      <div className="flex items-start gap-3">
        <div className="min-h-[44px] flex items-center">
          <Switch
            checked={autonomyEnabled}
            onCheckedChange={handleToggle}
            aria-label="Autonomous execution toggle"
            className="data-[state=checked]:bg-[var(--hatchin-green)]"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[var(--hatchin-text)]">
            Autonomous execution
          </p>
          <p className="text-micro text-[var(--hatchin-text-muted)] mt-0.5">
            {autonomyEnabled ? 'Hatches are working independently' : 'Hatches wait for your input'}
          </p>
        </div>
      </div>

      {/* Auto-start timer (only when enabled) */}
      <AnimatePresence initial={false}>
        {autonomyEnabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--hatchin-text-muted)]">Auto-start after</span>
              <Select value={inactivityTriggerMinutes} onValueChange={handleInactivityChange}>
                <SelectTrigger className="h-8 w-[120px] text-xs bg-transparent border-[var(--hatchin-border-subtle)]">
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

      {/* Power level indicator dots */}
      <div className={`space-y-3 transition-all duration-300 ${!autonomyEnabled ? 'opacity-80 grayscale-[70%] pointer-events-none' : ''}`}>
        {/* 4 dot power meter */}
        <div className="flex items-center gap-1.5 h-1">
          {DIAL_POSITIONS.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-full rounded-full transition-all duration-500"
              style={{
                background: i <= levelIndex ? config.gradient : 'var(--hatchin-surface)',
                boxShadow: i <= levelIndex ? `0 0 8px ${config.textColor}40` : 'none',
              }}
            />
          ))}
        </div>

        {/* Level selector — 2x2 grid to prevent text truncation */}
        <div
          role="radiogroup"
          aria-label="Autonomy level"
          className="grid grid-cols-2 gap-1.5"
        >
          {DIAL_POSITIONS.map(level => {
            const isActive = autonomyLevel === level;
            const lvlConfig = DIAL_CONFIG[level];
            return (
              <motion.button
                key={level}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => handleDialChange(level)}
                whileTap={{ scale: 0.97 }}
                className={`flex items-center justify-center min-h-[44px] text-micro font-medium capitalize rounded-xl transition-all duration-200 border ${
                  isActive 
                    ? 'bg-[var(--glass-frosted-strong)] border-[var(--hatchin-border)] shadow-sm' 
                    : 'bg-[var(--hatchin-surface)] border-transparent text-[var(--hatchin-text-muted)]'
                }`}
                style={isActive ? {
                  color: lvlConfig.textColor,
                  boxShadow: `inset 0 0 12px ${lvlConfig.textColor}15`,
                } : {}}
              >
                {level}
              </motion.button>
            );
          })}
        </div>

        {/* Active level description */}
        <p className="text-micro leading-relaxed transition-colors duration-300" style={{ color: config.textColor }}>
          {config.description}
        </p>
      </div>
    </div>
  );
}
