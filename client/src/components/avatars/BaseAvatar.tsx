// BaseAvatar — Shared SVG primitives and animation variants
// All character avatars extend these base patterns.

import { motion, AnimatePresence } from "framer-motion";

/** Brand accent — mirrors CSS var(--hatchin-blue) for SVG fill contexts */
const HATCHIN_BLUE = "#6C82FF";

export type AvatarState = "idle" | "thinking" | "speaking" | "celebrating" | "working";

export interface AvatarProps {
  state?: AvatarState;
  size?: number; // px, default 36
  className?: string;
}

// Whole-avatar motion variants — NO head tilt (distracting), celebrate only
export const avatarVariants = {
  idle: {},
  thinking: {},
  speaking: {},
  celebrating: {
    y: [0, -12, -2, -8, 0],
    scaleY: [1, 0.85, 1.1, 0.95, 1],
    transition: {
      duration: 0.6,
      times: [0, 0.3, 0.5, 0.7, 1],
      ease: "easeOut",
    },
  },
  working: {},
};

// Eye animations — idle blinks naturally every ~7s, thinking eyes shift upward
export const eyeThinkingVariants = {
  idle: {
    scaleY: [1, 1, 1, 0.08, 1, 1, 1, 1, 0.08, 1, 1],
    transition: {
      duration: 7,
      repeat: Infinity,
      times: [0, 0.28, 0.30, 0.32, 0.34, 0.70, 0.80, 0.82, 0.84, 0.86, 1],
      ease: "easeInOut",
    },
  },
  thinking: {
    y: [-1, -3, -1],
    transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
  },
  speaking: {
    scaleY: [1, 1, 1, 0.08, 1, 1, 1, 1, 0.08, 1, 1],
    transition: {
      duration: 7,
      repeat: Infinity,
      times: [0, 0.28, 0.30, 0.32, 0.34, 0.70, 0.80, 0.82, 0.84, 0.86, 1],
      ease: "easeInOut",
    },
  },
  celebrating: {},
};

interface AvatarWrapperProps {
  state: AvatarState;
  size: number;
  className?: string;
  children: React.ReactNode;
}

// Thinking bubble — appears above avatar when state=thinking
const ThinkingBubble = ({ size }: { size: number }) => {
  const scale = Math.max(0.6, size / 36);
  const bw = Math.round(14 * scale);
  const bh = Math.round(12 * scale);
  return (
    <motion.div
      className="absolute z-20 pointer-events-none"
      style={{ top: -bh * 0.6, right: -bw * 0.3 }}
      initial={{ opacity: 0, scale: 0, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0, y: 4 }}
      transition={{ duration: 0.25, ease: "backOut" }}
    >
      <svg width={bw} height={bh} viewBox="0 0 14 12" fill="none">
        {/* Trail dots from head to cloud */}
        <circle cx="2" cy="10.5" r="1.2" fill={HATCHIN_BLUE} opacity="0.7" />
        <circle cx="4.5" cy="8" r="1.6" fill={HATCHIN_BLUE} opacity="0.8" />
        {/* Thought cloud — 3 overlapping circles */}
        <motion.g
          animate={{ opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <circle cx="7.5" cy="5.5" r="2.8" fill={HATCHIN_BLUE} />
          <circle cx="11" cy="4.5" r="2.3" fill={HATCHIN_BLUE} />
          <circle cx="9" cy="2.5" r="2" fill={HATCHIN_BLUE} />
        </motion.g>
        {/* Three animated dots inside the cloud */}
        <motion.circle cx="7.5" cy="5" r="0.55" fill="white"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
        <motion.circle cx="9.2" cy="4.2" r="0.55" fill="white"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
        <motion.circle cx="10.8" cy="5" r="0.55" fill="white"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
      </svg>
    </motion.div>
  );
};

export function AvatarWrapper({ state, size, className = "", children }: AvatarWrapperProps) {
  return (
    <div className="relative inline-flex items-center justify-center select-none" style={{ width: size, height: size }}>
      {/* Thinking bubble */}
      <AnimatePresence>
        {state === "thinking" && <ThinkingBubble size={size} />}
      </AnimatePresence>

      <motion.div
        className={`relative rounded-full overflow-hidden ring-1 ring-hatchin-blue/40 ${className}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        animate={state}
        variants={avatarVariants}
      >
        {children}
        {/* 3D top-light specular highlight — sits over every avatar */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle at 35% 28%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 45%, transparent 70%)",
          }}
        />
      </motion.div>

      {/* Working state — rotating dashed ring overlay */}
      {state === "working" && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: '2px dashed rgba(108,130,255,0.6)',
            animation: 'agent-working-ring 3s linear infinite',
            boxShadow: '0 0 8px rgba(108,130,255,0.3)',
          }}
        />
      )}
    </div>
  );
}
