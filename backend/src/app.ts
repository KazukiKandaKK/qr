import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { parse, Kind } from 'graphql';
import depthLimit from 'graphql-depth-limit';
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
    validationRules: [depthLimit(config.GRAPHQL_MAX_DEPTH)],
    formatError: (formattedError, error) => {
      logger.error({ err: error }, 'GraphQL error');
      return formattedError;
    },
  });

  await server.start();

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: config.NODE_ENV === 'production' }));

  const corsOriginValue = config.CORS_ORIGIN.toLowerCase();
  const corsOrigin =
    corsOriginValue === '*' ? true : corsOriginValue === 'false' ? false : config.CORS_ORIGIN;

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const authRateLimit = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) =>
      config.NODE_ENV === 'test' ||
      config.RATE_LIMIT_DISABLED ||
      !isAuthMutation(req),
    message: 'Too many authentication requests, please try again later.',
  });

  app.use(
    '/graphql',
    cors<express.Request>({ origin: corsOrigin, credentials: config.CORS_CREDENTIALS }),
    express.json(),
    authRateLimit,
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

interface GraphqlRequestBody {
  query?: string;
}

function isAuthMutation(req: express.Request): boolean {
  const body = req.body as GraphqlRequestBody | GraphqlRequestBody[] | undefined;
  if (!body) return false;
  if (Array.isArray(body)) return body.some(isSingleAuthMutation);
  return isSingleAuthMutation(body);
}

function isSingleAuthMutation(body: GraphqlRequestBody): boolean {
  if (typeof body.query !== 'string') return false;
  try {
    const document = parse(body.query);
    return document.definitions.some((def) => {
      if (
        def.kind !== Kind.OPERATION_DEFINITION ||
        def.operation !== 'mutation'
      ) {
        return false;
      }
      return def.selectionSet.selections.some((sel) => {
        if (sel.kind !== Kind.FIELD) return false;
        return sel.name.value === 'register' || sel.name.value === 'login';
      });
    });
  } catch {
    return false;
  }
}
