import type { Candidate } from '../schemas/candidate.js';
import type { ScoreResult } from '../schemas/score.js';

const SKILLS = [
  'TypeScript',
  'JavaScript',
  'Node.js',
  'React',
  'Vue',
  'Python',
  'Golang',
  'Java',
  'PostgreSQL',
  'MySQL',
  'Redis',
  'Docker',
  'Kubernetes',
  'AWS',
  'OpenAI',
] as const;

const CITIES = ['北京', '上海', '深圳', '广州', '杭州', '成都', '武汉', '南京'];

export function mockExtract(resumeText: string): Candidate {
  const email = resumeText.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] ?? '';
  const phone = resumeText.match(/(?:\+?86[-\s]?)?1[3-9](?:[-\s]?\d){9}/)?.[0] ?? '';
  const firstLine = resumeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return {
    name: firstLine && firstLine.length <= 60 ? firstLine : '',
    phone,
    email,
    city: CITIES.find((city) => resumeText.includes(city)) ?? '',
    education: [],
    skills: findSkills(resumeText),
  };
}

export function mockScore(resumeText: string, jdText: string): ScoreResult {
  const resumeSkills = new Set(findSkills(resumeText));
  const jdSkills = findSkills(jdText);
  const matched = jdSkills.filter((skill) => resumeSkills.has(skill));
  const skillScore = jdSkills.length === 0 ? 50 : Math.round((matched.length / jdSkills.length) * 100);
  const experienceScore = /\b\d+\+?\s*(?:years?|年)/i.test(resumeText) ? 75 : 55;
  const educationScore = /本科|硕士|博士|bachelor|master|ph\.?d|university|大学/i.test(resumeText)
    ? 75
    : 50;
  const overallScore = Math.round(skillScore * 0.6 + experienceScore * 0.25 + educationScore * 0.15);
  const missing = jdSkills.filter((skill) => !resumeSkills.has(skill));

  return {
    overall_score: clamp(overallScore),
    skill_score: clamp(skillScore),
    experience_score: clamp(experienceScore),
    education_score: clamp(educationScore),
    comment: `Mock 模式估算：匹配 ${matched.length}/${jdSkills.length || 0} 项已识别技能。此结果仅用于演示，不代表 AI 评价。`,
    interview_questions: [
      matched.length > 0
        ? `请介绍你使用 ${matched[0]} 完成的一个项目。`
        : '请介绍一个你主导过的全栈项目。',
      missing.length > 0
        ? `你是否有学习或使用 ${missing[0]} 的经验？`
        : '请说明你如何保证项目的可维护性和测试质量。',
    ],
  };
}

function findSkills(text: string): string[] {
  const normalized = text.toLowerCase();
  return SKILLS.filter((skill) => normalized.includes(skill.toLowerCase()));
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
