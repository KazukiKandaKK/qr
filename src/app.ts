import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { typeDefs } from './graphql/schema';
import { createQrCodeResolvers } from './features/qrCode/resolvers';
import { QrCodeService } from './features/qrCode/service';
import { PrismaQrCodeRepository } from './features/qrCode/repository';
import { prisma } from './lib/prisma';
import { config } from './config/config';
import { logger } from './config/logger';
import type pino from 'pino';

export interface AppContext {
  logger: pino.Logger;
  qrCodeService: QrCodeService;
}

export async function createApp(): Promise<express.Express> {
  const repository = new PrismaQrCodeRepository(prisma);
  const qrCodeService = new QrCodeService(repository, logger);

  const server = new ApolloServer<AppContext>({
    typeDefs,
    resolvers: createQrCodeResolvers(qrCodeService),
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
      context: async (): Promise<AppContext> => ({
        logger,
        qrCodeService,
      }),
    }),
  );

  return app;
}
