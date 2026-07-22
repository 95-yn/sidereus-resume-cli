import type { FileSuggestionKind } from './utils/file-suggestions.js';

export interface FileGuidance {
  kind: FileSuggestionKind;
  inputPath: string;
}

export interface AppErrorOptions {
  code: string;
  exitCode?: 1 | 2;
  cause?: unknown;
  fileGuidance?: FileGuidance;
}

export class AppError extends Error {
  readonly code: string;
  readonly exitCode: 1 | 2;
  readonly fileGuidance?: FileGuidance;

  constructor(message: string, options: AppErrorOptions) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = options.code;
    this.exitCode = options.exitCode ?? 1;
    if (options.fileGuidance !== undefined) {
      this.fileGuidance = options.fileGuidance;
    }
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError('发生未预期错误，请使用 --verbose 查看原因。', {
    code: 'UNEXPECTED_ERROR',
    cause: error,
  });
}
