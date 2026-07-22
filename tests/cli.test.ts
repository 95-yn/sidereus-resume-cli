import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/errors.js';
import {
  runCli,
  type CliSignal,
  type ProgramDependencies,
  type SignalRuntime,
} from '../src/program.js';
import { writeResult } from '../src/utils/output.js';
import type { Progress } from '../src/utils/progress.js';

function dependencies(): ProgramDependencies {
  return {
    loadEnvironment: vi.fn().mockResolvedValue(undefined),
    readPdf: vi.fn().mockResolvedValue('resume text'),
    readJd: vi.fn().mockResolvedValue('jd text'),
    extractCandidate: vi.fn().mockResolvedValue({
      name: '', phone: '', email: '', city: '', education: [], skills: [],
    }),
    scoreResume: vi.fn().mockResolvedValue({
      overall_score: 50,
      skill_score: 50,
      experience_score: 50,
      education_score: 50,
      comment: '演示',
      interview_questions: ['问题'],
    }),
    mockExtract: vi.fn().mockReturnValue({
      name: 'Mock', phone: '', email: '', city: '', education: [], skills: [],
    }),
    mockScore: vi.fn().mockReturnValue({
      overall_score: 50,
      skill_score: 50,
      experience_score: 50,
      education_score: 50,
      comment: 'Mock',
      interview_questions: ['问题'],
    }),
    writeResult: vi.fn(),
    renderAppError: vi.fn(async (error: AppError) => `错误：${error.message}`),
  };
}

function io(options: {
  stdoutIsTTY?: boolean;
  stderrIsTTY?: boolean;
  progressFactory?: (enabled: boolean) => Progress;
  signalRuntime?: SignalRuntime;
} = {}) {
  return { stdout: vi.fn(), stderr: vi.fn(), ...options };
}

const originalCi = process.env.CI;

afterEach(() => {
  if (originalCi === undefined) {
    delete process.env.CI;
  } else {
    process.env.CI = originalCi;
  }
});

describe('CLI', () => {
  it.each([
    ['--help'],
    ['parse', '--help'],
    ['extract', '--help'],
    ['score', '--help'],
  ])('renders help for %s', async (...args) => {
    const deps = dependencies();
    const progressFactory = vi.fn();
    const streams = io({ progressFactory });
    const exitCode = await runCli(args, deps, streams);
    expect(exitCode).toBe(0);
    expect(streams.stdout.mock.calls.join('\n')).toContain('Usage:');
    expect(deps.loadEnvironment).not.toHaveBeenCalled();
    expect(progressFactory).not.toHaveBeenCalled();
  });

  it('lists the progress opt-out in root help', async () => {
    const progressFactory = vi.fn();
    const streams = io({ progressFactory });

    expect(await runCli(['--help'], dependencies(), streams)).toBe(0);
    expect(streams.stdout.mock.calls.join('\n')).toContain('--no-progress');
    expect(streams.stdout.mock.calls.join('\n')).toContain('关闭动态进度提示');
  });

  it.each([
    ['both streams are TTY', true, true, undefined, ['parse', 'resume.pdf'], true],
    ['stdout is piped', false, true, undefined, ['parse', 'resume.pdf'], false],
    ['stderr is not a TTY', true, false, undefined, ['parse', 'resume.pdf'], false],
    ['CI is set', true, true, '1', ['parse', 'resume.pdf'], false],
    ['progress is disabled before the command', true, true, undefined,
      ['--no-progress', 'parse', 'resume.pdf'], false],
    ['progress is disabled after the command', true, true, undefined,
      ['parse', 'resume.pdf', '--no-progress'], false],
  ] as const)(
    'applies progress policy for %s',
    async (_description, stdoutIsTTY, stderrIsTTY, ci, args, expected) => {
      if (ci === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = ci;
      }
      const progress: Progress = {
        start: vi.fn(), update: vi.fn(), stop: vi.fn(), succeed: vi.fn(),
      };
      const progressFactory = vi.fn().mockReturnValue(progress);
      const streams = io({ stdoutIsTTY, stderrIsTTY, progressFactory });

      expect(await runCli([...args], dependencies(), streams)).toBe(0);

      expect(progressFactory).toHaveBeenCalledOnce();
      expect(progressFactory).toHaveBeenCalledWith(expected);
    },
  );

  it.each([['--help'], ['--version']])(
    'does not load env or create progress for %s',
    async (...args) => {
      const deps = dependencies();
      const progressFactory = vi.fn();

      expect(await runCli(args, deps, io({ progressFactory }))).toBe(0);
      expect(deps.loadEnvironment).not.toHaveBeenCalled();
      expect(progressFactory).not.toHaveBeenCalled();
    },
  );

  it('loads the default environment before running a command', async () => {
    const deps = dependencies();
    const streams = io();

    expect(await runCli(['extract', 'resume.pdf', '--mock'], deps, streams)).toBe(0);

    expect(deps.loadEnvironment).toHaveBeenCalledWith({
      cwd: process.cwd(),
      env: process.env,
    });
    expect(vi.mocked(deps.loadEnvironment).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deps.readPdf).mock.invocationCallOrder[0]!,
    );
  });

  it('passes an explicit global env file to the loader', async () => {
    const deps = dependencies();
    const streams = io();

    expect(
      await runCli(
        ['--env-file', 'config/resume.env', 'extract', 'resume.pdf', '--mock'],
        deps,
        streams,
      ),
    ).toBe(0);
    expect(deps.loadEnvironment).toHaveBeenCalledWith({
      cwd: process.cwd(),
      env: process.env,
      envFile: 'config/resume.env',
    });
  });

  it('maps an environment loading error to exit code 2', async () => {
    const deps = dependencies();
    deps.loadEnvironment = vi.fn().mockRejectedValue(
      new AppError('配置文件不存在', {
        code: 'ENV_FILE_NOT_FOUND',
        exitCode: 2,
      }),
    );
    const progressFactory = vi.fn();
    const streams = io({ progressFactory });

    expect(
      await runCli(['--env-file', 'missing.env', 'parse', 'resume.pdf'], deps, streams),
    ).toBe(2);
    expect(deps.readPdf).not.toHaveBeenCalled();
    expect(progressFactory).not.toHaveBeenCalled();
    expect(deps.renderAppError).toHaveBeenCalledOnce();
    expect(streams.stderr).toHaveBeenCalledWith(expect.stringContaining('配置文件不存在'));
  });

  it('treats a missing JD option as a user error', async () => {
    const streams = io();
    const exitCode = await runCli(['score', 'resume.pdf'], dependencies(), streams);
    expect(exitCode).toBe(2);
    expect(streams.stderr.mock.calls.join('\n')).toContain('--jd');
  });

  it('keeps ordinary unknown-option errors readable with help guidance', async () => {
    const streams = io();

    expect(await runCli(['parse', 'resume.pdf', '--unknown'], dependencies(), streams)).toBe(2);
    const stderr = streams.stderr.mock.calls.flat().join('');
    expect(stderr).toContain("error: unknown option '--unknown'");
    expect(stderr).toContain('Usage: resume-cli parse');
  });

  it('sanitizes terminal controls in Commander parser errors', async () => {
    const streams = io();

    expect(await runCli(
      ['parse', 'resume.pdf', unsafeOption],
      dependencies(),
      streams,
    )).toBe(2);

    const stderr = streams.stderr.mock.calls.flat().join('');
    expect(stderr).toContain(
      "error: unknown option '--bad\\n\\u001B]0;pwn\\u0007\\u009B31m\\u202E'",
    );
    expect(stderr).toContain('Usage: resume-cli parse');
    expect(stderr).not.toContain(unsafeOption);
    for (const character of ['\u001b', '\u0007', '\u009b', '\u202e']) {
      expect(stderr).not.toContain(character);
    }
  });

  it('dispatches extract mock mode and keeps real stdout JSON clean', async () => {
    const deps = dependencies();
    deps.writeResult = writeResult;
    const progress: Progress = {
      start: vi.fn(), update: vi.fn(), stop: vi.fn(), succeed: vi.fn(),
    };
    const streams = io({
      stdoutIsTTY: true,
      stderrIsTTY: true,
      progressFactory: vi.fn().mockReturnValue(progress),
    });
    delete process.env.CI;
    const exitCode = await runCli(['extract', 'resume.pdf', '--mock'], deps, streams);
    expect(exitCode).toBe(0);
    expect(deps.mockExtract).toHaveBeenCalled();
    expect(deps.extractCandidate).not.toHaveBeenCalled();
    expect(streams.stdout).toHaveBeenCalledOnce();
    const output = streams.stdout.mock.calls[0]![0];
    expect(JSON.parse(output)).toEqual({
      name: 'Mock', phone: '', email: '', city: '', education: [], skills: [],
    });
    expect(output).not.toMatch(/正在|完成/);
    expect(output).not.toContain(String.fromCharCode(27));
    expect(progress.start).toHaveBeenCalledWith('正在解析 PDF…');
  });

  it('returns typed application exit codes', async () => {
    const deps = dependencies();
    deps.readPdf = vi.fn().mockRejectedValue(
      new AppError('文件不存在', { code: 'PDF_NOT_FOUND', exitCode: 2 }),
    );
    const streams = io();
    expect(await runCli(['parse', 'missing.pdf'], deps, streams)).toBe(2);
    expect(streams.stderr).toHaveBeenCalledWith(expect.stringContaining('文件不存在'));
  });

  it('hides unexpected errors', async () => {
    const deps = dependencies();
    deps.readPdf = vi.fn().mockRejectedValue(new Error('internal secret'));
    const streams = io();
    expect(await runCli(['parse', 'resume.pdf'], deps, streams)).toBe(1);
    expect(streams.stderr.mock.calls.join('\n')).not.toContain('internal secret');
  });

  it('awaits friendly error rendering and writes it before verbose diagnostics', async () => {
    const deps = dependencies();
    const failure = new AppError('文件不存在', { code: 'PDF_NOT_FOUND', exitCode: 2 });
    deps.readPdf = vi.fn().mockRejectedValue(failure);
    let resolveRender!: (text: string) => void;
    deps.renderAppError = vi.fn(() => new Promise<string>((resolve) => {
      resolveRender = resolve;
    }));
    const streams = io();

    const result = runCli(['--verbose', 'parse', 'missing.pdf'], deps, streams);
    await vi.waitFor(() => expect(deps.renderAppError).toHaveBeenCalledWith(
      failure,
      { cwd: process.cwd(), args: ['--verbose', 'parse', 'missing.pdf'] },
    ));
    expect(streams.stderr).not.toHaveBeenCalledWith('友好错误文本');
    resolveRender('友好错误文本');

    expect(await result).toBe(2);
    expect(streams.stderr).toHaveBeenNthCalledWith(2, '友好错误文本');
    expect(streams.stderr).toHaveBeenNthCalledWith(3, '[debug] code=PDF_NOT_FOUND');
  });

  it('uses silent progress when no factory is supplied', async () => {
    expect(await runCli(['parse', 'resume.pdf'], dependencies(), io())).toBe(0);
  });

  it.each(['SIGINT', 'SIGTERM'] as const)(
    'stops active progress before propagating %s and removes handlers',
    async (signal) => {
      const deps = dependencies();
      let resolveRead!: (text: string) => void;
      deps.readPdf = vi.fn(() => new Promise<string>((resolve) => {
        resolveRead = resolve;
      }));
      const events: string[] = [];
      const progress: Progress = {
        start: vi.fn((text) => events.push(`start:${text}`)),
        update: vi.fn(),
        stop: vi.fn(() => events.push('stop')),
        succeed: vi.fn(() => events.push('succeed')),
      };
      const handlers = new Map<CliSignal, () => void>();
      const signalRuntime: SignalRuntime = {
        onSignal: vi.fn((signal, handler) => {
          events.push(`on:${signal}`);
          handlers.set(signal, handler);
        }),
        offSignal: vi.fn((signal, handler) => {
          events.push(`off:${signal}`);
          if (handlers.get(signal) === handler) handlers.delete(signal);
        }),
        propagateSignal: vi.fn((signal) => events.push(`propagate:${signal}`)),
      };
      const result = runCli(['parse', 'resume.pdf'], deps, io({
        stdoutIsTTY: true,
        stderrIsTTY: true,
        progressFactory: vi.fn().mockReturnValue(progress),
        signalRuntime,
      }));
      await vi.waitFor(() => expect(progress.start).toHaveBeenCalledOnce());

      handlers.get(signal)!();

      expect(events).toEqual([
        'on:SIGINT',
        'on:SIGTERM',
        'start:正在读取并解析 PDF…',
        'stop',
        'off:SIGINT',
        'off:SIGTERM',
        `propagate:${signal}`,
      ]);
      expect(handlers.size).toBe(0);
      resolveRead('resume text');
      expect(await result).toBe(0);
      expect(progress.stop).toHaveBeenCalledOnce();
      expect(progress.succeed).not.toHaveBeenCalled();
    },
  );

  it('removes temporary signal handlers after every normal run', async () => {
    const handlers = new Map<CliSignal, Set<() => void>>();
    const signalRuntime: SignalRuntime = {
      onSignal: vi.fn((signal, handler) => {
        const registered = handlers.get(signal) ?? new Set();
        registered.add(handler);
        handlers.set(signal, registered);
      }),
      offSignal: vi.fn((signal, handler) => handlers.get(signal)?.delete(handler)),
      propagateSignal: vi.fn(),
    };

    await runCli(['parse', 'resume.pdf'], dependencies(), io({ signalRuntime }));
    await runCli(['parse', 'resume.pdf'], dependencies(), io({ signalRuntime }));

    expect(signalRuntime.onSignal).toHaveBeenCalledTimes(4);
    expect(signalRuntime.offSignal).toHaveBeenCalledTimes(4);
    expect([...handlers.values()].every((registered) => registered.size === 0)).toBe(true);
  });

  it('keeps the primary application error when friendly rendering fails', async () => {
    const deps = dependencies();
    deps.readPdf = vi.fn().mockRejectedValue(
      new AppError('文件不存在', { code: 'PDF_NOT_FOUND', exitCode: 2 }),
    );
    deps.renderAppError = vi.fn().mockRejectedValue(new Error('renderer secret'));
    const streams = io();

    expect(await runCli(['--verbose', 'parse', 'missing.pdf'], deps, streams)).toBe(2);
    expect(streams.stderr.mock.calls.join('\n')).not.toContain('renderer secret');
    expect(streams.stderr).toHaveBeenCalledWith('错误：操作失败，请使用 --verbose 查看错误代码。');
    expect(streams.stderr).toHaveBeenLastCalledWith('[debug] code=PDF_NOT_FOUND');
  });

  it.each([
    ['parse', ['--verbose', 'parse', unsafePath], `[debug] parse: ${safePath}`],
    ['extract', ['--verbose', 'extract', unsafePath, '--mock'],
      `[debug] extract (mock): ${safePath}`],
    ['score', ['--verbose', 'score', unsafePath, '--jd', 'jd.txt', '--mock'],
      `[debug] score (mock): ${safePath}`],
  ] as const)('sanitizes attacker-controlled paths in %s diagnostics', async (
    _command,
    args,
    expected,
  ) => {
    const streams = io();

    expect(await runCli([...args], dependencies(), streams)).toBe(0);
    expect(streams.stderr).toHaveBeenCalledWith(expected);
    expect(streams.stderr.mock.calls.flat().join('')).not.toContain(unsafePath);
  });

  it('sanitizes application error codes in verbose diagnostics', async () => {
    const deps = dependencies();
    deps.readPdf = vi.fn().mockRejectedValue(
      new AppError('失败', { code: 'BAD\n\u001b]0;pwn\u0007\u009b31m\u202e' }),
    );
    const streams = io();

    expect(await runCli(['--verbose', 'parse', 'resume.pdf'], deps, streams)).toBe(1);
    expect(streams.stderr).toHaveBeenLastCalledWith(
      '[debug] code=BAD\\n\\u001B]0;pwn\\u0007\\u009B31m\\u202E',
    );
  });
});

const unsafePath = 'resume\n\u001b]0;pwn\u0007\u009b31m\u202e.pdf';
const safePath = 'resume\\n\\u001B]0;pwn\\u0007\\u009B31m\\u202E.pdf';
const unsafeOption = '--bad\n\u001b]0;pwn\u0007\u009b31m\u202e';
