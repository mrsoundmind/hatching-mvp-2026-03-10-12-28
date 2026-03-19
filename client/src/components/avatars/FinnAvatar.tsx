// FinnAvatar — Finn (UI Engineer) — Focused, minimal, clean
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function FinnAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="finnBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#5ce8ff" />
            <stop offset="100%" stopColor="#06b6d4" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#finnBg)" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#f0c8a8" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="9.5" ry="10.5" fill="#b08050" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#f0c8a8" />

        {/* Very short hair — minimal dark cap */}
        <path
          d="M9 17 Q9.5 9 18 9 Q26.5 9 27 17 Q26 14 24 13.5 Q21 12.5 18 12.5 Q15 12.5 12 13.5 Q10 14 9 17Z"
          fill="#1a1008"
        />

        {/* Hair highlight — subtle shine */}
        <path
          d="M11 14 Q14 10.5 21 11.5 Q18 10 18 10 Q14 10 11 14Z"
          fill="white"
          opacity="0.12"
        />

        {/* Eyes — focused, slightly squinting (thinner ellipses) */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye */}
          <ellipse cx="14" cy="20.5" rx="2.1" ry="1.4" fill="#1a1008" />
          <ellipse cx="14" cy="20.5" rx="1.2" ry="0.9" fill="#080400" />
          {/* Top lid squint line */}
          <path d="M11.9 19.8 Q14 19.2 16.1 19.8" stroke="#1a1008" strokeWidth="0.6" fill="none" />
          <circle cx="14.6" cy="20.0" r="0.55" fill="white" />

          {/* Right eye */}
          <ellipse cx="22" cy="20.5" rx="2.1" ry="1.4" fill="#1a1008" />
          <ellipse cx="22" cy="20.5" rx="1.2" ry="0.9" fill="#080400" />
          {/* Top lid squint line */}
          <path d="M19.9 19.8 Q22 19.2 24.1 19.8" stroke="#1a1008" strokeWidth="0.6" fill="none" />
          <circle cx="22.6" cy="20.0" r="0.55" fill="white" />
        </motion.g>

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#b08050" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#b08050" opacity="0.5" />

        {/* Neutral concentrated expression — slight focused compression */}
        <motion.g
          animate={{ scaleX: [1, 0.97, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d="M15 25.5 Q18 26 21 25.5"
            stroke="#1a1008"
            strokeWidth="1.1"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>

        {/* Clean straight brows — focused squint, brows lower slightly */}
        <motion.g
          animate={{ y: [0, 0.5, 0] }}
          transition={{ duration: 5, repeat: Infinity, delay: 1.5, ease: "easeInOut" }}
        >
          <path d="M12.5 18 L15.5 17.8" stroke="#1a1008" strokeWidth="0.9" strokeLinecap="round" fill="none" />
          <path d="M20.5 17.8 L23.5 18" stroke="#1a1008" strokeWidth="0.9" strokeLinecap="round" fill="none" />
        </motion.g>
      </svg>
    </AvatarWrapper>
  );
}
