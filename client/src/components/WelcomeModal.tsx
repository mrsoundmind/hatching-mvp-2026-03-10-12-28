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
            animate={{ scale: 1, opacity: 1, y: [0, -10, 0] }}
            transition={{
              opacity: { duration: 0.6 },
              scale: { duration: 0.6 },
              y: { duration: 3, repeat: Infinity, ease: "easeInOut" }
            }}
            className="relative w-24 h-28 mx-auto flex items-center justify-center pt-4"
          >
            {/* Outer glow ring */}
            <div className="absolute inset-x-0 inset-y-4 rounded-full blur-2xl opacity-40 bg-gradient-to-br from-[#6C82FF] to-[#9F7BFF]" />

            {/* Main orb — pearl highlight shape */}
            <div className="relative w-20 h-24 rounded-full overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #d0d8ff 30%, #a5b4fc 70%, #8b5cf6 100%)',
                boxShadow: '0 0 40px rgba(108,130,255,0.3), inset 0 2px 4px rgba(255,255,255,0.8)',
                borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
              }}
            >
              {/* Shimmer highlight */}
              <div className="absolute top-3 left-5 w-6 h-4 rounded-full opacity-80"
                style={{ background: 'rgba(255,255,255,0.7)', filter: 'blur(3px)' }}
              />
              <div className="absolute top-5 left-8 w-3 h-2 rounded-full"
                style={{ background: 'rgba(255,255,255,0.5)', filter: 'blur(1px)' }}
              />
            </div>
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
