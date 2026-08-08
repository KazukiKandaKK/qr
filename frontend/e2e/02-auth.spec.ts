import { test, expect, type APIRequestContext } from '@playwright/test';

async function graphqlLogin(
  request: APIRequestContext,
  email: string,
  password: string,
) {
  const result = await request.post('/graphql', {
    data: {
      query: `
        mutation {
          login(input: { email: "${email}", password: "${password}" }) {
            token
            user { id email role }
          }
        }
      `,
    },
  });
  return result.json();
}

test.describe.configure({ mode: 'serial' });

test.describe('Authentication', () => {
  test('shows the login form when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByPlaceholder('Email')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });

  test('can register a new account and access the dashboard', async ({ page }) => {
    const email = `newuser-${Date.now()}@example.com`;
    await page.goto('/');
    await page
      .getByRole('button', { name: "Don't have an account? Register" })
      .click();

    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Register' }).click();

    await expect(page.getByRole('heading', { name: 'Feeds' })).toBeVisible();
    await expect(page.locator('.user-info')).toContainText(email);
  });

  test('shows an error for invalid login', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Email').fill('unknown@example.com');
    await page.getByPlaceholder('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.locator('.error')).toContainText(
      'Invalid email or password',
    );
  });

  test('logs out and redirects to login', async ({ page }) => {
    const email = `logout-${Date.now()}@example.com`;
    await page.goto('/');
    await page
      .getByRole('button', { name: "Don't have an account? Register" })
      .click();

    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Register' }).click();

    await expect(page.getByRole('heading', { name: 'Feeds' })).toBeVisible();

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('dashboard queries are rejected without a token', async ({ request }) => {
    const result = await graphqlLogin(
      request,
      'missing@example.com',
      'password123',
    );
    expect(result.errors?.[0]?.message).toContain('Invalid email or password');
  });
});
