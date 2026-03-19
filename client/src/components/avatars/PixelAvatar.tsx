// PixelAvatar — Pixel (Social Media Manager) — Vibrant, trendy. Short stylish hair with color accent
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function PixelAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="pixelBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#pixelBg)" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#e8a87c" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="9.5" ry="10.5" fill="#c07040" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#e8a87c" />

        {/* Short stylish hair base */}
        <path
          d="M9 15.5 Q10 9 18 9 Q26 9 27 15.5 Q25 11 22 10.5 Q19 10 18 10.5 Q17 10 14 10.5 Q11 11 9 15.5Z"
          fill="#1a0a00"
        />
        {/* Hair highlight */}
        <path
          d="M9 15.5 Q10 9 18 9 Q26 9 27 15.5 Q25 11 22 10.5 Q19 10 18 10.5 Q17 10 14 10.5 Q11 11 9 15.5Z"
          fill="white"
          opacity="0.12"
        />
        {/* Styled front sweep — trendy angled fringe */}
        <path d="M9 15.5 Q10 12 13 11.5 Q11 13.5 10 15Z" fill="#1a0a00" />
        <path d="M13 11.5 Q15.5 10.5 18 10.5 Q16 11 14 12Z" fill="#1a0a00" />
        {/* Color accent — bright highlight on right side of hair */}
        <path d="M22 10.5 Q24.5 10.5 26 12.5 Q24 10.5 22.5 10.5Z" fill="#38bdf8" />
        <path d="M24 11 Q25.5 11.5 26.5 13 Q25 11.5 24 11Z" fill="#38bdf8" />

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#c07040" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#c07040" opacity="0.5" />

        {/* Eyes — lively, trendy */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye */}
          <circle cx="14" cy="20" r="2" fill="#0a1a2e" />
          <circle cx="14" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="14.6" cy="19.5" r="0.55" fill="white" />
          {/* Right eye */}
          <circle cx="22" cy="20" r="2" fill="#0a1a2e" />
          <circle cx="22" cy="20" r="1.2" fill="#0a0a0a" />
          <circle cx="22.6" cy="19.5" r="0.55" fill="white" />
        </motion.g>

        {/* Stylish slightly arched brows — precise, analytical tilt */}
        <motion.g
          animate={{ y: [0, -0.5, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        >
          <path d="M12 17.5 Q14 16.5 15.5 17.2" stroke="#0a1a2e" strokeWidth="0.95" strokeLinecap="round" fill="none" />
          <path d="M20.5 17.2 Q22 16.5 24 17.5" stroke="#0a1a2e" strokeWidth="0.95" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* Trendy upbeat smile — slight asymmetric press, focused */}
        <motion.g
          animate={{ x: [0, 0.3, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d="M14 24.5 Q18 28 22 24.5"
            stroke="#0a1a2e"
            strokeWidth="1.3"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>
      </svg>
    </AvatarWrapper>
  );
}
