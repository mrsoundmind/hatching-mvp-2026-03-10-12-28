import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ChevronRight, Lightbulb, Package, MousePointer2 } from "lucide-react";
import { motion } from "framer-motion";

interface PathSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartWithIdea: () => void;
  onUseStarterPack: () => void;
  // Optional: the "I'll figure it out as I go" path. Shown in onboarding, omitted
  // when creating a later project (the new-project flow doesn't offer a scratch start).
  onFigureItOut?: () => void;
}

export function PathSelectionModal({
  isOpen,
  onClose,
  onStartWithIdea,
  onUseStarterPack,
  onFigureItOut
}: PathSelectionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-hatchin-panel border-hatchin-border-subtle p-0 overflow-hidden">
        <DialogTitle className="sr-only">Choose your starting point</DialogTitle>
        <DialogDescription className="sr-only">
          Choose how you want to begin building your team in Hatchin.
        </DialogDescription>
        <div className="p-10 relative">
          {/* Ambient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b from-hatchin-blue/5 to-transparent pointer-events-none" />

          {/* Header */}
          <div className="text-center space-y-4 mb-10 relative z-10">
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold tracking-tight text-hatchin-text-bright"
            >
              How do you want to start?
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-muted-foreground text-lg"
            >
              Pick a path. You can always change it later.
            </motion.p>
          </div>

          {/* Path options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 relative z-10">
            {/* Start with an idea */}
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              onClick={onStartWithIdea}
              className="relative group p-6 bg-gradient-to-br from-hatchin-card to-hatchin-panel border border-hatchin-border-subtle rounded-2xl text-left transition-all duration-300 hover:border-hatchin-blue/50 hover:shadow-[0_8px_30px_rgba(108,130,255,0.15)] flex flex-col h-full overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="relative z-10 space-y-4 flex flex-col h-full">
                <div className="w-14 h-14 bg-gradient-to-br from-hatchin-blue/20 to-hatchin-blue/10 border border-hatchin-blue/30 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(108,130,255,0.12)] group-hover:shadow-[0_0_25px_rgba(108,130,255,0.25)] transition-shadow">
                  <Lightbulb className="w-8 h-8 text-hatchin-blue" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-hatchin-text-bright mb-2 group-hover:text-hatchin-blue transition-colors">
                    Start with an idea
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                    Not sure what to build? Maya will join your chat and help you discover the perfect team structure.
                  </p>
                </div>
                <div className="flex items-center text-hatchin-blue text-sm font-bold group-hover:translate-x-1 transition-transform mt-auto">
                  Get started with Maya
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </motion.button>

            {/* Use a starter pack */}
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              onClick={onUseStarterPack}
              className="relative group p-6 bg-gradient-to-br from-hatchin-card to-hatchin-panel border border-hatchin-border-subtle rounded-2xl text-left transition-all duration-300 hover:border-hatchin-blue/50 hover:shadow-[0_8px_30px_rgba(108,130,255,0.15)] flex flex-col h-full overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="relative z-10 space-y-4 flex flex-col h-full">
                <div className="w-14 h-14 bg-gradient-to-br from-hatchin-blue/20 to-hatchin-blue/10 border border-hatchin-blue/30 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(108,130,255,0.12)] group-hover:shadow-[0_0_25px_rgba(108,130,255,0.25)] transition-shadow">
                  <Package className="w-8 h-8 text-hatchin-blue" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-hatchin-text-bright mb-2 group-hover:text-hatchin-blue transition-colors">
                    Use a starter pack
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                    Explore high-performance team templates curated for SaaS, Creative, and Operations.
                  </p>
                </div>
                <div className="flex items-center text-hatchin-blue text-sm font-bold group-hover:translate-x-1 transition-transform mt-auto">
                  Browse templates
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </motion.button>
          </div>

          {/* Alternative option — only when a "figure it out" handler is provided (onboarding). */}
          {onFigureItOut && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-center relative z-10"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-hatchin-panel border border-hatchin-border-subtle text-muted-foreground text-sm group cursor-pointer hover:border-hatchin-border-subtle transition-all"
                onClick={onFigureItOut}>
                <MousePointer2 className="w-3.5 h-3.5" />
                <span>Not sure? <span className="text-hatchin-blue font-bold hover:underline ml-1">I'll figure it out as I go</span></span>
              </div>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
