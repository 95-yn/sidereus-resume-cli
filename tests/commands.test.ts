import { describe, expect, it, vi } from 'vitest';
import { runExtract } from '../src/commands/extract.js';
import { runParse } from '../src/commands/parse.js';
import { runScore } from '../src/commands/score.js';

const candidate = {
  name: 'Ada',
  phone: '',
  email: 'ada@example.com',
  city: '',
  education: [],
  skills: ['TypeScript'],
};

const score = {
  overall_score: 80,
  skill_score: 85,
  experience_score: 75,
  education_score: 70,
  comment: '匹配度较好。',
  interview_questions: ['请介绍相关项目。'],
};

describe('command use cases', () => {
  it('parse forwards extracted text and output path', async () => {
    const writeResult = vi.fn();
    await runParse('resume.pdf', { output: 'resume.txt' }, {
      readPdf: vi.fn().mockResolvedValue('resume text'),
      writeResult,
    });
    expect(writeResult).toHaveBeenCalledWith(
      'resume text',
      expect.objectContaining({ outputPath: 'resume.txt' }),
    );
  });

  it('extract selects mock only when requested', async () => {
    const extractCandidate = vi.fn().mockResolvedValue(candidate);
    const mockExtract = vi.fn().mockReturnValue(candidate);
    const writeResult = vi.fn();
    const dependencies = {
      readPdf: vi.fn().mockResolvedValue('resume text'),
      extractCandidate,
      mockExtract,
      writeResult,
    };

    await runExtract('resume.pdf', { mock: true }, dependencies);
    expect(mockExtract).toHaveBeenCalledWith('resume text');
    expect(extractCandidate).not.toHaveBeenCalled();
    expect(JSON.parse(writeResult.mock.calls[0]![0])).toEqual(candidate);
  });

  it('score passes both document texts to the AI adapter', async () => {
    const scoreResume = vi.fn().mockResolvedValue(score);
    const writeResult = vi.fn();
    await runScore('resume.pdf', { jd: 'jd.txt', mock: false }, {
      readPdf: vi.fn().mockResolvedValue('resume text'),
      readJd: vi.fn().mockResolvedValue('jd text'),
      scoreResume,
      mockScore: vi.fn(),
      writeResult,
    });
    expect(scoreResume).toHaveBeenCalledWith('resume text', 'jd text');
    expect(JSON.parse(writeResult.mock.calls[0]![0])).toEqual(score);
  });
});
