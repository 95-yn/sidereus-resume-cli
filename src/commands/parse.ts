import type { CommonCommandOptions, ReadPdf, WriteResult } from '../types.js';
import { silentProgress } from '../utils/progress.js';

export interface ParseDependencies {
  readPdf: ReadPdf;
  writeResult: WriteResult;
}

export async function runParse(
  pdfPath: string,
  options: CommonCommandOptions,
  dependencies: ParseDependencies,
): Promise<void> {
  const progress = options.progress ?? silentProgress;
  let stopped = false;
  const stopProgress = () => {
    if (stopped) return;
    stopped = true;
    progress.stop();
  };
  progress.start('正在读取并解析 PDF…');

  try {
    const text = await dependencies.readPdf(pdfPath);
    stopProgress();
    await dependencies.writeResult(text, outputOptions(options));
    progress.succeed('完成');
  } catch (error) {
    try {
      stopProgress();
    } catch {
      // Progress cleanup must not replace the command failure.
    }
    throw error;
  }
}

function outputOptions(options: CommonCommandOptions) {
  return {
    ...(options.output ? { outputPath: options.output } : {}),
    ...(options.stdout ? { stdout: options.stdout } : {}),
    ...(options.stderr ? { stderr: options.stderr } : {}),
  };
}
