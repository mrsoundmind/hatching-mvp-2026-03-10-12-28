// CleoAvatar — Cleo (Designer) — Expressive, wavy hair, warm smile
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function CleoAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="cleoBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#c97cff" />
            <stop offset="100%" stopColor="#a855f7" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#cleoBg)" />

        {/* Wavy hair — behind face, medium length, purple-tinted dark */}
        <path
          d="M7 22 Q6 14 10 10 Q14 6.5 18 7 Q22 6.5 26 10 Q30 14 29 22 Q27 18 26 16 Q24 12 22 13 Q20 11.5 18 12 Q16 11.5 14 13 Q12 12 10 16 Q9 18 7 22Z"
          fill="#3b1a5e"
        />
        {/* Side hair flowing down */}
        <path d="M7 22 Q6 26 8 30 Q9 28 10 26 Q9 24 9 22Z" fill="#3b1a5e" />
        <path d="M29 22 Q30 26 28 30 Q27 28 26 26 Q27 24 27 22Z" fill="#3b1a5e" />

        {/* Hair highlight — subtle shine on top curve */}
        <path
          d="M12 10 Q16 7.5 22 9 Q19 7 18 7.5 Q15 7 12 10Z"
          fill="white"
          opacity="0.12"
        />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#fcd5b5" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="9.5" ry="10.5" fill="#c89060" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#fcd5b5" />

        {/* Eyes — slightly larger, rounder */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye */}
          <circle cx="14" cy="20" r="2.3" fill="#2d1040" />
          <circle cx="14" cy="20" r="1.2" fill="#120820" />
          <circle cx="14.6" cy="19.5" r="0.55" fill="white" />
          {/* Right eye */}
          <circle cx="22" cy="20" r="2.3" fill="#2d1040" />
          <circle cx="22" cy="20" r="1.2" fill="#120820" />
          <circle cx="22.6" cy="19.5" r="0.55" fill="white" />
        </motion.g>

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#c89060" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#c89060" opacity="0.5" />

        {/* Arched raised brows — raise enthusiastically every 3s */}
        <motion.g
          animate={{ y: [0, -1, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M12 17 Q14 15.8 16 16.8" stroke="#2d1040" strokeWidth="1" strokeLinecap="round" fill="none" />
          <path d="M20 16.8 Q22 15.8 24 17" stroke="#2d1040" strokeWidth="1" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* Warm smile — grows slightly with enthusiasm */}
        <motion.g
          animate={{ scaleX: [1, 1.06, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d="M13.5 25 Q18 28.5 22.5 25"
            stroke="#2d1040"
            strokeWidth="1.3"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>

        {/* Small cheek blush dots — pulse with warmth */}
        <motion.g
          animate={{ opacity: [0.4, 0.6, 0.4], scale: [1, 1.1, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <circle cx="11.5" cy="22.5" r="1.5" fill="#f8a4c8" opacity="0.4" />
          <circle cx="24.5" cy="22.5" r="1.5" fill="#f8a4c8" opacity="0.4" />
        </motion.g>
      </svg>
    </AvatarWrapper>
  );
}
