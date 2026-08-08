/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach } from 'vitest';
import pino from 'pino';
import { RssService } from './service';
import { InMemoryRssRepository } from './repository';
import { ParsedArticle } from '../../lib/rssParser';

describe('RssService', () => {
  const logger = pino({ level: 'silent' });
  let repo: InMemoryRssRepository;
  let service: RssService;

  beforeEach(() => {
    repo = new InMemoryRssRepository();
    service = new RssService(repo, logger);
  });

  it('creates and lists a feed', async () => {
    const feed = await service.createFeed({
      name: 'The Hacker News',
      url: 'https://example.com/feed',
      category: 'News',
    });
    expect(feed.name).toBe('The Hacker News');

    const feeds = await service.listFeeds();
    expect(feeds).toHaveLength(1);
  });

  it('rejects duplicate feed urls', async () => {
    await service.createFeed({
      name: 'A',
      url: 'https://example.com/feed',
      category: 'News',
    });
    await expect(
      service.createFeed({
        name: 'B',
        url: 'https://example.com/feed',
        category: 'News',
      }),
    ).rejects.toThrow();
  });

  it('fetches and stores articles', async () => {
    const feed = await service.createFeed({
      name: 'Security Feed',
      url: 'https://example.com/feed',
      category: 'News',
    });

    const fakeFetcher = async (_url: string): Promise<ParsedArticle[]> => [
      {
        title: 'New Vulnerability',
        link: 'https://example.com/1',
        snippet: 'A new CVE was published.',
        publishedAt: new Date('2026-08-01T00:00:00Z'),
      },
    ];

    const fetchService = new RssService(repo, logger, fakeFetcher);
    const results = await fetchService.fetchFeeds();
    expect(results).toHaveLength(1);
    expect(results[0].inserted).toBe(1);

    const articles = await fetchService.listArticles({ feedId: feed.id });
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe('New Vulnerability');
  });

  it('marks an article as read and starred', async () => {
    const feed = await service.createFeed({
      name: 'Security Feed',
      url: 'https://example.com/feed',
      category: 'News',
    });
    const article = await repo.createArticle({
      feedId: feed.id,
      title: 'Alert',
      link: 'https://example.com/2',
      snippet: 'Important',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: false,
      isStarred: false,
    });

    const updated = await service.markArticleRead(article.id, true);
    expect(updated.isRead).toBe(true);

    const starred = await service.markArticleStarred(article.id, true);
    expect(starred.isStarred).toBe(true);
  });

  it('returns stats', async () => {
    const feed = await service.createFeed({
      name: 'Security Feed',
      url: 'https://example.com/feed',
      category: 'News',
    });
    await repo.createArticle({
      feedId: feed.id,
      title: 'Read Alert',
      link: 'https://example.com/1',
      snippet: 'read',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: true,
      isStarred: true,
    });
    await repo.createArticle({
      feedId: feed.id,
      title: 'Unread Alert',
      link: 'https://example.com/2',
      snippet: 'unread',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: false,
      isStarred: false,
    });

    const stats = await service.getStats();
    expect(stats).toEqual({
      feedCount: 1,
      articleCount: 2,
      readCount: 1,
      unreadCount: 1,
      starredCount: 1,
    });
  });

  it('rejects invalid feed input', async () => {
    await expect(
      service.createFeed({
        name: '',
        url: 'https://example.com/feed',
        category: 'News',
      }),
    ).rejects.toThrow();

    await expect(
      service.createFeed({
        name: 'A',
        url: 'not-a-url',
        category: 'News',
      }),
    ).rejects.toThrow();
  });

  it('rejects feed names over 200 chars', async () => {
    await expect(
      service.createFeed({
        name: 'A'.repeat(201),
        url: 'https://example.com/feed',
        category: 'News',
      }),
    ).rejects.toThrow();
  });

  it('lists articles with filters', async () => {
    const feed = await service.createFeed({
      name: 'A',
      url: 'https://example.com/feed',
      category: 'News',
    });
    await repo.createArticle({
      feedId: feed.id,
      title: 'Security news',
      link: 'https://example.com/1',
      snippet: 'patch',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: true,
      isStarred: false,
    });
    await repo.createArticle({
      feedId: feed.id,
      title: 'Other',
      link: 'https://example.com/2',
      snippet: 'no match',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: false,
      isStarred: true,
    });

    const read = await service.listArticles({ isRead: true });
    expect(read).toHaveLength(1);

    const keyword = await service.listArticles({ keyword: 'security' });
    expect(keyword).toHaveLength(1);
  });

  it('updates a feed', async () => {
    const feed = await service.createFeed({
      name: 'A',
      url: 'https://example.com/feed',
      category: 'News',
    });
    const updated = await service.updateFeed(feed.id, { name: 'B' });
    expect(updated.name).toBe('B');
  });

  it('throws when updating a missing feed', async () => {
    await expect(service.updateFeed('missing', { name: 'B' })).rejects.toThrow(
      'Feed not found',
    );
  });

  it('returns null for unknown feed and article', async () => {
    expect(await service.getFeed('missing')).toBeNull();
    expect(await service.getArticle('missing')).toBeNull();
  });

  it('deletes a feed and its articles', async () => {
    const feed = await service.createFeed({
      name: 'A',
      url: 'https://example.com/feed',
      category: 'News',
    });
    await repo.createArticle({
      feedId: feed.id,
      title: 'X',
      link: 'https://example.com/1',
      snippet: 'x',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: false,
      isStarred: false,
    });

    await service.deleteFeed(feed.id);
    expect(await service.listFeeds()).toHaveLength(0);
    expect(await service.listArticles({})).toHaveLength(0);
  });

  it('updates existing articles on refetch without losing user flags', async () => {
    const feed = await service.createFeed({
      name: 'A',
      url: 'https://example.com/feed',
      category: 'News',
    });

    const fakeFetcher = async (_url: string): Promise<ParsedArticle[]> => [
      {
        title: 'Old',
        link: 'https://example.com/1',
        snippet: 'Old summary.',
        publishedAt: new Date('2026-08-01T00:00:00Z'),
      },
    ];

    const fetchService = new RssService(repo, logger, fakeFetcher);
    await fetchService.fetchFeeds();
    const [article] = await fetchService.listArticles({ feedId: feed.id });
    await fetchService.markArticleRead(article.id, true);

    const updatedFetcher = async (_url: string): Promise<ParsedArticle[]> => [
      {
        title: 'New',
        link: 'https://example.com/1',
        snippet: 'New summary.',
        publishedAt: new Date('2026-08-02T00:00:00Z'),
      },
    ];
    const updatedService = new RssService(repo, logger, updatedFetcher);
    await updatedService.fetchFeeds();

    const [updated] = await updatedService.listArticles({ feedId: feed.id });
    expect(updated.title).toBe('New');
    expect(updated.isRead).toBe(true);
  });

  it('reports fetch errors per feed', async () => {
    await service.createFeed({
      name: 'A',
      url: 'https://example.com/feed',
      category: 'News',
      enabled: true,
    });

    const failingFetcher = async (_url: string): Promise<ParsedArticle[]> => {
      throw new Error('network error');
    };
    const fetchService = new RssService(repo, logger, failingFetcher);
    const results = await fetchService.fetchFeeds();
    expect(results).toHaveLength(1);
    expect(results[0].error).toBe('network error');
    expect(results[0].inserted).toBe(0);
    expect(results[0].updated).toBe(0);
  });

  it('skips disabled feeds on fetch', async () => {
    await service.createFeed({
      name: 'Disabled',
      url: 'https://example.com/disabled',
      category: 'News',
      enabled: false,
    });

    const fetcher = async (_url: string): Promise<ParsedArticle[]> => [
      { title: 'T', link: 'https://example.com/1', snippet: 'x', publishedAt: new Date() },
    ];
    const fetchService = new RssService(repo, logger, fetcher);
    const results = await fetchService.fetchFeeds();
    expect(results).toHaveLength(0);
  });

  it('deletes an article', async () => {
    const feed = await service.createFeed({
      name: 'A',
      url: 'https://example.com/feed',
      category: 'News',
    });
    const article = await repo.createArticle({
      feedId: feed.id,
      title: 'X',
      link: 'https://example.com/1',
      snippet: 'x',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: false,
      isStarred: false,
    });

    const deleted = await service.deleteArticle(article.id);
    expect(deleted).toBe(true);
    expect(await service.listArticles({})).toHaveLength(0);
  });
});
