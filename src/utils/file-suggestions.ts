import { readdir, stat } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export type FileSuggestionKind = 'pdf' | 'jd' | 'env';

export interface SuggestFilesOptions {
  cwd?: string;
  maxDepth?: number;
  maxEntries?: number;
  limit?: number;
}

const EXCLUDED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'coverage', '.next', 'build']);

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function matchesKind(name: string, kind: FileSuggestionKind): boolean {
  const lowerName = name.toLowerCase();

  if (kind === 'pdf') return lowerName.endsWith('.pdf');
  if (kind === 'jd') {
    return lowerName.endsWith('.txt') || lowerName.endsWith('.md') || lowerName.endsWith('.markdown');
  }
  return /^\.env(?:\..+)?$/i.test(name);
}

function levenshtein(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    const leftCharacter = left[leftIndex - 1];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const replacementCost = leftCharacter === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex]! + 1,
        current[rightIndex - 1]! + 1,
        previous[rightIndex - 1]! + replacementCost,
      );
    }

    previous = current;
  }

  return previous[right.length]!;
}

async function suggestionRoot(inputPath: string, cwd: string): Promise<string> {
  const input = resolve(cwd, inputPath);

  try {
    if ((await stat(input)).isDirectory()) return input;
  } catch {
    // The input may not exist; its parent can still be useful to scan.
  }

  const parent = dirname(input);
  try {
    if ((await stat(parent)).isDirectory()) return parent;
  } catch {
    // A missing or inaccessible parent falls back to cwd.
  }

  return cwd;
}

function displayPath(path: string, cwd: string): string {
  const pathFromCwd = relative(cwd, path);
  const outsideCwd =
    pathFromCwd === '..' || pathFromCwd.startsWith(`..${sep}`) || isAbsolute(pathFromCwd);

  if (outsideCwd) return path;
  return `./${pathFromCwd.split(sep).join('/')}`;
}

export async function suggestFiles(
  inputPath: string,
  kind: FileSuggestionKind,
  options: SuggestFilesOptions = {},
): Promise<string[]> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const maxDepth = nonNegativeInteger(options.maxDepth, 2);
  const maxEntries = nonNegativeInteger(options.maxEntries, 500);
  const limit = nonNegativeInteger(options.limit, 3);
  if (limit === 0 || maxEntries === 0) return [];

  const root = await suggestionRoot(inputPath, cwd);
  const candidates: string[] = [];
  let inspectedEntries = 0;

  const scan = async (directory: string, depth: number): Promise<void> => {
    let entries: Dirent<string>[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (inspectedEntries >= maxEntries) return;
      inspectedEntries += 1;

      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || EXCLUDED_DIRECTORIES.has(entry.name)) continue;
        if (depth < maxDepth) await scan(path, depth + 1);
        continue;
      }

      if (!entry.isFile() || (kind !== 'env' && entry.name.startsWith('.'))) continue;
      if (matchesKind(entry.name, kind)) candidates.push(path);
    }
  };

  await scan(root, 0);

  const target = basename(inputPath).toLowerCase();
  candidates.sort((left, right) => {
    const distanceDifference =
      levenshtein(basename(left).toLowerCase(), target) -
      levenshtein(basename(right).toLowerCase(), target);
    if (distanceDifference !== 0) return distanceDifference;

    const depthDifference = left.split(sep).length - right.split(sep).length;
    if (depthDifference !== 0) return depthDifference;

    return left.localeCompare(right);
  });

  return candidates.slice(0, limit).map((path) => displayPath(path, cwd));
}
