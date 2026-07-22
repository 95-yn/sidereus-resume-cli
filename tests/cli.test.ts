import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/errors.js';
import { runCli, type ProgramDependencies } from '../src/program.js';

function dependencies(): ProgramDependencies {
  return {
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
  };
}

function io() {
  return { stdout: vi.fn(), stderr: vi.fn() };
}

describe('CLI', () => {
  it.each([
    ['--help'],
    ['parse', '--help'],
    ['extract', '--help'],
    ['score', '--help'],
  ])('renders help for %s', async (...args) => {
    const streams = io();
    const exitCode = await runCli(args, dependencies(), streams);
    expect(exitCode).toBe(0);
    expect(streams.stdout.mock.calls.join('\n')).toContain('Usage:');
  });

  it('treats a missing JD option as a user error', async () => {
    const streams = io();
    const exitCode = await runCli(['score', 'resume.pdf'], dependencies(), streams);
    expect(exitCode).toBe(2);
    expect(streams.stderr.mock.calls.join('\n')).toContain('--jd');
  });

  it('dispatches extract mock mode and keeps JSON output clean', async () => {
    const deps = dependencies();
    const streams = io();
    const exitCode = await runCli(['extract', 'resume.pdf', '--mock'], deps, streams);
    expect(exitCode).toBe(0);
    expect(deps.mockExtract).toHaveBeenCalled();
    expect(deps.extractCandidate).not.toHaveBeenCalled();
    expect(deps.writeResult).toHaveBeenCalledWith(
      expect.stringMatching(/^\{\n/),
      expect.objectContaining({ stdout: streams.stdout, stderr: streams.stderr }),
    );
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
});
