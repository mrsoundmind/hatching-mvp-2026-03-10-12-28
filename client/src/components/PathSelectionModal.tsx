import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ChevronRight, Lightbulb, Package, MousePointer2 } from "lucide-react";
import { motion } from "framer-motion";

interface PathSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartWithIdea: () => void;
  onUseStarterPack: () => void;
  onFigureItOut: () => void;
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
      <DialogContent className="max-w-2xl bg-[#1A1D23] border-[#31343A] p-0 overflow-hidden">
        <DialogTitle className="sr-only">Choose your starting point</DialogTitle>
        <DialogDescription className="sr-only">
          Choose how you want to begin building your team in Hatchin.
        </DialogDescription>
        <div className="p-10 relative">
          {/* Ambient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b from-[#6C82FF]/05 to-transparent pointer-events-none" />

          {/* Header */}
          <div className="text-center space-y-4 mb-10 relative z-10">
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold tracking-tight text-[#F1F1F3]"
            >
              Choose your starting point
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-[#A6A7AB] text-lg"
            >
              How would you like to begin building your team?
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
              className="relative group p-6 bg-gradient-to-br from-[#23262B] to-[#1A1D23] border border-[#31343A] rounded-2xl text-left transition-all duration-300 hover:border-[#6C82FF]/50 hover:shadow-[0_8px_30px_rgba(108,130,255,0.15)] flex flex-col h-full overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="relative z-10 space-y-4 flex flex-col h-full">
                <div className="w-14 h-14 bg-gradient-to-br from-yellow-400/20 to-orange-500/20 border border-yellow-500/30 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.1)] group-hover:shadow-[0_0_25px_rgba(245,158,11,0.2)] transition-shadow">
                  <Lightbulb className="w-8 h-8 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-[#F1F1F3] mb-2 group-hover:text-[#6C82FF] transition-colors">
                    Start with an idea
                  </h3>
                  <p className="text-[#A6A7AB] text-sm leading-relaxed mb-6">
                    Not sure what to build? Maya will join your chat and help you discover the perfect team structure.
                  </p>
                </div>
                <div className="flex items-center text-[#6C82FF] text-sm font-bold group-hover:translate-x-1 transition-transform mt-auto">
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
              className="relative group p-6 bg-gradient-to-br from-[#23262B] to-[#1A1D23] border border-[#31343A] rounded-2xl text-left transition-all duration-300 hover:border-[#9F7BFF]/50 hover:shadow-[0_8px_30px_rgba(159,123,255,0.15)] flex flex-col h-full overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="relative z-10 space-y-4 flex flex-col h-full">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500/20 to-indigo-600/20 border border-purple-500/30 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(159,123,255,0.1)] group-hover:shadow-[0_0_25px_rgba(159,123,255,0.2)] transition-shadow">
                  <Package className="w-8 h-8 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-[#F1F1F3] mb-2 group-hover:text-[#9F7BFF] transition-colors">
                    Use a starter pack
                  </h3>
                  <p className="text-[#A6A7AB] text-sm leading-relaxed mb-6">
                    Explore high-performance team templates curated for SaaS, Creative, and Operations.
                  </p>
                </div>
                <div className="flex items-center text-[#9F7BFF] text-sm font-bold group-hover:translate-x-1 transition-transform mt-auto">
                  Browse templates
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </motion.button>
          </div>

          {/* Alternative option */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center relative z-10"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#111318] border border-[#31343A] text-[#A6A7AB] text-sm group cursor-pointer hover:border-[#43444B] transition-all"
              onClick={onFigureItOut}>
              <MousePointer2 className="w-3.5 h-3.5" />
              <span>Not sure? <span className="text-[#6C82FF] font-bold hover:underline ml-1">I'll figure it out as I go</span></span>
            </div>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
