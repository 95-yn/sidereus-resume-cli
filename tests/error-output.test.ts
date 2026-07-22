import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/errors.js';
import { renderAppError } from '../src/utils/error-output.js';

describe('renderAppError', () => {
  it('renders ordinary errors concisely without scanning', async () => {
    const suggestFiles = vi.fn();
    const error = new AppError('AI 请求失败，请稍后重试。', { code: 'AI_REQUEST_FAILED' });

    await expect(
      renderAppError(error, { cwd: '/workspace', args: ['extract', 'resume.pdf'], suggestFiles }),
    ).resolves.toBe('错误：AI 请求失败，请稍后重试。');

    expect(suggestFiles).not.toHaveBeenCalled();
  });

  it('escapes terminal controls in primary error messages', async () => {
    const message = 'PDF 文件不存在：bad\n\u001b]0;pwn\u0007.pdf';
    const ordinary = new AppError(message, { code: 'AI_REQUEST_FAILED' });
    const guided = new AppError(message, {
      code: 'PDF_NOT_FOUND',
      fileGuidance: { kind: 'pdf', inputPath: 'missing.pdf' },
    });

    await expect(
      renderAppError(ordinary, { cwd: '/workspace', args: [], suggestFiles: vi.fn() }),
    ).resolves.toBe('错误：PDF 文件不存在：bad\\n\\u001B]0;pwn\\u0007.pdf');

    const renderedGuided = await renderAppError(guided, {
      cwd: '/workspace',
      args: ['extract', 'missing.pdf'],
      suggestFiles: async () => [],
    });
    expect(renderedGuided).toContain('错误：PDF 文件不存在：bad\\n\\u001B]0;pwn\\u0007.pdf');
    expect(renderedGuided).not.toContain(message);
  });

  it('renders file suggestions, a safe retry command, and the current directory', async () => {
    const error = new AppError('PDF 文件不存在：resume.pdf', {
      code: 'PDF_NOT_FOUND',
      fileGuidance: { kind: 'pdf', inputPath: 'resume.pdf' },
    });

    const rendered = await renderAppError(error, {
      cwd: '/workspace',
      args: ['extract', 'resume.pdf'],
      suggestFiles: async () => ['./简历/张三 cv.pdf', './resume.pdf'],
    });

    expect(rendered).toBe(
      '错误：PDF 文件不存在：resume.pdf\n\n' +
        '你可能想使用：\n' +
        '1. ./简历/张三 cv.pdf\n' +
        '2. ./resume.pdf\n\n' +
        "重试：resume-cli extract './简历/张三 cv.pdf'\n\n" +
        '当前目录：/workspace',
    );
  });

  it('shows an absolute-path hint when no candidates are found', async () => {
    const error = new AppError('JD 文件不存在：job.txt', {
      code: 'JD_NOT_FOUND',
      fileGuidance: { kind: 'jd', inputPath: 'job.txt' },
    });

    const rendered = await renderAppError(error, {
      cwd: '/workspace',
      args: ['score', 'resume.pdf', '--jd', 'job.txt'],
      suggestFiles: async () => [],
    });

    expect(rendered).toContain('提示：请检查相对路径，或改用绝对路径。');
    expect(rendered).not.toContain('重试：');
    expect(rendered).toMatch(/\n\n当前目录：\/workspace$/);
  });

  it('keeps the primary error and falls back when scanning rejects', async () => {
    const error = new AppError('PDF 文件不存在：resume.pdf', {
      code: 'PDF_NOT_FOUND',
      fileGuidance: { kind: 'pdf', inputPath: 'resume.pdf' },
    });

    const rendered = await renderAppError(error, {
      cwd: '/workspace',
      args: ['extract', 'resume.pdf'],
      suggestFiles: async () => Promise.reject(new Error('scanner unavailable')),
    });

    expect(rendered).toContain('错误：PDF 文件不存在：resume.pdf');
    expect(rendered).toContain('提示：请检查相对路径，或改用绝对路径。');
    expect(rendered).toMatch(/\n\n当前目录：\/workspace$/);
  });

  it('shell-quotes unsafe argv values and replaces only exact input tokens', async () => {
    const error = new AppError('PDF 文件不存在：resume.pdf', {
      code: 'PDF_NOT_FOUND',
      fileGuidance: { kind: 'pdf', inputPath: 'resume.pdf' },
    });

    const rendered = await renderAppError(error, {
      cwd: '/workspace',
      args: ['extract', 'resume.pdf', '--copy', 'resume.pdf.bak', '--note', "O'Reilly $HOME `id`"],
      suggestFiles: async () => ["./简历/O'Reilly $HOME `id`.pdf"],
    });

    expect(rendered).toContain(
      "重试：resume-cli extract './简历/O'\\''Reilly $HOME `id`.pdf' --copy resume.pdf.bak --note 'O'\\''Reilly $HOME `id`'",
    );
    expect(rendered).not.toContain('--copy ./简历/');
  });

  it('replaces only the PDF positional argument when another option has the same value', async () => {
    const error = new AppError('PDF 文件不存在：missing.pdf', {
      code: 'PDF_NOT_FOUND',
      fileGuidance: { kind: 'pdf', inputPath: 'missing.pdf' },
    });

    const rendered = await renderAppError(error, {
      cwd: '/workspace',
      args: ['parse', 'missing.pdf', '-o', 'missing.pdf'],
      suggestFiles: async () => ['./candidate.pdf'],
    });

    expect(rendered).toContain('重试：resume-cli parse ./candidate.pdf -o missing.pdf');
    expect(rendered).not.toContain('-o ./candidate.pdf');
  });

  it('shows fallback help instead of a retry when the guided argument role does not match', async () => {
    const error = new AppError('JD 文件不存在：missing.txt', {
      code: 'JD_NOT_FOUND',
      fileGuidance: { kind: 'jd', inputPath: 'missing.txt' },
    });

    const rendered = await renderAppError(error, {
      cwd: '/workspace',
      args: ['score', 'resume.pdf', '--jd', 'other.txt'],
      suggestFiles: async () => ['./candidate.txt'],
    });

    expect(rendered).toContain('你可能想使用：\n1. ./candidate.txt');
    expect(rendered).toContain('提示：请检查相对路径，或改用绝对路径。');
    expect(rendered).not.toContain('重试：');
  });

  it('escapes terminal controls in candidate and cwd displays without offering an unsafe retry', async () => {
    const unsafeCandidate = './resume\n\u001b]0;pwn\u0007\u009b31m\u202e.pdf';
    const unsafeCwd = '/workspace\r\u001b[2J\u2066';
    const error = new AppError('PDF 文件不存在：missing.pdf', {
      code: 'PDF_NOT_FOUND',
      fileGuidance: { kind: 'pdf', inputPath: 'missing.pdf' },
    });

    const rendered = await renderAppError(error, {
      cwd: unsafeCwd,
      args: ['extract', 'missing.pdf'],
      suggestFiles: async () => [unsafeCandidate],
    });

    expect(rendered).toContain('1. ./resume\\n\\u001B]0;pwn\\u0007\\u009B31m\\u202E.pdf');
    expect(rendered).toContain('当前目录：/workspace\\r\\u001B[2J\\u2066');
    expect(rendered).toContain('提示：请检查相对路径，或改用绝对路径。');
    expect(rendered).not.toContain('重试：');
    expect(rendered).not.toContain(unsafeCandidate);
    expect(rendered).not.toContain(unsafeCwd);
  });

  it('limits rendered candidates to three', async () => {
    const error = new AppError('PDF 文件不存在：missing.pdf', {
      code: 'PDF_NOT_FOUND',
      fileGuidance: { kind: 'pdf', inputPath: 'missing.pdf' },
    });

    const rendered = await renderAppError(error, {
      cwd: '/workspace',
      args: ['extract', 'missing.pdf'],
      suggestFiles: async () => ['./one.pdf', './two.pdf', './three.pdf', './four.pdf'],
    });

    expect(rendered).toContain('1. ./one.pdf\n2. ./two.pdf\n3. ./three.pdf');
    expect(rendered).not.toContain('./four.pdf');
  });

  it('suppresses a retry when any unrelated argv token has terminal controls', async () => {
    const error = new AppError('PDF 文件不存在：missing.pdf', {
      code: 'PDF_NOT_FOUND',
      fileGuidance: { kind: 'pdf', inputPath: 'missing.pdf' },
    });

    const rendered = await renderAppError(error, {
      cwd: '/workspace',
      args: ['extract', 'missing.pdf', '-o', 'unsafe\noutput.json'],
      suggestFiles: async () => ['./candidate.pdf'],
    });

    expect(rendered).toContain('提示：请检查相对路径，或改用绝对路径。');
    expect(rendered).not.toContain('重试：');
  });

  it('finds the PDF positional argument after known options', async () => {
    const error = new AppError('PDF 文件不存在：missing.pdf', {
      code: 'PDF_NOT_FOUND',
      fileGuidance: { kind: 'pdf', inputPath: 'missing.pdf' },
    });

    const rendered = await renderAppError(error, {
      cwd: '/workspace',
      args: ['parse', '-o', 'out.txt', 'missing.pdf'],
      suggestFiles: async () => ['./candidate.pdf'],
    });

    expect(rendered).toContain('重试：resume-cli parse -o out.txt ./candidate.pdf');
  });

  it('falls back instead of guessing after an unknown PDF option', async () => {
    const error = new AppError('PDF 文件不存在：missing.pdf', {
      code: 'PDF_NOT_FOUND',
      fileGuidance: { kind: 'pdf', inputPath: 'missing.pdf' },
    });

    const rendered = await renderAppError(error, {
      cwd: '/workspace',
      args: ['parse', '--unknown', 'missing.pdf', 'other.pdf'],
      suggestFiles: async () => ['./candidate.pdf'],
    });

    expect(rendered).toContain('提示：请检查相对路径，或改用绝对路径。');
    expect(rendered).not.toContain('重试：');
  });

  it('replaces a JD value supplied with an equals flag', async () => {
    const error = new AppError('JD 文件不存在：missing.txt', {
      code: 'JD_NOT_FOUND',
      fileGuidance: { kind: 'jd', inputPath: 'missing.txt' },
    });

    const rendered = await renderAppError(error, {
      cwd: '/workspace',
      args: ['score', 'resume.pdf', '--jd=missing.txt'],
      suggestFiles: async () => ['./candidate.txt'],
    });

    expect(rendered).toContain('重试：resume-cli score resume.pdf --jd=./candidate.txt');
  });

  it('replaces the last repeated JD flag value', async () => {
    const error = new AppError('JD 文件不存在：missing.txt', {
      code: 'JD_NOT_FOUND',
      fileGuidance: { kind: 'jd', inputPath: 'missing.txt' },
    });

    const rendered = await renderAppError(error, {
      cwd: '/workspace',
      args: ['score', 'resume.pdf', '--jd', 'old.txt', '--jd', 'missing.txt'],
      suggestFiles: async () => ['./candidate.txt'],
    });

    expect(rendered).toContain(
      '重试：resume-cli score resume.pdf --jd old.txt --jd ./candidate.txt',
    );
  });
});
