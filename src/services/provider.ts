import type { ZodType } from 'zod';
import { AppError } from '../errors.js';

export type AiProvider = 'deepseek' | 'openai';
export type ProviderEnv = NodeJS.ProcessEnv | Record<string, string | undefined>;

export interface StructuredRequest<T> {
  schema: ZodType<T>;
  schemaName: string;
  systemPrompt: string;
  userPrompt: string;
  jsonExample: string;
}

export interface StructuredRequester {
  request<T>(request: StructuredRequest<T>): Promise<T>;
}

export function resolveProvider(env: ProviderEnv): AiProvider {
  const value = (env.AI_PROVIDER ?? 'deepseek').trim().toLowerCase();
  if (value === 'deepseek' || value === 'openai') {
    return value;
  }

  throw new AppError(
    `不支持的 AI_PROVIDER：${env.AI_PROVIDER}。可选值为 deepseek 或 openai。`,
    {
      code: 'UNSUPPORTED_AI_PROVIDER',
      exitCode: 2,
    },
  );
}
