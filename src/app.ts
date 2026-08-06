import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { typeDefs } from './graphql/schema';
import { createRssResolvers } from './features/rss/resolvers';
import { RssService } from './features/rss/service';
import { PrismaRssRepository } from './features/rss/repository';
import { prisma } from './lib/prisma';
import { config } from './config/config';
import { logger } from './config/logger';
import type pino from 'pino';

export interface AppContext {
  logger: pino.Logger;
  rssService: RssService;
}

export async function createApp(): Promise<express.Express> {
  const repository = new PrismaRssRepository(prisma);
  const rssService = new RssService(repository, logger);

  const server = new ApolloServer<AppContext>({
    typeDefs,
    resolvers: createRssResolvers(rssService),
    formatError: (formattedError, error) => {
      logger.error({ err: error }, 'GraphQL error');
      return formattedError;
    },
  });

  await server.start();

  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use(
    '/graphql',
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware(server, {
      context: async (): Promise<AppContext> => ({ logger, rssService }),
    }),
  );

  return app;
}
