/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaRssRepository } from './repository';

const testDbPath = join(tmpdir(), `qr-test-${randomBytes(8).toString('hex')}.db`);
const databaseUrl = `file:${testDbPath}`;

describe('PrismaRssRepository', () => {
  let prisma: PrismaClient;
  let repo: PrismaRssRepository;

  beforeAll(async () => {
    execSync('npx prisma migrate deploy', {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    repo = new PrismaRssRepository(prisma);
  });

  beforeEach(async () => {
    await prisma.article.deleteMany();
    await prisma.feed.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    try {
      rmSync(testDbPath);
    } catch {
      // ignore cleanup errors
    }
  });

  it('creates and lists feeds', async () => {
    const feed = await repo.createFeed({
      name: 'A',
      url: 'https://example.com/a',
      category: 'News',
    });
    expect(feed.name).toBe('A');

    const feeds = await repo.findFeeds();
    expect(feeds).toHaveLength(1);
  });

  it('finds feeds by url and id', async () => {
    const created = await repo.createFeed({
      name: 'B',
      url: 'https://example.com/b',
      category: 'News',
    });
    const byId = await repo.findFeedById(created.id);
    const byUrl = await repo.findFeedByUrl('https://example.com/b');
    expect(byId?.name).toBe('B');
    expect(byUrl?.name).toBe('B');
  });

  it('updates a feed', async () => {
    const feed = await repo.createFeed({
      name: 'C',
      url: 'https://example.com/c',
      category: 'News',
    });
    const updated = await repo.updateFeed(feed.id, { name: 'Updated' });
    expect(updated.name).toBe('Updated');
  });

  it('updates lastFetchedAt', async () => {
    const feed = await repo.createFeed({
      name: 'D',
      url: 'https://example.com/d',
      category: 'News',
    });
    const now = new Date();
    await repo.updateFeedLastFetched(feed.id, now);
    const found = await repo.findFeedById(feed.id);
    expect(found?.lastFetchedAt?.getTime()).toBe(now.getTime());
  });

  it('deletes a feed and its articles', async () => {
    const feed = await repo.createFeed({
      name: 'E',
      url: 'https://example.com/e',
      category: 'News',
    });
    await repo.createArticle({
      feedId: feed.id,
      title: 'X',
      link: 'https://example.com/x',
      snippet: 'x',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: false,
      isStarred: false,
    });
    const deleted = await repo.deleteFeed(feed.id);
    expect(deleted).toBe(true);
    expect(await repo.findArticles({})).toHaveLength(0);
  });

  it('deletes a feed returns false for missing id', async () => {
    const deleted = await repo.deleteFeed('nonexistent-id');
    expect(deleted).toBe(false);
  });

  it('creates, filters, and deletes articles', async () => {
    const feed = await repo.createFeed({
      name: 'F',
      url: 'https://example.com/f',
      category: 'News',
    });
    const article = await repo.createArticle({
      feedId: feed.id,
      title: 'Security alert',
      link: 'https://example.com/1',
      snippet: 'patch',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: false,
      isStarred: false,
    });

    const byId = await repo.findArticleById(article.id);
    expect(byId?.title).toBe('Security alert');

    const byFeedLink = await repo.findArticleByFeedIdAndLink(
      feed.id,
      'https://example.com/1',
    );
    expect(byFeedLink?.title).toBe('Security alert');

    const keywordArticles = await repo.findArticles({ keyword: 'security' });
    expect(keywordArticles).toHaveLength(1);

    const updated = await repo.updateArticle(article.id, { isRead: true });
    expect(updated.isRead).toBe(true);

    const deleted = await repo.deleteArticle(article.id);
    expect(deleted).toBe(true);
    expect(await repo.findArticles({})).toHaveLength(0);
  });

  it('returns stats from the database', async () => {
    const feed = await repo.createFeed({
      name: 'G',
      url: 'https://example.com/g',
      category: 'News',
    });
    await repo.createArticle({
      feedId: feed.id,
      title: 'Read',
      link: 'https://example.com/1',
      snippet: 'x',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: true,
      isStarred: true,
    });
    await repo.createArticle({
      feedId: feed.id,
      title: 'Unread',
      link: 'https://example.com/2',
      snippet: 'x',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: false,
      isStarred: false,
    });

    const stats = await repo.getStats();
    expect(stats).toEqual({
      feedCount: 1,
      articleCount: 2,
      readCount: 1,
      unreadCount: 1,
      starredCount: 1,
    });
  });
});
