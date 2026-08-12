import { describe, it, expect } from 'vitest';
import { createAppContainer } from './container';
import { InMemoryRssRepository } from '../features/rss/repository';
import {
  InMemoryUserRepository,
  InMemoryAuditLogRepository,
} from '../features/auth/repository';

describe('createAppContainer', () => {
  it('resolves services with overridden repositories', async () => {
    const repo = new InMemoryRssRepository();
    const userRepo = new InMemoryUserRepository();
    const auditRepo = new InMemoryAuditLogRepository();
    const container = createAppContainer({
      repository: repo,
      userRepository: userRepo,
      auditLogRepository: auditRepo,
    });

    expect(container.cradle.rssService).toBeDefined();
    expect(container.cradle.authService).toBeDefined();
    expect(await container.cradle.rssService.listFeeds()).toEqual([]);

    const user = await container.cradle.authService.register({
      email: 'container@example.com',
      password: 'Password1',
    });
    expect(user.email).toBe('container@example.com');
  });

  it('returns the same singleton instances on repeated resolve', () => {
    const container = createAppContainer({
      repository: new InMemoryRssRepository(),
      userRepository: new InMemoryUserRepository(),
      auditLogRepository: new InMemoryAuditLogRepository(),
    });

    expect(container.cradle.rssService).toBe(container.cradle.rssService);
    expect(container.cradle.authService).toBe(container.cradle.authService);
  });
});
