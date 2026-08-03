import { PathSelectionModal } from "./PathSelectionModal";

interface QuickStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartWithIdea: () => void;
  onUseStarterPack: () => void;
}

/**
 * Thin adapter (O-3): the "how do you want to start?" UI now lives in a single place
 * (PathSelectionModal), so the onboarding flow and the new-project flow can never drift
 * apart. New projects don't offer a scratch/"figure it out" start, so onFigureItOut is
 * intentionally omitted (PathSelectionModal hides that option when it's absent).
 *
 * Kept as a default export with the same props the callers (home.tsx, LeftSidebar.tsx)
 * already pass, so those call sites need no changes.
 */
export default function QuickStartModal({
  isOpen,
  onClose,
  onStartWithIdea,
  onUseStarterPack,
}: QuickStartModalProps) {
  return (
    <PathSelectionModal
      isOpen={isOpen}
      onClose={onClose}
      onStartWithIdea={onStartWithIdea}
      onUseStarterPack={onUseStarterPack}
    />
  );
}
