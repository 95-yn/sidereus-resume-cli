import { scoreSchema } from '../schemas/score.js';
import type {
  CommonCommandOptions,
  MockScore,
  ReadJd,
  ReadPdf,
  ScoreResume,
  WriteResult,
} from '../types.js';

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
  const [resumeText, jdText] = await Promise.all([
    dependencies.readPdf(pdfPath),
    dependencies.readJd(options.jd),
  ]);
  const rawResult = options.mock
    ? dependencies.mockScore(resumeText, jdText)
    : await dependencies.scoreResume(resumeText, jdText);
  const result = scoreSchema.parse(rawResult);
  await dependencies.writeResult(JSON.stringify(result, null, 2), {
    ...(options.output ? { outputPath: options.output } : {}),
    ...(options.stdout ? { stdout: options.stdout } : {}),
    ...(options.stderr ? { stderr: options.stderr } : {}),
  });
}
