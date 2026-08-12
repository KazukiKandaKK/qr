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
import { createRssLoaders, type RssLoaders } from './features/rss/loaders';
import { AuthService } from './features/auth/service';
import { createAuthResolvers } from './features/auth/resolvers';
import { AuthContext } from './features/auth/guards';
import { config } from './config/config';
import { createAppContainer, ContainerOverrides } from './lib/container';
import { logger } from './config/logger';
import type pino from 'pino';

export interface AppContext extends AuthContext {
  logger: pino.Logger;
  rssService: RssService;
  loaders: RssLoaders;
}

export type CreateAppOptions = ContainerOverrides;

export async function createApp(
  options: CreateAppOptions = {},
): Promise<express.Express> {
  const container = createAppContainer(options);
  const rssService = container.cradle.rssService;
  const authService = container.cradle.authService;
  const loaders = createRssLoaders(container.cradle.repository);

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
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      xFrameOptions: { action: 'deny' },
    }),
  );

  const corsOriginValue = config.CORS_ORIGIN.toLowerCase();
  const corsOrigin =
    corsOriginValue === '*' ? true : corsOriginValue === 'false' ? false : config.CORS_ORIGIN;

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/.well-known/security.txt', (_req, res) => {
    res.type('text/plain');
    res.send(securityTxt());
  });
  app.get('/security.txt', (_req, res) => {
    res.redirect('/.well-known/security.txt');
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
        return {
          logger,
          rssService,
          loaders,
          user: user ?? undefined,
          ip: getClientIp(req),
          userAgent: req.headers['user-agent'],
        };
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

function getClientIp(req: express.Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) {
    return forwarded[0]?.split(',')[0]?.trim();
  }
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? undefined;
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

function securityTxt(): string {
  return [
    'Contact: mailto:security@example.com',
    'Expires: 2027-12-31T00:00:00.000Z',
    'Acknowledgments: /security-acknowledgments',
    'Policy: /security-policy',
    '',
    '# This is a sample security.txt for ISO 27017 readiness.',
    '# Replace the contact and policy URLs with real values before production.',
  ].join('\n');
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
