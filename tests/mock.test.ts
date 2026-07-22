import { describe, expect, it } from 'vitest';
import { mockExtract, mockScore } from '../src/services/mock.js';
import { candidateSchema } from '../src/schemas/candidate.js';
import { scoreSchema } from '../src/schemas/score.js';

const resume = `
Ada Lovelace
ada@example.com | +86 138-0013-8000 | 北京
5 years experience with TypeScript, Node.js, React and PostgreSQL.
Bachelor of Mathematics, 2020
`;

describe('mockExtract', () => {
  it('extracts deterministic contact details and known skills', () => {
    const first = mockExtract(resume);
    const second = mockExtract(resume);

    expect(first).toEqual(second);
    expect(first.email).toBe('ada@example.com');
    expect(first.phone).toContain('138');
    expect(first.city).toBe('北京');
    expect(first.skills).toEqual(expect.arrayContaining(['TypeScript', 'Node.js', 'React', 'PostgreSQL']));
    expect(candidateSchema.safeParse(first).success).toBe(true);
  });
});

describe('mockScore', () => {
  it('returns stable, valid scores and interview questions', () => {
    const jd = 'We need TypeScript, Node.js, React and Docker experience.';
    const first = mockScore(resume, jd);

    expect(first).toEqual(mockScore(resume, jd));
    expect(scoreSchema.safeParse(first).success).toBe(true);
    expect(first.comment).toContain('Mock');
    expect(first.interview_questions.length).toBeGreaterThanOrEqual(2);
  });
});
