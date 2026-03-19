// BlakeAvatar — Blake (Business Strategist) — Strategic, composed. Professional hair, chin tilt, confident look
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function BlakeAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="blakeBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#4d7de8" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#blakeBg)" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#fddcb5" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="8.5" ry="9.5" fill="#fddcb5" opacity="0.25" />

        {/* Face — slightly higher to suggest confident chin tilt */}
        <ellipse cx="18" cy="20.5" rx="9" ry="10" fill="#fddcb5" />

        {/* Professional swept-back hair */}
        <path
          d="M9 15 Q9.5 8.5 18 8.5 Q26.5 8.5 27 15 Q25 10.5 22 10 Q19 9.5 18 10 Q15 9.5 12 10.5 Q10 11.5 9 15Z"
          fill="#2d1b0e"
        />
        {/* Hair highlight */}
        <path
          d="M9 15 Q9.5 8.5 18 8.5 Q26.5 8.5 27 15 Q25 10.5 22 10 Q19 9.5 18 10 Q15 9.5 12 10.5 Q10 11.5 9 15Z"
          fill="white"
          opacity="0.12"
        />
        {/* Clean professional sides */}
        <path d="M9 15 Q9 12 10.5 10.5 Q9.5 12.5 9.5 14.5Z" fill="#2d1b0e" />
        <path d="M27 15 Q27 12 25.5 10.5 Q26.5 12.5 26.5 14.5Z" fill="#2d1b0e" />

        {/* Eyes — confident, direct gaze */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye */}
          <circle cx="14" cy="19.5" r="2" fill="#1a0a00" />
          <circle cx="14" cy="19.5" r="1.2" fill="#0a0a0a" />
          <circle cx="14.6" cy="19" r="0.55" fill="white" />
          {/* Right eye */}
          <circle cx="22" cy="19.5" r="2" fill="#1a0a00" />
          <circle cx="22" cy="19.5" r="1.2" fill="#0a0a0a" />
          <circle cx="22.6" cy="19" r="0.55" fill="white" />
        </motion.g>

        {/* Confident brows — barely move, steady and assured */}
        <motion.g
          animate={{ y: [0, -0.25, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M12.5 17.3 Q14 16.8 15.5 17.2" stroke="#1a0a00" strokeWidth="1" strokeLinecap="round" fill="none" />
          <path d="M20.5 17.2 Q22 16.8 23.5 17.3" stroke="#1a0a00" strokeWidth="1" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#c8a080" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#c8a080" opacity="0.5" />

        {/* Confident slight smile — slow, deliberate pulse */}
        <motion.g
          animate={{ scaleX: [1, 1.04, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "18px 26px" }}
        >
          <path
            d="M14.5 25 Q18 27 21.5 25"
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
