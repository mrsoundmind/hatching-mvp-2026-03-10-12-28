import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from 'remotion';
import { colors, typography } from '../design/tokens';

export interface CostFooterProps {
  rupees: number;
  timeMinutes: number;
  agentsInvolved: number;
  deliverablesProduced: number;
}

/**
 * The proof-point overlay. Shows the actual numbers: cost in ₹, time in
 * minutes, agents involved, deliverables produced. ~7 seconds.
 */
export const CostFooter: React.FC<CostFooterProps> = ({
  rupees,
  timeMinutes,
  agentsInvolved,
  deliverablesProduced,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleEnter = spring({ frame, fps, from: 0, to: 1, durationInFrames: 22, config: { damping: 14 } });
  const titleY = interpolate(titleEnter, [0, 1], [40, 0]);

  const stats = [
    { label: 'Total LLM cost', value: `₹${rupees}`, color: colors.green },
    { label: 'Time elapsed', value: `${timeMinutes} min`, color: colors.brand },
    { label: 'Hatches involved', value: String(agentsInvolved), color: colors.orange },
    { label: 'Deliverables', value: String(deliverablesProduced), color: '#A05BFF' },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: colors.dark, fontFamily: typography.display }}>
      <div style={{ height: 8, backgroundColor: colors.brand }} />

      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 100 }}>
        <div
          style={{
            opacity: titleEnter,
            transform: `translateY(${titleY}px)`,
            color: colors.brandSoft,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 4,
            marginBottom: 12,
          }}
        >
          THE PROOF
        </div>
        <div
          style={{
            opacity: titleEnter,
            transform: `translateY(${titleY}px)`,
            color: colors.white,
            fontSize: 64,
            fontWeight: 800,
            marginBottom: 80,
            textAlign: 'center',
            maxWidth: 1500,
            lineHeight: 1.1,
          }}
        >
          Real work, real artifacts, real cost.
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 56,
            maxWidth: 1700,
            width: '100%',
          }}
        >
          {stats.map((stat, i) => {
            const enterFrame = 18 + i * 8;
            const enter = spring({
              frame: frame - enterFrame,
              fps,
              from: 0,
              to: 1,
              durationInFrames: 24,
              config: { damping: 13 },
            });
            const y = interpolate(enter, [0, 1], [60, 0]);

            return (
              <div
                key={stat.label}
                style={{
                  opacity: enter,
                  transform: `translateY(${y}px)`,
                  textAlign: 'center',
                  padding: '40px 28px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${stat.color}40`,
                  borderRadius: 24,
                }}
              >
                <div style={{ fontSize: 80, fontWeight: 800, color: stat.color, lineHeight: 1, marginBottom: 16 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 22, color: colors.brandSoft, fontWeight: 500, letterSpacing: 1 }}>
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
