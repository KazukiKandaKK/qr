import { RssService } from './service';
import { dateTimeScalar } from '../../graphql/scalars';
import { requireAuth, requireAdmin, type AuthContext } from '../auth/guards';

export const createRssResolvers = (service: RssService) => ({
  DateTime: dateTimeScalar,
  Feed: {
    articles: (
      feed: { id: string },
      args: { filter?: { keyword?: string; isRead?: boolean; isStarred?: boolean } },
      ctx: AuthContext,
    ) => {
      requireAuth(ctx);
      return service.listArticles({ feedId: feed.id, ...args.filter });
    },
  },
  Article: {
    feed: (article: { feedId: string }, _args: unknown, ctx: AuthContext) => {
      requireAuth(ctx);
      return service.getFeed(article.feedId);
    },
  },
  Query: {
    feeds: (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx);
      return service.listFeeds();
    },
    feed: (_: unknown, args: { id: string }, ctx: AuthContext) => {
      requireAuth(ctx);
      return service.getFeed(args.id);
    },
    articles: (
      _: unknown,
      args: { filter?: object },
      ctx: AuthContext,
    ) => {
      requireAuth(ctx);
      return service.listArticles(args.filter);
    },
    article: (_: unknown, args: { id: string }, ctx: AuthContext) => {
      requireAuth(ctx);
      return service.getArticle(args.id);
    },
    stats: (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx);
      return service.getStats();
    },
  },
  Mutation: {
    createFeed: (
      _: unknown,
      args: { input: { name: string; url: string; category: string; enabled?: boolean } },
      ctx: AuthContext,
    ) => {
      requireAuth(ctx);
      return service.createFeed(args.input);
    },
    updateFeed: (
      _: unknown,
      args: { id: string; input: object },
      ctx: AuthContext,
    ) => {
      requireAuth(ctx);
      return service.updateFeed(args.id, args.input);
    },
    deleteFeed: (_: unknown, args: { id: string }, ctx: AuthContext) => {
      requireAdmin(ctx);
      return service.deleteFeed(args.id);
    },
    fetchFeeds: (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx);
      return service.fetchFeeds();
    },
    markArticleRead: (
      _: unknown,
      args: { id: string; isRead: boolean },
      ctx: AuthContext,
    ) => {
      requireAuth(ctx);
      return service.markArticleRead(args.id, args.isRead);
    },
    markArticleStarred: (
      _: unknown,
      args: { id: string; isStarred: boolean },
      ctx: AuthContext,
    ) => {
      requireAuth(ctx);
      return service.markArticleStarred(args.id, args.isStarred);
    },
    deleteArticle: (_: unknown, args: { id: string }, ctx: AuthContext) => {
      requireAdmin(ctx);
      return service.deleteArticle(args.id);
    },
  },
});
