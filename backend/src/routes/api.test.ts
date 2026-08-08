import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import express from 'express';
import pino from 'pino';
import { createApiRouter } from './api';
import { RssService } from '../features/rss/service';
import { InMemoryRssRepository } from '../features/rss/repository';

async function startTestServer(service: RssService) {
  const app = express();
  app.use('/api', createApiRouter(service));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { server, port };
}

async function getJson(port: number, path: string) {
  const res = await fetch(`http://localhost:${port}${path}`);
  return { status: res.status, body: (await res.json()) as unknown };
}

describe('api router', () => {
  let server: http.Server;
  let port: number;
  let service: RssService;
  let repository: InMemoryRssRepository;

  beforeEach(async () => {
    const logger = pino({ level: 'silent' });
    repository = new InMemoryRssRepository();
    service = new RssService(repository, logger);
    const testServer = await startTestServer(service);
    server = testServer.server;
    port = testServer.port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('returns health', async () => {
    const { status, body } = await getJson(port, '/api/health');
    expect(status).toBe(200);
    expect((body as { status: string }).status).toBe('ok');
  });

  it('lists feeds', async () => {
    await service.createFeed({
      name: 'A',
      url: 'https://example.com/feed',
      category: 'Test',
    });

    const { status, body } = await getJson(port, '/api/feeds');
    expect(status).toBe(200);
    expect((body as { feeds: unknown[] }).feeds).toHaveLength(1);
  });

  it('returns 404 for unknown feed', async () => {
    const { status } = await getJson(port, '/api/feeds/does-not-exist');
    expect(status).toBe(404);
  });

  it('filters articles by read/star status', async () => {
    const feed = await service.createFeed({
      name: 'B',
      url: 'https://example.com/b',
      category: 'Test',
    });

    const article = await repository.createArticle({
      feedId: feed.id,
      title: 'Unread',
      link: 'https://example.com/unread',
      snippet: 'snippet',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: false,
      isStarred: true,
    });

    const { body } = await getJson(port, '/api/articles?isStarred=true');
    const articles = (body as { articles: unknown[] }).articles;
    expect(articles).toHaveLength(1);
    expect((articles[0] as { id: string }).id).toBe(article.id);
  });
});
