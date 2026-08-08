import type { PrismaClient } from '@prisma/client';
import {
  Feed,
  Article,
  CreateFeedInput,
  UpdateFeedInput,
  ArticleFilter,
  Stats,
} from './domain';

export interface RssRepository {
  // feeds
  findFeeds(): Promise<Feed[]>;
  findFeedById(id: string): Promise<Feed | null>;
  findFeedByUrl(url: string): Promise<Feed | null>;
  findEnabledFeeds(): Promise<Feed[]>;
  createFeed(data: CreateFeedInput): Promise<Feed>;
  updateFeed(id: string, data: UpdateFeedInput): Promise<Feed>;
  deleteFeed(id: string): Promise<boolean>;
  updateFeedLastFetched(id: string, at: Date): Promise<void>;

  // articles
  findArticles(filter: ArticleFilter): Promise<Article[]>;
  findArticleById(id: string): Promise<Article | null>;
  findArticleByFeedIdAndLink(feedId: string, link: string): Promise<Article | null>;
  findArticlesByFeedId(feedId: string): Promise<Article[]>;
  createArticle(data: Omit<Article, 'id'>): Promise<Article>;
  updateArticle(id: string, data: Partial<Article>): Promise<Article>;
  deleteArticle(id: string): Promise<boolean>;

  // stats
  getStats(): Promise<Stats>;
}

function toFeed(row: {
  id: string;
  name: string;
  url: string;
  category: string;
  enabled: boolean;
  lastFetchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Feed {
  return { ...row };
}

function toArticle(row: {
  id: string;
  feedId: string;
  title: string;
  link: string;
  snippet: string;
  publishedAt: Date;
  fetchedAt: Date;
  isRead: boolean;
  isStarred: boolean;
}): Article {
  return { ...row };
}

export class PrismaRssRepository implements RssRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findFeeds(): Promise<Feed[]> {
    const rows = await this.prisma.feed.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toFeed);
  }

  async findFeedById(id: string): Promise<Feed | null> {
    const row = await this.prisma.feed.findUnique({ where: { id } });
    return row ? toFeed(row) : null;
  }

  async findFeedByUrl(url: string): Promise<Feed | null> {
    const row = await this.prisma.feed.findUnique({ where: { url } });
    return row ? toFeed(row) : null;
  }

  async findEnabledFeeds(): Promise<Feed[]> {
    const rows = await this.prisma.feed.findMany({
      where: { enabled: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toFeed);
  }

  async createFeed(data: CreateFeedInput): Promise<Feed> {
    const row = await this.prisma.feed.create({ data });
    return toFeed(row);
  }

  async updateFeed(id: string, data: UpdateFeedInput): Promise<Feed> {
    const row = await this.prisma.feed.update({ where: { id }, data });
    return toFeed(row);
  }

  async deleteFeed(id: string): Promise<boolean> {
    try {
      await this.prisma.feed.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async updateFeedLastFetched(id: string, at: Date): Promise<void> {
    await this.prisma.feed.update({
      where: { id },
      data: { lastFetchedAt: at },
    });
  }

  async findArticles(filter: ArticleFilter): Promise<Article[]> {
    const where: {
      feedId?: string;
      isRead?: boolean;
      isStarred?: boolean;
      OR?: Array<
        { title?: { contains: string } } | { snippet?: { contains: string } }
      >;
    } = {};

    if (filter.feedId) where.feedId = filter.feedId;
    if (filter.isRead !== undefined) where.isRead = filter.isRead;
    if (filter.isStarred !== undefined) where.isStarred = filter.isStarred;
    if (filter.keyword) {
      where.OR = [
        { title: { contains: filter.keyword } },
        { snippet: { contains: filter.keyword } },
      ];
    }

    const rows = await this.prisma.article.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
    });
    return rows.map(toArticle);
  }

  async findArticleById(id: string): Promise<Article | null> {
    const row = await this.prisma.article.findUnique({ where: { id } });
    return row ? toArticle(row) : null;
  }

  async findArticleByFeedIdAndLink(
    feedId: string,
    link: string,
  ): Promise<Article | null> {
    const row = await this.prisma.article.findUnique({
      where: { feedId_link: { feedId, link } },
    });
    return row ? toArticle(row) : null;
  }

  async findArticlesByFeedId(feedId: string): Promise<Article[]> {
    const rows = await this.prisma.article.findMany({
      where: { feedId },
      orderBy: { publishedAt: 'desc' },
    });
    return rows.map(toArticle);
  }

  async createArticle(
    data: Omit<Article, 'id'>,
  ): Promise<Article> {
    const row = await this.prisma.article.create({ data });
    return toArticle(row);
  }

  async updateArticle(id: string, data: Partial<Article>): Promise<Article> {
    const row = await this.prisma.article.update({ where: { id }, data });
    return toArticle(row);
  }

  async deleteArticle(id: string): Promise<boolean> {
    try {
      await this.prisma.article.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async getStats(): Promise<Stats> {
    const [
      feedCount,
      articleCount,
      readCount,
      starredCount,
    ] = await Promise.all([
      this.prisma.feed.count(),
      this.prisma.article.count(),
      this.prisma.article.count({ where: { isRead: true } }),
      this.prisma.article.count({ where: { isStarred: true } }),
    ]);

    return {
      feedCount,
      articleCount,
      readCount,
      starredCount,
      unreadCount: articleCount - readCount,
    };
  }
}

export class InMemoryRssRepository implements RssRepository {
  private feeds = new Map<string, Feed>();
  private articles = new Map<string, Article>();
  private feedIdSeq = 0;
  private articleIdSeq = 0;

  private nextFeedId(): string {
    this.feedIdSeq += 1;
    return `feed-${this.feedIdSeq}`;
  }

  private nextArticleId(): string {
    this.articleIdSeq += 1;
    return `article-${this.articleIdSeq}`;
  }

  async findFeeds(): Promise<Feed[]> {
    return Array.from(this.feeds.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async findFeedById(id: string): Promise<Feed | null> {
    return this.feeds.get(id) ?? null;
  }

  async findFeedByUrl(url: string): Promise<Feed | null> {
    return (
      Array.from(this.feeds.values()).find((f) => f.url === url) ?? null
    );
  }

  async findEnabledFeeds(): Promise<Feed[]> {
    return (await this.findFeeds()).filter((f) => f.enabled);
  }

  async createFeed(data: CreateFeedInput): Promise<Feed> {
    const now = new Date();
    const feed: Feed = {
      id: this.nextFeedId(),
      name: data.name,
      url: data.url,
      category: data.category,
      enabled: data.enabled ?? true,
      lastFetchedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.feeds.set(feed.id, feed);
    return feed;
  }

  async updateFeed(id: string, data: UpdateFeedInput): Promise<Feed> {
    const existing = this.feeds.get(id);
    if (!existing) {
      throw new Error(`Feed not found: ${id}`);
    }
    const updated: Feed = {
      ...existing,
      name: data.name ?? existing.name,
      category: data.category ?? existing.category,
      enabled: data.enabled ?? existing.enabled,
      updatedAt: new Date(),
    };
    this.feeds.set(id, updated);
    return updated;
  }

  async deleteFeed(id: string): Promise<boolean> {
    for (const [articleId, article] of this.articles) {
      if (article.feedId === id) {
        this.articles.delete(articleId);
      }
    }
    return this.feeds.delete(id);
  }

  async updateFeedLastFetched(id: string, at: Date): Promise<void> {
    const feed = this.feeds.get(id);
    if (feed) {
      feed.lastFetchedAt = at;
      feed.updatedAt = new Date();
    }
  }

  async findArticles(filter: ArticleFilter): Promise<Article[]> {
    let rows = Array.from(this.articles.values());
    if (filter.feedId) {
      rows = rows.filter((a) => a.feedId === filter.feedId);
    }
    if (filter.isRead !== undefined) {
      rows = rows.filter((a) => a.isRead === filter.isRead);
    }
    if (filter.isStarred !== undefined) {
      rows = rows.filter((a) => a.isStarred === filter.isStarred);
    }
    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase();
      rows = rows.filter(
        (a) =>
          a.title.toLowerCase().includes(kw) ||
          a.snippet.toLowerCase().includes(kw),
      );
    }
    return rows.sort(
      (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
    );
  }

  async findArticleById(id: string): Promise<Article | null> {
    return this.articles.get(id) ?? null;
  }

  async findArticleByFeedIdAndLink(
    feedId: string,
    link: string,
  ): Promise<Article | null> {
    return (
      Array.from(this.articles.values()).find(
        (a) => a.feedId === feedId && a.link === link,
      ) ?? null
    );
  }

  async findArticlesByFeedId(feedId: string): Promise<Article[]> {
    return (await this.findArticles({ feedId })).sort(
      (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
    );
  }

  async createArticle(data: Omit<Article, 'id'>): Promise<Article> {
    const article: Article = {
      ...data,
      id: this.nextArticleId(),
    };
    this.articles.set(article.id, article);
    return article;
  }

  async updateArticle(id: string, data: Partial<Article>): Promise<Article> {
    const existing = this.articles.get(id);
    if (!existing) {
      throw new Error(`Article not found: ${id}`);
    }
    const updated = { ...existing, ...data };
    this.articles.set(id, updated);
    return updated;
  }

  async deleteArticle(id: string): Promise<boolean> {
    return this.articles.delete(id);
  }

  async getStats(): Promise<Stats> {
    const feedCount = this.feeds.size;
    const articles = Array.from(this.articles.values());
    const articleCount = articles.length;
    const readCount = articles.filter((a) => a.isRead).length;
    const starredCount = articles.filter((a) => a.isStarred).length;

    return {
      feedCount,
      articleCount,
      readCount,
      starredCount,
      unreadCount: articleCount - readCount,
    };
  }
}
