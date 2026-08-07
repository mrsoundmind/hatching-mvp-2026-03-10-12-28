// Ruixen Gradient Footer — a normal footer that sits at the bottom of the page.
// Its content reads first; the blurred glow is pinned to the bottom of the
// viewport and stretches up from the floor over the last stretch of scroll,
// hitting full height exactly when you reach the end of the page.
// One inline <svg> — no canvas, no giant scroll spacer.
//
// Gradient design inspired by Dia Browser — https://www.diabrowser.com
//
// LOCAL CHANGES from the upstream component:
//   1. The "use client" directive is dropped. This app is Vite + React, not
//      Next.js, so the pragma is meaningless here.
//   2. The default stops are Hatchin's palette rather than the original
//      rainbow: the dark page floor, into blue, a near-white bloom, then the
//      working amber and coral, closing on purple. `stops` is still a prop, so
//      the original ramp can be passed back in at any time.

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type Stop = { offset: number; color: string };

const VBW = 1271;
const VBH = 599;

// Hatchin stops, floor (0) → top (1). Same shape as the original ramp (deep
// base, cool middle, a light bloom, then warm, closing on a transparent tint)
// but every colour is one the product already uses: #0A0C13 is the app and hero
// field, #5468F0/#6C82FF the primary, #F2B441/#E8734A the working state, and
// #9F7BFF the secondary accent.
export const HATCHIN_STOPS: Stop[] = [
  { offset: 0, color: "#0A0C13" },
  { offset: 0.1827, color: "#3F52D8" },
  { offset: 0.2837, color: "#6C82FF" },
  { offset: 0.4135, color: "#E4E9FE" },
  { offset: 0.5866, color: "#F2B441" },
  { offset: 0.6827, color: "#E8734A" },
  { offset: 0.8029, color: "#9F7BFF" },
  { offset: 1, color: "#C0B5FD00" },
];

// Height curve: a gentle power falloff, giving the flatter, pyramid-like rise of
// the original footer (short edges, tallest middle).
function bellHeights(n: number, peak: number, valley: number): number[] {
  const out: number[] = [];
  const mid = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const t = mid === 0 ? 0 : Math.abs(i - mid) / mid; // 0 center → 1 edge
    const eased = 1 - Math.pow(t, 1.24);
    out.push(peak * VBH * (valley + (1 - valley) * eased));
  }
  return out;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export interface RuixenGradientFooterProps {
  /** Footer content — links, wordmark, copyright — shown above the glow. */
  children?: ReactNode;
  /**
   * Height of the glow band pinned to the viewport bottom. Doubles as the
   * scroll distance the reveal takes, and the room reserved under the content.
   */
  gradientHeight?: string;
  /**
   * Resting height of the glow, as a fraction of the band — a thin, flat strip
   * of colour along the bottom edge before the scroll reveal starts. `0` keeps
   * it hidden until the last screen.
   */
  minReveal?: number;
  /** Number of blurred columns. */
  bars?: number;
  /** Blur in viewBox units. */
  blur?: number;
  /** Peak height as a fraction of the viewBox. */
  peak?: number;
  /** Edge height as a fraction of the peak (0..1). */
  valley?: number;
  /** Vertical gradient stops, floor (0) → top (1). */
  stops?: Stop[];
  className?: string;
  style?: CSSProperties;
}

export function RuixenGradientFooter({
  children,
  gradientHeight = "65vh",
  minReveal = 0.045,
  bars = 9,
  blur = 15,
  peak = 0.98,
  valley = 0.55,
  stops = HATCHIN_STOPS,
  className,
  style,
}: RuixenGradientFooterProps) {
  const uid = useId().replace(/:/g, "");
  const bandRef = useRef<HTMLDivElement>(null);
  // minReveal = a flat strip on the floor, 1 = risen to full height.
  const [progress, setProgress] = useState(minReveal);

  useEffect(() => {
    const el = bandRef.current;
    if (!el) return;
    // Bind to the element's OWN window so this tracks the right scroll context
    // on a real page and inside a preview iframe alike.
    const doc = el.ownerDocument;
    const win = doc.defaultView ?? window;
    const measure = () => {
      // offsetHeight ignores the transform, so the band can measure itself.
      const h = el.offsetHeight || 1;
      // How much scroll is left before the end of the page. The glow starts
      // rising once that's within its own height, and is full at the bottom.
      const left =
        doc.documentElement.scrollHeight - win.innerHeight - win.scrollY;
      const t = clamp01((h - left) / h);
      setProgress(minReveal + (1 - minReveal) * t);
    };
    measure();
    win.addEventListener("scroll", measure, { passive: true });
    win.addEventListener("resize", measure, { passive: true });
    return () => {
      win.removeEventListener("scroll", measure);
      win.removeEventListener("resize", measure);
    };
  }, [minReveal]);

  const colW = VBW / bars;

  return (
    // The glow is pinned to the viewport, so the footer reserves the same
    // height beneath its content for the glow to land in.
    <footer
      className={className}
      style={{ paddingBottom: gradientHeight, ...style }}
    >
      {children}

      {/* pinned to the viewport — a transformed/filtered ancestor would capture
          it, so keep the footer's ancestors as plain containing blocks. */}
      <div
        ref={bandRef}
        aria-hidden
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: gradientHeight,
          pointerEvents: "none",
          transformOrigin: "bottom",
          transform: `scaleY(${progress})`,
          willChange: "transform",
        }}
      >
        <svg
          style={{ height: "100%", width: "100%", display: "block" }}
          viewBox={`0 0 ${VBW} ${VBH}`}
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={`grad-${uid}`} x1="0" y1="1" x2="0" y2="0">
              {stops.map((s, i) => (
                <stop key={i} offset={s.offset} stopColor={s.color} />
              ))}
            </linearGradient>
            <filter
              id={`blur-${uid}`}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation={blur} />
            </filter>
          </defs>
          {bellHeights(bars, peak, valley).map((barH, i) => (
            <g key={i} filter={`url(#blur-${uid})`}>
              <rect
                x={i * colW}
                y={VBH - barH}
                width={colW * 1.23}
                height={barH}
                fill={`url(#grad-${uid})`}
              />
            </g>
          ))}
        </svg>
      </div>
    </footer>
  );
}

export default RuixenGradientFooter;
