import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";

interface NameInputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (name: string) => void;
    isLoading?: boolean;
}

export function NameInputModal({ isOpen, onClose, onSubmit, isLoading }: NameInputModalProps) {
    const [name, setName] = useState("");

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (name.trim() && !isLoading) {
            onSubmit(name.trim());
        }
    };

    // Fix: Radix UI Dialog intercepts keyboard events — explicitly handle Enter on the input
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation(); // Stop Dialog from handling Enter as "close"
            handleSubmit();
        }
    };

    return (
        // Intercept Enter at the DialogContent level too, so it never bubbles to Dialog close handler
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent
                className="max-w-md bg-[#1A1D23] border-[#31343A] p-0 overflow-hidden"
                onKeyDown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
            >
                <DialogTitle className="sr-only">Enter your name</DialogTitle>
                <DialogDescription className="sr-only">
                    Provide your name so Hatchin can personalize your workspace.
                </DialogDescription>
                <div className="text-center space-y-8 p-10 relative">
                    {/* Ambient Glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b from-[#6C82FF]/05 to-transparent pointer-events-none" />

                    {/* Premium Wave Orb */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1, y: [0, -8, 0] }}
                        transition={{
                            opacity: { duration: 0.6 },
                            scale: { duration: 0.6 },
                            y: { duration: 3, repeat: Infinity, ease: "easeInOut" }
                        }}
                        className="relative w-20 h-20 mx-auto"
                    >
                        <div className="absolute inset-0 bg-[#6C82FF] rounded-full blur-xl opacity-20" />
                        <div className="relative w-full h-full bg-gradient-to-br from-[#6C82FF] to-[#9F7BFF] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(108,130,255,0.2)]">
                            <span className="text-4xl select-none">👋</span>
                        </div>
                    </motion.div>

                    <div className="space-y-4 relative z-10">
                        <motion.h1
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-3xl font-bold tracking-tight text-[#F1F1F3]"
                        >
                            What should we call you?
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-[#A6A7AB] text-base leading-relaxed"
                        >
                            Your AI team needs to know who their manager is.
                        </motion.p>
                    </div>

                    <motion.form
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        onSubmit={handleSubmit}
                        className="space-y-5 relative z-10"
                    >
                        <div className="relative group">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Your name"
                                autoFocus
                                className="w-full px-5 py-4 bg-[#111318] border border-[#31343A] rounded-xl text-white placeholder-[#585961] focus:outline-none focus:border-[#6C82FF] focus:ring-1 focus:ring-[#6C82FF] transition-all duration-300 text-lg group-hover:border-[#43444B]"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={!name.trim() || isLoading}
                            className="group relative w-full px-6 py-4 bg-gradient-to-r from-[#6C82FF] to-[#8B5CF6] hover:from-[#5A6FE8] hover:to-[#7C3AED] text-white rounded-xl font-bold text-lg transition-all duration-300 shadow-[0_8px_25px_rgba(108,130,255,0.2)] hover:shadow-[0_12px_35px_rgba(108,130,255,0.3)] active:scale-[0.98] outline-none border-0 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center overflow-hidden"
                        >
                            <span className="relative z-10">
                                {isLoading ? (
                                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    "Continue"
                                )}
                            </span>
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    </motion.form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
