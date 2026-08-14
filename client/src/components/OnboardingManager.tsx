import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { WelcomeModal } from "./WelcomeModal";
import { PathSelectionModal } from "./PathSelectionModal";
import StarterPacksModal from "./StarterPacksModal";
import { TOUR_DONE_KEY } from "./onboarding/TourOverlay";

interface OnboardingManagerProps {
  onComplete: (path: 'idea' | 'template' | 'scratch', templateData?: any) => void;
  onStartWithIdeaPromptName?: () => void; // Called instead of onComplete('idea') to open ProjectNameModal
  // Server truth from home.tsx: has the projects query settled, and does the
  // user already own at least one real (non-demo) project? Onboarding is for
  // brand-new accounts only — a returning user must never see the teach flow.
  projectsSettled?: boolean;
  hasExistingProjects?: boolean;
  // Start creating the demo project the moment the Welcome screen appears, so it
  // is ready by the time the user clicks through — no "creating…" gap.
  onPreseedDemo?: () => void;
  // Reveal the guided tour on the (already-seeded) demo project.
  onStartTour?: () => void;
  // Tear down a pre-seeded demo if the user dismisses onboarding without touring.
  onAbortOnboarding?: () => void;
}

// Flow: pending -> welcome -> teach -> pick a path (idea / starter pack).
//
// 'pending' is the pre-decision state: we render nothing until we KNOW whether
// this is a new user. The decision uses server truth (does the account already
// have projects?), not just the local onboarding flag — the flag doesn't survive
// a browser switch or cache clear, and gating on it alone re-onboarded existing
// users (hijacking their real project with the throwaway demo).
//
// The 'teach' step is a guided coachmark tour that runs on a REAL, temporary
// demo project so a brand-new user learns what the team is *before* they have to
// choose. To avoid a "creating…" gap, home.tsx starts seeding the demo the
// instant the Welcome screen shows (onPreseedDemo), while the user reads it.
// Clicking through only reveals the tour on the already-ready demo (onStartTour).
// When the tour ends home.tsx fires 'hatchin:onboarding-teach-done', which
// advances us to the path choice. We do NOT complete onboarding until the user
// actually starts their own project; dismissing early tears the demo down
// (onAbortOnboarding).
type OnboardingStep = 'pending' | 'welcome' | 'teach' | 'path-selection' | 'starter-packs' | 'completed';

export function OnboardingManager({
  onComplete,
  onStartWithIdeaPromptName,
  projectsSettled = false,
  hasExistingProjects = false,
  onPreseedDemo,
  onStartTour,
  onAbortOnboarding,
}: OnboardingManagerProps) {
  const { completeOnboarding } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('pending');

  // Decide whether to teach, exactly once, and only after we have the facts.
  // The gate is server truth: does the account own at least one real (non-demo)
  // project? Anyone with zero — a brand-new signup OR a returning user who has
  // never actually built anything — goes through onboarding so they learn what
  // the team is. Anyone with a real project is established and skips it. The
  // local onboarding flag is deliberately NOT part of this gate (it doesn't
  // survive a browser switch / cache clear, and gating on it re-onboarded
  // existing users while permanently suppressing it for empty-handed ones).
  // Runs only while still 'pending' so that seeding the demo project mid-tour
  // (which briefly adds a project) can never abort an in-progress flow.
  useEffect(() => {
    if (currentStep !== 'pending') return;
    // Wait until the projects query has actually returned. If it never succeeds
    // (API down), we stay 'pending' and show nothing — never churn a demo
    // project when we can't even read the user's real ones.
    if (!projectsSettled) return;
    if (hasExistingProjects) {
      setCurrentStep('completed');
    } else {
      // Empty-handed user (new signup OR a returning user who never built
      // anything). Reset the once-only tour flag so the FULL guided tour runs
      // again, not just the Welcome + path picker — they should actually re-learn
      // what the team is. TourOverlay re-sets the flag when the tour finishes, so
      // there's no double-tour within a session, and once they create a real
      // project the gate above closes and this never runs again.
      try { localStorage.removeItem(TOUR_DONE_KEY); } catch { /* ignore */ }
      // Kick off demo-project creation now, while the Welcome screen is being
      // read, so the tour can appear instantly when they click through.
      onPreseedDemo?.();
      setCurrentStep('welcome');
    }
  }, [currentStep, projectsSettled, hasExistingProjects, onPreseedDemo]);

  // When the guided demo tour finishes (or is skipped), move on to letting the
  // user start their own project.
  useEffect(() => {
    const onTeachDone = () => setCurrentStep((s) => (s === 'teach' ? 'path-selection' : s));
    window.addEventListener('hatchin:onboarding-teach-done', onTeachDone);
    return () => window.removeEventListener('hatchin:onboarding-teach-done', onTeachDone);
  }, []);

  const handleGetStarted = () => {
    // Enter the teach step and reveal the tour on the demo project that has been
    // seeding since the Welcome screen appeared. Onboarding is NOT completed yet
    // — the path choice comes after the tour.
    setCurrentStep('teach');
    onStartTour?.();
  };

  const handleStartWithIdea = () => {
    completeOnboarding();
    setCurrentStep('completed');
    if (onStartWithIdeaPromptName) {
      // Open ProjectNameModal in home.tsx so user can name their project
      onStartWithIdeaPromptName();
    } else {
      onComplete('idea');
    }
  };

  const handleUseStarterPack = () => {
    setCurrentStep('starter-packs');
  };

  const handleFigureItOut = () => {
    completeOnboarding();
    onComplete('scratch');
    setCurrentStep('completed');
  };

  const handleStarterPackSelect = (pack: any) => {
    completeOnboarding();
    onComplete('template', pack);
    setCurrentStep('completed');
  };

  const handleClose = () => {
    // If a demo was pre-seeded but the user bails without touring, clean it up so
    // no throwaway project is left behind. No-op once the tour already cleaned it.
    onAbortOnboarding?.();
    completeOnboarding();
    setCurrentStep('completed');
  };

  // Render nothing until the new-vs-returning decision is made, or once done.
  if (currentStep === 'pending' || currentStep === 'completed') {
    return null;
  }

  return (
    <>
      <WelcomeModal
        isOpen={currentStep === 'welcome'}
        onClose={handleClose}
        onGetStarted={handleGetStarted}
      />

      {/* The 'teach' step renders no modal of its own — the guided tour on the
          seeded demo project (mounted by home.tsx) is the UI for this step. */}

      <PathSelectionModal
        isOpen={currentStep === 'path-selection'}
        onClose={handleClose}
        onStartWithIdea={handleStartWithIdea}
        onUseStarterPack={handleUseStarterPack}
        onFigureItOut={handleFigureItOut}
      />

      <StarterPacksModal
        isOpen={currentStep === 'starter-packs'}
        onClose={handleClose}
        onSelectTemplate={handleStarterPackSelect}
      />
    </>
  );
}
