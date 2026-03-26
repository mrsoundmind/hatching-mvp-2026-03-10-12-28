/**
 * Unit tests for PIPELINE_STAGES (approvalUtils.ts)
 * Coverage: APPR-02 pipeline stage mapping
 *
 * Key assertion: "blocked" status maps to "Review" display label (not raw "blocked").
 */
import { describe, it, expect } from 'vitest';
import { PIPELINE_STAGES } from '../client/src/components/sidebar/approvalUtils';

/** Minimal task shape for pipeline stage filter testing */
function makeTask(status: string, assignee?: string) {
  return { status, assignee: assignee ?? null } as { status: string; assignee: string | null };
}

describe('PIPELINE_STAGES', () => {
  it('has exactly 5 stages', () => {
    expect(PIPELINE_STAGES).toHaveLength(5);
  });

  describe('Queued stage', () => {
    it('matches status "todo" without assignee', () => {
      const stage = PIPELINE_STAGES.find(s => s.id === 'queued');
      expect(stage).toBeDefined();
      const task = makeTask('todo');
      expect(stage!.filter(task as any)).toBe(true);
    });

    it('does not match status "todo" with an assignee', () => {
      const stage = PIPELINE_STAGES.find(s => s.id === 'queued');
      const task = makeTask('todo', 'Alex');
      expect(stage!.filter(task as any)).toBe(false);
    });

    it('has label "Queued"', () => {
      const stage = PIPELINE_STAGES.find(s => s.id === 'queued');
      expect(stage!.label).toBe('Queued');
    });
  });

  describe('Assigned stage', () => {
    it('matches status "todo" with an assignee', () => {
      const stage = PIPELINE_STAGES.find(s => s.id === 'assigned');
      expect(stage).toBeDefined();
      const task = makeTask('todo', 'Alex');
      expect(stage!.filter(task as any)).toBe(true);
    });

    it('does not match status "todo" without assignee', () => {
      const stage = PIPELINE_STAGES.find(s => s.id === 'assigned');
      const task = makeTask('todo');
      expect(stage!.filter(task as any)).toBe(false);
    });

    it('has label "Assigned"', () => {
      const stage = PIPELINE_STAGES.find(s => s.id === 'assigned');
      expect(stage!.label).toBe('Assigned');
    });
  });

  describe('In Progress stage', () => {
    it('matches status "in_progress"', () => {
      const stage = PIPELINE_STAGES.find(s => s.id === 'inprogress');
      expect(stage).toBeDefined();
      const task = makeTask('in_progress');
      expect(stage!.filter(task as any)).toBe(true);
    });

    it('has label "In Progress"', () => {
      const stage = PIPELINE_STAGES.find(s => s.id === 'inprogress');
      expect(stage!.label).toBe('In Progress');
    });
  });

  describe('Review stage (APPR-02 key assertion: blocked → Review)', () => {
    it('matches status "blocked"', () => {
      const stage = PIPELINE_STAGES.find(s => s.id === 'review');
      expect(stage).toBeDefined();
      const task = makeTask('blocked');
      expect(stage!.filter(task as any)).toBe(true);
    });

    it('has label "Review" not "blocked" — the core APPR-02 rename assertion', () => {
      const stage = PIPELINE_STAGES.find(s => s.id === 'review');
      expect(stage!.label).toBe('Review');
      expect(stage!.label).not.toBe('blocked');
    });

    it('does not match any status other than "blocked"', () => {
      const stage = PIPELINE_STAGES.find(s => s.id === 'review');
      ['todo', 'in_progress', 'completed'].forEach(status => {
        expect(stage!.filter(makeTask(status) as any)).toBe(false);
      });
    });
  });

  describe('Done stage', () => {
    it('matches status "completed"', () => {
      const stage = PIPELINE_STAGES.find(s => s.id === 'done');
      expect(stage).toBeDefined();
      const task = makeTask('completed');
      expect(stage!.filter(task as any)).toBe(true);
    });

    it('has label "Done"', () => {
      const stage = PIPELINE_STAGES.find(s => s.id === 'done');
      expect(stage!.label).toBe('Done');
    });
  });

  it('each stage has a unique id', () => {
    const ids = PIPELINE_STAGES.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('each stage has a dot color class string', () => {
    PIPELINE_STAGES.forEach(stage => {
      expect(typeof stage.dot).toBe('string');
      expect(stage.dot.length).toBeGreaterThan(0);
    });
  });
});
