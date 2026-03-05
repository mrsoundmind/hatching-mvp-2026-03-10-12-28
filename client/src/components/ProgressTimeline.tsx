import { Check } from "lucide-react";

interface ProgressTimelineProps {
  progress: number;
}

export function ProgressTimeline({ progress }: ProgressTimelineProps) {
  const phases = [
    { name: 'Explore', threshold: 33 },
    { name: 'Build', threshold: 66 },
    { name: 'Launch', threshold: 100 },
  ];

  const getPhaseStatus = (threshold: number) => {
    if (progress >= threshold) return 'completed';
    if (progress >= threshold - 33) return 'active';
    return 'pending';
  };

  const getPhaseColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'hatchin-bg-green';
      case 'active':
        return 'hatchin-bg-blue';
      default:
        return 'bg-hatchin-border';
    }
  };

  const getTextColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'active':
        return 'hatchin-text';
      default:
        return 'hatchin-text-muted';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs hatchin-text-muted mb-2">
        <span>Start</span>
        <span>Completion</span>
      </div>
      
      <div className="space-y-2">
        {phases.map((phase, index) => {
          const status = getPhaseStatus(phase.threshold);
          
          return (
            <div key={phase.name} className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${getPhaseColor(status)}`}>
                {status === 'completed' && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </div>
              <span className={`text-sm ${getTextColor(status)}`}>
                {phase.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
