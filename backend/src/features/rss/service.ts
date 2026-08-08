import type { Logger } from 'pino';
import {
  Feed,
  Article,
  CreateFeedInput,
  UpdateFeedInput,
  ArticleFilter,
  Stats,
} from './domain';
import {
  createFeedSchema,
  updateFeedSchema,
  articleFilterSchema,
} from './schemas';
import { RssRepository } from './repository';
import { parseFeed, ParsedArticle } from '../../lib/rssParser';

export interface FetchResult {
  feedName: string;
  feedUrl: string;
  inserted: number;
  updated: number;
  error?: string;
}

export class RssService {
  constructor(
    private readonly repository: RssRepository,
    private readonly logger: Logger,
    private readonly fetchFeedFn: (
      url: string,
    ) => Promise<ParsedArticle[]> = parseFeed,
  ) {}

  listFeeds(): Promise<Feed[]> {
    this.logger.debug('listing feeds');
    return this.repository.findFeeds();
  }

  getStats(): Promise<Stats> {
    this.logger.debug('getting stats');
    return this.repository.getStats();
  }

  getFeed(id: string): Promise<Feed | null> {
    this.logger.debug({ id }, 'fetching feed');
    return this.repository.findFeedById(id);
  }

  async createFeed(input: CreateFeedInput): Promise<Feed> {
    const validated = createFeedSchema.parse(input);
    this.logger.info({ url: validated.url }, 'creating feed');

    const existing = await this.repository.findFeedByUrl(validated.url);
    if (existing) {
      throw new Error(`Feed already exists: ${validated.url}`);
    }

    return this.repository.createFeed(validated);
  }

  async updateFeed(id: string, input: UpdateFeedInput): Promise<Feed> {
    const validated = updateFeedSchema.parse(input);
    this.logger.info({ id }, 'updating feed');
    return this.repository.updateFeed(id, validated);
  }

  async deleteFeed(id: string): Promise<boolean> {
    this.logger.info({ id }, 'deleting feed');
    return this.repository.deleteFeed(id);
  }

  listArticles(filter: ArticleFilter = {}): Promise<Article[]> {
    const validated = articleFilterSchema.parse(filter);
    this.logger.debug({ filter: validated }, 'listing articles');
    return this.repository.findArticles(validated);
  }

  getArticle(id: string): Promise<Article | null> {
    this.logger.debug({ id }, 'fetching article');
    return this.repository.findArticleById(id);
  }

  async markArticleRead(id: string, isRead: boolean): Promise<Article> {
    this.logger.info({ id, isRead }, 'marking article read');
    return this.repository.updateArticle(id, { isRead });
  }

  async markArticleStarred(id: string, isStarred: boolean): Promise<Article> {
    this.logger.info({ id, isStarred }, 'marking article starred');
    return this.repository.updateArticle(id, { isStarred });
  }

  async deleteArticle(id: string): Promise<boolean> {
    this.logger.info({ id }, 'deleting article');
    return this.repository.deleteArticle(id);
  }

  async fetchFeeds(): Promise<FetchResult[]> {
    const feeds = await this.repository.findEnabledFeeds();
    const results: FetchResult[] = [];

    for (const feed of feeds) {
      const base: FetchResult = {
        feedName: feed.name,
        feedUrl: feed.url,
        inserted: 0,
        updated: 0,
      };

      try {
        const items = await this.fetchFeedFn(feed.url);
        const now = new Date();

        for (const item of items) {
          const existing = await this.repository.findArticleByFeedIdAndLink(
            feed.id,
            item.link,
          );

          if (existing) {
            await this.repository.updateArticle(existing.id, {
              title: item.title,
              snippet: item.snippet,
              publishedAt: item.publishedAt,
              fetchedAt: now,
            });
            base.updated += 1;
          } else {
            await this.repository.createArticle({
              feedId: feed.id,
              title: item.title,
              link: item.link,
              snippet: item.snippet,
              publishedAt: item.publishedAt,
              fetchedAt: now,
              isRead: false,
              isStarred: false,
            });
            base.inserted += 1;
          }
        }

        await this.repository.updateFeedLastFetched(feed.id, now);
        results.push(base);
        this.logger.info(base, 'fetched feed');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ ...base, error: message });
        this.logger.error({ feed: feed.url, error: message }, 'fetch failed');
      }
    }

    return results;
  }
}
