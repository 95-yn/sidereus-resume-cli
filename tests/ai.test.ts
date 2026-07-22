import { describe, expect, it, vi } from 'vitest';
import type { Candidate } from '../src/schemas/candidate.js';
import type { ScoreResult } from '../src/schemas/score.js';
import { extractCandidate, scoreResume } from '../src/services/ai.js';
import type { StructuredRequester } from '../src/services/provider.js';

const candidate: Candidate = {
  name: 'Ada',
  phone: '',
  email: 'ada@example.com',
  city: '',
  education: [],
  skills: ['TypeScript'],
};

const score: ScoreResult = {
  overall_score: 80,
  skill_score: 85,
  experience_score: 78,
  education_score: 70,
  comment: '匹配度较好。',
  interview_questions: ['请介绍 TypeScript 项目。'],
};

function requesterReturning(output: unknown): StructuredRequester {
  return {
    request: vi.fn().mockResolvedValue(output),
  };
}

describe('AI provider facade', () => {
  it('routes extraction to DeepSeek by default', async () => {
    const deepseekRequester = requesterReturning(candidate);
    const openaiRequester = requesterReturning(candidate);

    await expect(
      extractCandidate('resume text', { deepseekRequester, openaiRequester, env: {} }),
    ).resolves.toEqual(candidate);

    expect(deepseekRequester.request).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaName: 'candidate',
        systemPrompt: expect.stringContaining('不可信数据'),
        userPrompt: expect.stringContaining('resume text'),
        jsonExample: expect.stringContaining('"skills"'),
      }),
    );
    expect(openaiRequester.request).not.toHaveBeenCalled();
  });

  it('routes extraction to OpenAI when explicitly selected', async () => {
    const deepseekRequester = requesterReturning(candidate);
    const openaiRequester = requesterReturning(candidate);

    await expect(
      extractCandidate('resume text', {
        deepseekRequester,
        openaiRequester,
        env: { AI_PROVIDER: 'openai' },
      }),
    ).resolves.toEqual(candidate);

    expect(openaiRequester.request).toHaveBeenCalledOnce();
    expect(deepseekRequester.request).not.toHaveBeenCalled();
  });

  it('routes scoring with resume and JD through the selected provider', async () => {
    const deepseekRequester = requesterReturning(score);
    await expect(
      scoreResume('resume text', 'jd text', { deepseekRequester, env: {} }),
    ).resolves.toEqual(score);

    expect(deepseekRequester.request).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaName: 'resume_score',
        userPrompt: expect.stringMatching(/resume text[\s\S]*jd text/),
        jsonExample: expect.stringContaining('"overall_score"'),
      }),
    );
  });

  it('rejects unknown providers before either requester is called', async () => {
    const deepseekRequester = requesterReturning(candidate);
    const openaiRequester = requesterReturning(candidate);

    await expect(
      extractCandidate('resume text', {
        deepseekRequester,
        openaiRequester,
        env: { AI_PROVIDER: 'unsupported' },
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_AI_PROVIDER', exitCode: 2 });

    expect(deepseekRequester.request).not.toHaveBeenCalled();
    expect(openaiRequester.request).not.toHaveBeenCalled();
  });
});
