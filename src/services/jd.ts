import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AppError } from '../errors.js';

export async function readJd(inputPath: string): Promise<string> {
  const path = resolve(inputPath);
  let fileStat;

  try {
    fileStat = await stat(path);
  } catch (cause) {
    throw new AppError(`JD 文件不存在：${inputPath}`, {
      code: 'JD_NOT_FOUND',
      exitCode: 2,
      cause,
      fileGuidance: { kind: 'jd', inputPath },
    });
  }

  if (!fileStat.isFile()) {
    throw new AppError(`JD 路径不是文件：${inputPath}`, {
      code: 'JD_NOT_FILE',
      exitCode: 2,
      fileGuidance: { kind: 'jd', inputPath },
    });
  }

  const content = (await readFile(path, 'utf8')).trim();
  if (!content) {
    throw new AppError(`JD 文件为空：${inputPath}`, {
      code: 'JD_EMPTY',
      exitCode: 2,
    });
  }

  return content;
}
