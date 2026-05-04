import { Series } from 'remotion';
import { CaseIntro } from '../components/CaseIntro';
import { UserPrompt } from '../components/UserPrompt';
import { TeamAssembling } from '../components/TeamAssembling';
import { HandoffSequence } from '../components/HandoffSequence';
import { DeliverableReveal } from '../components/DeliverableReveal';
import { CostFooter } from '../components/CostFooter';
import { CTA } from '../components/CTA';
import { fps } from '../design/tokens';

/**
 * Case 01: "Launch a SaaS in 7 days"
 * Total duration: 90 seconds @ 30fps = 2700 frames
 *
 * Beat sheet:
 *   0-5s    CaseIntro             (150 frames)
 *   5-15s   UserPrompt            (300 frames)
 *   15-27s  TeamAssembling        (360 frames)
 *   27-65s  HandoffSequence       (1140 frames — 5 handoffs × ~7.6s each)
 *   65-78s  DeliverableReveal     (390 frames — show the PRD)
 *   78-87s  CostFooter            (270 frames)
 *   87-90s  CTA                   (90 frames)
 */
export const Case01: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={5 * fps}>
        <CaseIntro
          caseNumber={1}
          caseTitle="Launch a SaaS in 7 days"
          tagline="Idea to shipped GTM with a team of AI Hatches"
        />
      </Series.Sequence>

      <Series.Sequence durationInFrames={10 * fps}>
        <UserPrompt
          text='I want to launch a B2B SaaS for indie founders to track their financial runway. Help me ship it in 7 days — PRD, tech spec, design, marketing, and a launch plan.'
          wordsPerSecond={5}
        />
      </Series.Sequence>

      <Series.Sequence durationInFrames={12 * fps}>
        <TeamAssembling
          caption="The right team, hatched in seconds."
          agents={[
            { name: 'Alex', role: 'Product Manager', glyph: '📋' },
            { name: 'Dev', role: 'Backend Engineer', glyph: '⚙️' },
            { name: 'Cleo', role: 'Product Designer', glyph: '🎨' },
            { name: 'Kai', role: 'Growth Marketer', glyph: '📈' },
            { name: 'Wren', role: 'Copywriter', glyph: '✍️' },
          ]}
        />
      </Series.Sequence>

      <Series.Sequence durationInFrames={38 * fps}>
        <HandoffSequence
          framesPerStep={7 * fps}
          steps={[
            { fromAgent: 'You', fromGlyph: '👤', toAgent: 'Alex', toGlyph: '📋', deliverable: 'PRD' },
            { fromAgent: 'Alex', fromGlyph: '📋', toAgent: 'Dev', toGlyph: '⚙️', deliverable: 'Tech Spec' },
            { fromAgent: 'Alex', fromGlyph: '📋', toAgent: 'Cleo', toGlyph: '🎨', deliverable: 'Design Brief' },
            { fromAgent: 'Alex', fromGlyph: '📋', toAgent: 'Kai', toGlyph: '📈', deliverable: 'GTM Plan' },
            { fromAgent: 'Kai', fromGlyph: '📈', toAgent: 'Wren', toGlyph: '✍️', deliverable: 'Landing Copy' },
          ]}
        />
      </Series.Sequence>

      <Series.Sequence durationInFrames={13 * fps}>
        <DeliverableReveal
          type="PRD"
          title="Indie Founders' Financial Runway Tracker"
          author="Alex (Product Manager)"
          sections={[
            'Problem Statement',
            'Goals & Success Metrics',
            'User Stories',
            'Feature Requirements',
            'Non-Functional Requirements',
            'Timeline & Milestones',
            'Risks & Mitigations',
          ]}
        />
      </Series.Sequence>

      <Series.Sequence durationInFrames={9 * fps}>
        <CostFooter
          rupees={42}
          timeMinutes={94}
          agentsInvolved={5}
          deliverablesProduced={5}
        />
      </Series.Sequence>

      <Series.Sequence durationInFrames={3 * fps}>
        <CTA url="hatchin.app" />
      </Series.Sequence>
    </Series>
  );
};
