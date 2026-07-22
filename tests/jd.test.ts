import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readJd } from '../src/services/jd.js';

async function tempPath(name: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'resume-cli-jd-'));
  return join(directory, name);
}

describe('readJd', () => {
  it('reads and trims UTF-8 text', async () => {
    const path = await tempPath('jd.txt');
    await writeFile(path, '  TypeScript engineer  \n', 'utf8');
    await expect(readJd(path)).resolves.toBe('TypeScript engineer');
  });

  it('reports a missing file as a user error', async () => {
    const inputPath = relative(process.cwd(), await tempPath('missing.txt'));
    const error = await readJd(inputPath).catch((cause: unknown) => cause);

    expect(error).toMatchObject({
      code: 'JD_NOT_FOUND',
      exitCode: 2,
    });
    expect((error as { fileGuidance: unknown }).fileGuidance).toEqual({ kind: 'jd', inputPath });
  });

  it('rejects directories', async () => {
    const absolutePath = await tempPath('folder');
    await mkdir(absolutePath);
    const inputPath = relative(process.cwd(), absolutePath);
    const error = await readJd(inputPath).catch((cause: unknown) => cause);

    expect(error).toMatchObject({
      code: 'JD_NOT_FILE',
      exitCode: 2,
    });
    expect((error as { fileGuidance: unknown }).fileGuidance).toEqual({ kind: 'jd', inputPath });
  });

  it('rejects empty content', async () => {
    const path = await tempPath('empty.txt');
    await writeFile(path, ' \n ', 'utf8');
    const error = await readJd(path).catch((cause: unknown) => cause);
    expect(error).toMatchObject({ code: 'JD_EMPTY', exitCode: 2 });
    expect(error).toMatchObject({ fileGuidance: undefined });
  });
});
