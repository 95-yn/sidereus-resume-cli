import type { AppError } from '../errors.js';
import { suggestFiles } from './file-suggestions.js';

type SuggestFiles = typeof suggestFiles;

export interface RenderAppErrorOptions {
  cwd: string;
  args: string[];
  suggestFiles?: SuggestFiles;
}

const SAFE_SHELL_ARGUMENT = /^[A-Za-z0-9_./:@%+=,-]+$/;
const PDF_COMMANDS = new Set(['parse', 'extract', 'score']);
const PDF_VALUE_OPTIONS = new Set(['-o', '--output', '--jd', '--env-file']);
const PDF_BOOLEAN_OPTIONS = new Set(['--mock', '--no-progress', '-v', '--verbose']);
const ROOT_BOOLEAN_OPTIONS = new Set(['--no-progress', '-v', '--verbose']);

interface RetryTarget {
  index: number;
  value: string;
  prefix?: string;
}

function quoteShellArgument(argument: string): string {
  if (SAFE_SHELL_ARGUMENT.test(argument)) return argument;
  return `'${argument.replaceAll("'", "'\\''")}'`;
}

function isUnsafeTerminalCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0)!;
  return (
    codePoint <= 0x1f ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    codePoint === 0x61c ||
    (codePoint >= 0x200e && codePoint <= 0x200f) ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2066 && codePoint <= 0x2069)
  );
}

export function terminalSafeDisplay(value: string): string {
  return Array.from(value)
    .map((character) => {
      if (character === '\n') return '\\n';
      if (character === '\r') return '\\r';
      if (character === '\t') return '\\t';
      if (!isUnsafeTerminalCharacter(character)) return character;

      return `\\u${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;
    })
    .join('');
}

function pdfRetryTarget(args: string[]): RetryTarget | undefined {
  const commandIndex = pdfCommandIndex(args);
  if (commandIndex === undefined) return undefined;

  let afterSeparator = false;
  for (let index = commandIndex + 1; index < args.length; index += 1) {
    const argument = args[index]!;
    if (afterSeparator) return { index, value: argument };
    if (argument === '--') {
      afterSeparator = true;
      continue;
    }
    if (PDF_VALUE_OPTIONS.has(argument)) {
      index += 1;
      continue;
    }
    if (
      argument.startsWith('--output=') ||
      argument.startsWith('--jd=') ||
      argument.startsWith('--env-file=') ||
      (argument.startsWith('-o') && argument.length > 2)
    ) {
      continue;
    }
    if (PDF_BOOLEAN_OPTIONS.has(argument)) continue;
    if (argument.startsWith('-')) return undefined;

    return { index, value: argument };
  }

  return undefined;
}

function pdfCommandIndex(args: string[]): number | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (PDF_COMMANDS.has(argument)) return index;
    if (argument === '--env-file') {
      if (index + 1 >= args.length) return undefined;
      index += 1;
      continue;
    }
    if (argument.startsWith('--env-file=')) continue;
    if (ROOT_BOOLEAN_OPTIONS.has(argument)) continue;

    return undefined;
  }

  return undefined;
}

function lastFlagRetryTarget(args: string[], flag: '--jd' | '--env-file'): RetryTarget | undefined {
  let target: RetryTarget | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === '--') break;
    if (argument === flag && index + 1 < args.length) {
      target = { index: index + 1, value: args[index + 1]! };
      index += 1;
      continue;
    }
    const prefix = `${flag}=`;
    if (argument.startsWith(prefix)) {
      target = { index, value: argument.slice(prefix.length), prefix };
    }
  }

  return target;
}

function retryTarget(error: AppError, args: string[]): RetryTarget | undefined {
  const { fileGuidance } = error;
  if (fileGuidance === undefined) return undefined;

  if (fileGuidance.kind === 'pdf') return pdfRetryTarget(args);

  const flag = fileGuidance.kind === 'jd' ? '--jd' : '--env-file';
  return lastFlagRetryTarget(args, flag);
}

export async function renderAppError(
  error: AppError,
  options: RenderAppErrorOptions,
): Promise<string> {
  const { fileGuidance } = error;
  const message = terminalSafeDisplay(error.message);
  if (fileGuidance === undefined) return `错误：${message}`;

  const scan = options.suggestFiles ?? suggestFiles;
  let candidates: string[] = [];

  try {
    candidates = (await scan(fileGuidance.inputPath, fileGuidance.kind, { cwd: options.cwd })).slice(0, 3);
  } catch {
    // File suggestions are auxiliary guidance and must never mask the primary error.
  }

  const sections = [`错误：${message}`];

  if (candidates.length === 0) {
    sections.push('提示：请检查相对路径，或改用绝对路径。');
  } else {
    sections.push(
      `你可能想使用：\n${candidates
        .map((candidate, index) => `${index + 1}. ${terminalSafeDisplay(candidate)}`)
        .join('\n')}`,
    );

    const target = retryTarget(error, options.args);
    const retryArgs = target === undefined ? undefined : [...options.args];
    if (retryArgs !== undefined && target !== undefined) {
      retryArgs[target.index] = `${target.prefix ?? ''}${candidates[0]!}`;
    }
    const canRetry =
      target !== undefined &&
      target.value === fileGuidance.inputPath &&
      retryArgs !== undefined &&
      !retryArgs.some((argument) => Array.from(argument).some(isUnsafeTerminalCharacter));

    if (canRetry) {
      sections.push(`重试：${['resume-cli', ...retryArgs].map(quoteShellArgument).join(' ')}`);
    } else {
      sections.push('提示：请检查相对路径，或改用绝对路径。');
    }
  }

  sections.push(`当前目录：${terminalSafeDisplay(options.cwd)}`);
  return sections.join('\n\n');
}
