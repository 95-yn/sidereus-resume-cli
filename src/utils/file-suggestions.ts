import { opendir, stat } from 'node:fs/promises';
import type { Dir, Dirent } from 'node:fs';
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

async function readBoundedEntries(directory: string, limit: number): Promise<Dirent<string>[]> {
  const entries: Dirent<string>[] = [];
  let handle: Dir | undefined;

  try {
    handle = await opendir(directory);
    while (entries.length < limit) {
      const entry = await handle.read();
      if (entry === null) break;
      entries.push(entry);
    }
  } catch {
    // Permission and race errors leave any entries already read available to the caller.
  } finally {
    if (handle !== undefined) {
      try {
        await handle.close();
      } catch {
        // The handle may already be closed or invalidated by a filesystem race.
      }
    }
  }

  return entries;
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
  const directories = [{ path: root, depth: 0 }];

  for (let directoryIndex = 0; directoryIndex < directories.length; directoryIndex += 1) {
    if (inspectedEntries >= maxEntries) break;

    const directory = directories[directoryIndex]!;
    const remainingEntries = maxEntries - inspectedEntries;
    const entries = await readBoundedEntries(directory.path, remainingEntries);
    inspectedEntries += entries.length;
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (!entry.isFile() || (kind !== 'env' && entry.name.startsWith('.'))) continue;
      if (matchesKind(entry.name, kind)) candidates.push(resolve(directory.path, entry.name));
    }

    if (directory.depth >= maxDepth) continue;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      directories.push({ path: resolve(directory.path, entry.name), depth: directory.depth + 1 });
    }
  }

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
