import OpenAI from 'openai';
import { AppError } from '../errors.js';
import { parseModelJson } from '../utils/json.js';
import type {
  ProviderEnv,
  StructuredRequester,
} from './provider.js';

export interface DeepSeekChatParams {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  response_format: { type: 'json_object' };
  max_tokens: number;
  stream: false;
}

export interface DeepSeekClient {
  chat: {
    completions: {
      create(params: DeepSeekChatParams): Promise<{
        choices: Array<{ message: { content: string | null } }>;
      }>;
    };
  };
}

interface DeepSeekClientOptions {
  apiKey: string;
  baseURL: string;
}

export interface DeepSeekRequesterOptions {
  env?: ProviderEnv;
  createClient?: (options: DeepSeekClientOptions) => DeepSeekClient;
}

export function createDeepSeekRequester(
  options: DeepSeekRequesterOptions = {},
): StructuredRequester {
  const env = options.env ?? process.env;

  return {
    async request(request) {
      const apiKey = env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        throw new AppError(
          '缺少 DEEPSEEK_API_KEY；请配置环境变量、切换 AI_PROVIDER=openai 或使用 --mock。',
          {
            code: 'MISSING_API_KEY',
            exitCode: 2,
          },
        );
      }

      const client = (options.createClient ?? createSdkClient)({
        apiKey,
        baseURL: 'https://api.deepseek.com',
      });

      let content: string | null | undefined;
      try {
        const response = await client.chat.completions.create({
          model: env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash',
          messages: [
            {
              role: 'system',
              content: `${request.systemPrompt}\n只输出合法 JSON，不要输出 Markdown。JSON 结构示例：\n${request.jsonExample}`,
            },
            { role: 'user', content: request.userPrompt },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 4096,
          stream: false,
        });
        content = response.choices[0]?.message.content;
      } catch (cause) {
        throw new AppError('DeepSeek 请求失败，请检查网络、API Key、模型权限或额度。', {
          code: 'AI_REQUEST_FAILED',
          cause,
        });
      }

      if (!content?.trim()) {
        throw new AppError('DeepSeek 返回了空内容，请重试或调整输入。', {
          code: 'EMPTY_AI_RESPONSE',
        });
      }

      const parsed = parseModelJson(content);
      try {
        return request.schema.parse(parsed);
      } catch (cause) {
        throw new AppError('DeepSeek 返回的数据结构无效。', {
          code: 'INVALID_AI_RESPONSE',
          cause,
        });
      }
    },
  };
}

function createSdkClient(options: DeepSeekClientOptions): DeepSeekClient {
  const client = new OpenAI(options);
  return {
    chat: {
      completions: {
        async create(params) {
          const response = await client.chat.completions.create(params);
          return {
            choices: response.choices.map((choice) => ({
              message: { content: choice.message.content },
            })),
          };
        },
      },
    },
  };
}
