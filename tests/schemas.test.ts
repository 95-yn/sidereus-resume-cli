import { describe, expect, it } from 'vitest';
import { candidateSchema } from '../src/schemas/candidate.js';
import { scoreSchema } from '../src/schemas/score.js';

const candidate = {
  name: 'Ada Lovelace',
  phone: '13800138000',
  email: 'ada@example.com',
  city: 'London',
  education: [
    {
      school: 'University of London',
      major: 'Mathematics',
      degree: 'Bachelor',
      graduation_time: '1835',
    },
  ],
  skills: ['TypeScript'],
};

const score = {
  overall_score: 82,
  skill_score: 88,
  experience_score: 80,
  education_score: 75,
  comment: '候选人与岗位较匹配。',
  interview_questions: ['请介绍你的项目经验。'],
};

describe('candidateSchema', () => {
  it('accepts the required structure', () => {
    expect(candidateSchema.parse(candidate)).toEqual(candidate);
  });

  it('rejects incomplete education entries', () => {
    const invalid = structuredClone(candidate);
    Reflect.deleteProperty(invalid.education[0]!, 'degree');
    expect(candidateSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('scoreSchema', () => {
  it.each([0, 100])('accepts boundary score %i', (value) => {
    expect(scoreSchema.safeParse({ ...score, overall_score: value }).success).toBe(true);
  });

  it.each([101, -1, 82.5])('rejects invalid score %s', (value) => {
    expect(scoreSchema.safeParse({ ...score, overall_score: value }).success).toBe(false);
  });

  it('rejects empty explanations and questions', () => {
    expect(scoreSchema.safeParse({ ...score, comment: '' }).success).toBe(false);
    expect(scoreSchema.safeParse({ ...score, interview_questions: [] }).success).toBe(false);
  });
});
