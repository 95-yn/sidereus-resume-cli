import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { suggestFiles } from '../src/utils/file-suggestions.js';

async function createTree(
  files: Record<string, string> = {},
  directories: string[] = [],
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'resume-cli-suggestions-'));

  for (const directory of directories) {
    await mkdir(join(root, directory), { recursive: true });
  }

  for (const [relativePath, contents] of Object.entries(files)) {
    const path = join(root, relativePath);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, contents, 'utf8');
  }

  return root;
}

describe('suggestFiles', () => {
  it('ranks the closest PDF basename first and applies the default limit', async () => {
    const cwd = await createTree({
      'summary.pdf': '',
      'resume.pdf': '',
      'resume-copy.pdf': '',
      'unrelated-document.pdf': '',
    });

    const suggestions = await suggestFiles('resum.pdf', 'pdf', { cwd });

    expect(suggestions[0]).toBe('./resume.pdf');
    expect(suggestions).toHaveLength(3);
    expect(suggestions).not.toContain('./unrelated-document.pdf');
  });

  it('filters suggestions by PDF and JD file extensions', async () => {
    const cwd = await createTree({
      'resume.pdf': '',
      'UPPER.PDF': '',
      'resume.txt': '',
      'job.txt': '',
      'job.md': '',
      'job.markdown': '',
      'job.rtf': '',
    });

    await expect(suggestFiles('missing.pdf', 'pdf', { cwd, limit: 10 })).resolves.toEqual([
      './resume.pdf',
      './UPPER.PDF',
    ]);
    const jdSuggestions = await suggestFiles('missing.txt', 'jd', { cwd, limit: 10 });
    expect(jdSuggestions).toHaveLength(4);
    expect(jdSuggestions).toEqual(
      expect.arrayContaining(['./job.txt', './job.md', './job.markdown', './resume.txt']),
    );
  });

  it('matches .env and .env.* files while ignoring other hidden entries', async () => {
    const cwd = await createTree({
      '.env': '',
      '.env.local': '',
      '.env.production': '',
      '.ENV.DeepSeek': '',
      '.env.': '',
      '.envrc': '',
      '.secret': '',
      '.hidden/.env.staging': '',
    });

    const suggestions = await suggestFiles('.env', 'env', { cwd, limit: 10 });

    expect(suggestions).toEqual(
      expect.arrayContaining(['./.env', './.env.local', './.env.production', './.ENV.DeepSeek']),
    );
    expect(suggestions).not.toContain('./.env.');
  });

  it('scans inside a directory input, including Chinese and space paths', async () => {
    const cwd = await createTree({ '简历 空间/resume.pdf': '' }, ['简历 空间']);

    await expect(suggestFiles('简历 空间', 'pdf', { cwd })).resolves.toEqual([
      './简历 空间/resume.pdf',
    ]);
  });

  it('keeps suggestions absolute when an existing directory input is outside cwd', async () => {
    const cwd = await createTree();
    const outsideDirectory = await createTree({ 'resume.pdf': '' });

    await expect(suggestFiles(outsideDirectory, 'pdf', { cwd })).resolves.toEqual([
      join(outsideDirectory, 'resume.pdf'),
    ]);
  });

  it('skips excluded and hidden directories', async () => {
    const cwd = await createTree({
      'resume.pdf': '',
      '.git/resume.pdf': '',
      'node_modules/resume.pdf': '',
      'dist/resume.pdf': '',
      'coverage/resume.pdf': '',
      '.next/resume.pdf': '',
      'build/resume.pdf': '',
      '.private/resume.pdf': '',
    });

    await expect(suggestFiles('resum.pdf', 'pdf', { cwd, limit: 10 })).resolves.toEqual([
      './resume.pdf',
    ]);
  });

  it('does not include files below the configured maximum depth', async () => {
    const cwd = await createTree({
      'first/resume.pdf': '',
      'first/second/resume.pdf': '',
      'first/second/third/resume.pdf': '',
    });

    await expect(suggestFiles('resum.pdf', 'pdf', { cwd, limit: 10 })).resolves.toEqual([
      './first/resume.pdf',
      './first/second/resume.pdf',
    ]);
  });

  it('falls back to cwd when the input parent does not exist', async () => {
    const cwd = await createTree({ 'resume.pdf': '' });

    await expect(suggestFiles('missing/parent/resum.pdf', 'pdf', { cwd })).resolves.toEqual([
      './resume.pdf',
    ]);
  });

  it('stops inspecting entries when the entry budget is exhausted', async () => {
    const cwd = await createTree({ 'a-not-a-pdf.txt': '', 'resume.pdf': '' });

    await expect(suggestFiles('resum.pdf', 'pdf', { cwd, maxEntries: 1 })).resolves.toEqual([]);
  });

  it('returns deterministic results regardless of directory enumeration order', async () => {
    const cwd = await createTree({ 'beta.pdf': '', 'alpha.pdf': '' });

    const first = await suggestFiles('gamma.pdf', 'pdf', { cwd, limit: 10 });
    const second = await suggestFiles('gamma.pdf', 'pdf', { cwd, limit: 10 });

    expect(first).toEqual(['./alpha.pdf', './beta.pdf']);
    expect(second).toEqual(first);
  });
});
