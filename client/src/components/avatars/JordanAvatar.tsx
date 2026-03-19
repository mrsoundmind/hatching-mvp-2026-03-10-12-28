// JordanAvatar — Jordan (Technical Lead) — Confident, opinionated. Short spiky/messy hair, slight smirk
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function JordanAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="jordanBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fdba74" />
            <stop offset="100%" stopColor="#ea6c0a" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#jordanBg)" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#e8a87c" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="9.5" ry="10.5" fill="#b07040" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#e8a87c" />

        {/* Short spiky hair — dark, messy spikes */}
        <path d="M9 15 Q10 9 18 9 Q26 9 27 15 Q25 11 22 11 Q20 10 18 10.5 Q16 10 14 11 Q11 11 9 15Z" fill="#2d1b0e" />
        {/* Hair highlight */}
        <path d="M9 15 Q10 9 18 9 Q26 9 27 15 Q25 11 22 11 Q20 10 18 10.5 Q16 10 14 11 Q11 11 9 15Z" fill="white" opacity="0.12" />
        {/* Spikes */}
        <path d="M12 12 L11 8 L13.5 11.5Z" fill="#2d1b0e" />
        <path d="M16 10.5 L15.5 7 L18 10Z" fill="#2d1b0e" />
        <path d="M20 10 L21 7 L22.5 10.5Z" fill="#2d1b0e" />
        <path d="M24 11.5 L25.5 8.5 L26 12Z" fill="#2d1b0e" />

        {/* Eyes — confident, slightly narrowed */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye */}
          <circle cx="14" cy="20" r="2" fill="#1a0a00" />
          <circle cx="14" cy="20" r="1.2" fill="#0a0400" />
          <circle cx="14.6" cy="19.5" r="0.55" fill="white" />
          {/* Right eye */}
          <circle cx="22" cy="20" r="2" fill="#1a0a00" />
          <circle cx="22" cy="20" r="1.2" fill="#0a0400" />
          <circle cx="22.6" cy="19.5" r="0.55" fill="white" />
        </motion.g>

        {/* Confident brows — assertive occasional inward press, then snap back */}
        <motion.g
          animate={{ y: [0, 0.5, 0] }}
          transition={{ duration: 5, repeat: Infinity, delay: 1.5, ease: "easeInOut" }}
        >
          <path d="M12.5 18 Q14 17 15.5 17.8" stroke="#1a0a00" strokeWidth="1" strokeLinecap="round" fill="none" />
          <path d="M20.5 17.8 Q22 17 23.5 18" stroke="#1a0a00" strokeWidth="1" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#b07040" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#b07040" opacity="0.5" />

        {/* Slight smirk — subtle confident deepen, right side stays higher */}
        <motion.g
          animate={{ scaleX: [1, 1.04, 1] }}
          transition={{ duration: 5, repeat: Infinity, delay: 1.5, ease: "easeInOut" }}
          style={{ transformOrigin: "18px 26px" }}
        >
          <path
            d="M14.5 25.5 Q17 27 21.5 25"
            stroke="#1a0a00"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>
      </svg>
    </AvatarWrapper>
  );
}
