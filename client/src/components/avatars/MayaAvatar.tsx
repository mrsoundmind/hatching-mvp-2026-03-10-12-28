// MayaAvatar — Maya (AI Idea Partner) — Abstract ethereal AI, not a human face
import { motion } from "framer-motion";
import { AvatarWrapper, AvatarProps } from "./BaseAvatar.js";

// Orbit animation for the 4 dots in thinking state
const orbitVariants = {
  idle: (custom: number) => ({
    x: Math.cos((custom * Math.PI) / 2) * 7,
    y: Math.sin((custom * Math.PI) / 2) * 7,
    opacity: [0.5, 1, 0.5],
    scale: [0.8, 1.1, 0.8],
    transition: {
      opacity: { duration: 2, repeat: Infinity, ease: "easeInOut", delay: custom * 0.4 },
      scale: { duration: 2, repeat: Infinity, ease: "easeInOut", delay: custom * 0.4 },
      x: { duration: 0 },
      y: { duration: 0 },
    },
  }),
  thinking: (custom: number) => ({
    x: Math.cos((custom * Math.PI) / 2) * 7,
    y: Math.sin((custom * Math.PI) / 2) * 7,
    rotate: 360,
    opacity: 1,
    scale: 1,
    transition: {
      rotate: {
        duration: 2,
        repeat: Infinity,
        ease: "linear",
      },
      x: { duration: 0 },
      y: { duration: 0 },
      opacity: { duration: 0.3 },
      scale: { duration: 0.3 },
    },
  }),
  speaking: (custom: number) => ({
    x: Math.cos((custom * Math.PI) / 2) * 7,
    y: Math.sin((custom * Math.PI) / 2) * 7,
    opacity: [0.7, 1, 0.7],
    scale: [1, 1.3, 1],
    transition: {
      opacity: { duration: 0.5, repeat: Infinity, ease: "easeInOut", delay: custom * 0.12 },
      scale: { duration: 0.5, repeat: Infinity, ease: "easeInOut", delay: custom * 0.12 },
      x: { duration: 0 },
      y: { duration: 0 },
    },
  }),
  celebrating: (custom: number) => ({
    x: Math.cos((custom * Math.PI) / 2) * 10,
    y: Math.sin((custom * Math.PI) / 2) * 10,
    opacity: 1,
    scale: 1.3,
    transition: {
      duration: 0.4,
      ease: "easeOut",
    },
  }),
};

// Central orb animation
const orbVariants = {
  idle: {
    scale: [1, 1.05, 1],
    opacity: [0.85, 1, 0.85],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
  },
  thinking: {
    scale: [1, 1.1, 0.95, 1.05, 1],
    opacity: [0.9, 1, 0.8, 1, 0.9],
    transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
  },
  speaking: {
    scale: [1, 1.15, 1],
    opacity: [0.9, 1, 0.9],
    transition: { duration: 0.6, repeat: Infinity, ease: "easeInOut" },
  },
  celebrating: {
    scale: [1, 1.25, 1],
    opacity: 1,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

// Outer glow ring
const glowVariants = {
  idle: {
    opacity: [0.2, 0.4, 0.2],
    scale: [1, 1.08, 1],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
  },
  thinking: {
    opacity: [0.3, 0.6, 0.3],
    scale: [1, 1.15, 1],
    transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
  },
  speaking: {
    opacity: [0.4, 0.7, 0.4],
    scale: [1, 1.12, 1],
    transition: { duration: 0.6, repeat: Infinity, ease: "easeInOut" },
  },
  celebrating: {
    opacity: [0.5, 0.9, 0.5],
    scale: [1, 1.2, 1],
    transition: { duration: 0.4, repeat: Infinity, ease: "easeInOut" },
  },
};

export default function MayaAvatar({ state = "idle", size = 36, className = "" }: AvatarProps) {
  return (
    <AvatarWrapper state={state} size={size} className={className}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Teal gradient background */}
          <linearGradient id="mayaBg" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
          {/* Orb glow gradient */}
          <radialGradient id="mayaOrb" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="50%" stopColor="#a7f3d0" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.4" />
          </radialGradient>
          {/* Glow ring gradient */}
          <radialGradient id="mayaGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#5eead4" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="url(#mayaBg)" />

        {/* Outer glow ring */}
        <motion.circle
          cx="18"
          cy="18"
          r="9"
          fill="url(#mayaGlow)"
          animate={state}
          variants={glowVariants}
        />

        {/* Orbiting dots — 4 dots at 0°, 90°, 180°, 270° starting positions */}
        {/* Dot 0 — right */}
        <motion.circle
          cx="18"
          cy="18"
          r="1.8"
          fill="#a7f3d0"
          custom={0}
          animate={state}
          variants={orbitVariants}
        />
        {/* Dot 1 — bottom */}
        <motion.circle
          cx="18"
          cy="18"
          r="1.5"
          fill="#5eead4"
          custom={1}
          animate={state}
          variants={orbitVariants}
        />
        {/* Dot 2 — left */}
        <motion.circle
          cx="18"
          cy="18"
          r="1.8"
          fill="#a7f3d0"
          custom={2}
          animate={state}
          variants={orbitVariants}
        />
        {/* Dot 3 — top */}
        <motion.circle
          cx="18"
          cy="18"
          r="1.5"
          fill="#ccfbf1"
          custom={3}
          animate={state}
          variants={orbitVariants}
        />

        {/* Central glowing orb */}
        <motion.circle
          cx="18"
          cy="18"
          r="5"
          fill="url(#mayaOrb)"
          animate={state}
          variants={orbVariants}
        />

        {/* Tiny inner core dot */}
        <circle cx="18" cy="17.5" r="1.2" fill="white" opacity="0.9" />
      </svg>
    </AvatarWrapper>
  );
}
