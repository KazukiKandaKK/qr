import { test, expect } from '@playwright/test';
import { ensureAdminUser } from './helpers/auth.js';
import { startLocalRssServer } from './helpers/rssServer.js';
import { DashboardPage } from './pom/DashboardPage.js';

test.describe.configure({ mode: 'serial' });

test.describe('Golden path screenshots', () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    const session = await ensureAdminUser(request);
    adminToken = session.token;
  });

  test('captures key UI states', async ({ page }, testInfo) => {
    const dashboard = new DashboardPage(page, testInfo);

    await dashboard.gotoLogin();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await dashboard.screenshot('01-login.png');

    await dashboard.loginWithToken(adminToken);
    await dashboard.screenshot('02-empty-dashboard.png');

    const { server, port } = await startLocalRssServer(`
      <item>
        <title>Test Article</title>
        <link>https://example.com/article</link>
        <description>This is a test article.</description>
        <pubDate>Mon, 01 Aug 2026 00:00:00 GMT</pubDate>
      </item>
    `);

    try {
      await dashboard.addFeed('Local Feed', `http://localhost:${port}/feed`, 'Local');
      await expect(dashboard.feedItem('Local Feed')).toBeVisible();
      await dashboard.screenshot('03-feed-added.png');

      await dashboard.fetchFeeds();
      const article = dashboard.articleItem('Test Article');
      await expect(article).toBeVisible();
      await dashboard.screenshot('04-article-listed.png');

      await dashboard.markRead(article);
      await expect(article).toHaveClass(/read/);
      await dashboard.screenshot('05-article-read.png');

      await dashboard.markStarred(article);
      await expect(article.getByRole('button', { name: 'Unstar' })).toBeVisible();
      await dashboard.screenshot('06-article-starred.png');

      await dashboard.deleteArticle(article);
      await expect(article).toHaveCount(0);
      await dashboard.screenshot('07-article-deleted.png');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }

    await dashboard.logout();
    await dashboard.screenshot('08-logout.png');
  });
});
