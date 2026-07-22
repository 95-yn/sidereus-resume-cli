import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  config as dotenvConfig,
  type DotenvConfigOptions,
  type DotenvConfigOutput,
} from 'dotenv';
import { AppError } from '../errors.js';
import type { ProviderEnv } from './provider.js';

type DotenvLoader = (options: DotenvConfigOptions) => DotenvConfigOutput;

export interface LoadEnvironmentOptions {
  cwd?: string;
  env?: ProviderEnv;
  envFile?: string;
  loadDotenv?: DotenvLoader;
}

export async function loadEnvironment(
  options: LoadEnvironmentOptions = {},
): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const inputPath = options.envFile;
  const explicit = inputPath !== undefined;
  const path = resolve(cwd, inputPath ?? '.env');
  let fileStat;

  try {
    fileStat = await stat(path);
  } catch (cause) {
    if (!explicit && isMissingFile(cause)) {
      return;
    }
    throw new AppError(`环境配置文件不存在或无法读取：${path}`, {
      code: 'ENV_FILE_NOT_FOUND',
      exitCode: 2,
      cause,
      ...(inputPath === undefined
        ? {}
        : { fileGuidance: { kind: 'env' as const, inputPath } }),
    });
  }

  if (!fileStat.isFile()) {
    throw new AppError(`环境配置路径不是文件：${path}`, {
      code: 'ENV_FILE_NOT_FILE',
      exitCode: 2,
      ...(inputPath === undefined
        ? {}
        : { fileGuidance: { kind: 'env' as const, inputPath } }),
    });
  }

  const result = (options.loadDotenv ?? dotenvConfig)({
    path,
    processEnv: env,
    override: false,
    quiet: true,
  });
  if (result.error) {
    throw new AppError(`环境配置文件无法解析：${path}`, {
      code: 'ENV_FILE_INVALID',
      exitCode: 2,
      cause: result.error,
    });
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
