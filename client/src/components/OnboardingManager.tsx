import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { WelcomeModal } from "./WelcomeModal";
import { PathSelectionModal } from "./PathSelectionModal";
import StarterPacksModal from "./StarterPacksModal";

interface OnboardingManagerProps {
  onComplete: (path: 'idea' | 'template' | 'scratch', templateData?: any) => void;
  onStartWithIdeaPromptName?: () => void; // Called instead of onComplete('idea') to open ProjectNameModal
}

// Flow: welcome -> teach -> pick a path (idea / starter pack).
//
// The 'teach' step is a guided coachmark tour that runs on a REAL, temporary
// demo project so a brand-new user learns what the team is *before* they have to
// choose. It is driven by home.tsx: entering 'teach' fires
// 'hatchin:onboarding-seed-demo' (home.tsx seeds the demo project + runs the
// tour); when the tour ends home.tsx fires 'hatchin:onboarding-teach-done',
// which advances us to the path choice. We do NOT complete onboarding until the
// user actually starts their own project.
type OnboardingStep = 'welcome' | 'teach' | 'path-selection' | 'starter-packs' | 'completed';

export function OnboardingManager({ onComplete, onStartWithIdeaPromptName }: OnboardingManagerProps) {
  const { hasCompletedOnboarding, completeOnboarding } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(
    () => (hasCompletedOnboarding() ? 'completed' : 'welcome')
  );

  // Correct the step if onboarding-completion resolves after first render.
  useEffect(() => {
    if (hasCompletedOnboarding()) {
      setCurrentStep('completed');
    }
  }, [hasCompletedOnboarding]);

  // When the guided demo tour finishes (or is skipped), move on to letting the
  // user start their own project.
  useEffect(() => {
    const onTeachDone = () => setCurrentStep((s) => (s === 'teach' ? 'path-selection' : s));
    window.addEventListener('hatchin:onboarding-teach-done', onTeachDone);
    return () => window.removeEventListener('hatchin:onboarding-teach-done', onTeachDone);
  }, []);

  const handleGetStarted = () => {
    // Enter the teach step and ask home.tsx to seed a real demo project + run the
    // tour on it. Onboarding is NOT completed yet — the path choice comes after.
    setCurrentStep('teach');
    window.dispatchEvent(new CustomEvent('hatchin:onboarding-seed-demo'));
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
    completeOnboarding();
    setCurrentStep('completed');
  };

  // Don't render anything if onboarding is completed
  if (currentStep === 'completed') {
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
