import { describe, expect, it, vi } from 'vitest';
import { candidateSchema, type Candidate } from '../src/schemas/candidate.js';
import {
  createDeepSeekRequester,
  type DeepSeekClient,
} from '../src/services/deepseek.js';
import type { StructuredRequest } from '../src/services/provider.js';

const candidate: Candidate = {
  name: 'Ada',
  phone: '',
  email: 'ada@example.com',
  city: '',
  education: [],
  skills: ['TypeScript'],
};

const request: StructuredRequest<typeof candidate> = {
  schema: candidateSchema,
  schemaName: 'candidate',
  systemPrompt: 'Extract candidate data.',
  userPrompt: 'Resume text',
  jsonExample: JSON.stringify(candidate),
};

function clientReturning(content: string | null): DeepSeekClient {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content } }],
        }),
      },
    },
  };
}

describe('DeepSeek requester', () => {
  it('requires a DeepSeek key before constructing the client', async () => {
    const createClient = vi.fn();
    const requester = createDeepSeekRequester({ env: {}, createClient });
    await expect(requester.request(request)).rejects.toMatchObject({
      code: 'MISSING_API_KEY',
      exitCode: 2,
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('uses the official endpoint, current default model and JSON Output', async () => {
    const client = clientReturning(JSON.stringify(candidate));
    const createClient = vi.fn().mockReturnValue(client);
    const requester = createDeepSeekRequester({
      env: { DEEPSEEK_API_KEY: 'deepseek-test-key' },
      createClient,
    });

    await expect(requester.request(request)).resolves.toEqual(candidate);
    expect(createClient).toHaveBeenCalledWith({
      apiKey: 'deepseek-test-key',
      baseURL: 'https://api.deepseek.com',
    });
    expect(client.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'deepseek-v4-flash',
        response_format: { type: 'json_object' },
        max_tokens: 4096,
        stream: false,
      }),
    );
    const params = vi.mocked(client.chat.completions.create).mock.calls[0]![0];
    expect(params.messages[0]!.content).toContain('JSON');
    expect(params.messages[0]!.content).toContain(request.jsonExample);
  });

  it('supports a model override and repairs common JSON wrappers', async () => {
    const client = clientReturning(`\n\`\`\`json\n${JSON.stringify(candidate).replace(/}$/, ',}')}\n\`\`\``);
    const requester = createDeepSeekRequester({
      env: {
        DEEPSEEK_API_KEY: 'key',
        DEEPSEEK_MODEL: 'deepseek-v4-pro',
      },
      createClient: () => client,
    });
    await expect(requester.request(request)).resolves.toEqual(candidate);
    expect(client.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'deepseek-v4-pro' }),
    );
  });

  it.each([null, '   '])('rejects empty response content', async (content) => {
    const requester = createDeepSeekRequester({
      env: { DEEPSEEK_API_KEY: 'key' },
      createClient: () => clientReturning(content),
    });
    await expect(requester.request(request)).rejects.toMatchObject({
      code: 'EMPTY_AI_RESPONSE',
    });
  });

  it('maps transport failures without exposing the key', async () => {
    const client: DeepSeekClient = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error('deepseek-test-key rejected')),
        },
      },
    };
    const requester = createDeepSeekRequester({
      env: { DEEPSEEK_API_KEY: 'deepseek-test-key' },
      createClient: () => client,
    });
    const error = await requester.request(request).catch((cause: unknown) => cause);
    expect(error).toMatchObject({ code: 'AI_REQUEST_FAILED' });
    expect(String(error)).not.toContain('deepseek-test-key');
  });

  it('rejects data that does not match the local schema', async () => {
    const requester = createDeepSeekRequester({
      env: { DEEPSEEK_API_KEY: 'key' },
      createClient: () => clientReturning('{"name":"Ada"}'),
    });
    await expect(requester.request(request)).rejects.toMatchObject({
      code: 'INVALID_AI_RESPONSE',
    });
  });
});
