import 'dotenv/config';
import { createApp } from './app';
import { config } from './config/config';
import { logger } from './config/logger';
import { prisma } from './lib/prisma';

async function main() {
  try {
    await prisma.$connect();
    const app = await createApp();

    const server = app.listen(config.PORT, '0.0.0.0', () => {
      logger.info(`Server ready at http://0.0.0.0:${config.PORT}/graphql`);
    });

    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'shutting down');
      server.close();
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error(err, 'failed to start server');
    process.exit(1);
  }
}

main();
