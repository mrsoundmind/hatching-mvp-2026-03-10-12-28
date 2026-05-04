import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from 'remotion';
import { colors, typography } from '../design/tokens';

export interface CTAProps {
  url: string;
  /** Lead line, default "Try it yourself" */
  leadLine?: string;
}

/**
 * Outro card. Brand-color background, big URL, soft-pulse animation
 * on the "try it" button. ~3 seconds.
 */
export const CTA: React.FC<CTAProps> = ({ url, leadLine = 'Try it yourself' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, from: 0, to: 1, durationInFrames: 25, config: { damping: 12 } });
  const scale = interpolate(enter, [0, 1], [0.85, 1]);

  // Soft pulse on the URL after entry
  const pulse = 1 + 0.02 * Math.sin((frame / fps) * Math.PI * 2 * 1.2);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.brand, fontFamily: typography.display }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div
          style={{
            opacity: enter,
            transform: `scale(${scale})`,
            color: colors.white,
            fontSize: 36,
            fontWeight: 600,
            letterSpacing: 2,
            marginBottom: 28,
            textAlign: 'center',
            opacity: 0.9,
          }}
        >
          {leadLine}
        </div>
        <div
          style={{
            opacity: enter,
            transform: `scale(${scale * pulse})`,
            color: colors.white,
            fontSize: 140,
            fontWeight: 800,
            letterSpacing: -2,
            textAlign: 'center',
          }}
        >
          {url}
        </div>
        <div
          style={{
            opacity: enter,
            marginTop: 60,
            color: colors.white,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: 6,
          }}
        >
          BUILT WITH HATCHIN
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
