// QuinnAvatar — Quinn (Operations Manager) — Calm, methodical. Very neat short hair, composed neutral expression
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function QuinnAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="quinnBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#718096" />
            <stop offset="100%" stopColor="#475569" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#quinnBg)" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#e8a87c" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="8.5" ry="9.5" fill="#e8a87c" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#e8a87c" />

        {/* Very neat, short, perfectly trimmed hair */}
        <path
          d="M10 15.5 Q10.5 9.5 18 9.5 Q25.5 9.5 26 15.5 Q25 12 22.5 11.5 Q20 11 18 11 Q16 11 13.5 11.5 Q11 12 10 15.5Z"
          fill="#1c0f00"
        />
        {/* Hair highlight */}
        <path
          d="M10 15.5 Q10.5 9.5 18 9.5 Q25.5 9.5 26 15.5 Q25 12 22.5 11.5 Q20 11 18 11 Q16 11 13.5 11.5 Q11 12 10 15.5Z"
          fill="white"
          opacity="0.12"
        />
        {/* Clean even hairline — very precise */}
        <path d="M10 15.5 Q10.5 13 12.5 12 Q11 13.5 10.5 15Z" fill="#1c0f00" />
        <path d="M26 15.5 Q25.5 13 23.5 12 Q25 13.5 25.5 15Z" fill="#1c0f00" />

        {/* Eyes — calm, steady, composed */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye */}
          <circle cx="14" cy="20" r="1.9" fill="#100800" />
          <circle cx="14" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="14.6" cy="19.5" r="0.55" fill="white" />
          {/* Right eye */}
          <circle cx="22" cy="20" r="1.9" fill="#100800" />
          <circle cx="22" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="22.6" cy="19.5" r="0.55" fill="white" />
        </motion.g>

        {/* Very level even brows — slow, minimal drift */}
        <motion.g
          animate={{ y: [0, -0.3, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M12.5 17.8 L15.5 17.8" stroke="#100800" strokeWidth="0.95" strokeLinecap="round" fill="none" />
          <path d="M20.5 17.8 L23.5 17.8" stroke="#100800" strokeWidth="0.95" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#b07850" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#b07850" opacity="0.5" />

        {/* Composed neutral expression — very slow, very subtle */}
        <motion.g
          animate={{ scaleX: [1, 1.02, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "18px 25.75px" }}
        >
          <path
            d="M15.5 25.5 Q18 26 20.5 25.5"
            stroke="#100800"
            strokeWidth="1"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>
      </svg>
    </AvatarWrapper>
  );
}
