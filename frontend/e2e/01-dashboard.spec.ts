import { test, expect } from '@playwright/test';
import { startLocalRssServer } from './helpers/rssServer.js';


test.describe.configure({ mode: 'serial' });

test.describe('RSS Security Dashboard', () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    const email = 'e2e-admin@example.com';
    const password = 'Password123';
    const register = await request.post('/graphql', {
      data: {
        query: `
          mutation {
            register(input: { email: "${email}", password: "${password}", name: "E2E Admin" }) {
              token
              user { id role }
            }
          }
        `,
      },
    });
    const registerJson = await register.json();
    if (registerJson.data?.register?.token) {
      adminToken = registerJson.data.register.token;
    } else {
      const login = await request.post('/graphql', {
        data: {
          query: `
            mutation {
              login(input: { email: "${email}", password: "${password}" }) {
                token
              }
            }
          `,
        },
      });
      const loginJson = await login.json();
      adminToken = loginJson.data.login.token;
    }
  });

  test.beforeEach(async ({ page, request }) => {
    const authHeaders = { Authorization: `Bearer ${adminToken}` };

    const listResult = await request.post('/graphql', {
      headers: authHeaders,
      data: {
        query: `
          query {
            feeds { id }
            articles { id }
          }
        `,
      },
    });
    const listData = (await listResult.json()).data as {
      feeds: { id: string }[];
      articles: { id: string }[];
    };

    for (const article of listData.articles) {
      await request.post('/graphql', {
        headers: authHeaders,
        data: {
          query: `mutation { deleteArticle(id: "${article.id}") }`,
        },
      });
    }
    for (const feed of listData.feeds) {
      await request.post('/graphql', {
        headers: authHeaders,
        data: {
          query: `mutation { deleteFeed(id: "${feed.id}") }`,
        },
      });
    }

    await page.addInitScript((token: string) => {
      localStorage.setItem('token', token);
    }, adminToken);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Feeds' })).toBeVisible();
  });

  test('displays empty state with zero stats', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Feeds' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Articles/ })).toBeVisible();
    const statValues = page.locator('.stats-grid strong');
    await expect(statValues).toHaveCount(4);
    for (let i = 0; i < 4; i += 1) {
      await expect(statValues.nth(i)).toHaveText('0');
    }
  });

  test('creates a feed and shows it in the feed list', async ({ page }) => {
    await page.getByPlaceholder('Name').fill('Test Feed');
    await page.getByPlaceholder('URL').fill('https://example.com/feed.xml');
    await page.getByPlaceholder('Category').fill('Test');
    await page.getByRole('button', { name: 'Add Feed' }).click();

    const feedItem = page.locator('.feed-list li', { hasText: 'Test Feed' });
    await expect(feedItem).toBeVisible();
    await expect(feedItem).toContainText('Test');
    await expect(feedItem).toContainText('https://example.com/feed.xml');
  });

  test('fetches articles from a feed and toggles read/star/delete states', async ({ page }) => {
    const { server, port } = await startLocalRssServer(`
      <item>
        <title>Test Article</title>
        <link>https://example.com/article</link>
        <description>This is a test article.</description>
        <pubDate>Mon, 01 Aug 2026 00:00:00 GMT</pubDate>
      </item>
    `);

    try {
      await page.getByPlaceholder('Name').fill('Local Feed');
      await page.getByPlaceholder('URL').fill(`http://localhost:${port}/feed`);
      await page.getByPlaceholder('Category').fill('Local');
      await page.getByRole('button', { name: 'Add Feed' }).click();

      await page.getByRole('button', { name: 'Fetch feeds' }).click();

      const article = page.locator('.article-list li', {
        hasText: 'Test Article',
      });
      await expect(article).toBeVisible();
      await expect(article).toContainText('This is a test article.');

      await article.getByRole('button', { name: 'Mark read' }).click();
      await expect(article).toHaveClass(/read/);
      await expect(
        article.getByRole('button', { name: 'Mark unread' }),
      ).toBeVisible();

      await article.getByRole('button', { name: 'Star' }).click();
      await expect(
        article.getByRole('button', { name: 'Unstar' }),
      ).toBeVisible();

      await article.getByRole('button', { name: 'Delete' }).click();
      await expect(article).toHaveCount(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });
});
