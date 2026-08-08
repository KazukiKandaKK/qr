import { RssService } from './service';
import { dateTimeScalar } from '../../graphql/scalars';

export const createRssResolvers = (service: RssService) => ({
  DateTime: dateTimeScalar,
  Feed: {
    articles: (feed: { id: string }, args: { filter?: { keyword?: string; isRead?: boolean; isStarred?: boolean } }) =>
      service.listArticles({ feedId: feed.id, ...args.filter }),
  },
  Article: {
    feed: (article: { feedId: string }) => service.getFeed(article.feedId),
  },
  Query: {
    feeds: () => service.listFeeds(),
    feed: (_: unknown, args: { id: string }) => service.getFeed(args.id),
    articles: (_: unknown, args: { filter?: object }) =>
      service.listArticles(args.filter),
    article: (_: unknown, args: { id: string }) => service.getArticle(args.id),
    stats: () => service.getStats(),
  },
  Mutation: {
    createFeed: (_: unknown, args: { input: { name: string; url: string; category: string; enabled?: boolean } }) =>
      service.createFeed(args.input),
    updateFeed: (_: unknown, args: { id: string; input: object }) =>
      service.updateFeed(args.id, args.input),
    deleteFeed: (_: unknown, args: { id: string }) =>
      service.deleteFeed(args.id),
    fetchFeeds: () => service.fetchFeeds(),
    markArticleRead: (_: unknown, args: { id: string; isRead: boolean }) =>
      service.markArticleRead(args.id, args.isRead),
    markArticleStarred: (
      _: unknown,
      args: { id: string; isStarred: boolean },
    ) => service.markArticleStarred(args.id, args.isStarred),
    deleteArticle: (_: unknown, args: { id: string }) =>
      service.deleteArticle(args.id),
  },
});
