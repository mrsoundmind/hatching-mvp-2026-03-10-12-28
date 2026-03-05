import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface EggHatchingAnimationProps {
  onComplete: () => void;
  projectName: string;
  completionTitle?: string;
  completionSubtitle?: string;
}

export function EggHatchingAnimation({
  onComplete,
  projectName,
  completionTitle = "Maya is Ready!",
  completionSubtitle = "Your AI idea partner is ready to help."
}: EggHatchingAnimationProps) {
  const [stage, setStage] = useState<'floating' | 'cracking' | 'hatched' | 'maya-appears'>('floating');

  useEffect(() => {
    const timer1 = setTimeout(() => setStage('cracking'), 800);
    const timer2 = setTimeout(() => setStage('hatched'), 1600);
    const timer3 = setTimeout(() => setStage('maya-appears'), 2200);
    const timer4 = setTimeout(() => onComplete(), 3500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{
      background: 'radial-gradient(ellipse at center, #1a1d28 0%, #0d0e14 100%)'
    }}>
      {/* Ambient glow backdrop */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(108,130,255,0.12) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
      </div>

      <div className="text-center relative z-10">
        {/* Central animation stage */}
        <AnimatePresence mode="wait">
          {/* Stage 1: Floating premium orb */}
          {stage === 'floating' && (
            <motion.div
              key="floating"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, y: [0, -12, 0] }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{
                opacity: { duration: 0.6 },
                scale: { duration: 0.8, ease: "easeOut" },
                y: { duration: 3, repeat: Infinity, ease: "easeInOut" }
              }}
              className="mb-12 flex justify-center"
            >
              <div className="relative w-28 h-28 flex items-center justify-center">
                {/* Dynamic Energy Rings */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-[-20%] border border-dashed border-[#6C82FF]/30 rounded-full"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-[-10%] border border-dashed border-[#9F7BFF]/20 rounded-full"
                />

                {/* Multiple Glow Layers */}
                <div className="absolute inset-0 rounded-full blur-2xl opacity-60 bg-gradient-to-br from-[#6C82FF] to-[#9F7BFF]" />
                <div className="absolute inset-0 rounded-full blur-3xl opacity-30 bg-[#6C82FF] animate-pulse" />

                {/* The Core Orb */}
                <div className="relative w-20 h-24 rounded-full overflow-hidden"
                  style={{
                    background: 'radial-gradient(circle at 30% 30%, #ffffff 0%, #d0d8ff 20%, #7e87ff 60%, #4f46e5 100%)',
                    boxShadow: '0 0 50px rgba(108,130,255,0.4), inset 0 2px 4px rgba(255,255,255,0.9)',
                    borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                  }}
                >
                  {/* Bioluminescent Pulse */}
                  <motion.div
                    animate={{ opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-gradient-to-tr from-[#6C82FF]/40 to-transparent"
                  />

                  {/* Refraction/Highlights */}
                  <div className="absolute top-3 left-5 w-7 h-5 rounded-full opacity-90"
                    style={{ background: 'rgba(255,255,255,0.8)', filter: 'blur(4px)' }}
                  />
                  <div className="absolute top-5 left-8 w-4 h-3 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.6)', filter: 'blur(1.5px)' }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Stage 2: Cracking with vibration */}
          {stage === 'cracking' && (
            <motion.div
              key="cracking"
              animate={{
                rotate: [0, -3, 3, -2, 2, 0],
                scale: [1, 1.03, 1.01, 1.03, 1],
              }}
              transition={{ duration: 0.8, times: [0, 0.2, 0.4, 0.6, 0.8, 1] }}
              className="mb-8 flex justify-center"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full blur-xl opacity-60"
                  style={{ background: 'radial-gradient(circle, #6C82FF, #9F7BFF)' }}
                />
                <div className="relative w-20 h-24 overflow-hidden"
                  style={{
                    background: 'linear-gradient(145deg, #ffffff 0%, #d0d8ff 30%, #a5b4fc 70%, #8b5cf6 100%)',
                    boxShadow: '0 0 50px rgba(108,130,255,0.5), inset 0 2px 4px rgba(255,255,255,0.8)',
                    borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                  }}
                >
                  {/* Crack lines radiating out */}
                  <motion.div
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ duration: 0.3 }}
                    className="absolute top-6 left-1/2 w-0.5 h-10 origin-top"
                    style={{
                      background: 'linear-gradient(to bottom, rgba(108,130,255,0.8), transparent)',
                      transform: 'translateX(-50%) rotate(15deg)'
                    }}
                  />
                  <motion.div
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ delay: 0.2, duration: 0.2 }}
                    className="absolute top-10 left-4 w-8 h-0.5 origin-left"
                    style={{ background: 'rgba(108,130,255,0.6)' }}
                  />
                  <div className="absolute top-3 left-5 w-5 h-3 rounded-full opacity-60"
                    style={{ background: 'rgba(255,255,255,0.7)', filter: 'blur(3px)' }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Stage 3: Hatched — energy particles burst + new orb emerges */}
          {stage === 'hatched' && (
            <motion.div
              key="hatched"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="mb-8 flex justify-center"
            >
              <div className="relative">
                {/* Energy particles */}
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      background: i % 2 === 0 ? '#6C82FF' : '#47DB9A',
                      top: '50%',
                      left: '50%',
                    }}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{
                      x: Math.cos(i * Math.PI / 4) * 50,
                      y: Math.sin(i * Math.PI / 4) * 50,
                      opacity: 0,
                      scale: 0
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                ))}
                {/* Shell fragments */}
                <div className="w-20 h-10 rounded-b-full"
                  style={{
                    background: 'linear-gradient(to bottom, rgba(165,180,252,0.4), rgba(139,92,246,0.2))',
                    border: '1px solid rgba(165,180,252,0.3)',
                  }}
                />
                {/* Emerging Maya orb */}
                <motion.div
                  initial={{ scale: 0, y: 10 }}
                  animate={{ scale: 1, y: -20 }}
                  transition={{ duration: 0.6, ease: "backOut" }}
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2"
                >
                  <div className="w-14 h-14 rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, #6C82FF 0%, #9F7BFF 50%, #47DB9A 100%)',
                      boxShadow: '0 0 30px rgba(108,130,255,0.6), 0 0 60px rgba(108,130,255,0.2)',
                    }}
                  />
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Stage 4: Maya appears — full premium orb with glowing aura */}
          {stage === 'maya-appears' && (
            <motion.div
              key="maya"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="mb-8 flex justify-center"
            >
              <div className="relative">
                {/* Multiple glow rings */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    background: 'radial-gradient(circle, rgba(108,130,255,0.4), transparent)',
                    filter: 'blur(8px)',
                  }}
                />
                {/* Inner orb */}
                <div className="w-20 h-20 rounded-full relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #6C82FF 0%, #9F7BFF 40%, #47DB9A 100%)',
                    boxShadow: '0 0 40px rgba(108,130,255,0.7), 0 0 80px rgba(108,130,255,0.3), inset 0 2px 8px rgba(255,255,255,0.3)',
                  }}
                >
                  {/* Moving shimmer */}
                  <motion.div
                    className="absolute w-6 h-6 rounded-full"
                    animate={{ x: [0, 20, 0], y: [0, 10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      background: 'rgba(255,255,255,0.4)',
                      filter: 'blur(4px)',
                      top: '15%',
                      left: '15%',
                    }}
                  />
                  {/* Inner depth */}
                  <div className="absolute inset-2 rounded-full"
                    style={{
                      background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2), transparent 60%)'
                    }}
                  />
                </div>
                {/* Outer decorative ring */}
                <motion.div
                  className="absolute -inset-3 rounded-full border border-[#6C82FF]/30"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  style={{
                    borderStyle: 'dashed',
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Project Name */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-sm font-medium mb-1" style={{ color: '#6C82FF', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Initializing
          </h2>
          <h1 className="text-3xl font-bold text-white mb-1">{projectName}</h1>
        </motion.div>

        {/* Status message during maya-appears */}
        <AnimatePresence>
          {stage === 'maya-appears' && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="mt-3"
            >
              <p className="text-sm font-medium text-white mb-0.5">{completionTitle}</p>
              <p className="text-xs" style={{ color: 'rgba(108,130,255,0.8)' }}>{completionSubtitle}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wave progress dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          className="mt-6 flex items-end justify-center"
          style={{ height: '20px', gap: '6px' }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full block"
              style={{
                background: '#6C82FF',
                animation: `wave-bounce 1.2s ease-in-out infinite`,
                animationDelay: `${i * 0.18}s`,
              }}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}