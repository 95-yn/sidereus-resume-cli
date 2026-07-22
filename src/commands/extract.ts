import { candidateSchema } from '../schemas/candidate.js';
import type {
  CommonCommandOptions,
  ExtractCandidate,
  MockExtract,
  ReadPdf,
  WriteResult,
} from '../types.js';
import { silentProgress } from '../utils/progress.js';

export interface ExtractOptions extends CommonCommandOptions {
  mock?: boolean;
}

export interface ExtractDependencies {
  readPdf: ReadPdf;
  extractCandidate: ExtractCandidate;
  mockExtract: MockExtract;
  writeResult: WriteResult;
}

export async function runExtract(
  pdfPath: string,
  options: ExtractOptions,
  dependencies: ExtractDependencies,
): Promise<void> {
  const progress = options.progress ?? silentProgress;
  let stopped = false;
  const stopProgress = () => {
    if (stopped) return;
    stopped = true;
    progress.stop();
  };
  progress.start('正在解析 PDF…');

  try {
    const text = await dependencies.readPdf(pdfPath);
    progress.update('正在提取结构化信息…');
    const rawResult = options.mock
      ? dependencies.mockExtract(text)
      : await dependencies.extractCandidate(text);
    const result = candidateSchema.parse(rawResult);
    stopProgress();
    await dependencies.writeResult(JSON.stringify(result, null, 2), {
      ...(options.output ? { outputPath: options.output } : {}),
      ...(options.stdout ? { stdout: options.stdout } : {}),
      ...(options.stderr ? { stderr: options.stderr } : {}),
    });
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
