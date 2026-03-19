// VinceAvatar — Vince (Audio Editor) — Creative, rhythmic. Messy artistic hair, headphone arc on top, relaxed expression
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function VinceAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="vinceBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffd84d" />
            <stop offset="100%" stopColor="#eab308" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#vinceBg)" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#f5c8a0" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="8.5" ry="9.5" fill="#f5c8a0" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#f5c8a0" />

        {/* Messy artistic hair */}
        <path
          d="M8 17 Q8 9 18 8.5 Q28 9 28 17 Q26 12 23 11 Q20 10 18 10.5 Q16 10 13 11 Q10 12 8 17Z"
          fill="#3d1c00"
        />
        {/* Hair highlight */}
        <path
          d="M8 17 Q8 9 18 8.5 Q28 9 28 17 Q26 12 23 11 Q20 10 18 10.5 Q16 10 13 11 Q10 12 8 17Z"
          fill="white"
          opacity="0.12"
        />
        {/* Messy sticking up pieces */}
        <path d="M14 11.5 Q13.5 8 15.5 8.5 Q14.5 9.5 14 11Z" fill="#3d1c00" />
        <path d="M19 10.5 Q19.5 7.5 21 8 Q20 9.5 19.5 10.5Z" fill="#3d1c00" />
        <path d="M11 13 Q10 9.5 12 9.5 Q11 11 11 12.5Z" fill="#3d1c00" />
        {/* Side messy piece */}
        <path d="M8 17 Q7 15 7.5 12.5 Q8 14 8.5 16Z" fill="#3d1c00" />

        {/* Headphone arc — curved line over top of head */}
        <path
          d="M8 18 Q8 6 18 6 Q28 6 28 18"
          stroke="#1a0800"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Left earpiece */}
        <rect x="6" y="17" width="3.5" height="4.5" rx="1" fill="#1a0800" />
        {/* Right earpiece */}
        <rect x="26.5" y="17" width="3.5" height="4.5" rx="1" fill="#1a0800" />

        {/* Eyes — relaxed, calm creative expression */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye — slightly relaxed */}
          <ellipse cx="14" cy="20" rx="2" ry="1.8" fill="#1a0800" />
          <ellipse cx="14" cy="20" rx="1.2" ry="1.08" fill="#0a0a0a" />
          <circle cx="14.6" cy="19.5" r="0.55" fill="white" />
          {/* Right eye */}
          <ellipse cx="22" cy="20" rx="2" ry="1.8" fill="#1a0800" />
          <ellipse cx="22" cy="20" rx="1.2" ry="1.08" fill="#0a0a0a" />
          <circle cx="22.6" cy="19.5" r="0.55" fill="white" />
        </motion.g>

        {/* Relaxed, casual brows — rhythmic creative movement */}
        <motion.g
          animate={{ y: [0, -0.7, 0.1, -0.9, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M12.5 17.8 Q14 17.2 15.5 17.6" stroke="#1a0800" strokeWidth="0.85" strokeLinecap="round" fill="none" />
          <path d="M20.5 17.6 Q22 17.2 23.5 17.8" stroke="#1a0800" strokeWidth="0.85" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#c98a5e" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#c98a5e" opacity="0.5" />

        {/* Relaxed easy smile — in the groove, lively pulse */}
        <motion.g
          animate={{ scaleX: [1, 1.06, 1, 1.08, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "18px 26px" }}
        >
          <path
            d="M14.5 25 Q18 27.5 21.5 25"
            stroke="#1a0800"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>
      </svg>
    </AvatarWrapper>
  );
}
