import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { PrismaRssRepository } from '../features/rss/repository';
import { RssService } from '../features/rss/service';
import { logger } from '../config/logger';

async function main() {
  const repository = new PrismaRssRepository(prisma);
  const service = new RssService(repository, logger);

  const results = await service.fetchFeeds();
  let hadError = false;

  for (const result of results) {
    if (result.error) {
      hadError = true;
      console.error(`[${result.feedName}] error: ${result.error}`);
    } else {
      console.log(
        `[${result.feedName}] inserted=${result.inserted}, updated=${result.updated}`,
      );
    }
  }

  if (hadError) {
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
