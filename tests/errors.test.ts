import { describe, expect, it } from 'vitest';
import { AppError, toAppError } from '../src/errors.js';

describe('application errors', () => {
  it('preserves a typed user error', () => {
    const original = new AppError('missing', {
      exitCode: 2,
      code: 'FILE_NOT_FOUND',
    });

    expect(toAppError(original)).toBe(original);
  });

  it('hides unexpected internal details', () => {
    const result = toAppError(new Error('secret implementation detail'));

    expect(result.message).toBe('发生未预期错误，请使用 --verbose 查看原因。');
    expect(result.exitCode).toBe(1);
    expect(result.cause).toBeInstanceOf(Error);
  });
});
