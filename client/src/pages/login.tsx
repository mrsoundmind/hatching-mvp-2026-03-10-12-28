import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { FcGoogle } from "react-icons/fc";
import { Hexagon, Sparkles, Code2, Users2 } from "lucide-react";

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
    <main className="min-h-screen w-full flex overflow-hidden bg-[#050505]">

      {/* LEFT COLUMN: Authentication */}
      <section className="relative w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 z-10">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] left-[-20%] w-[60vw] h-[60vw] rounded-full bg-blue-500/5 blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px]"
        >
          {/* Enhanced Hatchin Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <Hexagon className="absolute inset-0 w-12 h-12 text-blue-500 animate-[spin_10s_linear_infinite] opacity-50" strokeWidth={1} />
              <Hexagon className="absolute inset-0 w-12 h-12 text-indigo-500 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)] fill-indigo-500/10" strokeWidth={2} />
              <span className="text-white font-bold text-xl tracking-tighter relative z-10">H</span>
            </div>
            <span className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">Hatchin</span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-white mb-4">
            Welcome back
          </h1>
          <p className="text-lg text-slate-400 mb-10 leading-relaxed">
            Sign in to access your projects and collaborate with your AI team seamlessly.
          </p>

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
            className="group relative w-full inline-flex items-center justify-center gap-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white text-[16px] font-medium px-4 py-4 transition-all duration-300 overflow-hidden"
            href={`/api/auth/google/start?returnTo=${encodeURIComponent(nextPath)}`}
          >
            <FcGoogle className="w-6 h-6 z-10" />
            <span className="z-10 tracking-wide font-semibold text-white/90">Sign in with Google</span>

            {/* Hover state gradient border inner glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </a>

          <p className="mt-8 text-sm text-slate-500">
            By continuing, you agree to our <a href="#" className="text-slate-400 hover:text-white transition-colors underline decoration-slate-600 underline-offset-2">Terms of Service</a> and <a href="#" className="text-slate-400 hover:text-white transition-colors underline decoration-slate-600 underline-offset-2">Privacy Policy</a>.
          </p>
        </motion.div>
      </section>

      {/* RIGHT COLUMN: Showcase Carousel / Animations */}
      <section className="hidden lg:flex relative w-1/2 flex-col items-center justify-center bg-slate-900 overflow-hidden border-l border-white/5">

        {/* Dynamic Background Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505] z-0" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-transparent z-0" />

        <div className="relative z-10 w-full max-w-lg px-8 flex flex-col items-center h-[500px] justify-center">
          <AnimatePresence mode="wait">

            {/* SLIDE 1: The AI Team */}
            {activeSlide === 0 && (
              <motion.div
                key="slide1"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.5 }}
                className="w-full flex flex-col items-center"
              >
                <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium text-sm">
                  <Users2 className="w-4 h-4" /> Your Autonomous Team
                </div>
                <h2 className="text-4xl font-semibold text-white mb-4 tracking-tight text-center">
                  Your Ideas, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Hatched.</span>
                </h2>
                <p className="text-lg text-slate-400 leading-relaxed text-center mb-16">
                  Deploy autonomous AI agents to build, design, and engineer your next big project.
                </p>

                {/* Floating Hatches Animation */}
                <div className="relative w-full h-[240px] flex items-center justify-center pointer-events-none">
                  {hatches.map((hatch, i) => (
                    <motion.div
                      key={i}
                      className={`absolute w-60 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-5 shadow-2xl ${i === 0 ? "left-0 top-0" : i === 1 ? "right-0 top-1/2 -translate-y-1/2" : "left-12 bottom-0"
                        } z-${20 - i * 10}`}
                      animate={{
                        y: [0, -10, 0],
                        rotate: [0, i % 2 === 0 ? 1.5 : -1.5, 0],
                      }}
                      transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: hatch.delay,
                      }}
                    >
                      <div className="flex items-center gap-4 mb-3">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${hatch.color} flex items-center justify-center shadow-lg shadow-white/5`}>
                          <span className="text-white font-medium text-sm">{hatch.name[0]}</span>
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
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.5 }}
                className="w-full flex flex-col items-center"
              >
                <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 font-medium text-sm">
                  <Code2 className="w-4 h-4" /> Full-Stack Engineering
                </div>
                <h2 className="text-4xl font-semibold text-white mb-4 tracking-tight text-center">
                  Production-Ready <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Code.</span>
                </h2>
                <p className="text-lg text-slate-400 leading-relaxed text-center mb-16">
                  Sit back as Hatchin writes frontend components, database schemas, and robust backend logic.
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
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.5 }}
                className="w-full flex flex-col items-center"
              >
                <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium text-sm">
                  <Sparkles className="w-4 h-4" /> Continuous Improvement
                </div>
                <h2 className="text-4xl font-semibold text-white mb-4 tracking-tight text-center">
                  Always <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Evolving.</span>
                </h2>
                <p className="text-lg text-slate-400 leading-relaxed text-center mb-16">
                  Maintain persistent project memory so your AI colleagues learn your specific style and culture over time.
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
                        animate={{ height: \`\${height}%\` }}
                    transition={{ duration: 1, delay: i * 0.1, type: "spring", bounce: 0.4 }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Carousel Indicators */}
          <div className="absolute bottom-12 flex gap-3">
            {[0, 1, 2].map((slide) => (
              <button
                key={slide}
                onClick={() => setActiveSlide(slide)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${activeSlide === slide ? "bg-white w-8" : "bg-white/20 hover:bg-white/40"
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
