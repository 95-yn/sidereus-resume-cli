import { describe, expect, it } from 'vitest';
import { resolveProvider } from '../src/services/provider.js';

describe('resolveProvider', () => {
  it('defaults to DeepSeek', () => {
    expect(resolveProvider({})).toBe('deepseek');
  });

  it.each([
    ['deepseek', 'deepseek'],
    [' openai ', 'openai'],
    ['OPENAI', 'openai'],
    ['DeepSeek', 'deepseek'],
  ] as const)('maps %j to %s', (input, expected) => {
    expect(resolveProvider({ AI_PROVIDER: input })).toBe(expected);
  });

  it('rejects unsupported values as a user error', () => {
    expect(() => resolveProvider({ AI_PROVIDER: 'other' })).toThrowError(
      expect.objectContaining({
        code: 'UNSUPPORTED_AI_PROVIDER',
        exitCode: 2,
      }),
    );
  });
});
