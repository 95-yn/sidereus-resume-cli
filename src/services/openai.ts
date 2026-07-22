import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { AppError } from '../errors.js';
import type {
  ProviderEnv,
  StructuredRequester,
} from './provider.js';

export interface OpenAIParseParams {
  model: string;
  input: Array<{ role: 'system' | 'user'; content: string }>;
  text: { format: ReturnType<typeof zodTextFormat> };
}

export interface OpenAIResponsesClient {
  responses: {
    parse(params: OpenAIParseParams): Promise<{ output_parsed: unknown }>;
  };
}

export interface OpenAIRequesterOptions {
  env?: ProviderEnv;
  createClient?: (apiKey: string) => OpenAIResponsesClient;
}

export function createOpenAIRequester(
  options: OpenAIRequesterOptions = {},
): StructuredRequester {
  const env = options.env ?? process.env;

  return {
    async request(request) {
      const apiKey = env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new AppError(
          '缺少 OPENAI_API_KEY；请配置环境变量、切换 AI_PROVIDER=deepseek 或使用 --mock。',
          {
            code: 'MISSING_API_KEY',
            exitCode: 2,
          },
        );
      }

      const client = (options.createClient ?? createSdkClient)(apiKey);
      let output: unknown;
      try {
        const response = await client.responses.parse({
          model: env.OPENAI_MODEL ?? 'gpt-5.6',
          input: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userPrompt },
          ],
          text: { format: zodTextFormat(request.schema, request.schemaName) },
        });
        output = response.output_parsed;
      } catch (cause) {
        throw new AppError('OpenAI 请求失败，请检查网络、API Key、模型权限或额度。', {
          code: 'AI_REQUEST_FAILED',
          cause,
        });
      }

      try {
        return request.schema.parse(output);
      } catch (cause) {
        throw new AppError('OpenAI 返回的数据结构无效。', {
          code: 'INVALID_AI_RESPONSE',
          cause,
        });
      }
    },
  };
}

function createSdkClient(apiKey: string): OpenAIResponsesClient {
  const client = new OpenAI({ apiKey });
  return {
    responses: {
      async parse(params) {
        return client.responses.parse(params);
      },
    },
  };
}
