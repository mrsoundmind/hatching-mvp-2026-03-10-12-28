import { Composition } from 'remotion';
import { Case01 } from './cases/Case01';
import { videoConfig } from './design/tokens';

/**
 * Register every case here. Each case is a 1080p / 30fps composition.
 * Total duration is the sum of its <Series.Sequence> children in frames.
 *
 * Adding a new case:
 *   1. Build src/cases/CaseNN.tsx using the 7 reusable components
 *   2. Add a <Composition> entry below
 *   3. Add a render script in package.json: "render:caseNN"
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Case01"
        component={Case01}
        durationInFrames={90 * videoConfig.fps} // 90 seconds
        fps={videoConfig.fps}
        width={videoConfig.width}
        height={videoConfig.height}
      />
      {/* Future:
        <Composition id="Case02" component={Case02} ... />
        <Composition id="Case03" component={Case03} ... />
        ...up to Case12
      */}
    </>
  );
};
