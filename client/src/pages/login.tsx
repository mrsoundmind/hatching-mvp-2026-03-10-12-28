import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { FcGoogle } from "react-icons/fc";
import { Sparkles, Code2, Users2 } from "lucide-react";

function sanitizeNextPath(value: string | null): string {
  if (!value) return "/";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
  if (trimmed.startsWith("/api/auth")) return "/";
  return trimmed;
}

export default function LoginPage() {
  const { isSignedIn, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");

  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return "/";
    const params = new URLSearchParams(window.location.search);
    return sanitizeNextPath(params.get("next"));
  }, []);

  const authError = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("error");
  }, []);

  useEffect(() => {
    if (!isLoading && isSignedIn && location !== nextPath) {
      setLocation(nextPath);
    }
  }, [isLoading, isSignedIn, location, nextPath, setLocation]);

  // Auto-rotate slides
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % 3);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  if (!isLoading && isSignedIn) {
    return null;
  }

  // Define floating "hatches" (AI Agents/Colleagues) for Slide 1
  const hatches = [
    { role: "Product Manager", name: "Sarah", color: "from-blue-500 to-cyan-500", delay: 0 },
    { role: "Lead Engineer", name: "David", color: "from-indigo-500 to-purple-500", delay: 1.5 },
    { role: "UX Designer", name: "Maya", color: "from-fuchsia-500 to-pink-500", delay: 3 },
  ];

  return (
    <main className="min-h-[100dvh] w-full flex flex-col lg:flex-row bg-[#030303] overflow-y-auto lg:overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-indigo-200">

      {/* LEFT COLUMN: Authentication */}
      <section className="relative w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-16 z-10 min-h-[100dvh] lg:min-h-screen shrink-0 bg-[#030303] overflow-hidden">
        {/* Animated Background Orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-500/10 blur-[130px]"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-purple-500/10 blur-[110px]"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px] relative z-10"
        >
          {/* Hatchin Logo */}
          <div className="mb-12 flex items-center select-none">
            <span className="text-3xl font-bold tracking-tighter text-white">Hatchin<span className="text-indigo-500">.</span></span>
          </div>

          <div className="mb-8">
            {/* Custom Animated Tabs */}
            <div className="flex pb-4 mb-8 border-b border-white/10 gap-8">
              <button
                onClick={() => setActiveTab("login")}
                className={`relative pb-4 -mb-4 text-sm font-medium transition-colors ${activeTab === "login" ? "text-white" : "text-slate-400 hover:text-slate-300"}`}
              >
                Log In
                {activeTab === "login" && (
                  <motion.div layoutId="active-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("signup")}
                className={`relative pb-4 -mb-4 text-sm font-medium transition-colors ${activeTab === "signup" ? "text-white" : "text-slate-400 hover:text-slate-300"}`}
              >
                Sign Up
                {activeTab === "signup" && (
                  <motion.div layoutId="active-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                )}
              </button>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-white mb-3">
              {activeTab === "login" ? "Welcome back" : "Create an account"}
            </h1>
            <p className="text-base text-slate-400 leading-relaxed font-light">
              {activeTab === "login"
                ? "Sign in to access your projects and collaborate with your AI team seamlessly."
                : "Join Hatchin to start turning your visions into reality with an autonomous AI team."}
            </p>
          </div>

          {authError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="w-full mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            >
              Authentication failed. Please try again or check your credentials.
            </motion.div>
          )}

          <a
            className="group relative w-full inline-flex items-center justify-center gap-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-white text-[15px] font-medium px-4 py-3.5 transition-all duration-300 overflow-hidden shadow-2xl shadow-black/50"
            href={`/api/auth/google/start?returnTo=${encodeURIComponent(nextPath)}`}
          >
            <FcGoogle className="w-5 h-5 z-10 drop-shadow-sm" />
            <span className="z-10 tracking-wide font-medium text-white/90 group-hover:text-white transition-colors">
              {activeTab === "login" ? "Continue with Google" : "Sign up with Google"}
            </span>

            {/* Hover state gradient border inner glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-500" />
          </a>

          <p className="mt-8 text-sm text-slate-500 font-light">
            By continuing, you agree to our <a href="#" className="text-slate-400 hover:text-white transition-colors underline decoration-slate-600 underline-offset-2">Terms of Service</a> and <a href="#" className="text-slate-400 hover:text-white transition-colors underline decoration-slate-600 underline-offset-2">Privacy Policy</a>.
          </p>
        </motion.div>
      </section>

      {/* RIGHT COLUMN: Showcase Carousel / Animations */}
      <section className="relative w-full lg:w-1/2 flex flex-col items-center justify-center bg-slate-900 overflow-hidden border-t lg:border-t-0 lg:border-l border-white/5 py-20 lg:py-0 min-h-[700px] lg:min-h-screen shrink-0">

        {/* Dynamic Vibrant glowing background matching Framer AI aesthetic */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 bg-[#050505]">
          {/* Layer 1: Primary Top-Left Orb */}
          <motion.div
            className="absolute top-0 left-0 w-[150%] h-[150%] rounded-[100%] blur-[120px] mix-blend-screen will-change-transform"
            animate={{
              x: ["-10%", "10%", "-10%"],
              y: ["-10%", "5%", "-10%"],
              scale: [1, 1.1, 1],
            }}
            transition={{
              x: { duration: 20, repeat: Infinity, ease: "linear" },
              y: { duration: 25, repeat: Infinity, ease: "linear" },
              scale: { duration: 15, repeat: Infinity, ease: "easeInOut" }
            }}
          >
            <div className={`absolute inset-0 transition-opacity duration-1500 ease-in-out ${activeSlide === 0 ? "opacity-60" : "opacity-0"}`} style={{ background: "radial-gradient(circle at center, rgba(59,130,246,0.8) 0%, rgba(168,85,247,0.4) 30%, transparent 60%)" }} />
            <div className={`absolute inset-0 transition-opacity duration-1500 ease-in-out ${activeSlide === 1 ? "opacity-60" : "opacity-0"}`} style={{ background: "radial-gradient(circle at center, rgba(236,72,153,0.8) 0%, rgba(249,115,22,0.4) 30%, transparent 60%)" }} />
            <div className={`absolute inset-0 transition-opacity duration-1500 ease-in-out ${activeSlide === 2 ? "opacity-60" : "opacity-0"}`} style={{ background: "radial-gradient(circle at center, rgba(16,185,129,0.8) 0%, rgba(6,182,212,0.4) 30%, transparent 60%)" }} />
          </motion.div>

          {/* Layer 2: Bottom-Right Shifting Orb */}
          <motion.div
            className="absolute bottom-[-20%] right-[-20%] w-[130%] h-[130%] rounded-[100%] blur-[140px] mix-blend-screen will-change-transform"
            animate={{
              x: ["5%", "-15%", "5%"],
              y: ["10%", "-5%", "10%"],
              rotate: [0, 15, 0],
            }}
            transition={{
              x: { duration: 22, repeat: Infinity, ease: "linear" },
              y: { duration: 28, repeat: Infinity, ease: "linear" },
              rotate: { duration: 20, repeat: Infinity, ease: "easeInOut" }
            }}
          >
            <div className={`absolute inset-0 transition-opacity duration-1500 ease-in-out ${activeSlide === 0 ? "opacity-70" : "opacity-0"}`} style={{ background: "radial-gradient(circle at center, rgba(99,102,241,0.7) 0%, rgba(236,72,153,0.3) 40%, transparent 70%)" }} />
            <div className={`absolute inset-0 transition-opacity duration-1500 ease-in-out ${activeSlide === 1 ? "opacity-70" : "opacity-0"}`} style={{ background: "radial-gradient(circle at center, rgba(239,68,68,0.7) 0%, rgba(234,179,8,0.3) 40%, transparent 70%)" }} />
            <div className={`absolute inset-0 transition-opacity duration-1500 ease-in-out ${activeSlide === 2 ? "opacity-70" : "opacity-0"}`} style={{ background: "radial-gradient(circle at center, rgba(20,184,166,0.7) 0%, rgba(59,130,246,0.3) 40%, transparent 70%)" }} />
          </motion.div>

          {/* Layer 3: Central Drifting Highlight */}
          <motion.div
            className="absolute top-1/2 left-1/2 w-[100%] h-[100%] -translate-x-1/2 -translate-y-1/2 rounded-[100%] blur-[160px] mix-blend-screen will-change-transform"
            animate={{
              scale: [0.8, 1.2, 0.8],
              x: ["-20%", "20%", "-20%"],
            }}
            transition={{
              scale: { duration: 18, repeat: Infinity, ease: "easeInOut" },
              x: { duration: 30, repeat: Infinity, ease: "linear" }
            }}
          >
            <div className={`absolute inset-0 transition-opacity duration-1500 ease-in-out ${activeSlide === 0 ? "opacity-40" : "opacity-0"}`} style={{ background: "radial-gradient(circle at center, rgba(168,85,247,0.5) 0%, transparent 50%)" }} />
            <div className={`absolute inset-0 transition-opacity duration-1500 ease-in-out ${activeSlide === 1 ? "opacity-40" : "opacity-0"}`} style={{ background: "radial-gradient(circle at center, rgba(249,115,22,0.5) 0%, transparent 50%)" }} />
            <div className={`absolute inset-0 transition-opacity duration-1500 ease-in-out ${activeSlide === 2 ? "opacity-40" : "opacity-0"}`} style={{ background: "radial-gradient(circle at center, rgba(6,182,212,0.5) 0%, transparent 50%)" }} />
          </motion.div>
        </div>

        {/* Subtle dark texture overlay to make it look premium */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] z-0" style={{ maskImage: "radial-gradient(ellipse at center, transparent 20%, black 80%)", WebkitMaskImage: "radial-gradient(ellipse at center, transparent 20%, black 80%)" }} />

        <div className="relative z-10 w-full max-w-lg px-4 sm:px-8 flex flex-col items-center min-h-[550px] justify-center pb-12">
          <AnimatePresence mode="wait">

            {/* SLIDE 1: The AI Team */}
            {activeSlide === 0 && (
              <motion.div
                key="slide1"
                initial={{ opacity: 0, y: 30, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -30, filter: "blur(4px)" }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="w-full flex flex-col items-center"
              >
                <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium text-sm tracking-wide uppercase shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                  <Users2 className="w-4 h-4" /> Your Autonomous Team
                </div>
                <h2 className="text-4xl lg:text-5xl font-semibold text-white mb-6 tracking-tight text-center leading-tight">
                  Your Ideas, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 drop-shadow-sm">Hatched.</span>
                </h2>
                <p className="text-lg lg:text-xl text-slate-400 leading-relaxed text-center mb-16 px-4 font-light max-w-sm">
                  Turn your boldest ideas into reality with a dedicated AI team that builds your dreams from the ground up.
                </p>

                {/* Floating Hatches Animation */}
                <div className="relative w-full h-[240px] flex items-center justify-center pointer-events-none perspective-[1000px]">
                  {hatches.map((hatch, i) => (
                    <motion.div
                      key={i}
                      className={`absolute w-64 rounded-2xl border border-white/5 bg-black/40 backdrop-blur-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] ${i === 0 ? "left-0 top-0" : i === 1 ? "right-0 top-1/2 -translate-y-1/2" : "left-12 bottom-0"
                        } z-${20 - i * 10} transition-colors duration-500 hover:border-white/10`}
                      animate={{
                        y: [0, -12, 0],
                        rotateX: [0, i % 2 === 0 ? 2 : -2, 0],
                        rotateY: [0, i % 2 === 0 ? -2 : 2, 0],
                        rotateZ: [0, i % 2 === 0 ? 1.5 : -1.5, 0],
                      }}
                      transition={{
                        duration: 6,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: hatch.delay,
                      }}
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${hatch.color} flex items-center justify-center shadow-lg shadow-white/5`}>
                          <span className="text-white font-semibold text-lg drop-shadow-sm">{hatch.name[0]}</span>
                        </div>
                        <div>
                          <h3 className="text-white font-medium text-sm">{hatch.name}</h3>
                          <p className="text-xs text-slate-400">{hatch.role}</p>
                        </div>
                      </div>
                      <div className="space-y-2 mt-4">
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full bg-gradient-to-r ${hatch.color}`}
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
                          />
                        </div>
                        <div className="h-1.5 w-2/3 bg-white/10 rounded-full" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* SLIDE 2: Code Generation */}
            {activeSlide === 1 && (
              <motion.div
                key="slide2"
                initial={{ opacity: 0, y: 30, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -30, filter: "blur(4px)" }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="w-full flex flex-col items-center"
              >
                <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 font-medium text-sm tracking-wide uppercase shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                  <Code2 className="w-4 h-4" /> Bringing Visions to Life
                </div>
                <h2 className="text-4xl lg:text-5xl font-semibold text-white mb-6 tracking-tight text-center leading-tight">
                  Dreams made <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 drop-shadow-sm">Real.</span>
                </h2>
                <p className="text-lg lg:text-xl text-slate-400 leading-relaxed text-center mb-16 px-4 font-light max-w-sm">
                  Your autonomous team takes your vision and transforms it into a living, breathing application.
                </p>

                {/* Code Animation Mock */}
                <div className="relative w-full max-w-[360px] h-[240px] rounded-2xl border border-white/10 bg-[#0A0A0A]/80 backdrop-blur-xl p-5 shadow-2xl overflow-hidden font-mono text-sm shadow-purple-500/10 text-left">
                  <div className="flex gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  </div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-pink-400 mb-2"
                  >export const App = () =&gt; {"{"}</motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className="text-blue-400 ml-4 mb-2"
                  >return (</motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1 }}
                    className="text-white ml-8 mb-2"
                  >&lt;<span className="text-indigo-400">HatchinWrapper</span>&gt;</motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.4 }}
                    className="text-slate-400 ml-12 mb-2"
                  >{`// Magic happens here`}</motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.8 }}
                    className="text-white ml-8 mb-2"
                  >&lt;/<span className="text-indigo-400">HatchinWrapper</span>&gt;</motion.div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.2 }}
                    className="text-blue-400 ml-4 mb-2"
                  >);</motion.div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.4 }}
                    className="text-pink-400"
                  >{"}"};</motion.div>

                  <motion.div
                    className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  />
                </div>
              </motion.div>
            )}

            {/* SLIDE 3: Continuous Polish */}
            {(activeSlide === 2 || activeSlide === 3 /* fallback */) && (
              <motion.div
                key="slide3"
                initial={{ opacity: 0, y: 30, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -30, filter: "blur(4px)" }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="w-full flex flex-col items-center"
              >
                <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium text-sm tracking-wide uppercase shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                  <Sparkles className="w-4 h-4" /> Nurturing Your Dream
                </div>
                <h2 className="text-4xl lg:text-5xl font-semibold text-white mb-6 tracking-tight text-center leading-tight">
                  Growing <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 drop-shadow-sm">Together.</span>
                </h2>
                <p className="text-lg lg:text-xl text-slate-400 leading-relaxed text-center mb-16 px-4 font-light max-w-sm">
                  Your AI colleagues relentlessly learn your style, culture, and goals to make your dream project absolutely perfect.
                </p>

                {/* Dashboard / Graph Mock */}
                <div className="relative w-full max-w-[360px] h-[240px] rounded-2xl border border-white/10 bg-[#0A0A0A]/80 backdrop-blur-xl p-5 shadow-2xl flex flex-col justify-end overflow-hidden shadow-emerald-500/10">
                  <div className="absolute top-5 left-5 right-5 flex justify-between items-center mb-6">
                    <div className="space-y-1">
                      <div className="text-xs text-slate-400 font-medium tracking-wide">Project Velocity</div>
                      <div className="text-2xl font-semibold text-white">98.4%</div>
                    </div>
                    <div className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                      +12% vs last hatch
                    </div>
                  </div>

                  {/* Animated Bars */}
                  <div className="flex items-end justify-between gap-3 h-24 w-full px-2">
                    {[40, 60, 45, 80, 65, 90, 100].map((height, i) => (
                      <motion.div
                        key={i}
                        className="w-full bg-gradient-to-t from-emerald-500/20 to-teal-400 rounded-t-sm"
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ duration: 1, delay: i * 0.1, type: "spring", bounce: 0.4 }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Carousel Indicators - Refined */}
          <div className="absolute -bottom-2 flex gap-4">
            {[0, 1, 2].map((slide) => (
              <button
                key={slide}
                onClick={() => setActiveSlide(slide)}
                className={`h-1.5 rounded-full transition-all duration-500 ease-out ${activeSlide === slide ? "bg-white/90 w-10 shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "bg-white/20 hover:bg-white/40 w-2"
                  }`}
                aria-label={`Go to slide ${slide + 1}`}
              />
            ))}
          </div>

        </div>
      </section>

    </main>
  );
}
