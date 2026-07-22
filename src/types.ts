import type { Candidate } from './schemas/candidate.js';
import type { ScoreResult } from './schemas/score.js';
import type { OutputOptions } from './utils/output.js';

export interface CommandIo {
  stdout?: OutputOptions['stdout'];
  stderr?: OutputOptions['stderr'];
}

export interface CommonCommandOptions extends CommandIo {
  output?: string;
}

export type ReadPdf = (path: string) => Promise<string>;
export type ReadJd = (path: string) => Promise<string>;
export type ExtractCandidate = (resumeText: string) => Promise<Candidate>;
export type ScoreResume = (resumeText: string, jdText: string) => Promise<ScoreResult>;
export type MockExtract = (resumeText: string) => Candidate;
export type MockScore = (resumeText: string, jdText: string) => ScoreResult;
export type WriteResult = (content: string, options?: OutputOptions) => Promise<void>;
