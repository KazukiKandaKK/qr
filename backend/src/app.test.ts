/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { createApp } from './app';
import { InMemoryRssRepository } from './features/rss/repository';
import { InMemoryUserRepository } from './features/auth/repository';

async function startAppServer(
  repository: InMemoryRssRepository,
  userRepository: InMemoryUserRepository,
) {
  const app = await createApp({ repository, userRepository });
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
  let token: string;

  beforeEach(async () => {
    repo = new InMemoryRssRepository();
    userRepo = new InMemoryUserRepository();
    const started = await startAppServer(repo, userRepo);
    server = started.server;
    port = started.port;

    const { body } = await postJson(port, '/graphql', {
      query: `
        mutation {
          register(input: { email: "admin@example.com", password: "password123", name: "Admin" }) {
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
});
