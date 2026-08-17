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
import SectionControl from "@/components/landing-v3/SectionControl";
import SectionJobs from "@/components/landing-v3/SectionJobs";
import SectionOverview from "@/components/landing-v3/SectionOverview";
import SectionPresets from "@/components/landing-v3/SectionPresets";
import SectionPricing from "@/components/landing-v3/SectionPricing";
import SectionProblem from "@/components/landing-v3/SectionProblem";
import SectionProof from "@/components/landing-v3/SectionProof";
import SectionRail from "@/components/landing-v3/SectionRail";
import SiteFooter from "@/components/landing-v3/SiteFooter";
import { Sparkles } from "@/components/ui/sparkles";
import { PrismaHero } from "@/components/ui/prisma-hero";
import "@/components/landing-v3/landing-v3.css";

// v4's own rail: Overnight is merged into Control here, so one fewer stop and the
// Control stop is relabelled to what it now covers.
const RAIL_ITEMS = [
  { id: "problem", n: "01", label: "The problem" },
  { id: "overview", n: "02", label: "How it works" },
  { id: "knowledge", n: "03", label: "vs a chatbot" },
  { id: "jobs", n: "04", label: "Real jobs" },
  { id: "control", n: "05", label: "While you're away" },
  { id: "packs", n: "06", label: "Start from a pack" },
  { id: "proof", n: "07", label: "The work" },
  { id: "start", n: "08", label: "Pricing" },
];

// The hero background alternates between these two clips. Nothing else about
// the hero changes: same headline, same copy, same nav, same CTA.
//
// It alternates rather than picking at random, because random repeats itself:
// a coin flip shows the same clip twice in a row half the time, which reads as
// "nothing changed". Storing the last index guarantees the other one next time.
const HERO_VIDEOS = [
  { src: "/media/hero.mp4", poster: "/media/hero-poster.jpg" },
  { src: "/media/hero-v5.mp4", poster: "/media/hero-v5-poster.jpg" },
];

const HERO_VIDEO_KEY = "hatchin-hero-video";

/** Resolved synchronously, before the first render commits. Choosing after
 *  mount would paint one clip and then swap the src, making the browser
 *  download both. */
function pickHeroVideo() {
  try {
    const prev = Number(window.localStorage.getItem(HERO_VIDEO_KEY) ?? "-1");
    const next = ((Number.isFinite(prev) ? prev : -1) + 1) % HERO_VIDEOS.length;
    window.localStorage.setItem(HERO_VIDEO_KEY, String(next));
    return HERO_VIDEOS[next];
  } catch {
    // private mode / storage disabled: fall back to the original clip
    return HERO_VIDEOS[0];
  }
}

export default function LandingPageV4() {
  const [mounted, setMounted] = useState(false);
  const [heroVideo] = useState(pickHeroVideo);

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
      {/* pinned, exactly like v3: the page scrolls up over the hero. On mobile the
          shell is 80vh (not a full screen) so the headline is not marooned at the
          bottom under a tall empty video band; desktop stays full height. */}
      <div className="sticky top-0 z-0 h-[80vh] overflow-hidden md:h-screen">
        <PrismaHero
          heightClass="h-[80vh] md:h-screen"
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
          /* Nav links removed per design: the hero carries only the promise, the
             wordmark, and the two CTAs (Start free below, Sign in top-right).
             The section rail below still provides in-page wayfinding. */
          navCta={{ label: "Sign in", href: "/login" }}
          /* Self-hosted, re-encoded. The original shipped from a CloudFront
             bucket we do not own, at 1924x1076 / 12.8 Mbps / 15.35 MB, which
             was 96% of the whole page weight. Re-encoded at CRF 30 with no
             audio track it is 0.66 MB and frame-for-frame indistinguishable
             (it is a darkened background loop behind a scrim). */
          videoSrc={heroVideo.src}
          videoPoster={heroVideo.poster}
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

      {mounted && <SectionRail items={RAIL_ITEMS} />}

      {/* the same sections v3 ships, imported not copied */}
      <main className="lv3-editorial relative z-10 bg-white shadow-[0_-24px_60px_rgba(10,12,19,0.45)]">
        <SectionProblem />
        <SectionOverview />
        <SectionCompare />
        <SectionJobs showRoster={false} />
        <SectionControl />
        <SectionPresets />
        <SectionProof />
        <SectionPricing />
        <ClosingBand />
      </main>

      <SiteFooter />
    </div>
  );
}
