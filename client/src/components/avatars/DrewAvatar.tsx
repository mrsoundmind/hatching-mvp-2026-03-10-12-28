// DrewAvatar — Drew (Email Specialist) — Warm, precise. Gentle smile, neat hair tucked behind ears
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function DrewAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="drewBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#e07b2a" />
            <stop offset="100%" stopColor="#b45309" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#drewBg)" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#f5c8a0" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="8.5" ry="9.5" fill="#f5c8a0" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#f5c8a0" />

        {/* Medium length hair tucked behind — neat, warm brown */}
        <path
          d="M7 21 Q6.5 12 10 9 Q13 6.5 18 7 Q23 6.5 26 9 Q29.5 12 29 21 Q27 15 25 13 Q22 11 18 11.5 Q14 11 11 13 Q9 15 7 21Z"
          fill="#5c2d0a"
        />
        {/* Hair highlight */}
        <path
          d="M7 21 Q6.5 12 10 9 Q13 6.5 18 7 Q23 6.5 26 9 Q29.5 12 29 21 Q27 15 25 13 Q22 11 18 11.5 Q14 11 11 13 Q9 15 7 21Z"
          fill="white"
          opacity="0.12"
        />
        {/* Hair tucked behind left ear */}
        <path d="M7 21 Q6.5 23 7 26 Q8 24 8.5 22 Q7.5 21.5 7.5 20.5Z" fill="#5c2d0a" />
        {/* Ear peek — left */}
        <ellipse cx="9" cy="21.5" rx="1.2" ry="1.5" fill="#e8a87c" />
        {/* Hair tucked behind right ear */}
        <path d="M29 21 Q29.5 23 29 26 Q28 24 27.5 22 Q28.5 21.5 28.5 20.5Z" fill="#5c2d0a" />
        {/* Ear peek — right */}
        <ellipse cx="27" cy="21.5" rx="1.2" ry="1.5" fill="#e8a87c" />

        {/* Eyes — warm, gentle */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye */}
          <circle cx="14" cy="20" r="2" fill="#3d1c00" />
          <circle cx="14" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="14.6" cy="19.5" r="0.55" fill="white" />
          {/* Right eye */}
          <circle cx="22" cy="20" r="2" fill="#3d1c00" />
          <circle cx="22" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="22.6" cy="19.5" r="0.55" fill="white" />
        </motion.g>

        {/* Soft friendly brows — warm precise, gentle lift */}
        <motion.g
          animate={{ y: [0, -0.5, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M12.5 17.5 Q14 16.8 15.5 17.3" stroke="#3d1c00" strokeWidth="0.9" strokeLinecap="round" fill="none" />
          <path d="M20.5 17.3 Q22 16.8 23.5 17.5" stroke="#3d1c00" strokeWidth="0.9" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#c8906a" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#c8906a" opacity="0.5" />

        {/* Gentle warm smile — subtle pulse */}
        <motion.g
          animate={{ scaleX: [1, 1.05, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "18px 25px" }}
        >
          <path
            d="M14 24.5 Q18 27.5 22 24.5"
            stroke="#3d1c00"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>

        {/* Very subtle warm cheeks */}
        <circle cx="11.5" cy="22.5" r="1.5" fill="#f59e0b" opacity="0.25" />
        <circle cx="24.5" cy="22.5" r="1.5" fill="#f59e0b" opacity="0.25" />
      </svg>
    </AvatarWrapper>
  );
}
