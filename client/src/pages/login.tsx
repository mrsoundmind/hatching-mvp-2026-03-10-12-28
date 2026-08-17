// Sign in / sign up.
//
// One route serves both. Google OAuth signs in an existing account and creates
// one for a new user through the same endpoint, so the two buttons differ only
// in the words people are looking for, not in where they go.
//
// LAYOUT: a white page holding one rounded card that locks to the viewport on
// desktop (lg:h-[calc(100vh-48px)]) and grows with its content below that, so a
// phone never traps the card in a short scrolling box. The video fills the card,
// the content sits above it: glass nav pill at the top, a flexible spacer, then
// headline and auth card sharing the bottom edge.
//
// FONT SCOPING: the design calls for Inter everywhere. That is applied by the
// `lv3` class, NOT by a global `* { font-family }` rule, which would have
// restyled the whole application and overridden Poppins across the product.
// `.lv3` also carries the colour tokens used below. Both are scoped to this
// subtree, so nothing outside this page can be affected.
//
// Inter and Instrument Serif are already requested in client/index.html, so
// there is deliberately no @font-face or @import here: a second request for
// fonts the page has already downloaded would cost a round trip and reopen the
// CSP hole that blocked Google Fonts in production.

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

import { useAuth } from "@/hooks/useAuth";
import LegalModal from "@/components/legal/LegalModal";
import Wordmark from "@/components/landing-v3/Wordmark";
import AgentAvatar from "@/components/avatars/AgentAvatar";
import "@/components/landing-v3/landing-v3.css";

/** The same faces the homepage roster renders, through the same AgentAvatar
 *  component, so the two surfaces cannot drift apart. Character names and roles
 *  are the real ones from the role registry, not decoration. */
const TEAM_PREVIEW = [
  { name: "Maya", role: "Idea Partner" },
  { name: "Alex", role: "Product Manager" },
  { name: "Dev", role: "Backend Developer" },
  { name: "Cleo", role: "Product Designer" },
  { name: "Sam", role: "QA Lead" },
  { name: "Mira", role: "Content Writer" },
  { name: "Kai", role: "Growth Marketer" },
];

/** Self-hosted and re-encoded. See the LandingPageV4 note: the original was
 *  13.49 MB from a CloudFront bucket we do not own. */
const VIDEO_URL = "/media/login.mp4";
const VIDEO_POSTER = "/media/login-poster.jpg";

/** The card and its content layer must climb the same height ladder, or the
 *  content stops filling the card and the bottom row floats mid-air. */
const HEIGHT_LADDER =
  "min-h-[calc(100vh-24px)] sm:min-h-[calc(100vh-32px)] md:min-h-[calc(100vh-48px)]";

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

  const authHref = `/api/auth/google/start?returnTo=${encodeURIComponent(nextPath)}`;

  return (
    <div className="lv3 min-h-screen w-full bg-white p-3 sm:p-4 md:p-6">
      <div
        className={`relative overflow-hidden rounded-2xl sm:rounded-3xl lg:h-[calc(100vh-48px)] ${HEIGHT_LADDER}`}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          poster={VIDEO_POSTER}
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src={VIDEO_URL} type="video/mp4" />
        </video>

        {/* No scrim over the video, by choice. Measured before removing it: the
            region the white headline occupies averages luma 92 on this footage,
            which is 6.67:1 against white and clears AA on its own. A gradient
            here would only mute the clip for nothing. */}

        <div
          className={`relative z-10 flex flex-col gap-6 p-4 sm:p-6 md:p-8 lg:h-full ${HEIGHT_LADDER}`}
        >
          {/* sm:self-start is load-bearing: this is a child of a flex-col, whose
              default align-items:stretch makes it span the card regardless of
              `w-auto`. Without it the pill renders as a full-width grey band. */}
          <nav className="flex w-full items-center gap-3 rounded-2xl bg-white/60 py-2 pl-3 shadow-sm backdrop-blur-md sm:w-auto sm:gap-6 sm:self-start sm:pl-4 pr-2">
            <Wordmark tone="dark" />
            <a
              href="/"
              className="ml-auto rounded-xl bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 sm:px-5"
            >
              Back to site
            </a>
          </nav>

          {/* Headline and card are ONE column now, headline directly on top of
              the card, the pair centred against the video. They were side by
              side, which left them sharing no edge and reading as two unrelated
              things; stacked, the headline titles the panel it sits on. */}
          <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-end">
            {/* Narrower than it was. At 620px the panel was 41-58% empty space
                depending on viewport, which read as an unfinished box rather
                than a designed one. Capped and centred below lg too, where it
                previously stretched to 722px. */}
            {/* lg:self-center, and NO h-full on the card below. Stretching the
                panel to the full frame height left it with more height than
                content, and there is no arrangement of that which looks right:
                centring the content puts dead space at both edges, spreading it
                puts a hole in the middle. Sized to its content and centred
                against the video instead, so there is no void to distribute. */}
            <div className="mx-auto w-full max-w-[440px] shrink-0 lg:mx-0 lg:w-[40%] lg:max-w-[460px] lg:self-center">
              {/* Four tiers, with spacing carrying the hierarchy: gap-8 BETWEEN
                  groups, tight spacing inside them. Previously every element sat
                  in one flat stack at the same gap-5, so nothing read as more or
                  less important than anything else. */}
              {/* justify-BETWEEN, not center. Centering floated the content in
                  the middle of a full-height panel and left ~90px of dead space
                  above and below it. The action sits at the top where it is read
                  first; the team sits on the bottom edge and closes the panel. */}
              <div className="flex flex-col justify-between gap-8 overflow-hidden rounded-2xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7 lg:p-8">
                {/* ── TOP: what this is, and the action ── */}
                <div className="flex flex-col gap-6">
                {/* The page's only heading, and the card's title. It carries the
                    same two-font treatment as the homepage headline: sans for
                    the setup, Instrument Serif italic for the payoff. */}
                <div>
                  <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-black lg:text-[32px]">
                    Meet your{" "}
                    <span
                      style={{
                        fontFamily: "'Instrument Serif', serif",
                        fontStyle: "italic",
                        fontWeight: 400,
                      }}
                    >
                      team.
                    </span>
                  </h1>
                  <p className="mt-2 text-sm text-gray-500">
                    They plan, push back, and hand back finished work.
                  </p>
                </div>

                {authError && (
                  <div
                    className="rounded-xl border px-4 py-3 text-sm"
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

                {/* 2 — the action. One group, tightly spaced, so the two buttons
                    and their caption read as a single decision rather than three
                    unrelated blocks. Blue matches the "Start free" pill clicked
                    on the landing page; the secondary is deliberately quieter. */}
                <div className="flex flex-col gap-3">
                  <a
                    href={authHref}
                    className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl text-[15px] font-semibold text-white transition-transform hover:scale-[1.02] lg:h-[52px]"
                    style={{
                      background: "var(--lv3-blue)",
                      boxShadow: "0 8px 26px rgba(66,87,232,0.35)",
                    }}
                  >
                    <GoogleIcon className="size-4" />
                    Sign in with Google
                  </a>

                  <div className="flex items-center gap-3 py-0.5">
                    <span className="h-px flex-1 bg-gray-100" />
                    <span className="text-xs font-medium text-gray-400">OR</span>
                    <span className="h-px flex-1 bg-gray-100" />
                  </div>

                  <a
                    href={authHref}
                    className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-gray-200 text-[15px] font-medium text-gray-700 transition-colors hover:border-gray-400 hover:text-black lg:h-[52px]"
                  >
                    <GoogleIcon className="size-4" />
                    Create an account with Google
                  </a>

                  <p className="pt-1 text-center text-xs text-gray-400">
                    Free forever plan · no card needed
                  </p>
                </div>
                </div>

                {/* ── BOTTOM: the team, then legal, pinned to the bottom edge ── */}
                <div className="flex flex-col gap-4">
                  {/* A hairline rule rather than the filled grey card this was:
                      that box carried as much weight as the primary button and
                      competed with it. */}
                  <div className="border-t border-gray-100 pt-6">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                      Who you're signing in to
                    </p>
                    <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                      {TEAM_PREVIEW.map((m) => (
                        <AgentAvatar key={m.name} characterName={m.name} role={m.role} size={36} />
                      ))}
                    </div>
                    <p className="mt-3.5 text-[13px] leading-relaxed text-gray-500">
                      Maya shapes the idea, Alex scopes it, Dev builds it. They push back when
                      they think you're wrong.
                    </p>
                  </div>

                {/* Legal, the quietest tier. `border-t` with no colour inherits
                    the app's default border, which rendered as a hard near-black
                    rule cutting the card in half. */}
                <p className="text-[12px] leading-relaxed text-gray-400">
                  By continuing you agree to our{" "}
                  <button
                    type="button"
                    onClick={() => setLegalModal({ open: true, type: "terms" })}
                    className="underline underline-offset-4 transition-colors hover:text-black"
                  >
                    Terms of Service
                  </button>{" "}
                  and{" "}
                  {/* Link and full stop kept on one line: as separate inline
                      nodes the period wrapped alone onto the next line. */}
                  <span className="whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setLegalModal({ open: true, type: "privacy" })}
                      className="underline underline-offset-4 transition-colors hover:text-black"
                    >
                      Privacy Policy
                    </button>
                    .
                  </span>
                </p>
                </div>
              </div>
            </div>
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
