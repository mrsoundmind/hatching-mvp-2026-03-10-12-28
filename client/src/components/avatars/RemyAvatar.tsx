// RemyAvatar — Remy (DevOps Engineer) — Serious, protective. Short hair, subtle stubble dots below mouth
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function RemyAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="remyBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#e8622a" />
            <stop offset="100%" stopColor="#c2410c" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#remyBg)" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#8d5327" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="9.5" ry="10.5" fill="#6b3d1a" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#8d5327" />

        {/* Short close-cropped hair */}
        <path
          d="M9 16 Q9.5 9.5 18 9.5 Q26.5 9.5 27 16 Q26 12 23 11.5 Q20 11 18 11 Q16 11 13 11.5 Q10 12 9 16Z"
          fill="#1a0a00"
        />
        {/* Hair highlight */}
        <path
          d="M9 16 Q9.5 9.5 18 9.5 Q26.5 9.5 27 16 Q26 12 23 11.5 Q20 11 18 11 Q16 11 13 11.5 Q10 12 9 16Z"
          fill="white"
          opacity="0.12"
        />

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#6b3d1a" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#6b3d1a" opacity="0.5" />

        {/* Eyes — serious, steady */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye */}
          <circle cx="14" cy="20" r="2" fill="#0d0600" />
          <circle cx="14" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="14.6" cy="19.5" r="0.55" fill="white" />
          {/* Right eye */}
          <circle cx="22" cy="20" r="2" fill="#0d0600" />
          <circle cx="22" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="22.6" cy="19.5" r="0.55" fill="white" />
        </motion.g>

        {/* Serious straight brows — slightly furrowed, slow protective tension */}
        <motion.g
          animate={{ y: [0, 0.5, 0], scaleX: [1, 1.02, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M12.5 17.5 Q14 17 15.5 17.5" stroke="#0d0600" strokeWidth="1.1" strokeLinecap="round" fill="none" />
          <path d="M20.5 17.5 Q22 17 23.5 17.5" stroke="#0d0600" strokeWidth="1.1" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* Firm straight mouth — barely moves, protective stillness */}
        <motion.g
          animate={{ scaleX: [1, 0.97, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        >
          <path
            d="M15 25.5 Q18 25.8 21 25.5"
            stroke="#0d0600"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>

        {/* Stubble dots below mouth — small scattered dots */}
        <circle cx="15.5" cy="27.2" r="0.4" fill="#0d0600" opacity="0.5" />
        <circle cx="17" cy="27.5" r="0.4" fill="#0d0600" opacity="0.5" />
        <circle cx="18.5" cy="27.5" r="0.4" fill="#0d0600" opacity="0.5" />
        <circle cx="20" cy="27.2" r="0.4" fill="#0d0600" opacity="0.5" />
        <circle cx="16.2" cy="26.5" r="0.35" fill="#0d0600" opacity="0.4" />
        <circle cx="19.2" cy="26.5" r="0.35" fill="#0d0600" opacity="0.4" />
      </svg>
    </AvatarWrapper>
  );
}
