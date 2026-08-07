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
});
