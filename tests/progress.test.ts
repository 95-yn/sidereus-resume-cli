import { beforeEach, describe, expect, it, vi } from 'vitest';

const { oraMock, spinner } = vi.hoisted(() => {
  const spinner = {
    isSpinning: false,
    text: '',
    start: vi.fn((text: string) => {
      spinner.isSpinning = true;
      spinner.text = text;
      return spinner;
    }),
    stop: vi.fn(),
    succeed: vi.fn(),
  };

  return { oraMock: vi.fn(() => spinner), spinner };
});

vi.mock('ora', () => ({ default: oraMock }));

import {
  createProgress,
  shouldShowProgress,
  silentProgress,
} from '../src/utils/progress.js';

describe('shouldShowProgress', () => {
  it.each([
    [{ stdoutIsTTY: true, stderrIsTTY: true }, true],
    [{ stdoutIsTTY: false, stderrIsTTY: true }, false],
    [{ stdoutIsTTY: true, stderrIsTTY: false }, false],
    [{ stdoutIsTTY: true, stderrIsTTY: true, ci: true }, false],
    [{ stdoutIsTTY: true, stderrIsTTY: true, disabled: true }, false],
  ])('returns %s for %j', (policy, expected) => {
    expect(shouldShowProgress(policy)).toBe(expected);
  });
});

describe('createProgress', () => {
  beforeEach(() => {
    oraMock.mockClear();
    spinner.isSpinning = false;
    spinner.text = '';
    spinner.start.mockClear();
    spinner.stop.mockClear();
    spinner.succeed.mockClear();
  });

  it('delegates the parse, extraction, and completion stages to ora', () => {
    const progress = createProgress({ enabled: true });

    progress.start('正在解析 PDF…');
    progress.update('正在提取结构化信息…');
    progress.succeed('完成');

    expect(oraMock).toHaveBeenCalledExactlyOnceWith({
      isEnabled: true,
      discardStdin: false,
    });
    expect(spinner.start).toHaveBeenCalledExactlyOnceWith('正在解析 PDF…');
    expect(spinner.text).toBe('正在提取结构化信息…');
    expect(spinner.succeed).toHaveBeenCalledExactlyOnceWith('完成');
  });

  it('passes an explicitly supplied stream to ora', () => {
    createProgress({ enabled: true, stream: process.stderr });

    expect(oraMock).toHaveBeenCalledExactlyOnceWith({
      isEnabled: true,
      discardStdin: false,
      stream: process.stderr,
    });
  });

  it('silences ora when progress is disabled', () => {
    createProgress({ enabled: false });

    expect(oraMock).toHaveBeenCalledExactlyOnceWith({
      isEnabled: false,
      isSilent: true,
      discardStdin: false,
    });
  });

  it('starts the spinner when updating while stopped', () => {
    const progress = createProgress({ enabled: true });

    progress.update('正在提取结构化信息…');

    expect(spinner.start).toHaveBeenCalledExactlyOnceWith('正在提取结构化信息…');
  });

  it('stops the spinner', () => {
    const progress = createProgress({ enabled: true });

    progress.stop();

    expect(spinner.stop).toHaveBeenCalledTimes(1);
  });
});

describe('silentProgress', () => {
  it('does not throw for any operation', () => {
    expect(() => {
      silentProgress.start('正在解析 PDF…');
      silentProgress.update('正在提取结构化信息…');
      silentProgress.stop();
      silentProgress.succeed('完成');
    }).not.toThrow();
  });
});
