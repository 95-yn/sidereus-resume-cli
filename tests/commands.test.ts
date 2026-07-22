import { describe, expect, it, vi } from 'vitest';
import { runExtract } from '../src/commands/extract.js';
import { runParse } from '../src/commands/parse.js';
import { runScore } from '../src/commands/score.js';
import type { Progress } from '../src/utils/progress.js';

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

function progressSpy(events: string[]): Progress {
  return {
    start: vi.fn((text: string) => events.push(`start:${text}`)),
    update: vi.fn((text: string) => events.push(`update:${text}`)),
    stop: vi.fn(() => events.push('stop')),
    succeed: vi.fn((text: string) => events.push(`succeed:${text}`)),
  };
}

describe('command use cases', () => {
  it('parse forwards extracted text and output path', async () => {
    const events: string[] = [];
    const writeResult = vi.fn();
    writeResult.mockImplementation(async () => {
      events.push('write');
    });
    await runParse(
      'resume.pdf',
      { output: 'resume.txt', progress: progressSpy(events) },
      {
        readPdf: vi.fn().mockImplementation(async () => {
          events.push('read');
          return 'resume text';
        }),
        writeResult,
      },
    );
    expect(writeResult).toHaveBeenCalledWith(
      'resume text',
      expect.objectContaining({ outputPath: 'resume.txt' }),
    );
    expect(events).toEqual([
      'start:正在读取并解析 PDF…',
      'read',
      'stop',
      'write',
      'succeed:完成',
    ]);
  });

  it('extract selects mock only when requested', async () => {
    const events: string[] = [];
    const extractCandidate = vi.fn().mockResolvedValue(candidate);
    const mockExtract = vi.fn().mockImplementation(() => {
      events.push('mock');
      return candidate;
    });
    const writeResult = vi.fn().mockImplementation(async () => {
      events.push('write');
    });
    const dependencies = {
      readPdf: vi.fn().mockImplementation(async () => {
        events.push('read');
        return 'resume text';
      }),
      extractCandidate,
      mockExtract,
      writeResult,
    };

    await runExtract(
      'resume.pdf',
      { mock: true, progress: progressSpy(events) },
      dependencies,
    );
    expect(mockExtract).toHaveBeenCalledWith('resume text');
    expect(extractCandidate).not.toHaveBeenCalled();
    expect(JSON.parse(writeResult.mock.calls[0]![0])).toEqual(candidate);
    expect(events).toEqual([
      'start:正在解析 PDF…',
      'read',
      'update:正在提取结构化信息…',
      'mock',
      'stop',
      'write',
      'succeed:完成',
    ]);
  });

  it('score passes both document texts to the AI adapter', async () => {
    const events: string[] = [];
    const scoreResume = vi.fn().mockImplementation(async () => {
      events.push('ai');
      return score;
    });
    const writeResult = vi.fn().mockImplementation(async () => {
      events.push('write');
    });
    await runScore(
      'resume.pdf',
      { jd: 'jd.txt', mock: false, progress: progressSpy(events) },
      {
        readPdf: vi.fn().mockImplementation(async () => {
          events.push('read-pdf');
          return 'resume text';
        }),
        readJd: vi.fn().mockImplementation(async () => {
          events.push('read-jd');
          return 'jd text';
        }),
        scoreResume,
        mockScore: vi.fn(),
        writeResult,
      },
    );
    expect(scoreResume).toHaveBeenCalledWith('resume text', 'jd text');
    expect(JSON.parse(writeResult.mock.calls[0]![0])).toEqual(score);
    expect(events).toEqual([
      'start:正在读取简历与 JD…',
      'read-pdf',
      'read-jd',
      'update:正在分析匹配度…',
      'ai',
      'stop',
      'write',
      'succeed:完成',
    ]);
  });

  it.each([
    ['parse read', () => runParse('resume.pdf', { progress: failingProgress }, {
      readPdf: vi.fn().mockRejectedValue(failure),
      writeResult: vi.fn(),
    }), ['start:正在读取并解析 PDF…', 'stop'], true],
    ['parse write', () => runParse('resume.pdf', { progress: failingProgress }, {
      readPdf: vi.fn().mockResolvedValue('resume text'),
      writeResult: vi.fn().mockRejectedValue(failure),
    }), ['start:正在读取并解析 PDF…', 'stop'], true],
    ['extract read', () => runExtract('resume.pdf', { mock: false, progress: failingProgress }, {
      readPdf: vi.fn().mockRejectedValue(failure),
      extractCandidate: vi.fn(),
      mockExtract: vi.fn(),
      writeResult: vi.fn(),
    }), ['start:正在解析 PDF…', 'stop'], true],
    ['extract AI', () => runExtract('resume.pdf', { mock: false, progress: failingProgress }, {
      readPdf: vi.fn().mockResolvedValue('resume text'),
      extractCandidate: vi.fn().mockRejectedValue(failure),
      mockExtract: vi.fn(),
      writeResult: vi.fn(),
    }), ['start:正在解析 PDF…', 'update:正在提取结构化信息…', 'stop'], true],
    ['extract schema', () => runExtract('resume.pdf', { mock: true, progress: failingProgress }, {
      readPdf: vi.fn().mockResolvedValue('resume text'),
      extractCandidate: vi.fn(),
      mockExtract: vi.fn().mockReturnValue({}),
      writeResult: vi.fn(),
    }), ['start:正在解析 PDF…', 'update:正在提取结构化信息…', 'stop'], false],
    ['extract write', () => runExtract('resume.pdf', { mock: true, progress: failingProgress }, {
      readPdf: vi.fn().mockResolvedValue('resume text'),
      extractCandidate: vi.fn(),
      mockExtract: vi.fn().mockReturnValue(candidate),
      writeResult: vi.fn().mockRejectedValue(failure),
    }), ['start:正在解析 PDF…', 'update:正在提取结构化信息…', 'stop'], true],
    ['score read', () => runScore('resume.pdf', {
      jd: 'jd.txt', mock: false, progress: failingProgress,
    }, {
      readPdf: vi.fn().mockRejectedValue(failure),
      readJd: vi.fn().mockResolvedValue('jd text'),
      scoreResume: vi.fn(),
      mockScore: vi.fn(),
      writeResult: vi.fn(),
    }), ['start:正在读取简历与 JD…', 'stop'], true],
    ['score AI', () => runScore('resume.pdf', {
      jd: 'jd.txt', mock: false, progress: failingProgress,
    }, {
      readPdf: vi.fn().mockResolvedValue('resume text'),
      readJd: vi.fn().mockResolvedValue('jd text'),
      scoreResume: vi.fn().mockRejectedValue(failure),
      mockScore: vi.fn(),
      writeResult: vi.fn(),
    }), ['start:正在读取简历与 JD…', 'update:正在分析匹配度…', 'stop'], true],
    ['score schema', () => runScore('resume.pdf', {
      jd: 'jd.txt', mock: true, progress: failingProgress,
    }, {
      readPdf: vi.fn().mockResolvedValue('resume text'),
      readJd: vi.fn().mockResolvedValue('jd text'),
      scoreResume: vi.fn(),
      mockScore: vi.fn().mockReturnValue({}),
      writeResult: vi.fn(),
    }), ['start:正在读取简历与 JD…', 'update:正在分析匹配度…', 'stop'], false],
    ['score write', () => runScore('resume.pdf', {
      jd: 'jd.txt', mock: true, progress: failingProgress,
    }, {
      readPdf: vi.fn().mockResolvedValue('resume text'),
      readJd: vi.fn().mockResolvedValue('jd text'),
      scoreResume: vi.fn(),
      mockScore: vi.fn().mockReturnValue(score),
      writeResult: vi.fn().mockRejectedValue(failure),
    }), ['start:正在读取简历与 JD…', 'update:正在分析匹配度…', 'stop'], true],
  ] as const)(
    'stops progress without succeeding when %s fails',
    async (_name, run, expectedEvents, expectsKnownFailure) => {
      events = [];
      failingProgress = progressSpy(events);

      let rejected: unknown;
      try {
        await run();
      } catch (error) {
        rejected = error;
      }

      expect(rejected).toBeDefined();
      if (expectsKnownFailure) {
        expect(rejected).toBe(failure);
      }
      expect(events).toEqual(expectedEvents);
      expect(events).not.toContain('succeed:完成');
    },
  );

  it('uses silent progress when no progress dependency is supplied', async () => {
    await expect(runParse('resume.pdf', {}, {
      readPdf: vi.fn().mockResolvedValue('resume text'),
      writeResult: vi.fn(),
    })).resolves.toBeUndefined();
  });
});

const failure = new Error('boom');
let events: string[] = [];
let failingProgress: Progress;
