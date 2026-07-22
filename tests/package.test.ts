import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

interface PackageManifest {
  name?: string;
  bin?: Record<string, string>;
  files?: string[];
  license?: string;
  keywords?: string[];
  publishConfig?: Record<string, string>;
  scripts?: Record<string, string>;
}

async function readManifest(): Promise<PackageManifest> {
  return JSON.parse(await readFile('package.json', 'utf8')) as PackageManifest;
}

describe('package distribution contract', () => {
  it('publishes the expected command and files', async () => {
    const manifest = await readManifest();

    expect(manifest.name).toBe('sidereus-resume-cli');
    expect(manifest.bin).toEqual({ 'resume-cli': 'dist/cli.js' });
    expect(manifest.files).toEqual(
      expect.arrayContaining(['dist', 'README.md', 'LICENSE']),
    );
    expect(manifest.license).toBe('MIT');
    expect(manifest.publishConfig).toEqual({ access: 'public' });
  });

  it('builds Git installs and gates packed artifacts', async () => {
    const manifest = await readManifest();

    expect(manifest.scripts?.prepare).toBe('npm run build');
    expect(manifest.scripts?.prepack).toBe('npm run check');
    expect(manifest.scripts?.postinstall).toBeUndefined();
  });

  it('includes discoverable CLI keywords', async () => {
    const manifest = await readManifest();

    expect(manifest.keywords).toEqual(
      expect.arrayContaining(['resume', 'cli', 'deepseek', 'openai']),
    );
  });
});
