// Sign in.
//
// Rebuilt to match landing v3. It was the last page still speaking v1's
// language: a particle field, a frosted liquid-glass card, "Hatchin." with an
// indigo full stop, and a shadcn default button. Someone clicking "Start free"
// on v3 landed somewhere that looked like a different product.
//
// It now echoes the v3 hero directly — same video, same scrim, same wordmark,
// same blue pill — with the editorial white card the rest of the page uses.
//
// NOTE: this route is shared. /landing (v1) and every AuthGuard redirect land
// here too, so v1 now leads into a v3-styled sign-in. That is the intended
// direction of travel, but it is a cross-page change, not a v3-only one.
//
// landing-v3.css is imported for its tokens. Every rule in it is scoped under
// .lv3, so loading it here cannot restyle anything else.

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import LegalModal from "@/components/legal/LegalModal";
import Wordmark from "@/components/landing-v3/Wordmark";
import "@/components/landing-v3/landing-v3.css";

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
    <div className="lv3 relative min-h-screen w-full overflow-hidden bg-[#0A0C13]">
      {/* the hero's own footage, so signing in feels like the same place */}
      {/* Self-hosted, re-encoded: 13.49 MB -> 1.09 MB. See LandingPageV4. */}
      <video
        autoPlay
        loop
        muted
        playsInline
        poster="/media/login-poster.jpg"
        className="absolute inset-0 z-0 h-full w-full object-cover"
      >
        <source src="/media/login.mp4" type="video/mp4" />
      </video>
      {/* a lighter scrim so the footage (and the person in it) stays visible; a
          soft top-and-bottom gradient keeps the white wordmark, Back link, and the
          card's edge legible without darkening the whole scene. */}
      <div
        aria-hidden
        className="absolute inset-0 z-[1]"
        style={{ background: "linear-gradient(to bottom, rgba(10,12,19,0.55) 0%, rgba(10,12,19,0.22) 34%, rgba(10,12,19,0.22) 66%, rgba(10,12,19,0.55) 100%)" }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <Wordmark tone="light" />
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Back
          </a>
        </div>

        {/* card sits in the upper area, not dead-centre, so it no longer covers
            the person in the footage below it */}
        <div className="flex flex-1 items-start justify-center pt-8 pb-10 sm:pt-14">
          <div className="lv3-editorial w-full max-w-[420px] rounded-xl border bg-white p-8 shadow-2xl shadow-black/30 sm:p-10">
            <span className="lv3-label lv3-t-blue">Start free</span>
            <h1
              className="lv3-t-navy mt-3 text-[30px] font-bold leading-tight tracking-[-0.02em]"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Meet your team.
            </h1>
            <p className="lv3-t-soft mt-3 text-[15px] leading-relaxed">
              They plan, push back, and hand back finished work.
            </p>

            {authError && (
              <div
                className="mt-6 border px-4 py-3 text-sm"
                style={{
                  borderColor: "rgba(192,49,26,0.35)",
                  background: "rgba(192,49,26,0.06)",
                  color: "#a32a16",
                }}
              >
                {authError === "email_in_use"
                  ? "That email is already registered with a different sign-in method."
                  : "Sign in failed. Please try again."}
              </div>
            )}

            {/* Both entry points. Google OAuth signs in an existing account and
                creates one for a new user through the same flow, so both buttons
                point at the same endpoint; showing both matches what people expect
                and answers "I clicked Sign in but I don't have an account yet." */}
            <div className="mt-7 flex flex-col gap-3">
              <a
                href={`/api/auth/google/start?returnTo=${encodeURIComponent(nextPath)}`}
                className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full text-[15px] font-medium text-white transition-transform hover:scale-[1.02]"
                style={{ background: "var(--lv3-blue)", boxShadow: "0 8px 26px rgba(66,87,232,0.35)" }}
              >
                <GoogleIcon className="size-4" />
                Sign in with Google
              </a>
              <a
                href={`/api/auth/google/start?returnTo=${encodeURIComponent(nextPath)}`}
                className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full border text-[15px] font-medium transition-colors hover:bg-[color:var(--lv3-candle)]"
                style={{ borderColor: "var(--lv3-border)", color: "var(--lv3-navy)" }}
              >
                <GoogleIcon className="size-4" />
                Create an account with Google
              </a>
            </div>

            <p className="lv3-label lv3-t-soft-55 mt-4 text-center">
              Free forever plan · no card needed
            </p>

            <p className="lv3-t-soft-55 mt-7 border-t pt-5 text-[12.5px] leading-relaxed">
              By continuing you agree to our{" "}
              <button
                type="button"
                onClick={() => setLegalModal({ open: true, type: "terms" })}
                className="underline underline-offset-4 transition-colors hover:text-[#14182f]"
              >
                Terms of Service
              </button>{" "}
              and{" "}
              <button
                type="button"
                onClick={() => setLegalModal({ open: true, type: "privacy" })}
                className="underline underline-offset-4 transition-colors hover:text-[#14182f]"
              >
                Privacy Policy
              </button>
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
