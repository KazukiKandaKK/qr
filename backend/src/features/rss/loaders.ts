import DataLoader from 'dataloader';
import type { Feed, Article, ArticleFilter, PaginationArgs } from './domain';
import type { RssRepository } from './repository';

export interface RssLoaders {
  feedById: DataLoader<string, Feed | null>;
  articlesByFeedId: DataLoader<
    { feedId: string; filter?: ArticleFilter; pagination?: PaginationArgs },
    Article[]
  >;
}

function applyInMemoryPagination<T>(
  rows: T[],
  pagination?: PaginationArgs,
): T[] {
  if (!pagination) return rows;
  const offset = pagination.offset ?? 0;
  const limit = pagination.limit ?? rows.length;
  return rows.slice(offset, offset + limit);
}

export function createRssLoaders(repository: RssRepository): RssLoaders {
  return {
    feedById: new DataLoader(async (ids) => {
      const feeds = await repository.findFeedsByIds(ids);
      const map = new Map(feeds.map((feed) => [feed.id, feed]));
      return ids.map((id) => map.get(id) ?? null);
    }),
    articlesByFeedId: new DataLoader(
      async (keys) => {
        const byFilter = new Map<
          string,
          {
            filter: ArticleFilter | undefined;
            pagination: PaginationArgs | undefined;
            feedIds: string[];
            indices: number[];
          }
        >();

        keys.forEach((key, index) => {
          const filterKey = JSON.stringify({
            filter: key.filter ?? {},
            pagination: key.pagination ?? {},
          });
          const entry = byFilter.get(filterKey);
          if (entry) {
            entry.feedIds.push(key.feedId);
            entry.indices.push(index);
          } else {
            byFilter.set(filterKey, {
              filter: key.filter,
              pagination: key.pagination,
              feedIds: [key.feedId],
              indices: [index],
            });
          }
        });

        const results: Article[][] = new Array(keys.length).fill([]);

        await Promise.all(
          Array.from(byFilter.values()).map(async ({ filter, feedIds, indices }) => {
            const articles = await repository.findArticlesByFeedIds(feedIds, filter);
            const grouped = new Map<string, Article[]>();
            for (const article of articles) {
              const list = grouped.get(article.feedId) ?? [];
              list.push(article);
              grouped.set(article.feedId, list);
            }
            for (const index of indices) {
              const key = keys[index];
              const list = grouped.get(key.feedId) ?? [];
              results[index] = applyInMemoryPagination(list, key.pagination);
            }
          }),
        );

        return results;
      },
      { cacheKeyFn: (key) => JSON.stringify(key) },
    ),
  };
}
