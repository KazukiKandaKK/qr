import 'dotenv/config';
import { z } from 'zod';

const DEFAULT_JWT_SECRET = 'dev-secret-do-not-use-in-production';

const booleanFromEnv = z.preprocess(
  (val) => val === 'true' || val === true,
  z.boolean(),
);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).default(4000),
  DATABASE_URL: z.string().default('file:./dev.db'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  LOG_FILE: z.string().optional(),
  JWT_SECRET: z.string().min(1).default(DEFAULT_JWT_SECRET),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('*'),
  CORS_CREDENTIALS: booleanFromEnv.default(false),
  GRAPHQL_MAX_DEPTH: z.coerce.number().int().min(1).default(10),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1).default(15 * 60 * 1000),
  RATE_LIMIT_DISABLED: booleanFromEnv.default(false),
  AUTH_MAX_FAILED_LOGINS: z.coerce.number().int().min(1).default(5),
  AUTH_LOCKOUT_DURATION_MS: z.coerce.number().int().min(1).default(15 * 60 * 1000),
});

export const config = schema.parse(process.env);

if (config.NODE_ENV === 'production') {
  if (config.JWT_SECRET === DEFAULT_JWT_SECRET) {
    throw new Error(
      'JWT_SECRET must be changed from the default value in production',
    );
  }
  if (config.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  if (config.CORS_ORIGIN === '*') {
    throw new Error(
      'CORS_ORIGIN must not be "*" in production; set it to your frontend origin or "false"',
    );
  }
}
