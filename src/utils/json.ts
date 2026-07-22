import { AppError } from '../errors.js';

export function parseModelJson(input: string): unknown {
  const normalized = input
    .replace(/^\uFEFF/, '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = normalized.indexOf('{');
  const end = normalized.lastIndexOf('}');

  if (start < 0 || end < start) {
    throw invalidJsonError();
  }

  const candidate = normalized.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(candidate) as unknown;
  } catch (cause) {
    throw invalidJsonError(cause);
  }
}

function invalidJsonError(cause?: unknown): AppError {
  return new AppError('AI 未返回有效的 JSON。', {
    code: 'INVALID_AI_JSON',
    cause,
  });
}
