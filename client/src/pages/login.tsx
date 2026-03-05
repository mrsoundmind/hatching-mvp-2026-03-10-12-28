import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

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

  return (
    <main className="min-h-screen hatchin-bg-dark flex items-center justify-center px-6">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-md p-8 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.24em] text-blue-300/80 mb-3">Hatchin</p>
        <h1 className="text-2xl font-semibold text-white mb-2">Sign in to continue</h1>
        <p className="text-sm text-slate-300 mb-6">
          Continue with Google to access your private projects and team memory.
        </p>

        {authError ? (
          <div className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            Login failed. Please retry.
          </div>
        ) : null}

        <a
          className="w-full inline-flex items-center justify-center rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium px-4 py-3 transition-colors"
          href={`/api/auth/google/start?returnTo=${encodeURIComponent(nextPath)}`}
        >
          Continue with Google
        </a>
      </section>
    </main>
  );
}
