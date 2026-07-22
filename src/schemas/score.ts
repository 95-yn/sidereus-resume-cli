import { z } from 'zod';

const boundedScore = z.number().int().min(0).max(100);

export const scoreSchema = z.object({
  overall_score: boundedScore,
  skill_score: boundedScore,
  experience_score: boundedScore,
  education_score: boundedScore,
  comment: z.string().min(1),
  interview_questions: z.array(z.string().min(1)).min(1),
});

export type ScoreResult = z.infer<typeof scoreSchema>;
