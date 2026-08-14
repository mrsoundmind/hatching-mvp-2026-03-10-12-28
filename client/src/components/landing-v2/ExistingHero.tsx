// Landing v2 — the hero we already have.
//
// Copied verbatim out of client/src/pages/LandingPage.tsx (the HERO section
// and the SPARKLES TRANSITION that follows it). Same video, same nav, same
// copy, same CTA, same scroll cue. LandingPage.tsx itself is untouched: this
// is a copy so v1 and v2 can run side by side without one editing the other.
//
// Nothing here is a redesign. If you change the hero on v1, change it here too
// or the two pages will drift.

import { Link } from "wouter";
import { ChevronDown } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles";

export function ExistingHero() {
  return (
    <>
      {/* ━━━ HERO ━━━ */}
      <section className="relative min-h-screen overflow-hidden flex-shrink-0">
        {/* Full-screen video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
            type="video/mp4"
          />
        </video>

        {/* Edge blend — fade bottom of video into dark bg below */}
        <div
          className="absolute inset-x-0 bottom-0 h-64 z-[1] pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(10,12,19,0) 0%, rgba(10,12,19,0.35) 50%, rgba(10,12,19,0.85) 85%, #0A0C13 100%)",
          }}
        />

        {/* Navigation */}
        <nav className="relative z-10 flex items-center justify-between px-5 py-5 md:px-8 md:py-6 max-w-7xl mx-auto">
          <span
            className="text-[22px] md:text-[28px] tracking-tight text-white"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Hatchin<sup className="text-xs align-super ml-0.5">®</sup>
          </span>

          <div className="hidden md:flex items-center gap-8">
            {[
              { label: "Product", href: "#how-it-works" },
              { label: "Pricing", href: "#pricing" },
              { label: "FAQ", href: "#faq" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-white/55 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <Link href="/login">
            <button className="liquid-glass rounded-full px-4 py-1.5 text-[13px] md:px-5 md:py-2 md:text-sm text-white hover:scale-[1.03] transition-transform cursor-pointer">
              Get Started
            </button>
          </Link>
        </nav>

        {/* Hero copy */}
        <div className="relative z-10 flex flex-col items-center text-center px-5 pt-12 pb-32 sm:pt-16 sm:pb-48 md:px-6 md:pt-20 md:pb-64">
          <h1
            className="animate-fade-rise text-[32px] sm:text-5xl md:text-6xl leading-[1.08] tracking-[-1px] md:tracking-[-1.5px] max-w-4xl font-semibold text-white"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Where{" "}
            <em className="not-italic" style={{ color: "rgba(255,255,255,0.38)" }}>
              great ideas
            </em>{" "}
            find{" "}
            <em className="not-italic" style={{ color: "rgba(255,255,255,0.38)" }}>
              the team to build them.
            </em>
          </h1>

          <p
            className="animate-fade-rise-delay text-[15px] sm:text-lg max-w-xl mt-6 md:mt-8 leading-relaxed"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            A PM, an engineer, a designer: real AI teammates who plan, push back, and ship the work,
            not just chat about it.
          </p>

          <Link href="/login">
            <button className="animate-fade-rise-delay-2 liquid-glass rounded-full px-8 py-3.5 text-[15px] md:px-14 md:py-5 md:text-base text-white mt-8 md:mt-12 hover:scale-[1.03] transition-transform cursor-pointer">
              Meet Your Team →
            </button>
          </Link>

          {/* Scroll indicator */}
          <div
            className="animate-fade-rise-delay-3 mt-16 flex flex-col items-center gap-2"
            style={{ color: "rgba(255,255,255,0.28)" }}
          >
            <span className="text-xs tracking-[0.22em] uppercase">Scroll to explore</span>
            <ChevronDown className="w-4 h-4 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ━━━ SPARKLES TRANSITION ━━━ */}
      <div className="relative w-full h-[200px] -mt-16 z-[5]">
        <Sparkles
          className="absolute inset-0 w-full h-full"
          density={400}
          size={1.4}
          speed={0.8}
          opacity={0.6}
          color="#ffffff"
          background="transparent"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0A0C13] to-transparent" />
      </div>
    </>
  );
}

export default ExistingHero;
