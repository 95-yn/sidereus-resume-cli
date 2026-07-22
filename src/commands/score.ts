import { scoreSchema } from '../schemas/score.js';
import type {
  CommonCommandOptions,
  MockScore,
  ReadJd,
  ReadPdf,
  ScoreResume,
  WriteResult,
} from '../types.js';
import { silentProgress } from '../utils/progress.js';

export interface ScoreOptions extends CommonCommandOptions {
  jd: string;
  mock?: boolean;
}

export interface ScoreDependencies {
  readPdf: ReadPdf;
  readJd: ReadJd;
  scoreResume: ScoreResume;
  mockScore: MockScore;
  writeResult: WriteResult;
}

export async function runScore(
  pdfPath: string,
  options: ScoreOptions,
  dependencies: ScoreDependencies,
): Promise<void> {
  const progress = options.progress ?? silentProgress;
  let stopped = false;
  const stopProgress = () => {
    if (stopped) return;
    stopped = true;
    progress.stop();
  };
  progress.start('正在读取简历与 JD…');

  try {
    const [resumeText, jdText] = await Promise.all([
      dependencies.readPdf(pdfPath),
      dependencies.readJd(options.jd),
    ]);
    progress.update('正在分析匹配度…');
    const rawResult = options.mock
      ? dependencies.mockScore(resumeText, jdText)
      : await dependencies.scoreResume(resumeText, jdText);
    const result = scoreSchema.parse(rawResult);
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
