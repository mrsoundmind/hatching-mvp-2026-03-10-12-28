import { AbsoluteFill, useCurrentFrame, interpolate, useVideoConfig } from 'remotion';
import { colors, typography } from '../design/tokens';

export interface UserPromptProps {
  text: string;
  /** Words per second for typewriter. Default 6 = natural typing speed. */
  wordsPerSecond?: number;
}

/**
 * Typewriter animation of what the user typed into Hatchin.
 * Frames a chat bubble at top-right with a thinking cursor.
 */
export const UserPrompt: React.FC<UserPromptProps> = ({ text, wordsPerSecond = 6 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = text.split(' ');
  const totalWords = words.length;
  const wordsToShow = Math.min(
    totalWords,
    Math.floor((frame / fps) * wordsPerSecond)
  );
  const visibleText = words.slice(0, wordsToShow).join(' ');

  // Cursor blinks every 15 frames after typing finishes
  const typingDoneFrame = (totalWords / wordsPerSecond) * fps;
  const showCursor = frame < typingDoneFrame ? true : Math.floor((frame - typingDoneFrame) / 15) % 2 === 0;

  // Bubble fade-in
  const bubbleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bgSoft, fontFamily: typography.body }}>
      <div style={{ height: 8, backgroundColor: colors.brand }} />

      <AbsoluteFill style={{ alignItems: 'flex-end', justifyContent: 'flex-start', padding: 120 }}>
        <div
          style={{
            opacity: bubbleOpacity,
            backgroundColor: colors.white,
            borderRadius: 32,
            padding: '48px 56px',
            maxWidth: 1200,
            boxShadow: '0 12px 40px rgba(30, 34, 53, 0.08)',
            border: `1px solid ${colors.brandSoft}`,
          }}
        >
          <div style={{ fontSize: 18, color: colors.grey, marginBottom: 16, fontWeight: 600, letterSpacing: 2 }}>
            YOU
          </div>
          <div
            style={{
              fontSize: 44,
              color: colors.dark,
              lineHeight: 1.4,
              fontWeight: 500,
            }}
          >
            {visibleText}
            {showCursor && (
              <span
                style={{
                  display: 'inline-block',
                  width: 4,
                  height: 44,
                  backgroundColor: colors.brand,
                  marginLeft: 6,
                  verticalAlign: 'middle',
                }}
              />
            )}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
