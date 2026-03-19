import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OnboardingStepsProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

/* ── inline animation components ─────────────────────────────── */

/** Step 1 – mock chat with typing effect + Maya reply */
function ChatPreview() {
  const phrase = "Build a fitness app for runners...";
  const [displayed, setDisplayed] = useState("");
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setShowBubble(false);
    let i = 0;
    const t = setInterval(() => {
      setDisplayed(phrase.slice(0, ++i));
      if (i >= phrase.length) {
        clearInterval(t);
        setTimeout(() => setShowBubble(true), 400);
      }
    }, 44);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="w-full rounded-xl bg-black/40 border border-white/8 p-3">
      {/* mock input */}
      <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 mb-2">
        <span className="text-xs text-gray-300 min-h-[16px]">{displayed}</span>
        <span className="w-px h-4 bg-indigo-400 animate-pulse rounded-sm flex-shrink-0" />
      </div>
      <AnimatePresence>
        {showBubble && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex-shrink-0 mt-0.5" />
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2 py-1.5 text-xs text-indigo-200 leading-snug">
              Got it! Let me hatch your team…
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Step 2 – specialty roles pop in from egg */
function AgentHatch() {
  const agents = [
    { role: "Product Manager",   characterName: "Alex",  avatarBg: "bg-blue-600",   delay: 0.35, emoji: "📋" },
    { role: "Backend Developer", characterName: "Dev",   avatarBg: "bg-orange-600", delay: 0.75, emoji: "⚙️" },
    { role: "Product Designer",  characterName: "Cleo",  avatarBg: "bg-purple-600", delay: 1.15, emoji: "🎨" },
  ];
  return (
    <div className="flex items-end justify-center gap-10 py-2 w-full">
      <motion.span
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 0, scale: 0 }}
        transition={{ delay: 1.7, duration: 0.3 }}
        className="text-3xl absolute"
      >
        🥚
      </motion.span>
      {agents.map((a) => (
        <motion.div
          key={a.role}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: a.delay, type: "spring", bounce: 0.55 }}
          className="flex flex-col items-center gap-1.5"
        >
          <div className={`w-11 h-11 rounded-full ${a.avatarBg} flex items-center justify-center text-white text-lg shadow-lg`}>
            {a.emoji}
          </div>
          <span className="text-xs text-indigo-400/80 font-medium">{a.characterName}</span>
          <span className="text-xs text-gray-400 text-center leading-tight whitespace-nowrap">{a.role}</span>
        </motion.div>
      ))}
    </div>
  );
}

/** Step 3 – project brain auto-fills */
function BrainFill() {
  const items = ["Target: Runners aged 18–35", "Stack: React Native + Node", "Launch: 6 weeks"];
  return (
    <div className="w-full rounded-xl bg-black/40 border border-white/8 p-3">
      <div className="text-xs text-hatchin-blue uppercase tracking-widest font-semibold mb-2">
        Project Brain
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <motion.div
            key={item}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.65 + 0.2 }}
            className="flex items-center gap-2 text-xs text-gray-300"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#47DB9A] flex-shrink-0" />
            {item}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/** Step 4 – chat progress exchange */
function ChatProgress() {
  const exchanges = [
    { from: "user", text: "What's next for the app?", delay: 0 },
    { from: "maya", text: "Based on our last session, let's tackle onboarding UX today.", delay: 0.6 },
    { from: "user", text: "Perfect. Draft a wireframe brief.", delay: 1.3 },
  ];
  return (
    <div className="w-full rounded-xl bg-black/40 border border-white/8 p-3 space-y-2">
      {exchanges.map((ex, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ex.delay }}
          className={`flex ${ex.from === "user" ? "justify-end" : "justify-start"}`}
        >
          {ex.from === "maya" && (
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex-shrink-0 mt-0.5 mr-1.5" />
          )}
          <div
            className={`max-w-[80%] rounded-lg px-2 py-1.5 text-xs leading-snug ${ex.from === "user"
              ? "bg-white/8 text-gray-200"
              : "bg-indigo-500/10 border border-indigo-500/20 text-indigo-200"
              }`}
          >
            {ex.text}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ── step definitions ─────────────────────────────────────────── */
const steps = [
  {
    id: 1,
    title: "Describe your idea",
    description: "Tell Maya what you want to build. One sentence is enough to get started.",
    preview: <ChatPreview />,
  },
  {
    id: 2,
    title: "Watch your team hatch",
    description: "Maya assembles a specialized AI team for your project — designer, developer, PM — in seconds.",
    preview: <AgentHatch />,
  },
  {
    id: 3,
    title: "Your AI remembers everything",
    description: "Every conversation builds context. Your team picks up exactly where you left off.",
    preview: <BrainFill />,
  },
  {
    id: 4,
    title: "Chat and make progress",
    description: "Ask questions, plan next steps, or delegate tasks. Your team is always ready.",
    preview: <ChatProgress />,
  },
];

/* ── main component ───────────────────────────────────────────── */
export function OnboardingSteps({ isOpen, onClose, onComplete }: OnboardingStepsProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // reset to slide 0 each time modal opens
  useEffect(() => {
    if (isOpen) setCurrentStep(0);
  }, [isOpen]);

  const nextStep = () => {
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
    else onComplete();
  };
  const prevStep = () => { if (currentStep > 0) setCurrentStep(currentStep - 1); };

  const stepData = steps[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl bg-[#1A1D23] border-[#31343A] p-0 overflow-hidden">
        <DialogTitle className="sr-only">Hatchin onboarding steps</DialogTitle>
        <DialogDescription className="sr-only">
          Walkthrough of how Hatchin teams and project memory work.
        </DialogDescription>

        <div className="relative">
          {/* Skip */}
          <div className="flex justify-between items-center p-5 pb-3">
            <div className="text-xs text-[#505153] font-medium uppercase tracking-widest">
              {currentStep + 1} / {steps.length}
            </div>
            <button
              onClick={onComplete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[#A6A7AB] hover:text-[#F1F1F3] transition-colors text-sm"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Skip
            </button>
          </div>

          {/* Animated slide */}
          <div className="px-6 pb-4 min-h-[280px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={stepData.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-4"
              >
                {/* Live mini preview */}
                <div className="relative h-[120px] flex items-center justify-center">
                  {stepData.preview}
                </div>

                {/* Title + description */}
                <div className="text-center space-y-2">
                  <h2 className="text-lg font-semibold text-[#F1F1F3]">{stepData.title}</h2>
                  <p className="text-[#A6A7AB] text-sm leading-relaxed max-w-sm mx-auto">
                    {stepData.description}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 pb-4">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`rounded-full transition-all duration-300 ${i === currentStep
                  ? "w-5 h-1.5 bg-hatchin-blue"
                  : "w-1.5 h-1.5 bg-[#43444B] hover:bg-hatchin-blue/40"
                  }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between px-6 pb-6 pt-1">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-[#A6A7AB] hover:text-[#F1F1F3] transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <button
              onClick={nextStep}
              className="flex items-center gap-1.5 px-5 py-2 bg-hatchin-blue hover:bg-hatchin-blue/90 text-white rounded-lg transition-colors text-sm font-medium"
            >
              {currentStep === steps.length - 1 ? "Let's go →" : "Next"}
              {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
