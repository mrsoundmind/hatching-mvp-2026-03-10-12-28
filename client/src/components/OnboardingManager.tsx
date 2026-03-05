import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { WelcomeModal } from "./WelcomeModal";
import { OnboardingSteps } from "./OnboardingSteps";
import { PathSelectionModal } from "./PathSelectionModal";
import StarterPacksModal from "./StarterPacksModal";
import { NameInputModal } from "./NameInputModal";

interface OnboardingManagerProps {
  onComplete: (path: 'idea' | 'template' | 'scratch', templateData?: any) => void;
}

type OnboardingStep = 'welcome' | 'name-input' | 'steps' | 'path-selection' | 'starter-packs' | 'completed';

export function OnboardingManager({ onComplete }: OnboardingManagerProps) {
  const { isSignedIn, hasCompletedOnboarding, completeOnboarding, signIn } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Check if user has completed onboarding or is already signed in on initial load
  useEffect(() => {
    if (isSignedIn || hasCompletedOnboarding()) {
      setCurrentStep('completed');
    }
  }, []);

  const handleGetStarted = () => {
    setCurrentStep('name-input');
  };

  const handleNameSubmit = async (name: string) => {
    setIsLoggingIn(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      });

      if (response.ok) {
        const userData = await response.json();
        signIn(userData);
        setCurrentStep('steps');
      } else {
        console.error('Login failed');
      }
    } catch (error) {
      console.error('Error logging in:', error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleStepsComplete = () => {
    setCurrentStep('path-selection');
  };

  const handleStartWithIdea = () => {
    completeOnboarding();
    onComplete('idea');
    setCurrentStep('completed');
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

      <NameInputModal
        isOpen={currentStep === 'name-input'}
        onClose={handleClose}
        onSubmit={handleNameSubmit}
        isLoading={isLoggingIn}
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