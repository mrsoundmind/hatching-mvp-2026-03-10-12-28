// ZaraAvatar — Zara (Creative Director) — Dramatic, confident. Long wavy hair, bold expression
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function ZaraAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="zaraBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#e066ff" />
            <stop offset="100%" stopColor="#c026d3" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#zaraBg)" />

        {/* Long wavy hair — behind face, flowing down sides */}
        <path
          d="M6 22 Q5 12 9 9 Q12 6.5 18 7 Q24 6.5 27 9 Q31 12 30 22 Q28 16 26 14 Q24 11 21 12 Q19 10.5 18 11 Q17 10.5 15 12 Q12 11 10 14 Q8 16 6 22Z"
          fill="#1a0033"
        />
        {/* Hair highlight */}
        <path
          d="M6 22 Q5 12 9 9 Q12 6.5 18 7 Q24 6.5 27 9 Q31 12 30 22 Q28 16 26 14 Q24 11 21 12 Q19 10.5 18 11 Q17 10.5 15 12 Q12 11 10 14 Q8 16 6 22Z"
          fill="white"
          opacity="0.12"
        />
        {/* Long flowing sides */}
        <path d="M6 22 Q4 26 5 32 Q7 28 8 25 Q7 23 6.5 21Z" fill="#1a0033" />
        <path d="M30 22 Q32 26 31 32 Q29 28 28 25 Q29 23 29.5 21Z" fill="#1a0033" />
        {/* Wavy details on sides */}
        <path d="M6 22 Q5.5 24 6 26 Q7 24.5 7.5 23Z" fill="#2d0050" />
        <path d="M30 22 Q30.5 24 30 26 Q29 24.5 28.5 23Z" fill="#2d0050" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#f5c8a0" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="9.5" ry="10.5" fill="#d4a070" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#f5c8a0" />

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#d4a070" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#d4a070" opacity="0.5" />

        {/* Eyes — bold, wide, dramatic */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye — bold with lash line */}
          <circle cx="14" cy="20" r="2" fill="#0d0020" />
          <circle cx="14" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="14.6" cy="19.5" r="0.55" fill="white" />
          {/* Lash line top */}
          <path d="M11.7 18.5 Q14 17.5 16.3 18.5" stroke="#0d0020" strokeWidth="0.8" fill="none" />
          {/* Right eye */}
          <circle cx="22" cy="20" r="2" fill="#0d0020" />
          <circle cx="22" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="22.6" cy="19.5" r="0.55" fill="white" />
          <path d="M19.7 18.5 Q22 17.5 24.3 18.5" stroke="#0d0020" strokeWidth="0.8" fill="none" />
        </motion.g>

        {/* Dramatic arched brows — pulse upward with confidence */}
        <motion.g
          animate={{ y: [0, -0.8, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M12 17 Q14 15.5 16 16.5" stroke="#0d0020" strokeWidth="1.1" strokeLinecap="round" fill="none" />
          <path d="M20 16.5 Q22 15.5 24 17" stroke="#0d0020" strokeWidth="1.1" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* Bold confident smile — surges with dramatic flair */}
        <motion.g
          animate={{ scaleX: [1, 1.05, 1] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d="M13.5 24.5 Q18 28 22.5 24.5"
            stroke="#0d0020"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>
      </svg>
    </AvatarWrapper>
  );
}
