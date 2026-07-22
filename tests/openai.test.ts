import { describe, expect, it, vi } from 'vitest';
import { candidateSchema, type Candidate } from '../src/schemas/candidate.js';
import {
  createOpenAIRequester,
  type OpenAIResponsesClient,
} from '../src/services/openai.js';
import type { StructuredRequest } from '../src/services/provider.js';

const candidate: Candidate = {
  name: 'Ada',
  phone: '',
  email: 'ada@example.com',
  city: '',
  education: [],
  skills: ['TypeScript'],
};

const request: StructuredRequest<Candidate> = {
  schema: candidateSchema,
  schemaName: 'candidate',
  systemPrompt: 'Extract candidate data.',
  userPrompt: 'Resume text',
  jsonExample: JSON.stringify(candidate),
};

function clientReturning(output: unknown): OpenAIResponsesClient {
  return {
    responses: {
      parse: vi.fn().mockResolvedValue({ output_parsed: output }),
    },
  };
}

describe('OpenAI requester', () => {
  it('requires an OpenAI key before constructing the client', async () => {
    const createClient = vi.fn();
    const requester = createOpenAIRequester({ env: {}, createClient });
    await expect(requester.request(request)).rejects.toMatchObject({
      code: 'MISSING_API_KEY',
      exitCode: 2,
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('uses Responses Structured Outputs and the default model', async () => {
    const client = clientReturning(candidate);
    const requester = createOpenAIRequester({
      env: { OPENAI_API_KEY: 'openai-test-key' },
      createClient: () => client,
    });
    await expect(requester.request(request)).resolves.toEqual(candidate);
    expect(client.responses.parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.6',
        text: { format: expect.any(Object) },
      }),
    );
  });

  it('supports OPENAI_MODEL override', async () => {
    const client = clientReturning(candidate);
    const requester = createOpenAIRequester({
      env: { OPENAI_API_KEY: 'key', OPENAI_MODEL: 'custom-model' },
      createClient: () => client,
    });
    await requester.request(request);
    expect(client.responses.parse).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'custom-model' }),
    );
  });

  it('maps provider failures without exposing the key', async () => {
    const client: OpenAIResponsesClient = {
      responses: {
        parse: vi.fn().mockRejectedValue(new Error('openai-test-key rejected')),
      },
    };
    const requester = createOpenAIRequester({
      env: { OPENAI_API_KEY: 'openai-test-key' },
      createClient: () => client,
    });
    const error = await requester.request(request).catch((cause: unknown) => cause);
    expect(error).toMatchObject({ code: 'AI_REQUEST_FAILED' });
    expect(String(error)).not.toContain('openai-test-key');
  });

  it('rejects malformed structured data', async () => {
    const requester = createOpenAIRequester({
      env: { OPENAI_API_KEY: 'key' },
      createClient: () => clientReturning({ ...candidate, skills: 'TypeScript' }),
    });
    await expect(requester.request(request)).rejects.toMatchObject({
      code: 'INVALID_AI_RESPONSE',
    });
  });
});
