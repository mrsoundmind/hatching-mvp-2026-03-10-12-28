import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { getRoleDefinition } from "@shared/roleRegistry";

// Tiny inline typing-text animator
function TypingText({ text }: { text: string }) {
    const [displayed, setDisplayed] = useState("");
    useEffect(() => {
        setDisplayed("");
        let i = 0;
        const timer = setInterval(() => {
            setDisplayed(text.slice(0, i + 1));
            i++;
            if (i >= text.length) clearInterval(timer);
        }, 48);
        return () => clearInterval(timer);
    }, [text]);
    return <span className="text-[12px] text-gray-300">{displayed}</span>;
}

// Step 1: Mini chat preview animation
function ChatPreview() {
    const [showBubble, setShowBubble] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setShowBubble(true), 2400);
        return () => clearTimeout(t);
    }, []);
    return (
        <div className="w-full rounded-xl bg-black/30 border border-white/5 p-3 mb-1">
            <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 mb-2">
                <TypingText text="Build a fitness app for runners..." />
                <span className="w-0.5 h-4 bg-indigo-400 animate-pulse rounded-sm flex-shrink-0" />
            </div>
            <AnimatePresence>
                {showBubble && (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="flex items-start gap-2"
                    >
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex-shrink-0 mt-0.5" />
                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2 py-1.5 text-[11px] text-indigo-200 leading-snug">
                            Got it! Let me hatch your team…
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Step 2: Agent hatch pop-in animation — uses real registry data
const PREVIEW_AGENTS = [
    { role: "Product Manager", delay: 0.3 },
    { role: "Backend Developer", delay: 0.7 },
    { role: "Product Designer", delay: 1.1 },
];

function AgentHatch() {
    return (
        <div className="flex items-center gap-4 mb-1 py-2">
            <motion.span
                initial={{ opacity: 1, scale: 1 }}
                animate={{ opacity: 0, scale: 0 }}
                transition={{ delay: 1.6, duration: 0.3 }}
                className="text-2xl mr-1"
            >
                🥚
            </motion.span>
            {PREVIEW_AGENTS.map((agent) => {
                const def = getRoleDefinition(agent.role);
                return (
                    <motion.div
                        key={agent.role}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: agent.delay, type: "spring", bounce: 0.6 }}
                        className="flex flex-col items-center gap-1"
                    >
                        <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm shadow-lg ${def?.avatarBg ?? "bg-indigo-600"}`}
                        >
                            {def?.emoji ?? agent.role[0]}
                        </div>
                        <span className="text-[10px] text-gray-400">{def?.characterName ?? agent.role}</span>
                    </motion.div>
                );
            })}
        </div>
    );
}

// Step 3: Project brain auto-fill animation
function BrainFill() {
    const items = [
        "Target: Runners aged 18–35",
        "Tech: React Native",
        "Launch: 6 weeks",
    ];
    return (
        <div className="w-full rounded-xl bg-black/30 border border-white/5 p-3 mb-1 space-y-1.5">
            <div className="text-[10px] text-hatchin-blue uppercase tracking-widest font-semibold mb-2">
                Project Brain
            </div>
            {items.map((item, i) => (
                <motion.div
                    key={item}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.6 + 0.3 }}
                    className="flex items-center gap-2 text-[11px] text-gray-300"
                >
                    <div className="w-1.5 h-1.5 rounded-full bg-[#47DB9A] flex-shrink-0" />
                    {item}
                </motion.div>
            ))}
        </div>
    );
}

const steps = [
    {
        num: 1,
        title: "Describe your idea",
        subtitle: "Tell Maya in plain English. One sentence is enough.",
        preview: <ChatPreview />,
        color: "from-blue-500 to-indigo-500",
        textColor: "text-blue-400",
    },
    {
        num: 2,
        title: "Watch your team hatch",
        subtitle: "Maya spins up a specialized team in seconds.",
        preview: <AgentHatch />,
        color: "from-indigo-500 to-purple-500",
        textColor: "text-indigo-400",
    },
    {
        num: 3,
        title: "Your AI remembers everything",
        subtitle: "Every decision is stored. Switch context freely.",
        preview: <BrainFill />,
        color: "from-purple-500 to-pink-500",
        textColor: "text-purple-400",
    },
];

const DESIGNATION_OPTIONS = [
    { label: "Founder / CEO", emoji: "🚀" },
    { label: "Product Manager", emoji: "📋" },
    { label: "Developer / Engineer", emoji: "⚙️" },
    { label: "Designer", emoji: "🎨" },
    { label: "Marketer", emoji: "📣" },
    { label: "Data / Analytics", emoji: "📈" },
    { label: "Operations", emoji: "⚡" },
    { label: "Other", emoji: "✦" },
];

export default function OnboardingPage() {
    const { user, completeOnboarding, hasCompletedOnboarding } = useAuth();
    const [, setLocation] = useLocation();
    const [step, setStep] = useState(1);
    // Pre-fill from localStorage if user has visited before
    const [designation, setDesignation] = useState<string>(
        () => localStorage.getItem("hatchin_user_designation") ?? ""
    );

    // If already onboarded, redirect home
    if (hasCompletedOnboarding()) {
        setLocation("/");
        return null;
    }

    const handleSelectDesignation = (label: string) => {
        setDesignation(label);
        localStorage.setItem("hatchin_user_designation", label);
    };

    const handleComplete = () => {
        completeOnboarding();
        setLocation("/");
    };

    return (
        <main className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-6 overflow-hidden relative">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-500/10 blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-500/10 blur-[120px]" />
            </div>

            <div className="max-w-xl w-full relative z-10">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4 }}
                            className="bg-white/[0.02] border border-white/5 backdrop-blur-xl p-10 rounded-3xl shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />

                            {/* Logo */}
                            <div className="flex justify-center mb-8 mx-auto">
                                <span className="text-3xl font-bold tracking-tighter text-white">
                                    Hatchin<span className="text-indigo-500">.</span>
                                </span>
                            </div>
                            <h1 className="text-3xl font-semibold text-white mb-4 text-center tracking-tight">
                                Welcome,{" "}
                                <span className="text-blue-400">{user?.name?.split(" ")[0] || "Builder"}</span>
                            </h1>
                            <p className="text-slate-400 text-center mb-10 max-w-sm mx-auto leading-relaxed">
                                Your AI team is ready. Let's show you how it works.
                            </p>

                            <div className="flex justify-center">
                                <Button
                                    onClick={() => setStep(2)}
                                    className="bg-white text-black hover:bg-slate-200 px-8 py-6 rounded-xl text-md font-medium transition-all hover:scale-105 active:scale-95"
                                >
                                    Show Me →
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="step2-designation"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4 }}
                            className="bg-white/[0.02] border border-white/5 backdrop-blur-xl p-10 rounded-3xl shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />

                            <h2 className="text-2xl font-semibold text-white mb-2 tracking-tight text-center">
                                What's your role?
                            </h2>
                            <p className="text-slate-400 text-sm text-center mb-8">
                                Your AI team will tailor how they communicate with you.
                            </p>

                            <div className="grid grid-cols-2 gap-3 mb-8">
                                {DESIGNATION_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.label}
                                        onClick={() => handleSelectDesignation(opt.label)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all text-sm font-medium ${
                                            designation === opt.label
                                                ? "bg-indigo-500/20 border-indigo-500/60 text-white"
                                                : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20"
                                        }`}
                                    >
                                        <span className="text-lg">{opt.emoji}</span>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex justify-between items-center pt-6 border-t border-white/10">
                                <Button onClick={() => setStep(1)} variant="ghost" className="text-slate-400 hover:text-white hover:bg-white/5">
                                    Back
                                </Button>
                                <Button
                                    onClick={() => setStep(3)}
                                    disabled={!designation}
                                    className="bg-white text-black hover:bg-slate-200 px-6 py-5 rounded-xl text-md font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Continue →
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4 }}
                            className="bg-white/[0.02] border border-white/5 backdrop-blur-xl p-10 rounded-3xl shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />

                            <h2 className="text-2xl font-semibold text-white mb-8 tracking-tight text-center">
                                How Hatchin Works
                            </h2>

                            <div className="space-y-4 mb-10">
                                {steps.map((s, idx) => (
                                    <motion.div
                                        key={s.num}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.12 }}
                                        className="flex gap-4 items-start p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                                    >
                                        {/* Live animation preview instead of number icon */}
                                        <div className="w-[140px] shrink-0 overflow-hidden">
                                            {s.preview}
                                        </div>

                                        <div className="flex-1">
                                            <h3 className="text-white font-medium mb-1">{s.title}</h3>
                                            <p className="text-slate-400 text-sm leading-relaxed">
                                                {s.subtitle}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/10">
                                <Button
                                    onClick={() => setStep(2)}
                                    variant="ghost"
                                    className="text-slate-400 hover:text-white hover:bg-white/5"
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={handleComplete}
                                    className="bg-white text-black hover:bg-slate-200 px-6 py-5 rounded-xl text-md font-medium transition-all hover:scale-105 active:scale-95 shadow-lg shadow-white/10"
                                >
                                    Start Chatting →
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
}
