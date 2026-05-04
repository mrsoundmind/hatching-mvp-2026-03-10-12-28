import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from 'remotion';
import { colors, typography } from '../design/tokens';

export interface HandoffStep {
  fromAgent: string;
  fromGlyph: string;
  fromColor?: string;
  toAgent: string;
  toGlyph: string;
  toColor?: string;
  deliverable: string;
}

export interface HandoffSequenceProps {
  steps: HandoffStep[];
  /** Frames per handoff step. Default 60 = 2s each. */
  framesPerStep?: number;
}

/**
 * Animated chain of agent handoffs. Each step shows from-agent → arrow → to-agent
 * with the deliverable name. Steps appear sequentially as a vertical timeline.
 */
export const HandoffSequence: React.FC<HandoffSequenceProps> = ({ steps, framesPerStep = 60 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bgSoft, fontFamily: typography.display }}>
      <div style={{ height: 8, backgroundColor: colors.brand }} />

      <AbsoluteFill style={{ padding: '80px 160px' }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: colors.brand,
            letterSpacing: 4,
            marginBottom: 32,
          }}
        >
          THE TEAM HANDS OFF
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          {steps.map((step, i) => {
            const stepStart = i * framesPerStep;
            const enter = spring({
              frame: frame - stepStart,
              fps,
              from: 0,
              to: 1,
              durationInFrames: 18,
              config: { damping: 14 },
            });
            const x = interpolate(enter, [0, 1], [-80, 0]);
            const fromColor = step.fromColor ?? colors.rolePalette[i % colors.rolePalette.length];
            const toColor = step.toColor ?? colors.rolePalette[(i + 1) % colors.rolePalette.length];

            // Animate the deliverable label after the row settles
            const labelStart = stepStart + 12;
            const labelOpacity = interpolate(frame, [labelStart, labelStart + 14], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            return (
              <div
                key={`step-${i}`}
                style={{
                  opacity: enter,
                  transform: `translateX(${x}px)`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 28,
                  backgroundColor: colors.white,
                  borderRadius: 24,
                  padding: '28px 36px',
                  boxShadow: '0 8px 24px rgba(30, 34, 53, 0.06)',
                }}
              >
                {/* From agent */}
                <Avatar glyph={step.fromGlyph} color={fromColor} size={88} />
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: colors.dark }}>{step.fromAgent}</div>
                  <div style={{ fontSize: 16, color: colors.grey }}>FROM</div>
                </div>

                {/* Arrow */}
                <Arrow color={colors.brand} />

                {/* Deliverable label */}
                <div
                  style={{
                    opacity: labelOpacity,
                    backgroundColor: colors.brand,
                    color: colors.white,
                    padding: '10px 20px',
                    borderRadius: 999,
                    fontSize: 20,
                    fontWeight: 600,
                    minWidth: 200,
                    textAlign: 'center',
                  }}
                >
                  {step.deliverable}
                </div>

                {/* Arrow */}
                <Arrow color={colors.brand} />

                {/* To agent */}
                <Avatar glyph={step.toGlyph} color={toColor} size={88} />
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: colors.dark }}>{step.toAgent}</div>
                  <div style={{ fontSize: 16, color: colors.grey }}>TO</div>
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Avatar: React.FC<{ glyph: string; color: string; size: number }> = ({ glyph, color, size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      backgroundColor: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.45,
      color: colors.white,
      fontWeight: 700,
      flexShrink: 0,
    }}
  >
    {glyph}
  </div>
);

const Arrow: React.FC<{ color: string }> = ({ color }) => (
  <svg width="64" height="24" viewBox="0 0 64 24" style={{ flexShrink: 0 }}>
    <path d="M0 12 L52 12 M44 4 L52 12 L44 20" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
