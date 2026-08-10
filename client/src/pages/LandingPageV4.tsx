// Landing v4 — the v3 page with the Prisma hero.
//
// Everything below the fold is v3's, unchanged and shared by import, so the two
// versions cannot drift: only the hero differs. That is the whole point of this
// variant — it isolates the hero decision.
//
// Differences from v3's hero:
//   · the wordmark becomes the headline, at ~14vw, pulled up word by word
//   · the nav is a centred black tab hanging from the top edge
//   · body copy and CTA sit bottom-right against the headline bottom-left
//   · it keeps v3's two hero effects: the Sparkles field over the video, and
//     the sticky pin so the page scrolls up over it. With a bottom-anchored
//     headline the pin reads well: the big word is the first thing the white
//     page eats as you scroll.

import { useEffect, useState } from "react";

import ClosingBand from "@/components/landing-v3/ClosingBand";
import SectionCompare from "@/components/landing-v3/SectionCompare";
import SectionInside from "@/components/landing-v3/SectionInside";
import SectionJobs from "@/components/landing-v3/SectionJobs";
import SectionOverview from "@/components/landing-v3/SectionOverview";
import SectionOvernight from "@/components/landing-v3/SectionOvernight";
import SectionPricing from "@/components/landing-v3/SectionPricing";
import SectionRail from "@/components/landing-v3/SectionRail";
import SiteFooter from "@/components/landing-v3/SiteFooter";
import { Sparkles } from "@/components/ui/sparkles";
import { PrismaHero } from "@/components/ui/prisma-hero";
import "@/components/landing-v3/landing-v3.css";

const NAV = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Real jobs", href: "#jobs" },
  { label: "Pricing", href: "#start" },
];

export default function LandingPageV4() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (history.scrollRestoration) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    document.body.style.overflow = "auto";
    document.body.style.overflowX = "hidden";
    setMounted(true);
    return () => {
      document.body.style.overflow = "";
      document.body.style.overflowX = "";
    };
  }, []);

  useEffect(() => {
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = previous;
    };
  }, []);

  return (
    <div className="lv3 min-h-screen w-full bg-[#0A0C13]">
      {/* pinned, exactly like v3: the page scrolls up over the hero */}
      <div className="sticky top-0 z-0 h-screen overflow-hidden">
        <PrismaHero
          /* v3's line, in v3's two-font treatment. The giant word below is the
             brand; this is the promise. */
          tagline={[
            { text: "Where great ideas find" },
            { text: "their team.", className: "lv3-serif-em", style: { fontWeight: 400 } },
          ]}
          title="Hatchin"
          showAsterisk
          body="Tell them what you need. They push back, then deliver."
          ctaLabel="Start free"
          ctaHref="/login"
          navItems={NAV}
          /* Sign in moves out of the centre tab to the top right, like v3.
             It stays "Sign in" rather than a second "Start free": the bottom
             CTA already carries that, and two identical buttons split one
             click two ways, which is the thing v3's hero was fixed for. */
          navCta={{ label: "Sign in", href: "/login" }}
          /* Self-hosted, re-encoded. The original shipped from a CloudFront
             bucket we do not own, at 1924x1076 / 12.8 Mbps / 15.35 MB, which
             was 96% of the whole page weight. Re-encoded at CRF 30 with no
             audio track it is 0.66 MB and frame-for-frame indistinguishable
             (it is a darkened background loop behind a scrim). */
          videoSrc="/media/hero.mp4"
          videoPoster="/media/hero-poster.jpg"
          ctaBg="var(--lv3-blue)"
          ctaFg="#ffffff"
          overlay={
            <Sparkles
              className="h-full w-full"
              density={260}
              size={1.2}
              speed={0.7}
              opacity={0.45}
              color="#ffffff"
              background="transparent"
            />
          }
        />
      </div>

      {mounted && <SectionRail />}

      {/* the same sections v3 ships, imported not copied */}
      <main className="lv3-editorial relative z-10 bg-white shadow-[0_-24px_60px_rgba(10,12,19,0.45)]">
        <SectionOverview />
        <SectionJobs />
        <SectionOvernight />
        <SectionCompare />
        <SectionInside />
        <SectionPricing />
        <ClosingBand />
      </main>

      <SiteFooter />
    </div>
  );
}
