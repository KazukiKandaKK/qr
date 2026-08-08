import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).default(4000),
  DATABASE_URL: z.string().default('file:./dev.db'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  JWT_SECRET: z.string().min(1).default('dev-secret-do-not-use-in-production'),
  JWT_EXPIRES_IN: z.string().default('7d'),
});

export const config = schema.parse(process.env);
