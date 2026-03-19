// MorganAvatar — Morgan (Business Analyst) — Methodical, neutral. Neat side-parted hair, calm expression
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function MorganAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="morganBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#1e40af" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#morganBg)" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#fddcb5" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="9.5" ry="10.5" fill="#c4a080" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#fddcb5" />

        {/* Neat side-parted hair — dark, combed to the right */}
        <path
          d="M9 16 Q9.5 9 18 9 Q26.5 9 27 17 Q26 13 23 12 Q20 11 17 11.5 Q14 12 11.5 13.5 Q10 14.5 9 16Z"
          fill="#1a1008"
        />
        {/* Hair highlight */}
        <path
          d="M9 16 Q9.5 9 18 9 Q26.5 9 27 17 Q26 13 23 12 Q20 11 17 11.5 Q14 12 11.5 13.5 Q10 14.5 9 16Z"
          fill="white"
          opacity="0.12"
        />
        {/* Side part line — left sweep */}
        <path d="M9 16 Q10 13 12 12 Q10 14.5 9.5 17Z" fill="#1a1008" />
        {/* Part — the right sweep is thicker */}
        <path d="M12.5 11 Q16 10.5 18 11 Q17 10 15 10.5Z" fill="#2d1b0e" />

        {/* Eyes — calm, neutral ovals */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye */}
          <circle cx="14" cy="20" r="2" fill="#1a1008" />
          <circle cx="14" cy="20" r="1.2" fill="#0a0804" />
          <circle cx="14.6" cy="19.5" r="0.55" fill="white" />
          {/* Right eye */}
          <circle cx="22" cy="20" r="2" fill="#1a1008" />
          <circle cx="22" cy="20" r="1.2" fill="#0a0804" />
          <circle cx="22.6" cy="19.5" r="0.55" fill="white" />
        </motion.g>

        {/* Flat neutral brows — very slight occasional raise, methodical rhythm */}
        <motion.g
          animate={{ y: [0, -0.3, 0] }}
          transition={{ duration: 7, repeat: Infinity, delay: 2 }}
        >
          <path d="M12.5 17.8 L15.5 17.5" stroke="#1a1008" strokeWidth="0.9" strokeLinecap="round" fill="none" />
          <path d="M20.5 17.5 L23.5 17.8" stroke="#1a1008" strokeWidth="0.9" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#c4a080" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#c4a080" opacity="0.5" />

        {/* Calm neutral mouth — barely moves */}
        <motion.g
          animate={{ scaleX: [1, 1.01, 1] }}
          transition={{ duration: 8, repeat: Infinity }}
          style={{ transformOrigin: "18px 26px" }}
        >
          <path
            d="M15 25.5 Q18 26.5 21 25.5"
            stroke="#1a1008"
            strokeWidth="1.1"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>
      </svg>
    </AvatarWrapper>
  );
}
