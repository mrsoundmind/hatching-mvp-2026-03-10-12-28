import { useEffect, useState, useRef, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface EggHatchingAnimationProps {
  onComplete: () => void;
  projectName: string;
  completionTitle?: string;
  completionSubtitle?: string;
}

// Premium cubic-bezier (expo-out feel) used across the sequence.
const EASE = [0.22, 1, 0.36, 1] as const;

// The team, as points of light — a single cohesive blue-violet family (not a
// rainbow), so it reads mature and aligned with the app rather than playful.
const POINTS = ["#AEB9FF", "#C7D0FF", "#9FB0FF", "#BCC4FF", "#A7B4FF", "#CBD3FF"];
const RING_RADIUS = 82;

/**
 * Project-creation moment: a core of light forms, then quietly ignites — the team
 * draws out of it as points of light connected back to the hub, settling into a
 * calm constellation. Restrained, cosmic, premium. ~1.2s, not skippable, and
 * reduced-motion aware.
 */
export function EggHatchingAnimation({
  onComplete,
  projectName,
  completionTitle = "Your team is ready",
}: EggHatchingAnimationProps) {
  const [ignited, setIgnited] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const completedRef = useRef(false);
  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setIgnited(true);
      const t = setTimeout(finish, 650);
      return () => clearTimeout(t);
    }
    const t1 = setTimeout(() => setIgnited(true), 420);
    const t2 = setTimeout(finish, 1250);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [prefersReducedMotion, finish]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "radial-gradient(120% 120% at 50% 42%, #0f1226 0%, #0a0b16 48%, #06070c 100%)" }}
      aria-live="polite"
      aria-label={`Creating ${projectName}`}
    >
      {/* Ambient aurora — restrained */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 720, height: 720, filter: "blur(100px)",
          background: "radial-gradient(circle, rgba(108,130,255,0.15), rgba(159,123,255,0.06) 45%, transparent 70%)",
        }}
        initial={{ opacity: 0.25, scale: 0.92 }}
        animate={{ opacity: ignited ? 0.4 : 0.3, scale: ignited ? 1.05 : 1 }}
        transition={{ duration: 1.2, ease: EASE }}
      />

      {/* Faint stars for depth */}
      {[...Array(16)].map((_, i) => (
        <motion.span
          aria-hidden
          key={i}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${(i * 61) % 100}%`, top: `${(i * 34 + 7) % 100}%`,
            width: 2, height: 2, background: "rgba(255,255,255,0.45)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.4, 0.1] }}
          transition={{ duration: 3, delay: (i % 6) * 0.18, repeat: Infinity, repeatType: "reverse" }}
        />
      ))}

      {/* Constellation stage */}
      <div className="relative flex items-center justify-center" style={{ width: 230, height: 230 }}>
        {/* Single, restrained bloom on ignite */}
        {ignited && (
          <motion.div
            aria-hidden
            className="absolute rounded-full"
            style={{ width: 110, height: 110, border: "1px solid rgba(150,165,255,0.35)" }}
            initial={{ scale: 0.5, opacity: 0.5 }}
            animate={{ scale: 2.8, opacity: 0 }}
            transition={{ duration: 1.1, ease: EASE }}
          />
        )}

        {/* Soft core glow — dialed down */}
        <motion.div
          aria-hidden
          className="absolute rounded-full"
          style={{
            width: 120, height: 120, filter: "blur(34px)",
            background: "radial-gradient(circle, rgba(108,130,255,0.4), rgba(159,123,255,0.16) 55%, transparent 72%)",
          }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [1, 1.05, 1], opacity: ignited ? 0.7 : 0.5 }}
          transition={{ scale: { duration: 3.4, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 1, ease: EASE } }}
        />

        {/* Slowly-rotating ring: connecting lines + team points */}
        <motion.div
          aria-hidden
          className="absolute"
          style={{ width: 0, height: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 40, ease: "linear", repeat: Infinity }}
        >
          {/* Connecting lines (behind the points) */}
          {POINTS.map((_, i) => {
            const angleDeg = -90 + i * (360 / POINTS.length);
            return (
              <motion.div
                key={`line-${i}`}
                className="absolute"
                style={{
                  left: 0, top: 0, height: 1, width: RING_RADIUS,
                  transformOrigin: "0% 50%",
                  background: "linear-gradient(to right, rgba(174,185,255,0.30), rgba(174,185,255,0.02))",
                }}
                initial={{ scaleX: 0, opacity: 0, rotate: angleDeg }}
                animate={ignited ? { scaleX: 1, opacity: 0.45, rotate: angleDeg } : { scaleX: 0, opacity: 0, rotate: angleDeg }}
                transition={{ duration: 0.7, ease: EASE, delay: ignited ? 0.05 * i : 0 }}
              />
            );
          })}
          {/* Team points */}
          {POINTS.map((color, i) => {
            const angle = (-90 + i * (360 / POINTS.length)) * (Math.PI / 180);
            const rx = Math.cos(angle) * RING_RADIUS;
            const ry = Math.sin(angle) * RING_RADIUS;
            return (
              <motion.span
                key={`pt-${i}`}
                className="absolute rounded-full"
                style={{
                  width: 10, height: 10, marginLeft: -5, marginTop: -5,
                  background: color,
                  boxShadow: `0 0 8px ${color}99`,
                }}
                initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                animate={ignited ? { x: rx, y: ry, scale: 1, opacity: 0.92 } : { x: 0, y: 0, scale: 0, opacity: 0 }}
                transition={{ duration: 0.7, ease: EASE, delay: ignited ? 0.05 * i : 0 }}
              />
            );
          })}
        </motion.div>

        {/* The core — a deeper, more refined sphere */}
        <motion.div
          className="relative rounded-full overflow-hidden"
          style={{
            width: 66, height: 66,
            background: "radial-gradient(circle at 36% 30%, #e7ecff 0%, #b7c3ff 24%, #8290ec 54%, #5b5bce 78%, #3b3798 100%)",
            boxShadow: "0 0 34px rgba(108,130,255,0.35), inset 0 2px 7px rgba(255,255,255,0.55), inset 0 -9px 18px rgba(50,40,130,0.55)",
          }}
          initial={{ scale: 0.35, opacity: 0 }}
          animate={{ scale: ignited ? [1, 1.08, 1] : 1, opacity: 1 }}
          transition={{
            scale: ignited ? { duration: 0.7, ease: EASE } : { type: "spring", stiffness: 170, damping: 17 },
            opacity: { duration: 0.4 },
          }}
        >
          <motion.div
            aria-hidden
            className="absolute rounded-full"
            style={{ width: 24, height: 15, top: "15%", left: "17%", background: "rgba(255,255,255,0.7)", filter: "blur(5px)" }}
            animate={{ x: [0, 8, 0], y: [0, 5, 0], opacity: [0.7, 0.42, 0.7] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>

      {/* Name + status */}
      <div className="relative z-10 mt-9 px-6 text-center">
        <motion.h1
          className="text-3xl font-semibold tracking-tight text-white/95 md:text-[2.1rem]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: EASE }}
        >
          {projectName}
        </motion.h1>
        <div className="relative mt-2.5 h-6">
          <motion.p
            className="absolute inset-x-0 text-sm"
            style={{ color: "rgba(150,160,200,0.7)", letterSpacing: "0.01em" }}
            animate={{ opacity: ignited ? 0 : 1, y: ignited ? -6 : 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            Assembling your team…
          </motion.p>
          <motion.p
            className="absolute inset-x-0 text-sm"
            style={{ color: "rgba(205,213,240,0.9)", letterSpacing: "0.01em" }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: ignited ? 1 : 0, y: ignited ? 0 : 6 }}
            transition={{ duration: 0.5, ease: EASE, delay: ignited ? 0.25 : 0 }}
          >
            {completionTitle}
          </motion.p>
        </div>
      </div>
    </div>
  );
}
