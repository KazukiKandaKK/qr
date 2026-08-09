import { z } from 'zod';

const PASSWORD_MESSAGE =
  'Password must be 8-128 characters and contain at least one uppercase letter, one lowercase letter, and one number';

export const passwordSchema = z
  .string()
  .min(8, PASSWORD_MESSAGE)
  .max(128, PASSWORD_MESSAGE)
  .refine(
    (value) => /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value),
    { message: PASSWORD_MESSAGE },
  );

export const registerInputSchema = z.object({
  email: z.string().email().min(1).max(254),
  password: passwordSchema,
  name: z.string().max(100).optional(),
});

export const loginInputSchema = z.object({
  email: z.string().email().min(1).max(254),
  password: z.string().min(1).max(128),
});
