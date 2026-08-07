import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { defaultFeeds } from '../lib/defaultFeeds';

async function main() {
  for (const seed of defaultFeeds) {
    await prisma.feed.upsert({
      where: { url: seed.url },
      update: {},
      create: seed,
    });
    console.log(`Seeded feed: ${seed.name}`);
  }
  console.log('Seeding complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
