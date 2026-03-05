export interface TestModeTag {
  enabled: boolean;
  label: string;
  provider?: string;
  model?: string;
}

export function deriveTestModeTag(input: {
  mode?: string;
  provider?: string;
  model?: string;
}): TestModeTag {
  const isTest = (input.mode || '').toLowerCase() === 'test';
  return {
    enabled: isTest,
    label: isTest ? 'Test Mode (Local Model)' : '',
    provider: input.provider,
    model: input.model,
  };
}
