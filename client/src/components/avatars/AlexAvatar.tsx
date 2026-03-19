// AlexAvatar — Alex (PM) — Confident, professional look
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function AlexAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="alexBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#7ab3ff" />
            <stop offset="100%" stopColor="#3b82f6" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#alexBg)" />

        {/* Short neat hair — dark rectangle cap at top */}
        <rect x="8" y="8" width="20" height="8" rx="4" fill="#2d1b0e" />
        <rect x="9" y="12" width="18" height="4" fill="#2d1b0e" />

        {/* Hair highlight — subtle shine */}
        <rect x="10" y="9" width="12" height="3" rx="2" fill="white" opacity="0.12" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#f5c8a0" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="9.5" ry="10.5" fill="#c8925a" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#f5c8a0" />

        {/* Hair top overlap for clean look */}
        <rect x="9" y="11" width="18" height="4" rx="2" fill="#2d1b0e" />

        {/* Eyes */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye */}
          <circle cx="14" cy="20" r="2" fill="#2d1b0e" />
          <circle cx="14" cy="20" r="1.2" fill="#1a0e00" />
          <circle cx="14.6" cy="19.5" r="0.55" fill="white" />
          {/* Right eye */}
          <circle cx="22" cy="20" r="2" fill="#2d1b0e" />
          <circle cx="22" cy="20" r="1.2" fill="#1a0e00" />
          <circle cx="22.6" cy="19.5" r="0.55" fill="white" />
        </motion.g>

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#c8925a" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#c8925a" opacity="0.5" />

        {/* Confident half-smile — subtle confident pulse */}
        <motion.g
          animate={{ scaleX: [1, 1.03, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d="M14.5 25 Q17 27.5 22 25.5"
            stroke="#2d1b0e"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>

        {/* Subtle brow lines — left brow raises very slightly every 4s */}
        <motion.g
          animate={{ y: [0, -0.5, 0] }}
          transition={{ duration: 4, repeat: Infinity, delay: 2, ease: "easeInOut" }}
        >
          <path d="M12.5 17.5 Q14 16.8 15.5 17.5" stroke="#2d1b0e" strokeWidth="0.8" strokeLinecap="round" fill="none" />
          <path d="M20.5 17.5 Q22 16.8 23.5 17.5" stroke="#2d1b0e" strokeWidth="0.8" strokeLinecap="round" fill="none" />
        </motion.g>
      </svg>
    </AvatarWrapper>
  );
}
