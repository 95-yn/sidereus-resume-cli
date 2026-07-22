import type { CommonCommandOptions, ReadPdf, WriteResult } from '../types.js';

export interface ParseDependencies {
  readPdf: ReadPdf;
  writeResult: WriteResult;
}

export async function runParse(
  pdfPath: string,
  options: CommonCommandOptions,
  dependencies: ParseDependencies,
): Promise<void> {
  const text = await dependencies.readPdf(pdfPath);
  await dependencies.writeResult(text, outputOptions(options));
}

function outputOptions(options: CommonCommandOptions) {
  return {
    ...(options.output ? { outputPath: options.output } : {}),
    ...(options.stdout ? { stdout: options.stdout } : {}),
    ...(options.stderr ? { stderr: options.stderr } : {}),
  };
}
