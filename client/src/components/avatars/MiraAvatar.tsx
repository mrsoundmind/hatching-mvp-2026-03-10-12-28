// MiraAvatar — Mira (Content Writer) — Warm, expressive, curly hair, big smile
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function MiraAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="miraBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#eab308" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#miraBg)" />

        {/* Curly/puffy hair — large cloud-like shape behind face */}
        <path
          d="M6 20 Q5 12 9 9 Q11 6 14 7 Q16 5.5 18 6 Q20 5.5 22 7 Q25 6 27 9 Q31 12 30 20 Q28 15 26 14 Q25 11 22 12 Q20 10.5 18 11 Q16 10.5 14 12 Q11 11 10 14 Q8 15 6 20Z"
          fill="#5c2d0a"
        />
        {/* Hair highlight */}
        <path
          d="M6 20 Q5 12 9 9 Q11 6 14 7 Q16 5.5 18 6 Q20 5.5 22 7 Q25 6 27 9 Q31 12 30 20 Q28 15 26 14 Q25 11 22 12 Q20 10.5 18 11 Q16 10.5 14 12 Q11 11 10 14 Q8 15 6 20Z"
          fill="white"
          opacity="0.12"
        />
        {/* Side curls */}
        <path d="M6 20 Q4 22 5 26 Q7 23 8 21Z" fill="#5c2d0a" />
        <path d="M30 20 Q32 22 31 26 Q29 23 28 21Z" fill="#5c2d0a" />
        {/* Top curl bumps */}
        <circle cx="13" cy="8" r="3.5" fill="#5c2d0a" />
        <circle cx="18" cy="7" r="3.5" fill="#5c2d0a" />
        <circle cx="23" cy="8" r="3.5" fill="#5c2d0a" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#f5cba7" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="9.5" ry="10.5" fill="#c49070" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#f5cba7" />

        {/* Eyes — slightly larger, open, warm */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye */}
          <circle cx="14" cy="20" r="2" fill="#3d1c00" />
          <circle cx="14" cy="20" r="1.2" fill="#1a0a00" />
          <circle cx="14.6" cy="19.5" r="0.55" fill="white" />
          {/* Right eye */}
          <circle cx="22" cy="20" r="2" fill="#3d1c00" />
          <circle cx="22" cy="20" r="1.2" fill="#1a0a00" />
          <circle cx="22.6" cy="19.5" r="0.55" fill="white" />
        </motion.g>

        {/* Warm raised brows — gentle idle raise */}
        <motion.g
          animate={{ y: [0, -0.6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M12.5 17.2 Q14 16.3 15.5 17" stroke="#3d1c00" strokeWidth="0.9" strokeLinecap="round" fill="none" />
          <path d="M20.5 17 Q22 16.3 23.5 17.2" stroke="#3d1c00" strokeWidth="0.9" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#c49070" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#c49070" opacity="0.5" />

        {/* Big wide warm smile — gently grows and softens */}
        <motion.g
          animate={{ scaleX: [1, 1.08, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "18px 26px" }}
        >
          <path
            d="M13 24.5 Q18 29 23 24.5"
            stroke="#3d1c00"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>

        {/* Cheek blush — golden warmth */}
        <circle cx="11.5" cy="22.5" r="2" fill="#f59e0b" opacity="0.35" />
        <circle cx="24.5" cy="22.5" r="2" fill="#f59e0b" opacity="0.35" />
      </svg>
    </AvatarWrapper>
  );
}
