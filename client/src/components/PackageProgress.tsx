import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Package, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import type { DeliverablePackage, Deliverable } from '@shared/schema';

const TEMPLATE_LABELS: Record<string, { label: string; emoji: string }> = {
  'launch': { label: 'Launch Package', emoji: '🚀' },
  'content-sprint': { label: 'Content Sprint', emoji: '✍️' },
  'research': { label: 'Research Package', emoji: '🔬' },
  'custom': { label: 'Custom Package', emoji: '📦' },
};

const STATUS_CONFIG = {
  'not_started': { color: 'var(--hatchin-text-muted)', icon: Clock, label: 'Not Started' },
  'in_progress': { color: 'var(--hatchin-blue)', icon: Clock, label: 'In Progress' },
  'complete': { color: 'var(--hatchin-green)', icon: CheckCircle2, label: 'Complete' },
} as const;

interface PackageCardProps {
  pkg: DeliverablePackage;
  deliverables: Deliverable[];
  onSelectDeliverable: (id: string) => void;
}

function PackageCard({ pkg, deliverables, onSelectDeliverable }: PackageCardProps) {
  const templateInfo = TEMPLATE_LABELS[pkg.template] || TEMPLATE_LABELS.custom;
  const statusConfig = STATUS_CONFIG[pkg.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.not_started;
  const StatusIcon = statusConfig.icon;

  const packageDeliverables = deliverables.filter(d => d.packageId === pkg.id);
  const completedCount = packageDeliverables.filter(d => d.status === 'complete').length;
  const totalExpected = (pkg.metadata as any)?.expectedDeliverables || packageDeliverables.length || 1;
  const progress = Math.round((completedCount / totalExpected) * 100);

  // Find which agent is currently working
  const inProgressDeliverable = packageDeliverables.find(d => d.status === 'draft');

  return (
    <motion.div
      className="premium-card p-4 space-y-3"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{templateInfo.emoji}</span>
          <div>
            <h4 className="text-sm font-semibold hatchin-text">{pkg.name}</h4>
            <span className="text-xs hatchin-text-muted">{templateInfo.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5" style={{ color: statusConfig.color }}>
          <StatusIcon className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{statusConfig.label}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="hatchin-text-muted">{completedCount}/{totalExpected} deliverables</span>
          <span className="font-medium" style={{ color: statusConfig.color }}>{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--hatchin-surface)] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: statusConfig.color }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Working status */}
      {inProgressDeliverable && pkg.status === 'in_progress' && (
        <div className="text-micro hatchin-text-muted flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--hatchin-blue)] animate-pulse" />
          {inProgressDeliverable.agentName} is working on {inProgressDeliverable.title}
        </div>
      )}

      {/* Deliverable list */}
      {packageDeliverables.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-[var(--hatchin-border-subtle)]">
          {packageDeliverables.map((d) => (
            <button
              key={d.id}
              onClick={() => onSelectDeliverable(d.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-[var(--hatchin-surface)]/50 transition-colors"
            >
              {d.status === 'complete' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--hatchin-green)] shrink-0" />
              ) : d.status === 'in_review' ? (
                <AlertCircle className="w-3.5 h-3.5 text-[var(--hatchin-orange)] shrink-0" />
              ) : (
                <Clock className="w-3.5 h-3.5 hatchin-text-muted shrink-0" />
              )}
              <span className="text-micro truncate hatchin-text">{d.title}</span>
              <span className="text-xs hatchin-text-muted ml-auto shrink-0">{d.agentName}</span>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

interface PackageProgressProps {
  projectId: string;
}

export function PackageProgress({ projectId }: PackageProgressProps) {
  const { data: packagesData } = useQuery<{ packages: DeliverablePackage[] }>({
    queryKey: [`/api/projects/${projectId}/packages`],
    enabled: !!projectId,
  });

  const { data: deliverablesData } = useQuery<{ deliverables: Deliverable[] }>({
    queryKey: [`/api/projects/${projectId}/deliverables`],
    enabled: !!projectId,
  });

  const packages = packagesData?.packages || [];
  const deliverables = deliverablesData?.deliverables || [];

  const handleSelectDeliverable = (id: string) => {
    window.dispatchEvent(new CustomEvent('open_deliverable', { detail: { deliverableId: id } }));
  };

  if (packages.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Package className="w-3.5 h-3.5 hatchin-text-muted" />
        <span className="text-xs font-semibold hatchin-text">Active Packages</span>
      </div>
      {packages.map((pkg) => (
        <PackageCard
          key={pkg.id}
          pkg={pkg}
          deliverables={deliverables}
          onSelectDeliverable={handleSelectDeliverable}
        />
      ))}
    </div>
  );
}
