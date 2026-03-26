/**
 * Tests for updateProjectSchema extensions:
 * - autonomyLevel enum in executionRules
 * - inactivityTriggerMinutes range validation
 * - New brain document types (uploaded-pdf, uploaded-docx, etc.)
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Replicate the Zod schema from server/routes/projects.ts for unit testing
const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  emoji: z.string().max(10).optional(),
  description: z.string().max(5000).nullable().optional(),
  coreDirection: z.object({
    whatBuilding: z.string().optional(),
    whyMatters: z.string().optional(),
    whoFor: z.string().optional(),
  }).nullable().optional(),
  brain: z.object({
    documents: z.array(z.object({
      id: z.string(),
      title: z.string(),
      content: z.string(),
      type: z.enum(["idea-development", "project-plan", "meeting-notes", "research", "uploaded-pdf", "uploaded-docx", "uploaded-txt", "uploaded-md"]),
      createdAt: z.string(),
    })).optional(),
    sharedMemory: z.string().optional(),
  }).nullable().optional(),
  executionRules: z.object({
    autonomyEnabled: z.boolean().optional(),
    autonomyPaused: z.boolean().optional(),
    inactivityAutonomyEnabled: z.boolean().optional(),
    autonomyLevel: z.enum(['observe', 'propose', 'confirm', 'autonomous']).optional(),
    inactivityTriggerMinutes: z.number().int().min(30).max(480).optional(),
    rules: z.string().optional(),
    taskGraph: z.unknown().optional(),
  }).nullable().optional(),
  starterPack: z.string().max(100).nullable().optional(),
}).strict();

describe('updateProjectSchema - executionRules autonomyLevel', () => {
  it('accepts valid autonomyLevel: observe', () => {
    const result = updateProjectSchema.safeParse({
      executionRules: { autonomyLevel: 'observe' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid autonomyLevel: propose', () => {
    const result = updateProjectSchema.safeParse({
      executionRules: { autonomyLevel: 'propose' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid autonomyLevel: confirm', () => {
    const result = updateProjectSchema.safeParse({
      executionRules: { autonomyLevel: 'confirm' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid autonomyLevel: autonomous', () => {
    const result = updateProjectSchema.safeParse({
      executionRules: { autonomyLevel: 'autonomous' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid autonomyLevel: "invalid"', () => {
    const result = updateProjectSchema.safeParse({
      executionRules: { autonomyLevel: 'invalid' },
    });
    expect(result.success).toBe(false);
  });
});

describe('updateProjectSchema - executionRules inactivityTriggerMinutes', () => {
  it('accepts minimum boundary: 30', () => {
    const result = updateProjectSchema.safeParse({
      executionRules: { inactivityTriggerMinutes: 30 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts maximum boundary: 480', () => {
    const result = updateProjectSchema.safeParse({
      executionRules: { inactivityTriggerMinutes: 480 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects below minimum: 29', () => {
    const result = updateProjectSchema.safeParse({
      executionRules: { inactivityTriggerMinutes: 29 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects above maximum: 481', () => {
    const result = updateProjectSchema.safeParse({
      executionRules: { inactivityTriggerMinutes: 481 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer: 30.5', () => {
    const result = updateProjectSchema.safeParse({
      executionRules: { inactivityTriggerMinutes: 30.5 },
    });
    expect(result.success).toBe(false);
  });
});

describe('updateProjectSchema - brain document types (uploaded-*)', () => {
  const makeDoc = (type: string) => ({
    brain: {
      documents: [{
        id: 'test-id',
        title: 'Test Doc',
        content: 'content',
        type,
        createdAt: '2026-03-26T00:00:00Z',
      }],
    },
  });

  it('accepts uploaded-pdf type', () => {
    const result = updateProjectSchema.safeParse(makeDoc('uploaded-pdf'));
    expect(result.success).toBe(true);
  });

  it('accepts uploaded-docx type', () => {
    const result = updateProjectSchema.safeParse(makeDoc('uploaded-docx'));
    expect(result.success).toBe(true);
  });

  it('accepts uploaded-txt type', () => {
    const result = updateProjectSchema.safeParse(makeDoc('uploaded-txt'));
    expect(result.success).toBe(true);
  });

  it('accepts uploaded-md type', () => {
    const result = updateProjectSchema.safeParse(makeDoc('uploaded-md'));
    expect(result.success).toBe(true);
  });

  it('rejects unknown type: uploaded-xls', () => {
    const result = updateProjectSchema.safeParse(makeDoc('uploaded-xls'));
    expect(result.success).toBe(false);
  });
});
