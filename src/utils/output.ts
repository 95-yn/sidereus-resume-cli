import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export interface OutputOptions {
  outputPath?: string;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
}

export async function writeResult(content: string, options: OutputOptions = {}): Promise<void> {
  const stdout = options.stdout ?? console.log;
  const stderr = options.stderr ?? console.error;

  if (!options.outputPath) {
    stdout(content);
    return;
  }

  const outputPath = resolve(options.outputPath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, 'utf8');
  stderr(`结果已保存至：${outputPath}`);
}
