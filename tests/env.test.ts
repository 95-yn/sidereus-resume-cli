import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { loadEnvironment } from '../src/services/env.js';

async function tempDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'resume-cli-env-'));
}

describe('loadEnvironment', () => {
  it('loads .env from the supplied working directory', async () => {
    const cwd = await tempDirectory();
    await writeFile(join(cwd, '.env'), 'AI_PROVIDER=deepseek\nDEEPSEEK_API_KEY=fake-key\n');
    const env: Record<string, string | undefined> = {};

    await loadEnvironment({ cwd, env });

    expect(env).toMatchObject({
      AI_PROVIDER: 'deepseek',
      DEEPSEEK_API_KEY: 'fake-key',
    });
  });

  it('silently skips a missing default .env', async () => {
    const cwd = await tempDirectory();
    await expect(loadEnvironment({ cwd, env: {} })).resolves.toBeUndefined();
  });

  it('does not attach guidance when the implicit .env path is a directory', async () => {
    const cwd = await tempDirectory();
    await mkdir(join(cwd, '.env'));
    const error = await loadEnvironment({ cwd, env: {} }).catch((cause: unknown) => cause);

    expect(error).toMatchObject({ code: 'ENV_FILE_NOT_FILE', exitCode: 2 });
    expect(error).toMatchObject({ fileGuidance: undefined });
  });

  it('loads an explicitly named file', async () => {
    const cwd = await tempDirectory();
    await mkdir(join(cwd, 'config'));
    await writeFile(join(cwd, 'config', 'resume.env'), 'AI_PROVIDER=openai\n');
    const env: Record<string, string | undefined> = {};

    await loadEnvironment({ cwd, env, envFile: 'config/resume.env' });

    expect(env.AI_PROVIDER).toBe('openai');
  });

  it('rejects a missing explicit file', async () => {
    const cwd = await tempDirectory();
    const error = await loadEnvironment({ cwd, env: {}, envFile: 'missing.env' }).catch(
      (cause: unknown) => cause,
    );

    expect(error).toMatchObject({
      code: 'ENV_FILE_NOT_FOUND',
      exitCode: 2,
    });
    expect((error as { fileGuidance: unknown }).fileGuidance).toEqual({
      kind: 'env',
      inputPath: 'missing.env',
    });
  });

  it('rejects an explicit directory', async () => {
    const cwd = await tempDirectory();
    await mkdir(join(cwd, 'config.env'));
    const error = await loadEnvironment({ cwd, env: {}, envFile: 'config.env' }).catch(
      (cause: unknown) => cause,
    );

    expect(error).toMatchObject({
      code: 'ENV_FILE_NOT_FILE',
      exitCode: 2,
    });
    expect((error as { fileGuidance: unknown }).fileGuidance).toEqual({
      kind: 'env',
      inputPath: 'config.env',
    });
  });

  it('maps dotenv parsing errors without exposing content', async () => {
    const cwd = await tempDirectory();
    await writeFile(join(cwd, '.env'), 'SECRET=value\n');
    const loadDotenv = vi.fn().mockReturnValue({ error: new Error('parse failed') });
    const error = await loadEnvironment({ cwd, env: {}, loadDotenv }).catch(
      (cause: unknown) => cause,
    );

    expect(error).toMatchObject({ code: 'ENV_FILE_INVALID', exitCode: 2 });
    expect(String(error)).not.toContain('SECRET=value');
    expect(error).toMatchObject({ fileGuidance: undefined });
  });

  it('does not override variables provided by the parent process', async () => {
    const cwd = await tempDirectory();
    await writeFile(join(cwd, '.env'), 'AI_PROVIDER=deepseek\n');
    const env = { AI_PROVIDER: 'openai' };

    await loadEnvironment({ cwd, env });

    expect(env.AI_PROVIDER).toBe('openai');
  });
});
