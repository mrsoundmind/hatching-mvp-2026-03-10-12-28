import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Particles } from "@/components/ui/particles";
import { ChevronLeftIcon } from "lucide-react";
import LegalModal from "@/components/legal/LegalModal";

function sanitizeNextPath(value: string | null): string {
  if (!value) return "/";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
  if (trimmed.startsWith("/api/auth")) return "/";
  return trimmed;
}

const GoogleIcon = (props: React.ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12.479,14.265v-3.279h11.049c0.108,0.571,0.164,1.247,0.164,1.979c0,2.46-0.672,5.502-2.84,7.669 C18.744,22.829,16.051,24,12.483,24C5.869,24,0.308,18.613,0.308,12S5.869,0,12.483,0c3.659,0,6.265,1.436,8.223,3.307L18.392,5.62 c-1.404-1.317-3.307-2.341-5.913-2.341C7.65,3.279,3.873,7.171,3.873,12s3.777,8.721,8.606,8.721c3.132,0,4.916-1.258,6.059-2.401 c0.927-0.927,1.537-2.251,1.777-4.059L12.479,14.265z" />
  </svg>
);

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

  const [legalModal, setLegalModal] = useState<{ open: boolean; type: "privacy" | "terms" }>({
    open: false,
    type: "privacy",
  });

  useEffect(() => {
    if (!isLoading && isSignedIn && location !== nextPath) {
      setLocation(nextPath);
    }
  }, [isLoading, isSignedIn, location, nextPath, setLocation]);

  if (!isLoading && isSignedIn) return null;

  return (
    <div className="relative md:h-screen md:overflow-hidden w-full bg-background">
      <Particles color="#aaaaaa" quantity={400} ease={12} staticity={20} size={0.8} className="absolute inset-0" />
      <div aria-hidden className="absolute inset-0 isolate -z-10 contain-strict">
        <div className="bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,--theme(--color-foreground/.06)_0,hsla(0,0%,55%,.02)_50%,--theme(--color-foreground/.01)_80%)] absolute top-0 left-0 h-[1280px] w-[560px] -translate-y-[350px] -rotate-45 rounded-full" />
        <div className="bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] absolute top-0 left-0 h-[1280px] w-[240px] [translate:5%_-50%] -rotate-45 rounded-full" />
        <div className="bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] absolute top-0 left-0 h-[1280px] w-[240px] -translate-y-[350px] -rotate-45 rounded-full" />
      </div>
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4">
        <Button variant="ghost" className="absolute top-4 left-4" asChild>
          <a href="/">
            <ChevronLeftIcon className="me-1 size-4" />
            Home
          </a>
        </Button>

        <div className="liquid-glass mx-auto w-full max-w-md rounded-3xl p-10 shadow-2xl shadow-black/40">
          <div className="flex flex-col space-y-10">
            <p className="text-2xl font-semibold tracking-tight text-white">Hatchin<span className="text-indigo-400">.</span></p>

            <div className="flex flex-col space-y-3">
              <h1 className="font-heading text-2xl font-bold tracking-wide text-white">Sign In or Join Now!</h1>
              <p className="text-white/60 text-base">Your AI team is ready. Let's build something worth hatching.</p>
            </div>

            {authError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                Authentication failed. Please try again.
              </div>
            )}

            <Button type="button" size="lg" className="w-full" asChild>
              <a href={`/api/auth/google/start?returnTo=${encodeURIComponent(nextPath)}`}>
                <GoogleIcon className="me-2 size-4" />
                Continue with Google
              </a>
            </Button>

            <p className="text-muted-foreground text-sm">
              By clicking continue, you agree to our{" "}
              <a
                href="/legal/terms"
                onClick={(e) => {
                  e.preventDefault();
                  setLegalModal({ open: true, type: "terms" });
                }}
                className="hover:text-primary underline underline-offset-4"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/legal/privacy"
                onClick={(e) => {
                  e.preventDefault();
                  setLegalModal({ open: true, type: "privacy" });
                }}
                className="hover:text-primary underline underline-offset-4"
              >
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>
      </div>
      <LegalModal
        open={legalModal.open}
        onOpenChange={(open) => setLegalModal((prev) => ({ ...prev, open }))}
        type={legalModal.type}
      />
    </div>
  );
}
