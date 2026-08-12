import { expect } from '@playwright/test';
import type { Page, Locator, TestInfo } from '@playwright/test';

export class DashboardPage {
  private readonly page: Page;
  private readonly testInfo: TestInfo;

  constructor(page: Page, testInfo: TestInfo) {
    this.page = page;
    this.testInfo = testInfo;
  }

  async gotoLogin() {
    await this.page.goto('/');
    await this.page.evaluate(() => localStorage.clear());
    await this.page.reload();
  }

  async loginWithToken(token: string) {
    await this.page.evaluate((t) => localStorage.setItem('token', t), token);
    await this.page.goto('/');
    await this.expectLoaded();
  }

  async expectLoaded() {
    await expect(this.page.getByRole('heading', { name: 'Feeds' })).toBeVisible();
  }

  async screenshot(name: string) {
    await this.page.screenshot({
      path: this.testInfo.outputPath(name),
      fullPage: true,
    });
  }

  async addFeed(name: string, url: string, category: string) {
    await this.page.getByPlaceholder('Name').fill(name);
    await this.page.getByPlaceholder('URL').fill(url);
    await this.page.getByPlaceholder('Category').fill(category);
    await this.page.getByRole('button', { name: 'Add Feed' }).click();
  }

  feedItem(name: string): Locator {
    return this.page.locator('.feed-list li', { hasText: name });
  }

  async fetchFeeds() {
    await this.page.getByRole('button', { name: 'Fetch feeds' }).click();
  }

  articleItem(title: string): Locator {
    return this.page.locator('.article-list li', { hasText: title });
  }

  async markRead(article: Locator) {
    await article.getByRole('button', { name: 'Mark read' }).click();
  }

  async markStarred(article: Locator) {
    await article.getByRole('button', { name: 'Star' }).click();
  }

  async deleteArticle(article: Locator) {
    await article.getByRole('button', { name: 'Delete' }).click();
  }

  async logout() {
    await this.page.getByRole('button', { name: 'Logout' }).click();
    await expect(this.page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  }
}
