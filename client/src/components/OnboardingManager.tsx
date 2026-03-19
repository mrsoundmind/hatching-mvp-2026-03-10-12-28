import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { WelcomeModal } from "./WelcomeModal";
import { OnboardingSteps } from "./OnboardingSteps";
import { PathSelectionModal } from "./PathSelectionModal";
import StarterPacksModal from "./StarterPacksModal";

interface OnboardingManagerProps {
  onComplete: (path: 'idea' | 'template' | 'scratch', templateData?: any) => void;
  onStartWithIdeaPromptName?: () => void; // Called instead of onComplete('idea') to open ProjectNameModal
}

type OnboardingStep = 'welcome' | 'steps' | 'path-selection' | 'starter-packs' | 'completed';

export function OnboardingManager({ onComplete, onStartWithIdeaPromptName }: OnboardingManagerProps) {
  const { hasCompletedOnboarding, completeOnboarding } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');

  // Check if user has completed onboarding or is already signed in on initial load
  useEffect(() => {
    if (hasCompletedOnboarding()) {
      setCurrentStep('completed');
    }
  }, [hasCompletedOnboarding]);

  const handleGetStarted = () => {
    setCurrentStep('steps');
  };

  const handleStepsComplete = () => {
    setCurrentStep('path-selection');
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

      <OnboardingSteps
        isOpen={currentStep === 'steps'}
        onClose={handleClose}
        onComplete={handleStepsComplete}
      />

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
