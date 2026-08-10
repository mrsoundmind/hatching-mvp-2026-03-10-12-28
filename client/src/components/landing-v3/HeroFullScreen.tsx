// Landing v3 — the hero.
//
// Full-screen video, but no longer a verbatim copy of v1's hero. It was the
// last thing on the page still speaking v1's design language: a frosted
// liquid-glass pill for the CTA while every other button is a solid blue one, a
// nav whose labels pointed at sections that do not exist here, and a headline
// whose first concrete word arrived below the fold.
//
// What changed and why:
//   nav       labels now match the rail exactly, so a click lands where it says
//   headline  kept. It is the brand line and it earns its place. An eyebrow
//             above it ("34 AI specialists · one project") was tried and
//             removed on request, so the subhead is now the first concrete
//             description on the page
//   subhead   names the whole team, not three of them, and says what you get
//   CTA       the page's own primary pill plus a secondary route into the
//             strongest section, for anyone not ready to sign up
//   proof     one line under the buttons that answers "what does clicking cost"
//
// The video, the field colour and the scroll cue are untouched.

import { Link } from "wouter";
import { Sparkles } from "@/components/ui/sparkles";

import Wordmark from "./Wordmark";

const NAV = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Real jobs", href: "#jobs" },
  { label: "Pricing", href: "#start" },
];

/**
 * `showSparkles` is off when the hero is pinned behind the page: the sparkles
 * band existed to blend the hero into the dark section under it, and the
 * overview sliding over the top now does that job.
 */
export function HeroFullScreen({ showSparkles = true }: { showSparkles?: boolean }) {
  return (
    <>
      {/* ━━━ HERO ━━━ */}
      <section className="relative min-h-screen overflow-hidden flex-shrink-0">
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

        {/* legibility scrim + the blend into the page below */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{ background: "rgba(10,12,19,0.42)" }}
        />
        {/* v1's Sparkles field, reused. It was already imported here but never
            rendered: it used to live in a band below the hero, which the
            pinned-hero parallax now covers. Over the video it reads. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[1]">
          <Sparkles
            className="h-full w-full"
            density={260}
            size={1.2}
            speed={0.7}
            opacity={0.45}
            color="#ffffff"
            background="transparent"
          />
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-64"
          style={{
            background:
              "linear-gradient(to bottom, rgba(10,12,19,0) 0%, rgba(10,12,19,0.35) 50%, rgba(10,12,19,0.85) 85%, #0A0C13 100%)",
          }}
        />

        {/* ── nav ─────────────────────────────────────────────────── */}
        <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8 md:py-6">
          <Wordmark tone="light" />

          <div className="hidden items-center gap-8 md:flex">
            {NAV.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm text-white/60 transition-colors hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </div>

          <Link href="/login">
            <button
              className="cursor-pointer rounded-full px-5 py-2 text-[13px] font-medium text-white transition-transform hover:scale-[1.03] md:text-sm"
              style={{ background: "var(--lv3-blue)", boxShadow: "0 6px 22px rgba(84,104,240,0.35)" }}
            >
              Start free
            </button>
          </Link>
        </nav>

        {/* ── hero copy ───────────────────────────────────────────── */}
        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-5 pb-32 pt-14 text-center sm:pb-48 sm:pt-20 md:px-8 md:pb-56">
          <h1
            className="animate-fade-rise max-w-4xl text-[34px] font-semibold leading-[1.06] tracking-[-1px] text-white sm:text-5xl md:text-[64px] md:tracking-[-2px]"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Where{" "}
            <em className="not-italic" style={{ color: "rgba(255,255,255,0.42)" }}>
              great ideas
            </em>{" "}
            find{" "}
            <em className="not-italic" style={{ color: "rgba(255,255,255,0.42)" }}>
              the team to build them.
            </em>
          </h1>

          <p className="animate-fade-rise-delay mt-6 max-w-xl text-[16px] leading-relaxed text-white/80 sm:text-lg md:mt-7">
            Tell them what you need. They plan it, push back, and hand you the finished work.
          </p>

          {/* ONE action here. "Start free" already sits in the nav a few
              inches up, so repeating it just split the same click two ways.
              This button sends people into the page instead, which is where
              the argument actually gets made. */}
          <div className="animate-fade-rise-delay-2 mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#jobs"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/30 px-8 text-[15px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              Watch them work
            </a>
          </div>

          {/* answers "what does clicking cost me" before the click */}
          <p className="lv3-label animate-fade-rise-delay-2 mt-5 text-white/45">
            Free forever plan · no card needed
          </p>
        </div>
      </section>

      {showSparkles && (
        <div className="relative z-[5] -mt-16 h-[200px] w-full">
          <Sparkles
            className="absolute inset-0 h-full w-full"
            density={400}
            size={1.4}
            speed={0.8}
            opacity={0.6}
            color="#ffffff"
            background="transparent"
          />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0A0C13] to-transparent" />
        </div>
      )}
    </>
  );
}

export default HeroFullScreen;
