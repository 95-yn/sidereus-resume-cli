import { z } from 'zod';

export const educationSchema = z.object({
  school: z.string(),
  major: z.string(),
  degree: z.string(),
  graduation_time: z.string(),
});

export const candidateSchema = z.object({
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  city: z.string(),
  education: z.array(educationSchema),
  skills: z.array(z.string()),
});

export type Candidate = z.infer<typeof candidateSchema>;
