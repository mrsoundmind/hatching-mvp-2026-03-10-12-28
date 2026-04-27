"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useMotionTemplate } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Tick01Icon,
  FlashIcon,
  Search01Icon,
  Settings02Icon,
  Chart01Icon,
  CpuIcon,
  CodeIcon,
  PaintBoardIcon,
  BulbIcon,
  Target01Icon,
  Megaphone01Icon,
  AnalyticsUpIcon,
  Mail01Icon,
  PencilEdit01Icon,
  StarCircleIcon,
  Shield01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

const notionistAvatar = (seed: string) =>
  `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=fef3c7,fed7aa,fde68a,fee2e2,e0e7ff,dbeafe,dcfce7&radius=50`;

// ─── FEATURES ───────────────────────────────────────────────────────
const FEATURES = [
  { label: "Real conversations", title: "They think. They push back.", description: "AI teammates with genuine expertise. Maya challenges your strategy. Drew architects the solution. Zara obsesses over every pixel.", color: "#d946ef", glow: "rgba(217,70,239,0.12)" },
  { label: "30 specialists", title: "Every role you need. Already hired.", description: "PM, engineer, designer, data analyst, copywriter, growth marketer — 30 deep specialists with domain expertise and unique voices.", color: "#f97316", glow: "rgba(249,115,22,0.12)" },
  { label: "Autonomous execution", title: "They keep building while you sleep.", description: "Your team divides the work, reviews each other's output, and ships. Wake up to progress you didn't expect.", color: "#10b981", glow: "rgba(16,185,129,0.12)" },
  { label: "Shared memory", title: "Tell them once. They all remember.", description: "Your brand, past decisions, direction — every teammate stays in sync through a shared project brain. Zero context lost.", color: "#6366f1", glow: "rgba(99,102,241,0.12)" },
  { label: "Smart detection", title: "Chat becomes action. Automatically.", description: "Tasks detected from conversation, assigned to the right specialist, tracked — without you lifting a finger.", color: "#f59e0b", glow: "rgba(245,158,11,0.12)" },
];

// ─── GLASS PANEL WRAPPER ────────────────────────────────────────────
const GlassPanel = ({ children, glowColor, borderColor }: { children: React.ReactNode; glowColor: string; borderColor: string }) => (
  <div className="relative h-full rounded-2xl overflow-hidden">
    {/* Outer glow */}
    <div className="absolute -inset-[1px] rounded-2xl opacity-60" style={{ background: `linear-gradient(135deg, ${borderColor}30, transparent 40%, ${borderColor}15)` }} />
    {/* Glass body */}
    <div className="relative h-full rounded-2xl border border-white/[0.08] overflow-hidden" style={{ background: 'rgba(10,12,18,0.85)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}>
      {/* Inner glass shimmer */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(255,255,255,0.01) 100%)' }} />
      {/* Corner glow orb */}
      <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full pointer-events-none blur-3xl opacity-40" style={{ background: glowColor }} />
      <div className="absolute -bottom-16 -left-16 w-32 h-32 rounded-full pointer-events-none blur-3xl opacity-20" style={{ background: glowColor }} />
      <div className="relative h-full z-10">
        {children}
      </div>
    </div>
  </div>
);

// ─── DEMO 1: LIVE CHAT ─────────────────────────────────────────────
const CHAT_MSGS = [
  { agent: "Maya", color: "#d946ef", text: "Your target audience is too broad. Let's narrow to solo founders shipping their first product." },
  { agent: "user", color: "", text: "What about the MVP scope?" },
  { agent: "Drew", color: "#3b82f6", text: "I'll cut it to that persona — halves the initial build. I can start on the architecture tonight." },
  { agent: "Zara", color: "#10b981", text: "3 landing page directions ready by tomorrow. Bold, clean, conversion-first." },
];

const ChatDemo = ({ active }: { active: boolean }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) { setCount(0); return; }
    setCount(1);
  }, [active]);

  useEffect(() => {
    if (!active || count === 0 || count >= CHAT_MSGS.length) return;
    const t = setTimeout(() => setCount((c) => c + 1), 1600);
    return () => clearTimeout(t);
  }, [active, count]);

  return (
    <GlassPanel glowColor="rgba(217,70,239,0.15)" borderColor="#d946ef">
      <div className="h-full flex flex-col">
        {/* Chrome bar */}
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2.5 shrink-0 bg-white/[0.02]">
          <div className="flex gap-1.5">
            <div className="w-[9px] h-[9px] rounded-full bg-[#ff5f57]" />
            <div className="w-[9px] h-[9px] rounded-full bg-[#febc2e]" />
            <div className="w-[9px] h-[9px] rounded-full bg-[#28c840]" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-4 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <span className="text-[9px] text-white/25 tracking-wider">hatchin.ai / project-chat</span>
            </div>
          </div>
          <div className="flex gap-2">
            {[{ n: "Maya", c: "#d946ef" }, { n: "Drew", c: "#3b82f6" }, { n: "Zara", c: "#10b981" }].map((a) => (
              <motion.div
                key={a.n}
                className="w-6 h-6 rounded-full overflow-hidden"
                style={{ border: `1px solid ${a.c}35`, boxShadow: `0 0 12px ${a.c}15` }}
                animate={active ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 2, delay: Math.random(), repeat: Infinity }}
              >
                <img src={notionistAvatar(a.n)} alt={a.n} className="w-full h-full" />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-5 space-y-4 overflow-hidden">
          <AnimatePresence initial={false}>
            {CHAT_MSGS.slice(0, count).map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ type: "spring", stiffness: 250, damping: 24, delay: 0.05 }}
                className={cn("flex", msg.agent === "user" ? "justify-end" : "justify-start")}
              >
                {msg.agent === "user" ? (
                  <div className="max-w-[72%] px-4 py-3 rounded-2xl rounded-tr-sm" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)' }}>
                    <p className="text-[13px] text-white/80 leading-relaxed">{msg.text}</p>
                  </div>
                ) : (
                  <div className="max-w-[85%] flex gap-2.5">
                    <motion.div
                      className="w-7 h-7 rounded-full overflow-hidden shrink-0 mt-0.5"
                      style={{ border: `1px solid ${msg.color}30`, boxShadow: `0 0 15px ${msg.color}10` }}
                    >
                      <img src={notionistAvatar(msg.agent)} alt={msg.agent} className="w-full h-full" />
                    </motion.div>
                    <div className="flex-1">
                      <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: msg.color + "80" }}>{msg.agent}</span>
                      <div className="mt-1 p-3 rounded-xl rounded-tl-sm" style={{ background: `linear-gradient(135deg, ${msg.color}08, ${msg.color}03)`, border: `1px solid ${msg.color}12` }}>
                        <p className="text-[13px] text-white/55 leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {active && count > 0 && count < CHAT_MSGS.length && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5 items-center">
              <div className="w-7 h-7 rounded-full overflow-hidden" style={{ border: `1px solid ${CHAT_MSGS[count].color}30` }}>
                <img src={notionistAvatar(CHAT_MSGS[count].agent === "user" ? "You" : CHAT_MSGS[count].agent)} alt="" className="w-full h-full" />
              </div>
              <div className="flex gap-1.5 p-2 px-3 rounded-full" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {[0, 1, 2].map((d) => (
                  <motion.span key={d} className="w-[5px] h-[5px] rounded-full bg-white/30" animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }} transition={{ duration: 1.2, delay: d * 0.15, repeat: Infinity }} />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </GlassPanel>
  );
};

// ─── DEMO 2: ROLES LENS ────────────────────────────────────────────
const ROLE_ROWS = [
  [{ id: "pm", icon: Target01Icon, label: "Product Manager" }, { id: "eng", icon: CodeIcon, label: "Engineer" }, { id: "design", icon: PaintBoardIcon, label: "Designer" }, { id: "qa", icon: Shield01Icon, label: "QA Lead" }, { id: "data", icon: Chart01Icon, label: "Data Analyst" }],
  [{ id: "copy", icon: PencilEdit01Icon, label: "Copywriter" }, { id: "growth", icon: AnalyticsUpIcon, label: "Growth" }, { id: "brand", icon: StarCircleIcon, label: "Brand" }, { id: "devops", icon: CpuIcon, label: "DevOps" }, { id: "ops", icon: Settings02Icon, label: "Operations" }],
  [{ id: "ux", icon: BulbIcon, label: "UX Designer" }, { id: "social", icon: Megaphone01Icon, label: "Social Media" }, { id: "email", icon: Mail01Icon, label: "Email" }, { id: "ai", icon: FlashIcon, label: "AI Developer" }, { id: "seo", icon: Search01Icon, label: "SEO" }],
];

const RolesDemo = ({ active }: { active: boolean }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lensX = useMotionValue(0);
  const lensY = useMotionValue(0);

  // Clip/mask anchored to lens center — using pixel values relative to container center
  const clipPath = useMotionTemplate`circle(36px at calc(50% + ${lensX}px) calc(50% + ${lensY}px))`;
  const inverseMask = useMotionTemplate`radial-gradient(circle 36px at calc(50% + ${lensX}px) calc(50% + ${lensY}px), transparent 100%, black 100%)`;

  useEffect(() => {
    if (!active) { lensX.set(0); lensY.set(0); return; }
    let frame: number, t = 0;
    const drift = () => { t += 0.005; lensX.set(Math.sin(t * 1.1) * 80); lensY.set(Math.cos(t * 0.7) * 40); frame = requestAnimationFrame(drift); };
    frame = requestAnimationFrame(drift);
    return () => cancelAnimationFrame(frame);
  }, [active, lensX, lensY]);

  const renderRows = (reveal: boolean) =>
    ROLE_ROWS.map((row, ri) => (
      <motion.div key={`${reveal ? "r" : "b"}-${ri}`} className="flex gap-3 w-max" animate={{ x: ri % 2 === 0 ? ["0%", "-33.333%"] : ["-33.333%", "0%"] }} transition={{ duration: 20, ease: "linear", repeat: Infinity }}>
        {[...row, ...row, ...row].map((item, idx) => (
          <div key={`${item.id}-${idx}`} className={cn("flex gap-2 whitespace-nowrap py-2.5 px-4 items-center rounded-full text-[11px]", reveal ? "text-orange-300 font-medium scale-110" : "text-white/15")} style={reveal ? { background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))', border: '1px solid rgba(249,115,22,0.25)', boxShadow: '0 0 20px rgba(249,115,22,0.08)' } : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <HugeiconsIcon icon={item.icon} size={13} className={reveal ? "text-orange-400" : ""} />
            <span>{item.label}</span>
          </div>
        ))}
      </motion.div>
    ));

  return (
    <GlassPanel glowColor="rgba(249,115,22,0.12)" borderColor="#f97316">
      <div ref={containerRef} className="h-full relative overflow-hidden flex flex-col justify-center">
        {/* Base layer (masked out where lens is) */}
        <motion.div style={{ WebkitMaskImage: inverseMask, maskImage: inverseMask }} className="flex flex-col gap-4 w-full justify-center py-8">{renderRows(false)}</motion.div>
        {/* Reveal layer (only visible inside lens circle) */}
        <motion.div className="absolute inset-0 flex flex-col gap-4 justify-center pointer-events-none z-10 py-8" style={{ clipPath }}>{renderRows(true)}</motion.div>

        {/* Lens ring — positioned from center using motion x/y */}
        <motion.div
          className="absolute z-40 pointer-events-none"
          style={{ left: "calc(50% - 40px)", top: "calc(50% - 40px)", x: lensX, y: lensY }}
        >
          <div className="w-[80px] h-[80px] rounded-full" style={{ border: '2px solid rgba(249,115,22,0.3)', boxShadow: '0 0 40px rgba(249,115,22,0.12), 0 0 80px rgba(249,115,22,0.06), inset 0 0 30px rgba(249,115,22,0.05)' }} />
        </motion.div>

        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/5 z-20" style={{ background: 'linear-gradient(to right, rgba(10,12,18,0.95), transparent)' }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/5 z-20" style={{ background: 'linear-gradient(to left, rgba(10,12,18,0.95), transparent)' }} />
      </div>
    </GlassPanel>
  );
};

// ─── DEMO 3: AUTONOMOUS ─────────────────────────────────────────────
const TIMELINE = [
  { agent: "Maya", color: "#d946ef", text: "Drafted the product brief", time: "2m ago" },
  { agent: "Drew", color: "#3b82f6", text: "Started API architecture", time: "8m ago" },
  { agent: "Zara", color: "#10b981", text: "Created 3 mockup directions", time: "14m ago" },
  { agent: "Maya", color: "#d946ef", text: "Reviewing Drew's architecture", time: "now" },
];

const AutonomousDemo = ({ active }: { active: boolean }) => {
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setHighlight((h) => (h + 1) % TIMELINE.length), 2200);
    return () => clearInterval(t);
  }, [active]);

  return (
    <GlassPanel glowColor="rgba(16,185,129,0.15)" borderColor="#10b981">
      <div className="h-full flex flex-col p-5 sm:p-6">
        {/* Status bar */}
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/[0.06] shrink-0">
          <div className="relative">
            <motion.div className="w-2.5 h-2.5 rounded-full bg-emerald-400" animate={{ boxShadow: ["0 0 0px rgba(52,211,153,0.4)", "0 0 15px rgba(52,211,153,0.6)", "0 0 0px rgba(52,211,153,0.4)"] }} transition={{ duration: 2, repeat: Infinity }} />
          </div>
          <span className="text-[12px] text-emerald-400/90 font-medium">Team is working</span>
          <div className="ml-auto px-2.5 py-1 rounded-full" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
            <span className="text-[9px] text-emerald-400/50 font-medium">4 tasks in progress</span>
          </div>
        </div>

        <div className="flex-1 space-y-0.5 overflow-hidden">
          {TIMELINE.map((item, i) => (
            <motion.div
              key={i}
              animate={{ opacity: i === highlight ? 1 : 0.25 }}
              transition={{ duration: 0.5 }}
              className="flex items-start gap-3 py-3 px-3 rounded-xl relative border"
              style={{ background: i === highlight ? `linear-gradient(135deg, ${item.color}08, transparent)` : 'transparent', borderColor: i === highlight ? `${item.color}18` : 'transparent' }}
            >
              {i < TIMELINE.length - 1 && (
                <div className="absolute left-[23px] top-[40px] w-[1px] h-[calc(100%-12px)]" style={{ background: `linear-gradient(to bottom, ${item.color}20, transparent)` }} />
              )}
              <div className="relative shrink-0 mt-0.5">
                <div className="w-7 h-7 rounded-full overflow-hidden" style={{ border: `1px solid ${item.color}30`, boxShadow: `0 0 12px ${item.color}10` }}>
                  <img src={notionistAvatar(item.agent)} alt={item.agent} className="w-full h-full" />
                </div>
                {i === TIMELINE.length - 1 ? (
                  <motion.div
                    className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                    style={{ background: item.color, boxShadow: `0 0 0 1.5px #0A0C13` }}
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                ) : (
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center"
                    style={{ background: item.color, boxShadow: `0 0 0 1.5px #0A0C13` }}
                  >
                    <HugeiconsIcon icon={Tick01Icon} size={7} className="text-white" />
                  </div>
                )}
                {i === highlight && (
                  <motion.div className="absolute -inset-1 rounded-full" style={{ border: `1px solid ${item.color}30` }} animate={{ scale: [1, 1.5], opacity: [0.5, 0] }} transition={{ duration: 1.5, repeat: Infinity }} />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold" style={{ color: item.color }}>{item.agent}</span>
                  <span className="text-[10px] text-white/15">{item.time}</span>
                </div>
                <p className="text-[13px] text-white/45 mt-0.5">{item.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
};

// ─── DEMO 4: BRAIN — LIVE MEMORY SYNC ──────────────────────────────
const MEMORY_ITEMS = [
  { text: "Brand voice: warm, direct, no jargon", who: "Maya", whoColor: "#d946ef", synced: ["D", "Z", "S"], icon: "📝" },
  { text: "Target: solo founders, first product", who: "Maya", whoColor: "#d946ef", synced: ["D", "Z"], icon: "🎯" },
  { text: "Tech stack: React + Express + Neon", who: "Drew", whoColor: "#3b82f6", synced: ["M", "Z", "S"], icon: "⚙️" },
  { text: "Design system: dark theme, rounded", who: "Zara", whoColor: "#10b981", synced: ["M", "D"], icon: "🎨" },
  { text: "Launch deadline: April 15", who: "Maya", whoColor: "#d946ef", synced: ["D", "Z", "S"], icon: "📅" },
];

const SYNC_AGENTS = [
  { letter: "M", name: "Maya", color: "#d946ef" },
  { letter: "D", name: "Drew", color: "#3b82f6" },
  { letter: "Z", name: "Zara", color: "#10b981" },
  { letter: "S", name: "Sam", color: "#f59e0b" },
];

const BrainDemo = ({ active }: { active: boolean }) => {
  const [activeItem, setActiveItem] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!active) { setActiveItem(0); setSyncing(false); return; }
    const cycle = () => {
      setSyncing(true);
      setTimeout(() => setSyncing(false), 1500);
    };
    cycle();
    const t = setInterval(() => {
      setActiveItem((i) => (i + 1) % MEMORY_ITEMS.length);
      setTimeout(() => cycle(), 200);
    }, 3000);
    return () => clearInterval(t);
  }, [active]);

  const current = MEMORY_ITEMS[activeItem];

  return (
    <GlassPanel glowColor="rgba(99,102,241,0.15)" borderColor="#6366f1">
      <div className="h-full flex flex-col p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/[0.06]">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center relative" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05))', border: '1px solid rgba(99,102,241,0.2)' }}>
            <motion.div className="absolute inset-0 rounded-xl" animate={syncing ? { boxShadow: ["0 0 0px rgba(99,102,241,0)", "0 0 20px rgba(99,102,241,0.3)", "0 0 0px rgba(99,102,241,0)"] } : {}} transition={{ duration: 1 }} />
            <span className="text-[9px] text-indigo-400 font-bold relative z-10">🧠</span>
          </div>
          <div>
            <span className="text-[11px] text-white/70 font-medium block">Project Brain</span>
            <span className="text-[9px] text-white/25">{MEMORY_ITEMS.length} memories synced</span>
          </div>
          <div className="ml-auto flex -space-x-1.5">
            {SYNC_AGENTS.map((a) => (
              <div key={a.letter} className="w-5 h-5 rounded-full overflow-hidden relative z-10" style={{ border: `1.5px solid ${a.color}30` }}>
                <img src={notionistAvatar(a.name)} alt={a.name} className="w-full h-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Memory list */}
        <div className="flex-1 space-y-2 overflow-hidden">
          {MEMORY_ITEMS.map((item, i) => {
            const isCurrent = i === activeItem;
            return (
              <motion.div
                key={i}
                animate={{ opacity: isCurrent ? 1 : 0.25, scale: isCurrent ? 1 : 0.98 }}
                transition={{ duration: 0.4 }}
                className="p-3 rounded-xl relative overflow-hidden"
                style={isCurrent ? { background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(99,102,241,0.02))', border: '1px solid rgba(99,102,241,0.15)' } : { background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)' }}
              >
                {/* Sync shimmer on active */}
                {isCurrent && syncing && (
                  <motion.div className="absolute inset-0 pointer-events-none z-0" style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.06), transparent)' }} animate={{ x: ["-100%", "200%"] }} transition={{ duration: 1, ease: "linear" }} />
                )}

                <div className="flex items-start gap-2.5 relative z-10">
                  <span className="text-sm shrink-0 mt-0.5">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-white/60 leading-relaxed truncate">{item.text}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] font-medium" style={{ color: item.whoColor + "80" }}>Added by {item.who}</span>
                      {isCurrent && (
                        <div className="flex items-center gap-1">
                          <motion.span className="text-[8px] text-indigo-400/50" animate={syncing ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.5 }} transition={{ duration: 0.8, repeat: syncing ? Infinity : 0 }}>
                            synced →
                          </motion.span>
                          <div className="flex -space-x-1">
                            {item.synced.map((letter, si) => {
                              const agent = SYNC_AGENTS.find(a => a.letter === letter);
                              return (
                                <motion.div
                                  key={letter}
                                  className="w-4 h-4 rounded-full overflow-hidden"
                                  style={{ border: `1px solid ${agent?.color}30` }}
                                  initial={syncing ? { scale: 0, opacity: 0 } : {}}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ delay: si * 0.15, type: "spring", stiffness: 400 }}
                                >
                                  <img src={notionistAvatar(agent?.name ?? letter)} alt={agent?.name ?? letter} className="w-full h-full" />
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </GlassPanel>
  );
};

// ─── DEMO 5: TASK DETECTION ─────────────────────────────────────────
const TaskDemo = ({ active }: { active: boolean }) => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) { setPhase(0); return; }
    const cycle = () => { setPhase(0); setTimeout(() => setPhase(1), 1200); setTimeout(() => setPhase(2), 2500); };
    cycle();
    const t = setInterval(cycle, 5500);
    return () => clearInterval(t);
  }, [active]);

  return (
    <GlassPanel glowColor="rgba(245,158,11,0.12)" borderColor="#f59e0b">
      <div className="h-full flex flex-col p-6">
        {/* Message */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full overflow-hidden" style={{ border: '1px solid rgba(217,70,239,0.25)' }}>
              <img src={notionistAvatar("Maya")} alt="Maya" className="w-full h-full" />
            </div>
            <span className="text-[10px] text-fuchsia-400/60 font-semibold uppercase tracking-wider">Maya</span>
            <span className="text-[9px] text-white/15 ml-auto">just now</span>
          </div>
          <div className="p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[13px] text-white/40 leading-relaxed">
              Based on user feedback, we need to{" "}
              <motion.span
                animate={{ color: phase >= 1 ? "#fb923c" : "rgba(255,255,255,0.4)", background: phase >= 1 ? "rgba(249,115,22,0.08)" : "transparent", boxShadow: phase >= 1 ? "0 0 20px rgba(249,115,22,0.1)" : "none" }}
                transition={{ duration: 0.6 }}
                className="px-1.5 py-0.5 rounded-md font-medium inline-block"
              >
                redesign the onboarding flow
              </motion.span>{" "}
              before v2 launch. Drop-off at step 3 is 68%.
            </p>
          </div>
        </div>

        {/* Scanner line */}
        <AnimatePresence>
          {phase >= 1 && phase < 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-3">
              <div className="h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(249,115,22,0.1)' }}>
                <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)', width: '40%' }} animate={{ x: ["-40%", "250%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <motion.div className="w-1.5 h-1.5 rounded-full bg-orange-400" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity }} />
                <span className="text-[10px] text-orange-400/60 font-medium">Analyzing conversation for tasks...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Task card */}
        <AnimatePresence>
          {phase >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="p-4 rounded-xl mt-auto relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.06), rgba(249,115,22,0.02))', border: '1px solid rgba(249,115,22,0.18)' }}
            >
              {/* Shimmer */}
              <motion.div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.04), transparent)' }} animate={{ x: ["-100%", "200%"] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />

              <div className="flex items-start gap-3 relative z-10">
                <motion.div
                  className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))', border: '1px solid rgba(249,115,22,0.3)' }}
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <HugeiconsIcon icon={Tick01Icon} size={10} className="text-orange-400" />
                </motion.div>
                <div>
                  <span className="text-[13px] font-medium text-orange-400/90 block">Redesign the onboarding flow</span>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-white/25 flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full overflow-hidden" style={{ border: '1px solid rgba(16,185,129,0.25)' }}>
                        <img src={notionistAvatar("Zara")} alt="Zara" className="w-full h-full" />
                      </div>
                      Zara
                    </span>
                    <span className="text-[9px] text-orange-400/50 px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.12)' }}>High priority</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassPanel>
  );
};

// ─── DEMOS ──────────────────────────────────────────────────────────
const DEMOS = [ChatDemo, RolesDemo, AutonomousDemo, BrainDemo, TaskDemo];

// ─── MAIN ───────────────────────────────────────────────────────────
export default function LandingBento() {
  const [activeIndex, setActiveIndex] = useState(0);
  const prevIndex = useRef(0);
  const triggerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const direction = activeIndex > prevIndex.current ? 1 : -1;

  useEffect(() => { prevIndex.current = activeIndex; }, [activeIndex]);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    triggerRefs.current.forEach((el, i) => {
      if (!el) return;
      const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setActiveIndex(i); }, { rootMargin: "-40% 0px -40% 0px" });
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const ActiveDemo = DEMOS[activeIndex];

  // Extra buffer so last slide doesn't jump
  const totalHeight = (FEATURES.length + 1) * 100;

  return (
    <>
      {/* ━━━ MOBILE: vertical stack, no scroll hijack ━━━ */}
      <section className="lg:hidden relative w-full px-5 py-16">
        <div className="text-center mb-12">
          <h2 className="text-[28px] font-semibold text-white mb-3" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Everything your team needs.
          </h2>
          <p className="text-white/35 text-[15px] leading-relaxed max-w-xs mx-auto">
            AI teammates that think, collaborate, and ship.
          </p>
        </div>
        <div className="flex flex-col gap-14 max-w-[440px] mx-auto">
          {FEATURES.map((feat, i) => {
            const Demo = DEMOS[i];
            return (
              <div key={i} className="flex flex-col gap-5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] mb-3 block" style={{ color: feat.color }}>
                    {feat.label}
                  </span>
                  <h3 className="text-[22px] leading-[1.2] tracking-[-0.5px] text-white font-semibold mb-3" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    {feat.title}
                  </h3>
                  <p className="text-[14px] text-white/40 leading-relaxed">
                    {feat.description}
                  </p>
                </div>
                <div className="relative h-[360px]">
                  <div className="absolute -inset-6 rounded-3xl blur-3xl pointer-events-none" style={{ background: feat.glow }} />
                  <div className="relative h-full">
                    <Demo active={true} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ━━━ DESKTOP: scroll-hijack cinema ━━━ */}
      <section className="hidden lg:block relative w-full" style={{ height: `${totalHeight}vh` }}>
      <div className="sticky top-0 h-screen flex flex-col overflow-hidden">

        {/* Section heading */}
        <div className="w-full text-center px-6 pt-14 pb-4 shrink-0">
          <h2 className="text-2xl md:text-4xl font-semibold text-white mb-3" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Everything your team needs.
          </h2>
          <p className="text-white/30 text-sm md:text-base max-w-md mx-auto leading-relaxed">
            AI teammates that think, collaborate, and ship.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col lg:flex-row items-center gap-8 lg:gap-16 max-w-[1200px] mx-auto w-full px-6 pb-8 min-h-0">

          {/* LEFT */}
          <div className="flex-1 max-w-md w-full flex flex-col justify-center">
            {/* Progress bar */}
            <div className="flex items-center gap-2.5 mb-10">
              {FEATURES.map((_, i) => (
                <motion.div
                  key={i}
                  className="h-[3px] rounded-full"
                  animate={{ width: i === activeIndex ? 32 : 8, background: i === activeIndex ? FEATURES[activeIndex].color : "rgba(255,255,255,0.08)" }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                />
              ))}
              <span className="text-[10px] text-white/15 ml-2 tabular-nums font-mono">{activeIndex + 1}/{FEATURES.length}</span>
            </div>

            {/* Feature text — slides in from scroll direction */}
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={activeIndex}
                custom={direction}
                initial={{ opacity: 0, y: direction * 40, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: direction * -30, filter: "blur(6px)" }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              >
                <motion.span
                  className="text-[10px] font-bold uppercase tracking-[0.25em] mb-4 block"
                  style={{ color: FEATURES[activeIndex].color }}
                >
                  {FEATURES[activeIndex].label}
                </motion.span>
                <h3 className="text-xl md:text-3xl leading-[1.15] tracking-[-1px] text-white font-semibold mb-6" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {FEATURES[activeIndex].title}
                </h3>
                <p className="text-[15px] text-white/35 leading-relaxed max-w-sm">
                  {FEATURES[activeIndex].description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* RIGHT — fixed height, consistent for all demos */}
          <div className="flex-1 w-full max-w-[540px]">
            <div className="h-[420px] sm:h-[450px] relative">
              {/* Ambient glow */}
              <motion.div
                className="absolute -inset-8 rounded-3xl blur-3xl pointer-events-none"
                animate={{ background: FEATURES[activeIndex].glow }}
                transition={{ duration: 0.8 }}
              />
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={activeIndex}
                  custom={direction}
                  initial={{ opacity: 0, scale: 0.96, y: direction * 30, filter: "blur(10px)" }}
                  animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.98, y: direction * -20, filter: "blur(8px)" }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                  className="h-full relative"
                >
                  <ActiveDemo active={true} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll triggers — one extra for buffer */}
      <div className="absolute top-0 left-0 w-px" style={{ height: `${totalHeight}vh` }}>
        {FEATURES.map((_, i) => (
          <div key={i} ref={(el) => { triggerRefs.current[i] = el; }} style={{ height: "100vh" }} />
        ))}
        {/* Extra buffer so last slide stays pinned */}
        <div style={{ height: "100vh" }} />
      </div>
      </section>
    </>
  );
}
