import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { colors, typography } from '../design/tokens';

export interface CaseIntroProps {
  caseTitle: string;
  caseNumber: number;
  tagline?: string;
}

/**
 * Title card. ~5 seconds. Number slides in, title fades up,
 * tagline fades in last. Subtle Hatchin brand bar at top.
 */
export const CaseIntro: React.FC<CaseIntroProps> = ({ caseTitle, caseNumber, tagline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const numberOpacity = spring({ frame: frame - 0, fps, from: 0, to: 1, durationInFrames: 20 });
  const numberY = interpolate(frame, [0, 20], [40, 0], { extrapolateRight: 'clamp' });

  const titleOpacity = spring({ frame: frame - 15, fps, from: 0, to: 1, durationInFrames: 25 });
  const titleY = interpolate(frame, [15, 40], [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const taglineOpacity = spring({ frame: frame - 45, fps, from: 0, to: 1, durationInFrames: 20 });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.white, fontFamily: typography.display }}>
      {/* Brand bar */}
      <div style={{ height: 8, backgroundColor: colors.brand }} />

      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 120 }}>
        <div
          style={{
            opacity: numberOpacity,
            transform: `translateY(${numberY}px)`,
            color: colors.brand,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 6,
            marginBottom: 24,
          }}
        >
          CASE {String(caseNumber).padStart(2, '0')}
        </div>

        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            color: colors.dark,
            fontSize: 92,
            fontWeight: 800,
            lineHeight: 1.05,
            textAlign: 'center',
            maxWidth: 1500,
          }}
        >
          {caseTitle}
        </div>

        {tagline && (
          <div
            style={{
              opacity: taglineOpacity,
              color: colors.grey,
              fontSize: 32,
              marginTop: 36,
              textAlign: 'center',
              maxWidth: 1300,
              fontWeight: 400,
            }}
          >
            {tagline}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
