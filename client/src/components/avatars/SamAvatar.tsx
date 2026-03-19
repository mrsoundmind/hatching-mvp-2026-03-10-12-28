// SamAvatar — Sam (QA Lead) — Skeptical, watchful, asymmetric expression
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function SamAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="samBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ff7a93" />
            <stop offset="100%" stopColor="#f43f5e" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#samBg)" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#d4a574" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="9.5" ry="10.5" fill="#9a6030" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#d4a574" />

        {/* Hair — dark, medium crop */}
        <path
          d="M9 18 Q9 9 18 8.5 Q27 9 27 18 Q26 14.5 24 13.5 Q21.5 12 18 12 Q14.5 12 12 13.5 Q10 14.5 9 18Z"
          fill="#1a0e06"
        />

        {/* Hair highlight — subtle shine */}
        <path
          d="M11 14 Q14 10 20 11 Q17 9.5 18 9.5 Q14 9.5 11 14Z"
          fill="white"
          opacity="0.12"
        />

        {/* Eyes — slightly smaller, attentive/watchful */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye */}
          <circle cx="14" cy="20.5" r="1.8" fill="#1a0e06" />
          <circle cx="14" cy="20.5" r="1.2" fill="#080400" />
          <circle cx="14.6" cy="20.0" r="0.55" fill="white" />
          {/* Right eye */}
          <circle cx="22" cy="20.5" r="1.8" fill="#1a0e06" />
          <circle cx="22" cy="20.5" r="1.2" fill="#080400" />
          <circle cx="22.6" cy="20.0" r="0.55" fill="white" />
        </motion.g>

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#9a6030" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#9a6030" opacity="0.5" />

        {/* Asymmetric brows — left brow raises independently (skeptical) */}
        <motion.g
          animate={{ y: [0, -1.2, 0, -0.5, 0] }}
          transition={{ duration: 5, repeat: Infinity, times: [0, 0.3, 0.5, 0.7, 1] }}
        >
          <path d="M12 17 Q13.5 15.8 15.5 16.8" stroke="#1a0e06" strokeWidth="1" strokeLinecap="round" fill="none" />
        </motion.g>
        {/* Right brow stays flat — no animation */}
        <path d="M20.5 17.8 Q22 17.2 23.5 17.8" stroke="#1a0e06" strokeWidth="1" strokeLinecap="round" fill="none" />

        {/* Slight skeptical mouth — barely moves, very slight side press */}
        <motion.g
          animate={{ scaleX: [1, 0.98, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d="M14.5 25.5 Q17.5 26.2 21.5 25"
            stroke="#1a0e06"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>
      </svg>
    </AvatarWrapper>
  );
}
