import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { DocumentUploadZone } from './DocumentUploadZone';
import { DocumentCard } from './DocumentCard';
import { AutonomySettingsPanel } from './AutonomySettingsPanel';
import { DeliverableList } from '@/components/ArtifactPanel';
import { PackageProgress } from '@/components/PackageProgress';
import type { Project } from '@shared/schema';

interface BrainDocsTabProps {
  projectId: string | undefined;
  project: Project | undefined;
}

/** Section divider — reads as a header (P1-D) with an at-a-glance count/state pill (P2-A) */
function SectionDivider({
  label,
  pill,
  pillTone = 'default',
}: {
  label: string;
  pill?: string | number;
  pillTone?: 'default' | 'on' | 'done';
}) {
  const toneClass =
    pillTone === 'on'
      ? 'bg-[var(--hatchin-blue)]/15 text-[var(--hatchin-blue)]'
      : pillTone === 'done'
      ? 'bg-[var(--hatchin-green)]/15 text-[var(--hatchin-green)]'
      : 'bg-[var(--hatchin-surface)] text-[var(--hatchin-text-muted)]';
  return (
    <div className="flex items-center gap-2 mb-3 mt-4">
      <span className="text-xs font-bold text-[var(--hatchin-text)] uppercase tracking-wide shrink-0">
        {label}
      </span>
      {pill !== undefined && pill !== '' && (
        <span className={`text-micro font-semibold px-2 py-0.5 rounded-full shrink-0 ${toneClass}`}>
          {pill}
        </span>
      )}
      <div className="flex-1 h-px bg-gradient-to-r from-[var(--hatchin-border-subtle)] to-transparent" />
    </div>
  );
}

export function BrainDocsTab({ projectId, project }: BrainDocsTabProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const { data: packagesData } = useQuery<{ packages: unknown[] }>({
    queryKey: [`/api/projects/${projectId}/packages`],
    enabled: !!projectId,
  });
  const packages = packagesData?.packages ?? [];

  const { data: deliverablesData } = useQuery<{ deliverables: unknown[] }>({
    queryKey: [`/api/projects/${projectId}/deliverables`],
    enabled: !!projectId,
  });
  const deliverableCount = deliverablesData?.deliverables?.length ?? 0;

  if (!projectId) return null;

  const documents = project?.brain?.documents ?? [];
  const visibleDocs = documents.filter(doc => !removingIds.has(doc.id));

  const handleUploadComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    toast({ description: "Document added to your team's brain" });
  };

  const handleDelete = async (docId: string) => {
    setRemovingIds(prev => new Set(prev).add(docId));
    try {
      const res = await fetch(`/api/projects/${projectId}/brain/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ description: 'Document removed' });
    } catch {
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
      toast({ description: "Couldn't remove document. Try again.", variant: 'destructive' });
    }
  };

  const coreDirection = (project?.coreDirection as Record<string, string> | undefined) || {};
  const hasContext = !!(coreDirection.whatBuilding || coreDirection.whyMatters || coreDirection.whoFor);

  const execRules = (project?.executionRules as Record<string, unknown> | undefined) || {};
  const autonomyEnabled = !!execRules.autonomyEnabled;
  const autonomyLevel = (execRules.autonomyLevel as string) || 'confirm';
  const autonomyPill = autonomyEnabled
    ? autonomyLevel.charAt(0).toUpperCase() + autonomyLevel.slice(1)
    : 'Off';

  return (
    <div className="flex flex-col py-2">
      <div className="mb-2 px-1 shrink-0">
        <p className="text-sm font-semibold text-[var(--hatchin-text-bright)] mb-0.5">The Brain</p>
        <p className="text-xs hatchin-text-muted">Project context, autonomy rules, and shared knowledge.</p>
      </div>

      {/* ——— Project Context ——— */}
      {hasContext && (
        <>
          <SectionDivider label="Core Direction" />
          <div className="px-2 space-y-3 mb-2">
            {coreDirection.whatBuilding && (
              <div>
                <span className="text-xs font-semibold text-[var(--hatchin-blue)] uppercase">What we're building</span>
                <p className="text-xs hatchin-text-muted mt-0.5 leading-relaxed">{coreDirection.whatBuilding}</p>
              </div>
            )}
            {coreDirection.whoFor && (
              <div>
                <span className="text-xs font-semibold text-[var(--hatchin-orange)] uppercase">Who it's for</span>
                <p className="text-xs hatchin-text-muted mt-0.5 leading-relaxed">{coreDirection.whoFor}</p>
              </div>
            )}
            {coreDirection.whyMatters && (
              <div>
                <span className="text-xs font-semibold text-[#4ade80] uppercase">Why it matters</span>
                <p className="text-xs hatchin-text-muted mt-0.5 leading-relaxed">{coreDirection.whyMatters}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ——— Knowledge Base ——— (lead with what the user opens the tab for) */}
      <SectionDivider label="Knowledge Base" pill={visibleDocs.length} />
      <div className="px-2 mb-2">
        <p className="text-xs hatchin-text-muted leading-relaxed">Docs and context your Hatches read from when they work.</p>
      </div>
      <div className="px-1 flex flex-col gap-3">
        <DocumentUploadZone
          projectId={projectId}
          onUploadComplete={handleUploadComplete}
        />
        {visibleDocs.length > 0 && (
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {visibleDocs.map(doc => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  onDelete={handleDelete}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ——— Autonomy ——— */}
      <SectionDivider label="Autonomy" pill={autonomyPill} pillTone={autonomyEnabled ? 'on' : 'default'} />
      <div className="px-1">
        <AutonomySettingsPanel
          projectId={projectId}
          executionRules={project?.executionRules as Record<string, unknown> | null | undefined}
        />
      </div>

      {/* ——— Deliverables ——— */}
      <SectionDivider label="Deliverables" pill={deliverableCount} />
      <div className="px-2 mb-2">
        <p className="text-xs hatchin-text-muted leading-relaxed">Final output documents generated by Hatches for review.</p>
      </div>
      <div className="px-1">
        <DeliverableList
          projectId={projectId}
          onSelect={(id) => {
            window.dispatchEvent(new CustomEvent('open_deliverable', { detail: { deliverableId: id } }));
          }}
        />
      </div>

      {/* ——— Packages ——— */}
      <SectionDivider label="Packages" pill={packages.length} />
      <div className="px-2 mb-2">
        <p className="text-xs hatchin-text-muted leading-relaxed">Multi-step work running across the team shows up here.</p>
      </div>
      <div className="px-1">
        {packages.length > 0 ? (
          <PackageProgress projectId={projectId} />
        ) : (
          <div className="text-center py-4 px-2">
            <p className="text-xs font-medium hatchin-text mb-0.5">No active packages</p>
            <p className="text-micro hatchin-text-muted leading-relaxed">Launch a package and its progress across the team lands here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
