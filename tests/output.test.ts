import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { writeResult } from '../src/utils/output.js';

describe('writeResult', () => {
  it('writes to stdout when no path is provided', async () => {
    const stdout = vi.fn();
    await writeResult('hello', { stdout, stderr: vi.fn() });
    expect(stdout).toHaveBeenCalledExactlyOnceWith('hello');
  });

  it('creates parent directories and writes exact content', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'resume-cli-output-'));
    const outputPath = join(directory, 'nested', 'result.json');
    const stdout = vi.fn();
    const stderr = vi.fn();

    await writeResult('{"ok":true}', { outputPath, stdout, stderr });

    await expect(readFile(outputPath, 'utf8')).resolves.toBe('{"ok":true}');
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining(outputPath));
  });
});
