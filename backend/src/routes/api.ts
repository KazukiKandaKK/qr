import { Router, Request, Response, NextFunction } from 'express';
import { RssService } from '../features/rss/service';
import { ArticleFilter } from '../features/rss/domain';

function parseBool(value: unknown): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function buildFilter(query: Request['query']): ArticleFilter {
  return {
    feedId: typeof query.feedId === 'string' ? query.feedId : undefined,
    keyword: typeof query.keyword === 'string' ? query.keyword : undefined,
    isRead: parseBool(query.isRead),
    isStarred: parseBool(query.isStarred),
  };
}

export function createApiRouter(service: RssService): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  router.get(
    '/feeds',
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const feeds = await service.listFeeds();
        res.json({ feeds });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/feeds/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const feed = await service.getFeed(req.params.id);
        if (!feed) {
          res.status(404).json({ error: 'Feed not found' });
          return;
        }
        res.json({ feed });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/feeds/:id/articles',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const articles = await service.listArticles({
          feedId: req.params.id,
        });
        res.json({ articles });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/articles',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const articles = await service.listArticles(buildFilter(req.query));
        res.json({ articles });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
