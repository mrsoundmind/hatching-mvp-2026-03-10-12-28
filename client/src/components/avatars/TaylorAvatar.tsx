// TaylorAvatar — Taylor (HR Specialist) — Warm, empathetic. Soft wavy medium hair, warm open smile
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function TaylorAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="taylorBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#9d58ff" />
            <stop offset="100%" stopColor="#6d28d9" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#taylorBg)" />

        {/* Soft wavy hair — medium length, behind face */}
        <path
          d="M7 22 Q6 13 9.5 9.5 Q13 6.5 18 7 Q23 6.5 26.5 9.5 Q30 13 29 22 Q27 16 25 14 Q22 11.5 18 12 Q14 11.5 11 14 Q9 16 7 22Z"
          fill="#3d1a00"
        />
        {/* Hair highlight */}
        <path
          d="M7 22 Q6 13 9.5 9.5 Q13 6.5 18 7 Q23 6.5 26.5 9.5 Q30 13 29 22 Q27 16 25 14 Q22 11.5 18 12 Q14 11.5 11 14 Q9 16 7 22Z"
          fill="white"
          opacity="0.12"
        />
        {/* Soft wavy sides flowing down — gentle waves */}
        <path d="M7 22 Q6 25 6.5 29 Q8 26.5 8 24 Q7.5 23 7 21.5Z" fill="#3d1a00" />
        <path d="M29 22 Q30 25 29.5 29 Q28 26.5 28 24 Q28.5 23 29 21.5Z" fill="#3d1a00" />
        {/* Gentle wave details */}
        <path d="M7 22 Q6.5 24 7 26 Q7.5 24.5 8 23Q7.5 22.5 7.5 21.5Z" fill="#5c2d0a" />
        <path d="M29 22 Q29.5 24 29 26 Q28.5 24.5 28 23 Q28.5 22.5 28.5 21.5Z" fill="#5c2d0a" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#f5c8a0" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="8.5" ry="9.5" fill="#f5c8a0" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#f5c8a0" />

        {/* Eyes — warm, kind, open */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye */}
          <circle cx="14" cy="20" r="2" fill="#2d0e00" />
          <circle cx="14" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="14.6" cy="19.5" r="0.55" fill="white" />
          {/* Right eye */}
          <circle cx="22" cy="20" r="2" fill="#2d0e00" />
          <circle cx="22" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="22.6" cy="19.5" r="0.55" fill="white" />
        </motion.g>

        {/* Warm upward brows — empathetic, active lift */}
        <motion.g
          animate={{ y: [0, -0.8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M12 17.5 Q14 16.3 16 17" stroke="#2d0e00" strokeWidth="0.9" strokeLinecap="round" fill="none" />
          <path d="M20 17 Q22 16.3 24 17.5" stroke="#2d0e00" strokeWidth="0.9" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#c98a5e" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#c98a5e" opacity="0.5" />

        {/* Warm open smile — bigger pulse, empathetic energy */}
        <motion.g
          animate={{ scaleX: [1, 1.07, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "18px 26px" }}
        >
          <path
            d="M13.5 24.5 Q18 28.5 22.5 24.5"
            stroke="#2d0e00"
            strokeWidth="1.3"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>

        {/* Soft warm blush */}
        <circle cx="11.5" cy="22.5" r="1.8" fill="#f9a8d4" opacity="0.35" />
        <circle cx="24.5" cy="22.5" r="1.8" fill="#f9a8d4" opacity="0.35" />
      </svg>
    </AvatarWrapper>
  );
}
