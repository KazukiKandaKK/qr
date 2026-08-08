/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRssRepository } from './repository';
import type { Feed } from './domain';

describe('InMemoryRssRepository', () => {
  let repo: InMemoryRssRepository;

  beforeEach(() => {
    repo = new InMemoryRssRepository();
  });

  describe('feeds', () => {
    it('returns an empty list initially', async () => {
      const feeds = await repo.findFeeds();
      expect(feeds).toEqual([]);
    });

    it('creates and finds a feed by id', async () => {
      const feed = await repo.createFeed({
        name: 'A',
        url: 'https://example.com/a',
        category: 'News',
      });
      const found = await repo.findFeedById(feed.id);
      expect(found?.id).toBe(feed.id);
      expect(found?.enabled).toBe(true);
    });

    it('finds a feed by url', async () => {
      await repo.createFeed({
        name: 'A',
        url: 'https://example.com/a',
        category: 'News',
      });
      const found = await repo.findFeedByUrl('https://example.com/a');
      expect(found?.name).toBe('A');
    });

    it('returns enabled feeds only', async () => {
      await repo.createFeed({
        name: 'Enabled',
        url: 'https://example.com/enabled',
        category: 'News',
        enabled: true,
      });
      await repo.createFeed({
        name: 'Disabled',
        url: 'https://example.com/disabled',
        category: 'News',
        enabled: false,
      });
      const feeds = await repo.findEnabledFeeds();
      expect(feeds).toHaveLength(1);
      expect(feeds[0].name).toBe('Enabled');
    });

    it('updates a feed', async () => {
      const feed = await repo.createFeed({
        name: 'A',
        url: 'https://example.com/a',
        category: 'News',
      });
      const updated = await repo.updateFeed(feed.id, { name: 'B' });
      expect(updated.name).toBe('B');
      expect(updated.category).toBe('News');
    });

    it('throws when updating a missing feed', async () => {
      await expect(
        repo.updateFeed('missing', { name: 'B' }),
      ).rejects.toThrow('Feed not found');
    });

    it('deletes a feed and its articles', async () => {
      const feed = await repo.createFeed({
        name: 'A',
        url: 'https://example.com/a',
        category: 'News',
      });
      await repo.createArticle({
        feedId: feed.id,
        title: 'T',
        link: 'https://example.com/1',
        snippet: 's',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        isRead: false,
        isStarred: false,
      });
      const deleted = await repo.deleteFeed(feed.id);
      expect(deleted).toBe(true);
      expect(await repo.findArticles({})).toHaveLength(0);
    });

    it('returns false when deleting a missing feed', async () => {
      const deleted = await repo.deleteFeed('missing');
      expect(deleted).toBe(false);
    });
  });

  describe('articles', () => {
    let feed: Feed;

    beforeEach(async () => {
      feed = await repo.createFeed({
        name: 'A',
        url: 'https://example.com/a',
        category: 'News',
      });
    });

    it('creates and finds an article by id', async () => {
      const article = await repo.createArticle({
        feedId: feed.id,
        title: 'T',
        link: 'https://example.com/1',
        snippet: 'snippet',
        publishedAt: new Date('2026-08-01T00:00:00Z'),
        fetchedAt: new Date(),
        isRead: false,
        isStarred: false,
      });
      const found = await repo.findArticleById(article.id);
      expect(found?.id).toBe(article.id);
    });

    it('finds an article by feed id and link', async () => {
      await repo.createArticle({
        feedId: feed.id,
        title: 'T',
        link: 'https://example.com/1',
        snippet: 'snippet',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        isRead: false,
        isStarred: false,
      });
      const found = await repo.findArticleByFeedIdAndLink(
        feed.id,
        'https://example.com/1',
      );
      expect(found?.title).toBe('T');
    });

    it('finds articles by feed id', async () => {
      await repo.createArticle({
        feedId: feed.id,
        title: 'T',
        link: 'https://example.com/1',
        snippet: 'snippet',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        isRead: false,
        isStarred: false,
      });
      const articles = await repo.findArticlesByFeedId(feed.id);
      expect(articles).toHaveLength(1);
    });

    it('filters articles by read and starred', async () => {
      await repo.createArticle({
        feedId: feed.id,
        title: 'Read',
        link: 'https://example.com/1',
        snippet: 'x',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        isRead: true,
        isStarred: false,
      });
      await repo.createArticle({
        feedId: feed.id,
        title: 'Starred',
        link: 'https://example.com/2',
        snippet: 'x',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        isRead: false,
        isStarred: true,
      });
      const read = await repo.findArticles({ isRead: true });
      expect(read).toHaveLength(1);
      expect(read[0].title).toBe('Read');

      const starred = await repo.findArticles({ isStarred: true });
      expect(starred).toHaveLength(1);
      expect(starred[0].title).toBe('Starred');
    });

    it('filters articles by keyword in title or snippet', async () => {
      await repo.createArticle({
        feedId: feed.id,
        title: 'Security Alert',
        link: 'https://example.com/1',
        snippet: 'foo',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        isRead: false,
        isStarred: false,
      });
      await repo.createArticle({
        feedId: feed.id,
        title: 'Other',
        link: 'https://example.com/2',
        snippet: 'security patch',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        isRead: false,
        isStarred: false,
      });
      await repo.createArticle({
        feedId: feed.id,
        title: 'Unrelated',
        link: 'https://example.com/3',
        snippet: 'no match',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        isRead: false,
        isStarred: false,
      });
      const articles = await repo.findArticles({ keyword: 'SECURITY' });
      expect(articles).toHaveLength(2);
    });

    it('combines feedId and keyword filters', async () => {
      await repo.createArticle({
        feedId: feed.id,
        title: 'Security Alert',
        link: 'https://example.com/1',
        snippet: 'x',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        isRead: false,
        isStarred: false,
      });
      const otherFeed = await repo.createFeed({
        name: 'B',
        url: 'https://example.com/b',
        category: 'News',
      });
      await repo.createArticle({
        feedId: otherFeed.id,
        title: 'Security Alert',
        link: 'https://example.com/2',
        snippet: 'x',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        isRead: false,
        isStarred: false,
      });
      const articles = await repo.findArticles({
        feedId: feed.id,
        keyword: 'security',
      });
      expect(articles).toHaveLength(1);
    });

    it('updates an article', async () => {
      const article = await repo.createArticle({
        feedId: feed.id,
        title: 'T',
        link: 'https://example.com/1',
        snippet: 'x',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        isRead: false,
        isStarred: false,
      });
      const updated = await repo.updateArticle(article.id, {
        isRead: true,
        title: 'Updated',
      });
      expect(updated.isRead).toBe(true);
      expect(updated.title).toBe('Updated');
    });

    it('throws when updating a missing article', async () => {
      await expect(
        repo.updateArticle('missing', { isRead: true }),
      ).rejects.toThrow('Article not found');
    });

    it('deletes an article', async () => {
      const article = await repo.createArticle({
        feedId: feed.id,
        title: 'T',
        link: 'https://example.com/1',
        snippet: 'x',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        isRead: false,
        isStarred: false,
      });
      const deleted = await repo.deleteArticle(article.id);
      expect(deleted).toBe(true);
      expect(await repo.findArticles({})).toHaveLength(0);
    });

    it('returns false when deleting a missing article', async () => {
      const deleted = await repo.deleteArticle('missing');
      expect(deleted).toBe(false);
    });
  });

  describe('getStats', () => {
    it('returns zeros for an empty repository', async () => {
      const stats = await repo.getStats();
      expect(stats).toEqual({
        feedCount: 0,
        articleCount: 0,
        readCount: 0,
        unreadCount: 0,
        starredCount: 0,
      });
    });

    it('counts feeds and articles correctly', async () => {
      const feed = await repo.createFeed({
        name: 'A',
        url: 'https://example.com/a',
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
});
