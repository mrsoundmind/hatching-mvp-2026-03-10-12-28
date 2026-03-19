// DevAvatar — Dev (Backend) — Slightly tired, neutral expression, stubble
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function DevAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="devBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffb07a" />
            <stop offset="100%" stopColor="#f97316" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#devBg)" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#e8b89a" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="9.5" ry="10.5" fill="#b07840" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#e8b89a" />

        {/* Messy/short dark hair — irregular cap */}
        <path
          d="M9 16 Q9 8 18 8 Q27 8 27 16 Q25 13 22 13.5 Q20 12 18 12.5 Q16 12 13 13.5 Q11 13 9 16Z"
          fill="#1c1008"
        />

        {/* Hair highlight — subtle shine on top */}
        <path
          d="M11 13 Q14 10 20 11 Q22 10.5 24 12 Q20 10 18 10.5 Q14 10 11 13Z"
          fill="white"
          opacity="0.12"
        />

        {/* Eyes — slightly flat top (tired ellipses) */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye */}
          <ellipse cx="14" cy="20.5" rx="2" ry="1.6" fill="#1c1008" />
          <ellipse cx="14" cy="20.5" rx="1.2" ry="1.0" fill="#0a0400" />
          {/* Flat top lid line left */}
          <path d="M12 19.8 Q14 19 16 19.8" stroke="#1c1008" strokeWidth="0.7" fill="none" />
          <circle cx="14.6" cy="20.0" r="0.55" fill="white" />

          {/* Right eye */}
          <ellipse cx="22" cy="20.5" rx="2" ry="1.6" fill="#1c1008" />
          <ellipse cx="22" cy="20.5" rx="1.2" ry="1.0" fill="#0a0400" />
          {/* Flat top lid line right */}
          <path d="M20 19.8 Q22 19 24 19.8" stroke="#1c1008" strokeWidth="0.7" fill="none" />
          <circle cx="22.6" cy="20.0" r="0.55" fill="white" />
        </motion.g>

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#b07840" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#b07840" opacity="0.5" />

        {/* Flat neutral mouth — barely moves (very slight tired drift) */}
        <motion.g
          animate={{ y: [0, 0.3, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d="M14.5 25.5 Q18 25.8 21.5 25.5"
            stroke="#1c1008"
            strokeWidth="1.1"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>

        {/* Stubble dots below mouth */}
        <circle cx="16" cy="27" r="0.45" fill="#a87850" opacity="0.7" />
        <circle cx="18" cy="27.4" r="0.45" fill="#a87850" opacity="0.7" />
        <circle cx="20" cy="27" r="0.45" fill="#a87850" opacity="0.7" />

        {/* Flat brows — right brow occasionally droops lower (tired) */}
        <path d="M12.5 18 Q14 17.5 15.5 18" stroke="#1c1008" strokeWidth="0.9" strokeLinecap="round" fill="none" />
        <motion.g
          animate={{ y: [0, 0.4, 0] }}
          transition={{ duration: 6, repeat: Infinity, delay: 1, ease: "easeInOut" }}
        >
          <path d="M20.5 18 Q22 17.5 23.5 18" stroke="#1c1008" strokeWidth="0.9" strokeLinecap="round" fill="none" />
        </motion.g>
      </svg>
    </AvatarWrapper>
  );
}
