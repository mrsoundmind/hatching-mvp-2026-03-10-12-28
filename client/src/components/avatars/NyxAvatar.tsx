// NyxAvatar — Nyx (AI Developer) — Avant-garde, abstract. Angular hair, one-sided, cool expression
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps, eyeThinkingVariants } from "./BaseAvatar.js";

export default function NyxAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="nyxBg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#7c3aed" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#nyxBg)" />

        {/* Neck */}
        <rect x="15" y="27" width="6" height="4" rx="1" fill="#c97b4b" />

        {/* Face shadow */}
        <ellipse cx="18" cy="21.5" rx="9.5" ry="10.5" fill="#8a4a20" opacity="0.25" />

        {/* Face */}
        <ellipse cx="18" cy="21" rx="9" ry="10" fill="#c97b4b" />

        {/* Angular asymmetric hair — sharp geometric cut, swept left */}
        <path
          d="M27 15 L26 9 L20 8 L12 9 L9 11 L8 17 Q10 12 14 11.5 Q18 10.5 22 11 Q25 11.5 27 15Z"
          fill="#1a0033"
        />
        {/* Hair highlight */}
        <path
          d="M27 15 L26 9 L20 8 L12 9 L9 11 L8 17 Q10 12 14 11.5 Q18 10.5 22 11 Q25 11.5 27 15Z"
          fill="white"
          opacity="0.12"
        />
        {/* Sharp angled right side — angular cut */}
        <path d="M27 15 L28 12 L26 9Z" fill="#1a0033" />
        {/* Left side longer angular sweep */}
        <path d="M8 17 Q7 19 7 22 Q8 20 9 18Z" fill="#1a0033" />
        {/* Accent stripe — lighter purple highlight on right side */}
        <path d="M22 11 Q25 10.5 27 13 Q25.5 10.5 23 10.5Z" fill="#6d28d9" />

        {/* Eyes — cool, slightly asymmetric. Left eye slightly narrower */}
        <motion.g animate={state} variants={eyeThinkingVariants}>
          {/* Left eye — narrower, more aloof */}
          <circle cx="14" cy="20" r="2" fill="#0d0020" />
          <circle cx="14" cy="20" r="1.2" fill="#060010" />
          <circle cx="14.6" cy="19.5" r="0.55" fill="white" />
          {/* Right eye — more open */}
          <circle cx="22" cy="20" r="2" fill="#0d0020" />
          <circle cx="22" cy="20" r="1.2" fill="#060010" />
          <circle cx="22.6" cy="19.5" r="0.55" fill="white" />
        </motion.g>

        {/* Left brow — stays still, cool detachment (no animation — asymmetry preserved) */}
        <path d="M12.5 18.2 Q14 17.5 15.5 18" stroke="#0d0020" strokeWidth="0.8" strokeLinecap="round" fill="none" />

        {/* Right brow — only this one animates: subtle abstract arch, infrequent */}
        <motion.g
          animate={{ y: [0, -0.5, 0] }}
          transition={{ duration: 8, repeat: Infinity, delay: 4, ease: "easeInOut" }}
        >
          <path d="M20.5 17.5 Q22 16.5 24 17.2" stroke="#0d0020" strokeWidth="0.8" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* Nose dots */}
        <ellipse cx="16.8" cy="22.5" rx="0.5" ry="0.4" fill="#8a4a20" opacity="0.5" />
        <ellipse cx="19.2" cy="22.5" rx="0.5" ry="0.4" fill="#8a4a20" opacity="0.5" />

        {/* Cool composed mouth — abstract minimal pulse */}
        <motion.g
          animate={{ scaleX: [1, 1.03, 1] }}
          transition={{ duration: 9, repeat: Infinity, delay: 2 }}
          style={{ transformOrigin: "18px 25.5px" }}
        >
          <path
            d="M15 25.5 Q18 25.8 21 25.2"
            stroke="#0d0020"
            strokeWidth="1"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>
      </svg>
    </AvatarWrapper>
  );
}
