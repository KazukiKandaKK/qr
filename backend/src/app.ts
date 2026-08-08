import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { typeDefs } from './graphql/schema';
import { createRssResolvers } from './features/rss/resolvers';
import { RssService } from './features/rss/service';
import { PrismaRssRepository, RssRepository } from './features/rss/repository';
import { PrismaUserRepository, UserRepository } from './features/auth/repository';
import { AuthService } from './features/auth/service';
import { createAuthResolvers } from './features/auth/resolvers';
import { User } from './features/auth/domain';
import { prisma } from './lib/prisma';
import { config } from './config/config';
import { logger } from './config/logger';
import type pino from 'pino';

export interface AppContext {
  logger: pino.Logger;
  rssService: RssService;
  user?: User;
}

export interface CreateAppOptions {
  repository?: RssRepository;
  userRepository?: UserRepository;
}

export async function createApp(
  options: CreateAppOptions = {},
): Promise<express.Express> {
  const repository = options.repository ?? new PrismaRssRepository(prisma);
  const userRepository = options.userRepository ?? new PrismaUserRepository(prisma);
  const rssService = new RssService(repository, logger);
  const authService = new AuthService(
    userRepository,
    config.JWT_SECRET,
    config.JWT_EXPIRES_IN,
  );

  const server = new ApolloServer<AppContext>({
    typeDefs,
    resolvers: [createRssResolvers(rssService), createAuthResolvers(authService)],
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
      context: async ({ req }): Promise<AppContext> => {
        const user = await authService.verifyToken(
          extractBearerToken(req.headers.authorization),
        );
        return { logger, rssService, user: user ?? undefined };
      },
    }),
  );

  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });

  return app;
}

function extractBearerToken(header?: string | string[]): string {
  if (typeof header !== 'string') return '';
  const match = header.match(/^Bearer\s+(?<token>\S+)$/i);
  return match?.groups?.token ?? '';
}
