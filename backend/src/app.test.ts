/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { createApp } from './app';
import { InMemoryRssRepository } from './features/rss/repository';
import {
  InMemoryUserRepository,
  InMemoryAuditLogRepository,
} from './features/auth/repository';

async function startAppServer(
  repository: InMemoryRssRepository,
  userRepository: InMemoryUserRepository,
  auditLogRepository: InMemoryAuditLogRepository,
) {
  const app = await createApp({ repository, userRepository, auditLogRepository });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { server, port };
}

async function postJson(
  port: number,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  const res = await fetch(`http://localhost:${port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as unknown };
}

describe('createApp integration', () => {
  let server: http.Server;
  let port: number;
  let repo: InMemoryRssRepository;
  let userRepo: InMemoryUserRepository;
  let auditRepo: InMemoryAuditLogRepository;
  let token: string;

  beforeEach(async () => {
    repo = new InMemoryRssRepository();
    userRepo = new InMemoryUserRepository();
    auditRepo = new InMemoryAuditLogRepository();
    const started = await startAppServer(repo, userRepo, auditRepo);
    server = started.server;
    port = started.port;

    const { body } = await postJson(port, '/graphql', {
      query: `
        mutation {
          register(input: { email: "admin@example.com", password: "Password123", name: "Admin" }) {
            token
            user { id role }
          }
        }
      `,
    });
    token = (body as { data: { register: { token: string } } }).data.register
      .token;
  });

  afterEach(
    async () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  );

  it('responds to /health', async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe('ok');
  });

  it('serves GraphQL queries', async () => {
    await repo.createFeed({
      name: 'A',
      url: 'https://example.com/a',
      category: 'News',
    });

    const { status, body } = await postJson(
      port,
      '/graphql',
      {
        query: `query { feeds { id name } }`,
      },
      { Authorization: `Bearer ${token}` },
    );
    expect(status).toBe(200);
    const data = (body as { data: { feeds: unknown[] } }).data;
    expect(data.feeds).toHaveLength(1);
    expect(data.feeds[0]).toMatchObject({ name: 'A' });
  });

  it('serves GraphQL mutations', async () => {
    const { status, body } = await postJson(
      port,
      '/graphql',
      {
        query: `
          mutation {
            createFeed(input: { name: "A", url: "https://example.com/a", category: "News" }) {
              id
              name
            }
          }
        `,
      },
      { Authorization: `Bearer ${token}` },
    );
    expect(status).toBe(200);
    const data = (body as { data: { createFeed: { name: string } } }).data;
    expect(data.createFeed.name).toBe('A');
  });

  it('rejects unauthenticated mutations', async () => {
    const { status, body } = await postJson(port, '/graphql', {
      query: `
        mutation {
          createFeed(input: { name: "A", url: "https://example.com/a", category: "News" }) {
            id
          }
        }
      `,
    });
    expect(status).toBe(200);
    const errors = (body as { errors: { message: string }[] }).errors;
    expect(errors).toBeDefined();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toBe('Unauthorized');
  });

  it('serves the SPA fallback', async () => {
    const res = await fetch(`http://localhost:${port}/some-route`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('<!doctype html>');
  });

  it('returns GraphQL errors for invalid queries', async () => {
    const { status, body } = await postJson(port, '/graphql', {
      query: `query { unknownField }`,
    });
    expect(status).toBe(400);
    const errors = (body as { errors: unknown[] }).errors;
    expect(errors).toBeDefined();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('serves security.txt at the well-known path', async () => {
    const res = await fetch(`http://localhost:${port}/.well-known/security.txt`);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toContain('Contact:');
    expect(res.headers.get('content-type')).toContain('text/plain');
  });

  it('sets security headers including HSTS', async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.headers.get('strict-transport-security')).toContain(
      'max-age=31536000',
    );
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });

  it('allows admins to query audit logs', async () => {
    const { status, body } = await postJson(
      port,
      '/graphql',
      {
        query: `query { auditLogs(limit: 10) { action actorEmail } }`,
      },
      { Authorization: `Bearer ${token}` },
    );
    expect(status).toBe(200);
    const data = (body as { data: { auditLogs: { action: string }[] } }).data;
    expect(data.auditLogs.length).toBeGreaterThan(0);
    expect(data.auditLogs.some((log) => log.action === 'REGISTER')).toBe(true);
  });

  it('rejects non-admin audit log queries', async () => {
    const { body: registerBody } = await postJson(port, '/graphql', {
      query: `
        mutation {
          register(input: { email: "user@example.com", password: "Password123" }) {
            token
          }
        }
      `,
    });
    const userToken = (
      registerBody as { data: { register: { token: string } } }
    ).data.register.token;

    const { status, body } = await postJson(
      port,
      '/graphql',
      {
        query: `query { auditLogs(limit: 10) { action } }`,
      },
      { Authorization: `Bearer ${userToken}` },
    );
    expect(status).toBe(200);
    const errors = (body as { errors: { message: string }[] }).errors;
    expect(errors.some((e) => e.message === 'Forbidden')).toBe(true);
  });
});
