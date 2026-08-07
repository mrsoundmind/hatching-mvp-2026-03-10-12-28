// Prisma hero — word-by-word pull-up headline over full-bleed video.
//
// Dependencies are already in this project: framer-motion and lucide-react.
// Nothing to install.
//
// LOCAL CHANGES from the source component:
//   1. Everything hardcoded to "Prisma" is now props. The original shipped its
//      own nav items, wordmark, body copy and button label inline, which would
//      have meant forking the file to reuse it.
//   2. Colours default to the page palette instead of #E1E0CC.
//   3. `.noise-overlay` is not a class this codebase defines, so the grain is
//      an inline SVG data URI here rather than a dangling class name.
//   4. The nav is real links, and the CTA renders as an anchor, so both work.

import { motion, useInView } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useRef, type CSSProperties, type ReactNode } from "react";

/* ---------------- WordsPullUp ---------------- */
interface WordsPullUpProps {
  text: string;
  className?: string;
  showAsterisk?: boolean;
  style?: CSSProperties;
}

export const WordsPullUp = ({
  text,
  className = "",
  showAsterisk = false,
  style,
}: WordsPullUpProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const words = text.split(" ");

  return (
    <div ref={ref} className={`inline-flex flex-wrap ${className}`} style={style}>
      {words.map((word, i) => {
        const isLast = i === words.length - 1;
        return (
          <motion.span
            key={i}
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="relative inline-block"
            style={{ marginRight: isLast ? 0 : "0.25em" }}
          >
            {word}
            {showAsterisk && isLast && (
              <span className="absolute -right-[0.3em] top-[0.65em] text-[0.31em]">*</span>
            )}
          </motion.span>
        );
      })}
    </div>
  );
};

/* ---------------- WordsPullUpMultiStyle ---------------- */
interface Segment {
  text: string;
  className?: string;
  style?: CSSProperties;
}

export const WordsPullUpMultiStyle = ({
  segments,
  className = "",
  style,
}: {
  segments: Segment[];
  className?: string;
  style?: CSSProperties;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  const words: Segment[] = [];
  segments.forEach((seg) => {
    seg.text.split(" ").forEach((w) => {
      if (w) words.push({ text: w, className: seg.className, style: seg.style });
    });
  });

  return (
    <div ref={ref} className={`inline-flex flex-wrap ${className}`} style={style}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          className={`inline-block ${w.className ?? ""}`}
          style={{ marginRight: "0.25em", ...w.style }}
        >
          {w.text}
        </motion.span>
      ))}
    </div>
  );
};

/* the grain the original expected from a `.noise-overlay` class */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

export interface PrismaHeroProps {
  /** Line above the big word: the actual promise. Without it the hero says
   *  only the brand name, which makes no claim at all. Rendered through
   *  WordsPullUpMultiStyle so it can carry the page's two-font treatment. */
  tagline?: Segment[];
  /** Big pull-up word or phrase. */
  title: string;
  /** Optional second phrase, rendered in the accent style. */
  titleAccentClassName?: string;
  showAsterisk?: boolean;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  navItems?: { label: string; href: string }[];
  /** Pinned top-right, outside the centre nav tab, the way v3's hero does it.
   *  Keeps the returning-user action separate from the centre wayfinding. */
  navCta?: { label: string; href: string };
  videoSrc: string;
  /** Type + nav colour. Defaults to the page's off-white. */
  ink?: string;
  /** Fill for the CTA pill. Defaults to `ink`; pass a brand colour to override. */
  ctaBg?: string;
  ctaFg?: string;
  /** Rendered over the video, under the content. Used for the v3 sparkle field. */
  overlay?: ReactNode;
  className?: string;
}

export const PrismaHero = ({
  tagline,
  title,
  showAsterisk = false,
  body,
  ctaLabel,
  ctaHref,
  navItems = [],
  navCta,
  videoSrc,
  ink = "#E9EAF5",
  ctaBg,
  ctaFg,
  overlay,
  className = "",
}: PrismaHeroProps) => {
  const pillBg = ctaBg ?? ink;
  const pillFg = ctaFg ?? "#000000";
  return (
    <section className={`h-screen w-full ${className}`}>
      <div className="relative h-full w-full overflow-hidden">
        <motion.video
          autoPlay
          loop
          muted
          playsInline
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 h-full w-full object-cover"
          src={videoSrc}
        />

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-overlay"
          style={{ backgroundImage: GRAIN }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/75"
        />

        {overlay ? (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {overlay}
          </div>
        ) : null}

        {navCta && (
          <motion.a
            href={navCta.href}
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-4 top-4 z-20 rounded-full px-5 py-2 text-[13px] font-medium text-white transition-transform hover:scale-[1.03] sm:right-6 md:right-8 md:top-5 md:text-sm"
            style={{ background: "var(--lv3-blue)", boxShadow: "0 6px 22px rgba(66,87,232,0.35)" }}
          >
            {navCta.label}
          </motion.a>
        )}

        {navItems.length > 0 && (
          <nav className="absolute left-1/2 top-0 z-20 -translate-x-1/2">
            <motion.div
              initial={{ y: "-100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-4 rounded-b-2xl bg-black px-5 py-2.5 sm:gap-7 md:gap-12 md:rounded-b-3xl md:px-8"
            >
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-[11px] transition-opacity hover:opacity-100 sm:text-xs md:text-sm"
                  style={{ color: ink, opacity: 0.75 }}
                >
                  {item.label}
                </a>
              ))}
            </motion.div>
          </nav>
        )}

        <div className="absolute bottom-0 left-0 right-0 px-4 pb-2 sm:px-6 md:px-10">
          <div className="grid grid-cols-12 items-end gap-4">
            <div className="col-span-12 lg:col-span-8">
              {tagline && tagline.length > 0 && (
                <WordsPullUpMultiStyle
                  segments={tagline}
                  className="mb-3 text-[22px] leading-[1.12] tracking-[-0.02em] sm:text-[28px] md:mb-4 md:flex-nowrap md:whitespace-nowrap md:text-[34px]"
                  style={{ color: ink, fontFamily: "'Poppins', sans-serif", fontWeight: 600 }}
                />
              )}
              <h1
                className="text-[22vw] font-medium leading-[0.85] tracking-[-0.07em] sm:text-[20vw] md:text-[18vw] lg:text-[15vw] xl:text-[14vw]"
                style={{ color: ink, fontFamily: "'Poppins', sans-serif" }}
              >
                <WordsPullUp text={title} showAsterisk={showAsterisk} />
              </h1>
            </div>

            <div className="col-span-12 flex flex-col gap-5 pb-6 lg:col-span-4 lg:pb-10">
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-[17rem] text-[13.5px] sm:text-sm md:max-w-[19rem] md:text-[15px]"
                style={{ lineHeight: 1.4, color: ink, opacity: 0.78 }}
              >
                {body}
              </motion.p>

              <motion.a
                href={ctaHref}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="group inline-flex items-center gap-2 self-start rounded-full py-1 pl-5 pr-1 text-sm font-medium transition-all hover:gap-3 sm:text-base"
                style={{ background: pillBg, color: pillFg, boxShadow: "0 8px 28px rgba(66,87,232,0.4)" }}
              >
                {ctaLabel}
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-transform group-hover:scale-110 sm:h-10 sm:w-10"
                  style={{ background: "rgba(10,12,19,0.85)" }}
                >
                  <ArrowRight className="h-4 w-4" style={{ color: pillFg }} />
                </span>
              </motion.a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PrismaHero;
