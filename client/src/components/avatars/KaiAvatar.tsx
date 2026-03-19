// KaiAvatar — Kai (Growth Marketer) — Energetic, curious. Tousled hair, wide open eyes, big grin
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function KaiAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="kaiBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#16a34a" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#kaiBg)" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#fddcb5" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="9.5" ry="10.5" fill="#d4a870" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#fddcb5" />

        {/* Tousled messy hair — energetic random spikes and volume */}
        <path
          d="M8 16 Q8 9 18 8.5 Q28 9 28 16 Q27 12 24 11 Q21 10 18 10.5 Q15 10 12 11 Q9 12 8 16Z"
          fill="#5c2d0a"
        />
        {/* Hair highlight */}
        <path
          d="M8 16 Q8 9 18 8.5 Q28 9 28 16 Q27 12 24 11 Q21 10 18 10.5 Q15 10 12 11 Q9 12 8 16Z"
          fill="white"
          opacity="0.12"
        />
        {/* Tousled pieces sticking up */}
        <path d="M14 11 Q13 7.5 15 8 Q14.5 9.5 14.5 11Z" fill="#5c2d0a" />
        <path d="M18 10.5 L18 7 L19.5 8.5 L18.5 10.5Z" fill="#5c2d0a" />
        <path d="M21 11 Q22.5 7.5 23.5 8.5 Q22 9.5 21.5 11Z" fill="#5c2d0a" />
        {/* Side swoosh */}
        <path d="M8 16 Q7 14 8.5 12 Q8 14 8.5 15.5Z" fill="#5c2d0a" />

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#d4a870" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#d4a870" opacity="0.5" />

        {/* Eyes — wide open, energetic */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye — wide circle */}
          <circle cx="14" cy="20" r="2" fill="#1a0a00" />
          <circle cx="14" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="14.6" cy="19.5" r="0.55" fill="white" />
          {/* Right eye */}
          <circle cx="22" cy="20" r="2" fill="#1a0a00" />
          <circle cx="22" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="22.6" cy="19.5" r="0.55" fill="white" />
        </motion.g>

        {/* High raised energetic brows — bounce with curiosity */}
        <motion.g
          animate={{ y: [0, -1, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M12 17 Q14 15.8 15.5 16.5" stroke="#1a0a00" strokeWidth="1" strokeLinecap="round" fill="none" />
          <path d="M20.5 16.5 Q22 15.8 24 17" stroke="#1a0a00" strokeWidth="1" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* Big grin — pulses wider with infectious enthusiasm */}
        <motion.g
          animate={{ scaleX: [1, 1.06, 1], y: [0, -0.3, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        >
          <path
            d="M12.5 24 Q18 29.5 23.5 24"
            stroke="#1a0a00"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>

        {/* Cheek rosy circles */}
        <circle cx="11.5" cy="22.5" r="1.8" fill="#f97316" opacity="0.3" />
        <circle cx="24.5" cy="22.5" r="1.8" fill="#f97316" opacity="0.3" />
      </svg>
    </AvatarWrapper>
  );
}
