/// <reference types="vitest/globals" />
import { describe, it, expect, vi } from 'vitest';

describe('config', () => {
  it('loads default values when env is missing', async () => {
    vi.resetModules();
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.DATABASE_URL;
    delete process.env.LOG_LEVEL;

    const { config } = await import('./config');

    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(4000);
    expect(config.DATABASE_URL).toBe('file:./dev.db');
    expect(config.LOG_LEVEL).toBe('info');
  });

  it('parses provided env values', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.PORT = '8080';
    process.env.DATABASE_URL = 'file:./test.db';
    process.env.LOG_LEVEL = 'debug';

    const { config } = await import('./config');

    expect(config.NODE_ENV).toBe('production');
    expect(config.PORT).toBe(8080);
    expect(config.DATABASE_URL).toBe('file:./test.db');
    expect(config.LOG_LEVEL).toBe('debug');
  });
});
