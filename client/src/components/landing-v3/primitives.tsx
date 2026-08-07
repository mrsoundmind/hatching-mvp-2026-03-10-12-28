// Landing v3 — shared primitives.
//
// Straight ports of the FIMI mockup's Reveal / Counter / CTA / EvidenceChip,
// with one substitution: FIMI drives Reveal and Counter with GSAP ScrollTrigger,
// and GSAP is not a dependency here. Both are rebuilt on framer-motion's
// useInView, which this app already ships (framer-motion 11). Same behaviour,
// same reduced-motion escape hatch, no new packages.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

/** Shared scroll-in viewport rule, matching FIMI's `{ once: true, margin: "-60px" }`. */
export const VIEWPORT = { once: true, margin: "-60px" } as const;

export const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Rises + fades its direct children on scroll-in, staggered. FIMI's Reveal.
 *
 * CAUTION: FIMI's version is GSAP animating the existing children in place; this
 * one wraps each child in its own div to stagger them. That means it must NOT be
 * used as a grid or flex container: the wrapper becomes the grid item and the
 * layout collapses. Use it for prose blocks; animate layout containers per cell.
 */
export function Reveal({
  children,
  className,
  y = 26,
  stagger = 0.09,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  stagger?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -18% 0px" });
  const reduce = useReducedMotion();
  const on = reduce || inView;

  return (
    <div ref={ref} className={className}>
      {Array.isArray(children) ? (
        children.map((child, i) => (
          <div
            key={i}
            style={{
              opacity: on ? 1 : 0,
              transform: on ? "none" : `translateY(${y}px)`,
              transition: `opacity .8s cubic-bezier(.16,1,.3,1) ${i * stagger}s, transform .8s cubic-bezier(.16,1,.3,1) ${i * stagger}s`,
            }}
          >
            {child}
          </div>
        ))
      ) : (
        <div
          style={{
            opacity: on ? 1 : 0,
            transform: on ? "none" : `translateY(${y}px)`,
            transition: "opacity .8s cubic-bezier(.16,1,.3,1), transform .8s cubic-bezier(.16,1,.3,1)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** Counts up from 0 on scroll-in. Renders the final value when motion is off. */
export function Counter({
  to,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
  duration = 1600,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? to : 0);

  useEffect(() => {
    if (reduce) {
      setValue(to);
      return;
    }
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // power2.out, the easing FIMI's GSAP counter uses
      setValue(to * (1 - Math.pow(1 - t, 2)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, to, duration]);

  const text =
    prefix +
    value.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) +
    suffix;

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}

/** Pill button. FIMI's CTA, recoloured: green -> Hatchin blue, navy kept. */
export function CTA({
  href = "#",
  children,
  variant = "primary",
  className,
}: {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "navySolid" | "outlineLight" | "outlineNavy";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-full h-12 px-6 text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
  const variants: Record<string, string> = {
    primary: "text-white",
    navySolid: "text-white",
    outlineLight: "border border-white/25 text-white hover:bg-white/10",
    outlineNavy: "border lv3-bd-navy lv3-t-navy hover:bg-[rgba(20,24,47,0.05)]",
  };
  const style =
    variant === "primary"
      ? { background: "var(--lv3-blue)" }
      : variant === "navySolid"
        ? { background: "var(--lv3-navy)" }
        : undefined;

  const inner = (
    <span
      className={cn(base, variants[variant], className)}
      style={{ ...style, ...(variant === "primary" ? { boxShadow: "0 6px 22px rgba(108,130,255,0.28)" } : {}) }}
    >
      {children}
    </span>
  );

  // Internal app routes go through wouter so /v3 -> /login does not full-reload.
  if (href.startsWith("/")) {
    return (
      <Link href={href} className="inline-flex cursor-pointer">
        {inner}
      </Link>
    );
  }
  return (
    <a href={href} className="inline-flex">
      {inner}
    </a>
  );
}

/**
 * The cited-source chip. FIMI binds every statistic to a peer-reviewed paper;
 * here every claim is bound to the test or script in this repo that proves it,
 * which is the same mechanism applied to a product instead of a study.
 */
export function SourceChip({
  source,
  meta,
  tone = "light",
}: {
  source: string;
  meta?: string;
  tone?: "light" | "dark";
}) {
  return (
    <span className="lv3-chip block">
      <span
        className="lv3-label mb-1 block"
        style={{ color: tone === "dark" ? "var(--lv3-mint)" : "var(--lv3-purple)" }}
      >
        Verified in this build
      </span>
      <span style={{ color: tone === "dark" ? "rgba(255,255,255,0.72)" : "var(--lv3-soft)" }}>
        {source}
        {meta ? (
          <>
            {" · "}
            <b style={{ color: tone === "dark" ? "#ffffff" : "var(--lv3-navy)" }}>{meta}</b>
          </>
        ) : null}
      </span>
    </span>
  );
}

/** Section opener: mono eyebrow + display heading + lead. Used by every section. */
export function SectionHead({
  eyebrow,
  title,
  lead,
  className,
  align = "left",
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <Reveal className={cn(align === "center" && "mx-auto text-center", className)}>
      <span className="lv3-label lv3-t-blue">{eyebrow}</span>
      <h2 className="lv3-display lv3-t-navy mt-4 text-balance">{title}</h2>
      {lead ? <p className="lv3-t-soft mt-4 text-lg leading-relaxed">{lead}</p> : null}
    </Reveal>
  );
}
