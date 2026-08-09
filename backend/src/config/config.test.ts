/// <reference types="vitest/globals" />
import { describe, it, expect, vi } from 'vitest';

describe('config', () => {
  it('loads default values when env is missing', async () => {
    vi.resetModules();
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.DATABASE_URL;
    delete process.env.LOG_LEVEL;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.CORS_ORIGIN;
    delete process.env.CORS_CREDENTIALS;
    delete process.env.GRAPHQL_MAX_DEPTH;
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_WINDOW_MS;
    delete process.env.RATE_LIMIT_DISABLED;
    delete process.env.AUTH_MAX_FAILED_LOGINS;
    delete process.env.AUTH_LOCKOUT_DURATION_MS;

    const { config } = await import('./config');

    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(4000);
    expect(config.DATABASE_URL).toBe('file:./dev.db');
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.JWT_SECRET).toBe('dev-secret-do-not-use-in-production');
    expect(config.JWT_EXPIRES_IN).toBe('7d');
    expect(config.CORS_ORIGIN).toBe('*');
    expect(config.CORS_CREDENTIALS).toBe(false);
    expect(config.GRAPHQL_MAX_DEPTH).toBe(10);
    expect(config.RATE_LIMIT_MAX).toBe(20);
    expect(config.RATE_LIMIT_WINDOW_MS).toBe(15 * 60 * 1000);
    expect(config.RATE_LIMIT_DISABLED).toBe(false);
    expect(config.AUTH_MAX_FAILED_LOGINS).toBe(5);
    expect(config.AUTH_LOCKOUT_DURATION_MS).toBe(15 * 60 * 1000);
  });

  it('parses provided env values', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.PORT = '8080';
    process.env.DATABASE_URL = 'file:./test.db';
    process.env.LOG_LEVEL = 'debug';
    process.env.JWT_SECRET = 'a-secure-test-secret-with-at-least-32-chars';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.CORS_ORIGIN = 'https://example.com';
    process.env.CORS_CREDENTIALS = 'true';
    process.env.GRAPHQL_MAX_DEPTH = '6';
    process.env.RATE_LIMIT_MAX = '10';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    process.env.RATE_LIMIT_DISABLED = 'true';
    process.env.AUTH_MAX_FAILED_LOGINS = '3';
    process.env.AUTH_LOCKOUT_DURATION_MS = '300000';

    const { config } = await import('./config');

    expect(config.NODE_ENV).toBe('test');
    expect(config.PORT).toBe(8080);
    expect(config.DATABASE_URL).toBe('file:./test.db');
    expect(config.LOG_LEVEL).toBe('debug');
    expect(config.JWT_SECRET).toBe(
      'a-secure-test-secret-with-at-least-32-chars',
    );
    expect(config.JWT_EXPIRES_IN).toBe('1h');
    expect(config.CORS_ORIGIN).toBe('https://example.com');
    expect(config.CORS_CREDENTIALS).toBe(true);
    expect(config.GRAPHQL_MAX_DEPTH).toBe(6);
    expect(config.RATE_LIMIT_MAX).toBe(10);
    expect(config.RATE_LIMIT_WINDOW_MS).toBe(60000);
    expect(config.RATE_LIMIT_DISABLED).toBe(true);
    expect(config.AUTH_MAX_FAILED_LOGINS).toBe(3);
    expect(config.AUTH_LOCKOUT_DURATION_MS).toBe(300000);
  });

  it('rejects the default JWT_SECRET in production', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'dev-secret-do-not-use-in-production';
    process.env.CORS_ORIGIN = 'false';

    await expect(import('./config')).rejects.toThrow(
      'JWT_SECRET must be changed from the default value in production',
    );
  });

  it('rejects a short JWT_SECRET in production', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'short-secret';
    process.env.CORS_ORIGIN = 'false';

    await expect(import('./config')).rejects.toThrow(
      'JWT_SECRET must be at least 32 characters in production',
    );
  });

  it('rejects a wildcard CORS_ORIGIN in production', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a-secure-production-secret-with-32-chars!';
    process.env.CORS_ORIGIN = '*';

    await expect(import('./config')).rejects.toThrow(
      'CORS_ORIGIN must not be "*" in production',
    );
  });
});
