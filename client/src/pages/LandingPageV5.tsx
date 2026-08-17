// Landing v5 — hero only.
//
// Deliberately self-contained: nav, hero, social footer, and nothing else. No
// sections are imported and no existing section component is touched.
//
// THE LOOP: the `loop` attribute is intentionally absent. A looping video never
// fires `ended`, and the whole fade system described for this screen hangs off
// `ended` to restart the clip. So looping is done in JavaScript instead: fade
// out with 0.55s left, `ended` drops opacity to 0, and 100ms later the video
// rewinds, plays, and fades back in. Adding `loop` back would silently kill
// every fade.
//
// The video is self-hosted and re-encoded (19.13 MB to 2.03 MB) rather than
// pulled from the CloudFront bucket it was authored on, matching the rest of
// the site. It is used here and nowhere else.

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Globe, Instagram, Twitter } from "lucide-react";

import "./landing-v5.css";

const VIDEO_SRC = "/media/hero-v5.mp4";
const VIDEO_POSTER = "/media/hero-v5-poster.jpg";

const FADE_MS = 500;
/** Seconds of tail left when the fade-out starts. */
const FADE_OUT_LEAD = 0.55;
/** Gap between the clip ending and the rewound clip starting. */
const RESTART_DELAY_MS = 100;

const NAV_LINKS = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Real jobs", href: "/#jobs" },
  { label: "Pricing", href: "/#start" },
];

export default function LandingPageV5() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const restartRef = useRef<number | null>(null);
  /** Guards against timeupdate firing repeatedly inside the fade-out window. */
  const fadingOutRef = useRef(false);
  const [email, setEmail] = useState("");

  const cancelFade = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  /** Animates opacity to `target` over FADE_MS, resuming from wherever the
   *  previous fade left off rather than snapping to a start value. */
  const fadeTo = useCallback(
    (target: number) => {
      const v = videoRef.current;
      if (!v) return;
      cancelFade();

      const from = Number(v.style.opacity || "0");
      const delta = target - from;
      if (delta === 0) return;

      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / FADE_MS);
        v.style.opacity = String(from + delta * t);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [cancelFade],
  );

  const handleLoadedData = useCallback(() => {
    fadingOutRef.current = false;
    fadeTo(1);
  }, [fadeTo]);

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    if (fadingOutRef.current) return;
    if (v.duration - v.currentTime <= FADE_OUT_LEAD) {
      fadingOutRef.current = true;
      fadeTo(0);
    }
  }, [fadeTo]);

  const handleEnded = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    cancelFade();
    v.style.opacity = "0";
    restartRef.current = window.setTimeout(() => {
      v.currentTime = 0;
      void v.play();
      fadingOutRef.current = false;
      fadeTo(1);
    }, RESTART_DELAY_MS);
  }, [cancelFade, fadeTo]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (restartRef.current !== null) clearTimeout(restartRef.current);
    },
    [],
  );

  return (
    <div className="lv5 relative min-h-screen overflow-hidden bg-black">
      {/* Shifted down so the black upper third of the frame is cropped away and
          the lit subject sits in view. */}
      <video
        ref={videoRef}
        className="lv5-video absolute inset-0 h-full w-full translate-y-[17%] object-cover"
        autoPlay
        muted
        playsInline
        aria-hidden="true"
        poster={VIDEO_POSTER}
        src={VIDEO_SRC}
        onLoadedData={handleLoadedData}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />

      <div className="relative flex min-h-screen flex-col">
        <nav className="relative z-20 py-6 pl-6 pr-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between rounded-full px-6 py-3">
            <div className="flex items-center gap-8">
              <a href="/" className="flex items-center gap-2 text-lg font-semibold text-white">
                <Globe size={24} />
                Hatchin
              </a>
              <div className="hidden items-center gap-8 md:flex">
                {NAV_LINKS.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    className="text-sm font-medium text-white/80 transition-colors hover:text-white"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <a href="/login" className="text-sm font-medium text-white">
                Sign Up
              </a>
              <a
                href="/login"
                className="liquid-glass rounded-full px-6 py-2 text-sm font-medium text-white"
              >
                Login
              </a>
            </div>
          </div>
        </nav>

        <main className="relative z-10 flex flex-1 -translate-y-[20%] flex-col items-center justify-center px-6 py-12 text-center">
          <h1
            className="mb-8 whitespace-nowrap text-5xl tracking-tight text-white md:text-6xl lg:text-7xl"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Built for the curious
          </h1>

          <div className="w-full max-w-xl space-y-4">
            <form
              onSubmit={(e) => e.preventDefault()}
              className="liquid-glass flex items-center gap-3 rounded-full py-2 pl-6 pr-2"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                aria-label="Email address"
                className="min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-white/40 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Submit email"
                className="rounded-full bg-white p-3 text-black"
              >
                <ArrowRight size={20} />
              </button>
            </form>

            <p className="px-4 text-sm leading-relaxed text-white">
              Stay updated with the latest news and insights. Subscribe to our newsletter today and
              never miss out on exciting updates.
            </p>

            <div className="flex justify-center">
              <button
                type="button"
                className="liquid-glass rounded-full px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-white/5"
              >
                Manifesto
              </button>
            </div>
          </div>
        </main>

        <div className="relative z-10 flex justify-center gap-4 pb-12">
          {[
            { Icon: Instagram, label: "Instagram" },
            { Icon: Twitter, label: "Twitter" },
            { Icon: Globe, label: "Website" },
          ].map(({ Icon, label }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              className="liquid-glass rounded-full p-4 text-white/80 transition-all hover:bg-white/5 hover:text-white"
            >
              <Icon size={20} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
