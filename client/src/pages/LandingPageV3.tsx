// Landing v3 — assembly.
//
// A port of the FIMI project-page architecture (a light editorial system: mono
// eyebrows, square 1px panels, self-drawing illustrations, an auto-advancing
// stepper, and two bentos) recoloured to Hatchin and filled with Hatchin's own
// content. The hero is the one we already ship, copied verbatim.
//
// Parallel page. It imports nothing from LandingPage.tsx or LandingPageV2.tsx
// and modifies neither, so /landing, /v2 and /v3 run side by side.
//
// The stylesheet is scoped entirely under .lv3 / .lv3-editorial. That is
// deliberate: landing-v2's clickup-ported.css shipped unscoped .text-sm colour
// rules that painted the whole app, which is why it has to be lazy-loaded. This
// one cannot do that, but the route is lazy anyway for bundle size.

import { useEffect } from "react";

import ClosingBand from "@/components/landing-v3/ClosingBand";
import HeroFullScreen from "@/components/landing-v3/HeroFullScreen";
import SectionOvernight from "@/components/landing-v3/SectionOvernight";
import SectionInside from "@/components/landing-v3/SectionInside";
import SectionCompare from "@/components/landing-v3/SectionCompare";
import SectionOverview from "@/components/landing-v3/SectionOverview";
import SectionJobs from "@/components/landing-v3/SectionJobs";
import SectionRail from "@/components/landing-v3/SectionRail";
import SectionPricing from "@/components/landing-v3/SectionPricing";
import SiteFooter from "@/components/landing-v3/SiteFooter";
import "@/components/landing-v3/landing-v3.css";

export default function LandingPageV3() {
  useEffect(() => {
    if (history.scrollRestoration) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    // index.css puts `overflow: hidden` on body for the app shell, so a
    // full-page scrolling route has to opt back in. LandingPage.tsx does the
    // same; without it the page renders but will not scroll.
    document.body.style.overflow = "auto";
    document.body.style.overflowX = "hidden";
    return () => {
      document.body.style.overflow = "";
      document.body.style.overflowX = "";
    };
  }, []);

  // The FIMI rail anchors with plain hashes; smooth scrolling makes the jump
  // read as movement through the page rather than a cut.
  useEffect(() => {
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = previous;
    };
  }, []);

  return (
    <div className="lv3 min-h-screen w-full bg-[#0A0C13]">
      {/* Parallax: the hero is PINNED for its first screenful and the page
          scrolls up over it. position:sticky (not fixed) keeps it in flow, so
          it occupies exactly one viewport of scroll and then stops paying rent,
          which is what makes the overview read as sliding across it.
          It sits outside .lv3-editorial so its liquid-glass borders are not
          touched by the editorial border default. */}
      <div className="sticky top-0 z-0 h-screen overflow-hidden">
        <HeroFullScreen showSparkles={false} />
      </div>

      {/* rides alongside the editorial half */}
      <SectionRail />

      {/* z-10 + an opaque background is what lets this cover the pinned hero */}
      <main className="lv3-editorial relative z-10 bg-white shadow-[0_-24px_60px_rgba(10,12,19,0.45)]">
        <SectionOverview />
        <SectionJobs />
        <SectionOvernight />
        <SectionCompare />
        <SectionInside />
        <SectionPricing />
        <ClosingBand />
      </main>

      {/* z-20 so the footer's viewport-pinned glow paints above <main> */}
      <SiteFooter />

    </div>
  );
}
