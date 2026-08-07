// Landing v3 — the wordmark.
//
// Text only. An egg mark with a hover-opening crack was tried and dropped:
// the name carries the brand on its own and a second element beside it just
// competed with the nav.
//
// What is designed here rather than default: the weight and negative tracking
// match the display scale used for headings, and the ® is a small baseline
// glyph at reduced opacity instead of a floating superscript, which at 10px
// rendered as a stray speck.

export function Wordmark({
  tone = "light",
  className = "",
}: {
  /** "light" = on a dark field (hero, sign in). "dark" = on white (footer). */
  tone?: "light" | "dark";
  className?: string;
}) {
  const ink = tone === "light" ? "#ffffff" : "var(--lv3-navy)";

  return (
    <span
      className={`inline-block text-[21px] leading-none tracking-[-0.03em] md:text-[24px] ${className}`}
      style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, color: ink }}
    >
      Hatchin
      <span className="ml-[3px] align-baseline text-[8px]" style={{ fontWeight: 500, opacity: 0.45 }}>
        ®
      </span>
    </span>
  );
}

export default Wordmark;
