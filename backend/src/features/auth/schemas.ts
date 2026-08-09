import { z } from 'zod';

export const registerInputSchema = z.object({
  email: z.string().email().min(1).max(254),
  password: z.string().min(8).max(128),
  name: z.string().max(100).optional(),
});

export const loginInputSchema = z.object({
  email: z.string().email().min(1).max(254),
  password: z.string().min(1).max(128),
});
