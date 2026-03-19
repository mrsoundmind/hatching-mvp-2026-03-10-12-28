// RioAvatar — Rio (Data Analyst) — Sharp, visual thinker. Slick hair combed to one side, focused expression
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function RioAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="rioBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#7c75f0" />
            <stop offset="100%" stopColor="#4f46e5" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#rioBg)" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#c97b4b" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="8.5" ry="9.5" fill="#c97b4b" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#c97b4b" />

        {/* Slick hair combed to one side — swept right */}
        <path
          d="M9 16 Q9.5 9 18 9 Q26.5 9 27 16 Q25 11 21 10.5 Q18 10 16 10.5 Q12 11 9.5 14Z"
          fill="#1a0a00"
        />
        {/* Hair highlight */}
        <path
          d="M9 16 Q9.5 9 18 9 Q26.5 9 27 16 Q25 11 21 10.5 Q18 10 16 10.5 Q12 11 9.5 14Z"
          fill="white"
          opacity="0.12"
        />
        {/* Slicked direction — sharp combed line going right */}
        <path d="M9.5 14 Q12 11 16 10.5 Q14 11.5 11 13.5Z" fill="#1a0a00" />
        {/* The swept portion — showing combed direction toward right */}
        <path d="M18 10 Q22 9.5 25 11 Q22 10 18.5 10Z" fill="#2d1400" />

        {/* Eyes — sharp, focused */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye — slightly narrowed, focused */}
          <ellipse cx="14" cy="20" rx="2" ry="1.7" fill="#0a0500" />
          <circle cx="14" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="14.6" cy="19.5" r="0.55" fill="white" />
          {/* Right eye */}
          <ellipse cx="22" cy="20" rx="2" ry="1.7" fill="#0a0500" />
          <circle cx="22" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="22.6" cy="19.5" r="0.55" fill="white" />
        </motion.g>

        {/* Sharp focused brows — asymmetric analytical raise: left slightly higher */}
        <motion.g
          animate={{ y: [0, -0.6, -0.2, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M12.5 17.8 Q14 17 15.5 17.5" stroke="#0a0500" strokeWidth="1" strokeLinecap="round" fill="none" />
          <path d="M20.5 17.5 Q22 17 23.5 17.8" stroke="#0a0500" strokeWidth="1" strokeLinecap="round" fill="none" transform="translate(0, 0.3)" />
        </motion.g>

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#a05a30" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#a05a30" opacity="0.5" />

        {/* Focused, determined expression — firm set mouth, barely moves */}
        <motion.g
          animate={{ scaleX: [1, 1.02, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "18px 25.5px" }}
        >
          <path
            d="M15 25.5 Q18 26.2 21 25.5"
            stroke="#0a0500"
            strokeWidth="1.1"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>
      </svg>
    </AvatarWrapper>
  );
}
