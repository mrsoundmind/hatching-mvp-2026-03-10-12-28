import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from 'remotion';
import { colors, typography } from '../design/tokens';

export interface DeliverableRevealProps {
  title: string;
  type: string; // e.g. 'PRD', 'GTM Plan', 'Tech Spec'
  sections: string[];
  /** Author/agent name shown in the header bar */
  author?: string;
}

/**
 * Page-flip reveal of a generated deliverable. PDF-styled mock with a
 * Hatchin-blue header bar matching pdfExport.ts output. Sections fade in.
 */
export const DeliverableReveal: React.FC<DeliverableRevealProps> = ({ title, type, sections, author }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Page-flip entry: scale + rotate slightly
  const enter = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 30,
    config: { damping: 16 },
  });
  const scale = interpolate(enter, [0, 1], [0.6, 1]);
  const rotate = interpolate(enter, [0, 1], [-8, 0]);
  const opacity = enter;

  // Reveal type badge first, then title, then sections
  const titleFrame = 18;
  const titleOpacity = interpolate(frame, [titleFrame, titleFrame + 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bgSoft,
        fontFamily: typography.display,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div style={{ height: 8, backgroundColor: colors.brand, position: 'absolute', top: 0, left: 0, right: 0 }} />

      <div
        style={{
          opacity,
          transform: `scale(${scale}) rotate(${rotate}deg)`,
          backgroundColor: colors.white,
          width: 1100,
          minHeight: 760,
          borderRadius: 8,
          boxShadow: '0 28px 80px rgba(30, 34, 53, 0.18)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Page header bar (matches pdfExport.ts) */}
        <div style={{ height: 12, backgroundColor: colors.brand }} />

        <div style={{ padding: '64px 72px' }}>
          {/* Type badge */}
          <div
            style={{
              display: 'inline-block',
              backgroundColor: colors.brand,
              color: colors.white,
              padding: '8px 20px',
              borderRadius: 6,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 3,
              marginBottom: 24,
            }}
          >
            {type.toUpperCase()}
          </div>

          {/* Title */}
          <div
            style={{
              opacity: titleOpacity,
              fontSize: 56,
              fontWeight: 800,
              color: colors.dark,
              lineHeight: 1.1,
              marginBottom: 16,
            }}
          >
            {title}
          </div>

          {author && (
            <div style={{ opacity: titleOpacity, fontSize: 18, color: colors.grey, marginBottom: 36 }}>
              by {author}
            </div>
          )}

          {/* Sections — each fades in sequentially */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
            {sections.map((section, i) => {
              const sectionStart = 36 + i * 8;
              const sectionOpacity = interpolate(
                frame,
                [sectionStart, sectionStart + 12],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );
              return (
                <div
                  key={`section-${i}`}
                  style={{
                    opacity: sectionOpacity,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 18,
                    fontSize: 24,
                    color: colors.dark,
                    fontWeight: 500,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: colors.brand,
                      color: colors.white,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  {section}
                </div>
              );
            })}
          </div>

          {/* Footer attribution (matches PDF export) */}
          <div
            style={{
              marginTop: 48,
              paddingTop: 24,
              borderTop: `1px solid ${colors.bgSoft}`,
              fontSize: 14,
              color: colors.grey,
              textAlign: 'center',
            }}
          >
            Generated by Hatchin — AI Team Platform • hatchin.app
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
