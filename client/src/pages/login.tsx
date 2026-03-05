import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { FcGoogle } from "react-icons/fc";

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

  if (!isLoading && isSignedIn) {
    return null;
  }

  // Define floating "hatches" (AI Agents/Colleagues)
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
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-white font-bold tracking-tighter">H</span>
            </div>
            <span className="text-xl font-semibold tracking-tight text-white">Hatchin</span>
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
            <span className="z-10">Sign in with Google</span>

            {/* Hover state gradient border inner glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </a>

          <p className="mt-8 text-sm text-slate-500">
            By continuing, you agree to our <a href="#" className="text-slate-400 hover:text-white transition-colors">Terms of Service</a> and <a href="#" className="text-slate-400 hover:text-white transition-colors">Privacy Policy</a>.
          </p>
        </motion.div>
      </section>

      {/* RIGHT COLUMN: Showcase Showcase / Animations */}
      <section className="hidden lg:flex relative w-1/2 flex-col items-center justify-center bg-slate-900 overflow-hidden border-l border-white/5">

        {/* Dynamic Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505] z-0" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-transparent z-0" />

        <div className="relative z-10 w-full max-w-lg px-8 flex flex-col items-center">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-semibold text-white mb-4 tracking-tight">
              Your Ideas, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Hatched.</span>
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed max-w-sm mx-auto">
              Deploy autonomous AI agents to build, design, and engineer your next big project.
            </p>
          </motion.div>

          {/* Floating Hatches Animation */}
          <div className="relative w-full h-[320px] flex items-center justify-center pointer-events-none">
            {hatches.map((hatch, i) => (
              <motion.div
                key={i}
                className={`absolute w-64 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-5 shadow-2xl ${i === 0 ? "left-0 top-0" : i === 1 ? "right-0 top-1/2 -translate-y-1/2" : "left-8 bottom-0"
                  } z-${20 - i * 10}`}
                animate={{
                  y: [0, -15, 0],
                  rotate: [0, i % 2 === 0 ? 2 : -2, 0],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: hatch.delay,
                }}
              >
                <div className="flex items-center gap-4 mb-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${hatch.color} flex items-center justify-center shadow-lg`}>
                    <span className="text-white font-medium text-sm">{hatch.name[0]}</span>
                  </div>
                  <div>
                    <h3 className="text-white font-medium text-sm">{hatch.name}</h3>
                    <p className="text-xs text-slate-400">{hatch.role}</p>
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full bg-gradient-to-r ${hatch.color}`}
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
                    />
                  </div>
                  <div className="h-2 w-2/3 bg-white/10 rounded-full" />
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

    </main>
  );
}
