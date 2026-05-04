import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from 'remotion';
import { colors, typography } from '../design/tokens';

export interface AgentSpec {
  name: string;
  role: string;
  /** Hex color override; falls back to rolePalette by index. */
  color?: string;
  /** Single emoji or initial — shown as the avatar. */
  glyph: string;
}

export interface TeamAssemblingProps {
  agents: AgentSpec[];
  caption?: string;
}

/**
 * Hatch avatars slide in one by one from the bottom, then settle into a row.
 * Caption fades in last. ~10 seconds for 5 agents.
 */
export const TeamAssembling: React.FC<TeamAssemblingProps> = ({ agents, caption }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Stagger avatar entry by 12 frames (0.4s) each
  const STAGGER = 12;
  const captionStartFrame = STAGGER * agents.length + 18;
  const captionOpacity = interpolate(frame, [captionStartFrame, captionStartFrame + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.white, fontFamily: typography.display }}>
      <div style={{ height: 8, backgroundColor: colors.brand }} />

      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div
          style={{
            display: 'flex',
            gap: 56,
            justifyContent: 'center',
            flexWrap: 'wrap',
            maxWidth: 1700,
          }}
        >
          {agents.map((agent, i) => {
            const enterFrame = i * STAGGER;
            const enter = spring({
              frame: frame - enterFrame,
              fps,
              from: 0,
              to: 1,
              config: { damping: 12, mass: 0.6 },
            });
            const y = interpolate(enter, [0, 1], [200, 0]);
            const color = agent.color ?? colors.rolePalette[i % colors.rolePalette.length];

            return (
              <div
                key={`${agent.name}-${i}`}
                style={{
                  opacity: enter,
                  transform: `translateY(${y}px)`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 180,
                    height: 180,
                    borderRadius: '50%',
                    backgroundColor: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 80,
                    color: colors.white,
                    fontWeight: 700,
                    boxShadow: `0 12px 40px ${color}40`,
                  }}
                >
                  {agent.glyph}
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: colors.dark }}>{agent.name}</div>
                <div style={{ fontSize: 22, color: colors.grey, fontWeight: 500 }}>{agent.role}</div>
              </div>
            );
          })}
        </div>

        {caption && (
          <div
            style={{
              opacity: captionOpacity,
              marginTop: 80,
              fontSize: 32,
              color: colors.brand,
              fontWeight: 600,
              letterSpacing: 1,
              textAlign: 'center',
            }}
          >
            {caption}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
