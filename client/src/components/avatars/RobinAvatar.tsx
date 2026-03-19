// RobinAvatar — Robin (SEO Specialist) — Analytical, data-driven. Glasses, tidy hair
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function RobinAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="robinBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#f5a623" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#robinBg)" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#fddcb5" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="9.5" ry="10.5" fill="#d4a870" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#fddcb5" />

        {/* Tidy parted hair */}
        <path
          d="M9 16 Q9.5 9 18 9 Q26.5 9 27 16 Q25.5 12 22.5 11.5 Q20 11 18 11.5 Q14 11 11.5 12.5 Q10 13.5 9 16Z"
          fill="#2d1b0e"
        />
        {/* Hair highlight */}
        <path
          d="M9 16 Q9.5 9 18 9 Q26.5 9 27 16 Q25.5 12 22.5 11.5 Q20 11 18 11.5 Q14 11 11.5 12.5 Q10 13.5 9 16Z"
          fill="white"
          opacity="0.12"
        />
        {/* Clean part on left */}
        <path d="M9 16 Q9.5 13 11 11.5 Q9.5 13.5 9.5 15.5Z" fill="#2d1b0e" />

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#d4a870" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#d4a870" opacity="0.5" />

        {/* Eyes behind glasses — regular size */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye */}
          <circle cx="14" cy="20" r="2" fill="#1a0800" />
          <circle cx="14" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="14.6" cy="19.5" r="0.55" fill="white" />
          {/* Right eye */}
          <circle cx="22" cy="20" r="2" fill="#1a0800" />
          <circle cx="22" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="22.6" cy="19.5" r="0.55" fill="white" />
        </motion.g>

        {/* Glasses frames — two rounded rectangles */}
        <rect x="11.2" y="17.8" width="5.6" height="4.4" rx="1.5" stroke="#1a0800" strokeWidth="1" fill="none" />
        <rect x="19.2" y="17.8" width="5.6" height="4.4" rx="1.5" stroke="#1a0800" strokeWidth="1" fill="none" />
        {/* Bridge between lenses */}
        <path d="M16.8 20 L19.2 20" stroke="#1a0800" strokeWidth="0.8" strokeLinecap="round" fill="none" />
        {/* Left arm */}
        <path d="M11.2 20 Q9.5 19.5 9 19" stroke="#1a0800" strokeWidth="0.8" strokeLinecap="round" fill="none" />
        {/* Right arm */}
        <path d="M24.8 20 Q26.5 19.5 27 19" stroke="#1a0800" strokeWidth="0.8" strokeLinecap="round" fill="none" />

        {/* Focused analytical brows — slow deliberate micro-furrow */}
        <motion.g
          animate={{ y: [0, 0.4, 0], scaleX: [1, 1.03, 1] }}
          transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        >
          <path d="M12.5 17.5 Q14 17 15.5 17.5" stroke="#1a0800" strokeWidth="0.9" strokeLinecap="round" fill="none" />
          <path d="M20.5 17.5 Q22 17 23.5 17.5" stroke="#1a0800" strokeWidth="0.9" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* Thoughtful slight smile — slow measured shift, data processing pause */}
        <motion.g
          animate={{ scaleX: [1, 1.03, 1], y: [0, -0.2, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        >
          <path
            d="M15 25.5 Q18 27 21 25.5"
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
