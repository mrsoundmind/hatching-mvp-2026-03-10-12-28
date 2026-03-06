import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function OnboardingPage() {
    const { user, completeOnboarding, hasCompletedOnboarding } = useAuth();
    const [, setLocation] = useLocation();
    const [step, setStep] = useState(1);

    // If already onboarded, redirect home
    if (hasCompletedOnboarding()) {
        setLocation("/");
        return null;
    }

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

                            <video
                                src="/logo.webm"
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="w-20 h-20 object-contain mx-auto mb-8 pointer-events-none"
                            />
                            <h1 className="text-3xl font-semibold text-white mb-4 text-center tracking-tight">
                                Welcome to Hatchin<br />
                                <span className="text-blue-400">{user?.name || "Builder"}</span>
                            </h1>
                            <p className="text-slate-400 text-center mb-10 max-w-sm mx-auto leading-relaxed">
                                We're excited to have you on board. Hatchin is designed to bring your creative projects to life with intelligent AI teams.
                            </p>

                            <div className="flex justify-center">
                                <Button
                                    onClick={() => setStep(2)}
                                    className="bg-white text-black hover:bg-slate-200 px-8 py-6 rounded-xl text-md font-medium transition-all hover:scale-105 active:scale-95"
                                >
                                    Continue Setup
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4 }}
                            className="bg-white/[0.02] border border-white/5 backdrop-blur-xl p-10 rounded-3xl shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />

                            <h2 className="text-2xl font-semibold text-white mb-8 tracking-tight text-center">How Hatchin Works</h2>

                            <div className="space-y-4 mb-10">
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="flex gap-4 items-start p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-default"
                                >
                                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                        <span className="text-blue-400 font-semibold">1</span>
                                    </div>
                                    <div>
                                        <h3 className="text-white font-medium mb-1">Create Projects</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed">Define your core direction, execution rules, and team culture uniquely for each project.</p>
                                    </div>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="flex gap-4 items-start p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-default"
                                >
                                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                                        <span className="text-indigo-400 font-semibold">2</span>
                                    </div>
                                    <div>
                                        <h3 className="text-white font-medium mb-1">Collaborate with AI</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed">Your team responds to your messages with structured step-by-step execution.</p>
                                    </div>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="flex gap-4 items-start p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-default"
                                >
                                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                                        <span className="text-purple-400 font-semibold">3</span>
                                    </div>
                                    <div>
                                        <h3 className="text-white font-medium mb-1">Persist Memory</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed">Hatchin preserves your design choices and context across sessions automatically.</p>
                                    </div>
                                </motion.div>
                            </div>

                            <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/10">
                                <Button
                                    onClick={() => setStep(1)}
                                    variant="ghost"
                                    className="text-slate-400 hover:text-white hover:bg-white/5"
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={handleComplete}
                                    className="bg-white text-black hover:bg-slate-200 px-6 py-5 rounded-xl text-md font-medium transition-all hover:scale-105 active:scale-95 shadow-lg shadow-white/10"
                                >
                                    Start Building
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
}
