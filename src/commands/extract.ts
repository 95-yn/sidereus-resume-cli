import { candidateSchema } from '../schemas/candidate.js';
import type {
  CommonCommandOptions,
  ExtractCandidate,
  MockExtract,
  ReadPdf,
  WriteResult,
} from '../types.js';

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
  const text = await dependencies.readPdf(pdfPath);
  const rawResult = options.mock
    ? dependencies.mockExtract(text)
    : await dependencies.extractCandidate(text);
  const result = candidateSchema.parse(rawResult);
  await dependencies.writeResult(JSON.stringify(result, null, 2), {
    ...(options.output ? { outputPath: options.output } : {}),
    ...(options.stdout ? { stdout: options.stdout } : {}),
    ...(options.stderr ? { stderr: options.stderr } : {}),
  });
}
