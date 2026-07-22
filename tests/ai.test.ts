import { describe, expect, it, vi } from 'vitest';
import { extractCandidate, scoreResume, type AiClient } from '../src/services/ai.js';

const validCandidate = {
  name: 'Ada',
  phone: '',
  email: 'ada@example.com',
  city: '',
  education: [],
  skills: ['TypeScript'],
};

const validScore = {
  overall_score: 80,
  skill_score: 85,
  experience_score: 78,
  education_score: 70,
  comment: '匹配度较好。',
  interview_questions: ['请介绍 TypeScript 项目。'],
};

function clientReturning(output: unknown): AiClient {
  return {
    responses: {
      parse: vi.fn().mockResolvedValue({ output_parsed: output }),
    },
  };
}

describe('OpenAI adapter', () => {
  it('fails before constructing a client when API key is absent', async () => {
    const createClient = vi.fn();
    await expect(
      extractCandidate('resume', { env: {}, createClient }),
    ).rejects.toMatchObject({ code: 'MISSING_API_KEY', exitCode: 2 });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('returns locally validated structured candidate data', async () => {
    const client = clientReturning(validCandidate);
    await expect(
      extractCandidate('resume', {
        env: { OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'test-model' },
        createClient: () => client,
      }),
    ).resolves.toEqual(validCandidate);
    expect(client.responses.parse).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'test-model' }),
    );
  });

  it('rejects malformed structured data', async () => {
    const client = clientReturning({ ...validCandidate, skills: 'TypeScript' });
    await expect(
      extractCandidate('resume', {
        env: { OPENAI_API_KEY: 'test-key' },
        createClient: () => client,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_AI_RESPONSE' });
  });

  it('maps provider failures without leaking API keys', async () => {
    const client: AiClient = {
      responses: { parse: vi.fn().mockRejectedValue(new Error('test-key invalid')) },
    };
    const error = await scoreResume('resume', 'jd', {
      env: { OPENAI_API_KEY: 'test-key' },
      createClient: () => client,
    }).catch((cause: unknown) => cause);

    expect(error).toMatchObject({ code: 'AI_REQUEST_FAILED' });
    expect(String(error)).not.toContain('test-key');
  });

  it('validates a structured score response', async () => {
    const client = clientReturning(validScore);
    await expect(
      scoreResume('resume', 'jd', {
        env: { OPENAI_API_KEY: 'test-key' },
        createClient: () => client,
      }),
    ).resolves.toEqual(validScore);
  });
});
