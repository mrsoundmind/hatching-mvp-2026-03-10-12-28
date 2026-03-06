import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGetStarted: () => void;
}

export function WelcomeModal({ isOpen, onClose, onGetStarted }: WelcomeModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#1A1D23] border-[#31343A] p-0 overflow-hidden">
        <DialogTitle className="sr-only">Welcome to Hatchin</DialogTitle>
        <DialogDescription className="sr-only">
          Intro screen for setting up your AI teammate workspace.
        </DialogDescription>
        <div className="text-center space-y-8 p-10 relative">
          {/* Ambient Glow Backdrop */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b from-[#6C82FF]/10 to-transparent pointer-events-none" />

          {/* Premium Startup Orb */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="relative w-32 h-32 mx-auto flex items-center justify-center"
          >
            <video
              src="/logo.webm"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-contain pointer-events-none"
            />
          </motion.div>

          {/* Welcome text with stagger animations */}
          <div className="space-y-4 relative z-10">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-bold tracking-tight text-[#F1F1F3]"
            >
              Welcome to Hatchin
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-[#A6A7AB] text-base leading-relaxed max-w-xs mx-auto"
            >
              Build AI teammates that understand your goals and help you achieve them.
            </motion.p>
          </div>

          {/* Get Started button */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="pt-2"
          >
            <button
              onClick={onGetStarted}
              className="group relative w-full px-6 py-4 bg-gradient-to-r from-[#6C82FF] to-[#8B5CF6] hover:from-[#5A6FE8] hover:to-[#7C3AED] text-white rounded-xl font-bold text-lg transition-all duration-300 shadow-[0_8px_25px_rgba(108,130,255,0.3)] hover:shadow-[0_12px_35px_rgba(108,130,255,0.4)] active:scale-[0.98] outline-none border-0"
            >
              <span className="relative z-10">Get Started</span>
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
            </button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
