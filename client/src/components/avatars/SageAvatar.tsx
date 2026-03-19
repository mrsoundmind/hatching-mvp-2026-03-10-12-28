// SageAvatar — Sage (Data Scientist) — Skeptical, rigorous. Raised one eyebrow, round glasses, thoughtful
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function SageAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="sageBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#6560d0" />
            <stop offset="100%" stopColor="#3730a3" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#sageBg)" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#fddcb5" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="8.5" ry="9.5" fill="#fddcb5" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#fddcb5" />

        {/* Medium neat hair */}
        <path
          d="M9 16 Q9.5 9 18 9 Q26.5 9 27 16 Q25 11.5 22 11 Q19 10.5 18 11 Q15 10.5 12 11.5 Q10 12.5 9 16Z"
          fill="#4a2200"
        />
        {/* Hair highlight */}
        <path
          d="M9 16 Q9.5 9 18 9 Q26.5 9 27 16 Q25 11.5 22 11 Q19 10.5 18 11 Q15 10.5 12 11.5 Q10 12.5 9 16Z"
          fill="white"
          opacity="0.12"
        />

        {/* Eyes behind round glasses */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye */}
          <circle cx="14" cy="20" r="1.7" fill="#1a0800" />
          <circle cx="14" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="14.6" cy="19.5" r="0.55" fill="white" />
          {/* Right eye */}
          <circle cx="22" cy="20" r="1.7" fill="#1a0800" />
          <circle cx="22" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="22.6" cy="19.5" r="0.55" fill="white" />
        </motion.g>

        {/* Round glasses */}
        <circle cx="14" cy="20" r="2.8" stroke="#1a0800" strokeWidth="0.9" fill="none" />
        <circle cx="22" cy="20" r="2.8" stroke="#1a0800" strokeWidth="0.9" fill="none" />
        {/* Bridge */}
        <path d="M16.8 20 L19.2 20" stroke="#1a0800" strokeWidth="0.8" strokeLinecap="round" fill="none" />
        {/* Arms */}
        <path d="M11.2 19.5 Q9.5 19 9 18.5" stroke="#1a0800" strokeWidth="0.8" strokeLinecap="round" fill="none" />
        <path d="M24.8 19.5 Q26.5 19 27 18.5" stroke="#1a0800" strokeWidth="0.8" strokeLinecap="round" fill="none" />

        {/* Skeptical asymmetric brows — left raises more, right barely moves */}
        <motion.g
          animate={{ y: [0, -0.8, 0, -0.4, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Left brow — raises noticeably (skeptical arch) */}
          <path d="M12 16.5 Q13.5 15.5 15.5 16.8" stroke="#1a0800" strokeWidth="1" strokeLinecap="round" fill="none" />
        </motion.g>
        <motion.g
          animate={{ y: [0, -0.2, 0, -0.1, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Right brow — barely moves */}
          <path d="M20.5 17.5 Q22 17 23.5 17.5" stroke="#1a0800" strokeWidth="1" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#c8a080" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#c8a080" opacity="0.5" />

        {/* Skeptical thoughtful expression — very subtle movement */}
        <motion.g
          animate={{ scaleX: [1, 1.01, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "18px 25.5px" }}
        >
          <path
            d="M15 25.5 Q17.5 25.8 21 25"
            stroke="#1a0800"
            strokeWidth="1.1"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>
      </svg>
    </AvatarWrapper>
  );
}
