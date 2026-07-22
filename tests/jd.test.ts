import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
    const path = await tempPath('missing.txt');
    await expect(readJd(path)).rejects.toMatchObject({ code: 'JD_NOT_FOUND', exitCode: 2 });
  });

  it('rejects directories', async () => {
    const path = await tempPath('folder');
    await mkdir(path);
    await expect(readJd(path)).rejects.toMatchObject({ code: 'JD_NOT_FILE', exitCode: 2 });
  });

  it('rejects empty content', async () => {
    const path = await tempPath('empty.txt');
    await writeFile(path, ' \n ', 'utf8');
    await expect(readJd(path)).rejects.toMatchObject({ code: 'JD_EMPTY', exitCode: 2 });
  });
});
