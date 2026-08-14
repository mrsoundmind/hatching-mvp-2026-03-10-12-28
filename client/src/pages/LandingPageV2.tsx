// Landing v2 — assembly.
//
// The hero is the one we already have, copied verbatim from LandingPage.tsx.
// Everything under it is a port of the components from the ClickUp Super
// Agents mirror in website-clones/: their markup structure, their compiled
// CSS re-namespaced under lv2-, our content inside.
//
// Parallel page. It does not import from or modify LandingPage.tsx, so /landing
// and /v2 can run side by side.
//
// Character art is not generated yet. CharacterSlot draws a placeholder
// silhouette with the Shell Visor until paths are filled into
// components/landing-v2/characterAssets.ts, the only file that needs editing
// when the images land.

import { useEffect } from "react";
import { Link } from "wouter";
import AgentCarousel from "@/components/landing-v2/AgentCarousel";
import CapabilityMorph from "@/components/landing-v2/CapabilityMorph";
import CounterBand from "@/components/landing-v2/CounterBand";
import CtaCallout from "@/components/landing-v2/CtaCallout";
import CtaFinal from "@/components/landing-v2/CtaFinal";
import ExistingHero from "@/components/landing-v2/ExistingHero";
import FeatureRows from "@/components/landing-v2/FeatureRows";
import HeroPinned from "@/components/landing-v2/HeroPinned";
import PillsMarquee from "@/components/landing-v2/PillsMarquee";
import SixUpGrid from "@/components/landing-v2/SixUpGrid";
import SkillShowcase from "@/components/landing-v2/SkillShowcase";
import StatementBand from "@/components/landing-v2/StatementBand";
import "@/components/landing-v2/clickup-ported.css";
import "@/components/landing-v2/landing-v2.css";

export default function LandingPageV2() {
  useEffect(() => {
    if (history.scrollRestoration) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    // index.css puts `overflow: hidden` on body for the app shell, so a
    // full-page scrolling route has to opt back in. LandingPage.tsx does the
    // same thing; without it the page renders but will not scroll.
    document.body.style.overflow = "auto";
    document.body.style.overflowX = "hidden";
    return () => {
      document.body.style.overflow = "";
      document.body.style.overflowX = "";
    };
  }, []);

  return (
    <div className="lv2 w-full font-sans" style={{ background: "#0a0c13" }}>
      <div className="brutalist-mono sticky top-0 z-[80] w-full bg-[#f97316] px-4 py-1 text-center text-[11px] font-semibold tracking-[0.14em] text-[#0a0c13]">
        LANDING V2 PROTOTYPE · CHARACTER ART PENDING · /landing IS UNCHANGED
      </div>

      {/* the hero we already have, unchanged */}
      <ExistingHero />

      {/* Their pinned character hero, placed as a second act rather than at
          the top, so the video hero keeps the opening slot. */}
      <HeroPinned character="Dev" />

      <div id="team">
        <AgentCarousel />
      </div>

      <CtaCallout />

      <StatementBand
        eyebrow="NO ROUTING"
        title="Say it once. The right one picks it up."
        description="You do not choose who works on what. Describe the problem and the team decides who owns it, then tells you who took it."
        cta={{ label: "See the team", href: "/login" }}
      />

      <div id="how">
        <SkillShowcase />
      </div>

      <CounterBand />

      <PillsMarquee />

      <CapabilityMorph />

      <FeatureRows />

      <SixUpGrid />

      <CtaFinal />

      <footer className="w-full px-5 py-10 md:px-8">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 border-t border-white/[0.08] pt-8 text-[13px] text-white/40 md:flex-row">
          <span>Hatchin</span>
          <div className="flex items-center gap-5">
            <Link href="/landing" className="transition-colors duration-200 hover:text-white/70">
              Compare with v1
            </Link>
            <a href="/legal/privacy" className="transition-colors duration-200 hover:text-white/70">
              Privacy
            </a>
            <a href="/legal/terms" className="transition-colors duration-200 hover:text-white/70">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
