import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, SkipForward, Users, Zap, Brain, MessageSquare } from "lucide-react";

interface OnboardingStepsProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const steps = [
  {
    id: 1,
    icon: <Users className="w-8 h-8 text-white" strokeWidth={1.5} />,
    title: "AI teammates that get you",
    description: "Build custom AI teams that learn your style and help you achieve your goals, just like real teammates."
  },
  {
    id: 2,
    icon: <Zap className="w-8 h-8 text-white" strokeWidth={1.5} />,
    title: "Each teammate has a specialty",
    description: "Your AI teammates have specific skills like writing, design, or strategy. They bring their expertise to every project."
  },
  {
    id: 3,
    icon: <Brain className="w-8 h-8 text-white" strokeWidth={1.5} />,
    title: "Your projects remember everything",
    description: "Every conversation builds on the last. Your team remembers context, decisions, and goals so you never start from scratch."
  },
  {
    id: 4,
    icon: <MessageSquare className="w-8 h-8 text-white" strokeWidth={1.5} />,
    title: "Chat and make progress together",
    description: "Ask questions, share ideas, and plan next steps. Your AI team is always ready to help you move forward."
  }
];

export function OnboardingSteps({ isOpen, onClose, onComplete }: OnboardingStepsProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipIntro = () => {
    onComplete();
  };

  const currentStepData = steps[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#23262B] border-[#43444B] p-0">
        <DialogTitle className="sr-only">Hatchin onboarding steps</DialogTitle>
        <DialogDescription className="sr-only">
          Walkthrough of how Hatchin teams and project memory work.
        </DialogDescription>
        <div className="relative">
          {/* Skip button - top left */}
          <div className="flex justify-start p-6 pb-4">
            <button
              onClick={skipIntro}
              className="flex items-center gap-2 px-3 py-1.5 text-[#A6A7AB] hover:text-[#F1F1F3] transition-colors text-sm outline-none focus:outline-none focus:ring-0 active:outline-none"
            >
              <SkipForward className="w-4 h-4" />
              Skip intro
            </button>
          </div>

          {/* Main content */}
          <div className="px-6 pb-6">
            <div className="text-center space-y-6">
              {/* Premium Icon Orb */}
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 bg-[#6C82FF] rounded-full animate-ping opacity-20" />
                <div className="relative w-full h-full bg-gradient-to-br from-[#6C82FF] to-[#9F7BFF] rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(108,130,255,0.4)]">
                  {currentStepData.icon}
                </div>
              </div>

              {/* Title and description */}
              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-[#F1F1F3]">
                  {currentStepData.title}
                </h2>
                <p className="text-[#A6A7AB] text-sm leading-relaxed max-w-md mx-auto">
                  {currentStepData.description}
                </p>
              </div>

              {/* Progress dots - below text */}
              <div className="flex justify-center space-x-2 pt-2">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${index <= currentStep ? 'bg-[#6C82FF]' : 'bg-[#43444B]'
                      }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between px-6 pb-6">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-4 py-2 text-[#A6A7AB] hover:text-[#F1F1F3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="text-[#A6A7AB] text-sm">
              {currentStep + 1} of {steps.length}
            </div>

            <button
              onClick={nextStep}
              className="flex items-center gap-2 px-4 py-2 bg-[#6C82FF] hover:bg-[#5A6FE8] text-white rounded-lg transition-colors"
            >
              {currentStep === steps.length - 1 ? 'Continue' : 'Next'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
