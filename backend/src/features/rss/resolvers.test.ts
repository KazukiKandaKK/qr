/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApolloServer } from '@apollo/server';
import { typeDefs } from '../../graphql/schema';
import { createRssResolvers, type RssContext } from './resolvers';
import { RssService } from './service';
import { InMemoryRssRepository } from './repository';
import { createRssLoaders, type RssLoaders } from './loaders';
import { InMemoryUserRepository } from '../auth/repository';
import { AuthService } from '../auth/service';
import { type User } from '../auth/domain';
import pino from 'pino';

interface ExecutionResponse {
  data: Record<string, any> | null;
  errors: readonly any[] | undefined;
}

describe('GraphQL resolvers', () => {
  let server: ApolloServer<RssContext>;
  let service: RssService;
  let repo: InMemoryRssRepository;
  let loaders: RssLoaders;
  let adminUser: User;

  beforeEach(async () => {
    repo = new InMemoryRssRepository();
    service = new RssService(repo, pino({ level: 'silent' }));
    loaders = createRssLoaders(repo);
    server = new ApolloServer({
      typeDefs,
      resolvers: createRssResolvers(service),
    });
    await server.start();

    const userRepo = new InMemoryUserRepository();
    const authService = new AuthService(userRepo, 'test-secret', '1h');
    adminUser = await authService.register({
      email: 'admin@example.com',
      password: 'Password123',
      name: 'Admin',
    });
  });

  afterEach(async () => {
    await server.stop();
  });

  const execute = async (
    query: string,
    variables?: Record<string, unknown>,
    contextValue: Partial<RssContext> & { loaders: RssLoaders } = {
      user: adminUser,
      loaders,
    },
  ): Promise<ExecutionResponse> => {
    const result = await server.executeOperation(
      { query, variables },
      { contextValue },
    );
    if (result.body.kind !== 'single') {
      return { data: null, errors: [] };
    }
    return {
      data: result.body.singleResult.data as Record<string, any> | null,
      errors: result.body.singleResult.errors,
    };
  };

  it('creates and lists feeds', async () => {
    const createResult = await execute(`
      mutation {
        createFeed(input: { name: "A", url: "https://example.com/a", category: "News" }) {
          id
          name
        }
      }
    `);
    expect(createResult.errors).toBeUndefined();
    expect(createResult.data?.createFeed.name).toBe('A');

    const listResult = await execute(`
      query { feeds { id name } }
    `);
    expect(listResult.errors).toBeUndefined();
    expect(listResult.data?.feeds).toHaveLength(1);
  });

  it('rejects unauthenticated createFeed', async () => {
    const result = await execute(
      `
      mutation {
        createFeed(input: { name: "A", url: "https://example.com/a", category: "News" }) {
          id
        }
      }
    `,
      {},
      { user: undefined, loaders },
    );
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toBe('Unauthorized');
  });

  it('rejects non-admin deleteFeed and deleteArticle', async () => {
    const createResult = await execute(`
      mutation {
        createFeed(input: { name: "A", url: "https://example.com/a", category: "News" }) {
          id
        }
      }
    `);
    const feedId = createResult.data?.createFeed.id as string;

    const article = await repo.createArticle({
      feedId,
      title: 'A',
      link: 'https://example.com/1',
      snippet: 'x',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: false,
      isStarred: false,
    });

    const normalUser: User = {
      id: 'user-1',
      email: 'user@example.com',
      name: null,
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const deleteFeedResult = await execute(
      `
      mutation ($id: ID!) {
        deleteFeed(id: $id)
      }
    `,
      { id: feedId },
      { user: normalUser, loaders },
    );
    expect(deleteFeedResult.errors?.[0].message).toBe('Forbidden');

    const deleteArticleResult = await execute(
      `
      mutation ($id: ID!) {
        deleteArticle(id: $id)
      }
    `,
      { id: article.id },
      { user: normalUser, loaders },
    );
    expect(deleteArticleResult.errors?.[0].message).toBe('Forbidden');
  });

  it('returns a feed by id', async () => {
    const createResult = await execute(`
      mutation {
        createFeed(input: { name: "A", url: "https://example.com/a", category: "News" }) {
          id
        }
      }
    `);
    const id = createResult.data?.createFeed.id as string;

    const feedResult = await execute(
      `
      query ($id: ID!) {
        feed(id: $id) { id name }
      }
    `,
      { id },
    );
    expect(feedResult.errors).toBeUndefined();
    expect(feedResult.data?.feed.name).toBe('A');
  });

  it('returns null for unknown feed', async () => {
    const result = await execute(`
      query { feed(id: "missing") { id } }
    `);
    expect(result.data?.feed).toBeNull();
  });

  it('filters articles by keyword', async () => {
    const feedResult = await execute(`
      mutation {
        createFeed(input: { name: "A", url: "https://example.com/a", category: "News" }) {
          id
        }
      }
    `);
    const feedId = feedResult.data?.createFeed.id as string;

    await repo.createArticle({
      feedId,
      title: 'Security Alert',
      link: 'https://example.com/1',
      snippet: 'x',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: false,
      isStarred: false,
    });
    await repo.createArticle({
      feedId,
      title: 'Other',
      link: 'https://example.com/2',
      snippet: 'security patch',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: false,
      isStarred: false,
    });

    const result = await execute(
      `
      query ($keyword: String) {
        articles(filter: { keyword: $keyword }) { title }
      }
    `,
      { keyword: 'security' },
    );
    expect(result.errors).toBeUndefined();
    expect(result.data?.articles).toHaveLength(2);
  });

  it('marks an article as read', async () => {
    const feedResult = await execute(`
      mutation {
        createFeed(input: { name: "A", url: "https://example.com/a", category: "News" }) {
          id
        }
      }
    `);
    const feedId = feedResult.data?.createFeed.id as string;
    const article = await repo.createArticle({
      feedId,
      title: 'A',
      link: 'https://example.com/1',
      snippet: 'x',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: false,
      isStarred: false,
    });

    const result = await execute(
      `
      mutation ($id: ID!) {
        markArticleRead(id: $id, isRead: true) { id isRead }
      }
    `,
      { id: article.id },
    );
    expect(result.errors).toBeUndefined();
    expect(result.data?.markArticleRead.isRead).toBe(true);
  });

  it('returns stats', async () => {
    await execute(`
      mutation {
        createFeed(input: { name: "A", url: "https://example.com/a", category: "News" }) {
          id
        }
      }
    `);

    const result = await execute(`
      query {
        stats { feedCount articleCount readCount unreadCount starredCount }
      }
    `);
    expect(result.errors).toBeUndefined();
    expect(result.data?.stats).toEqual({
      feedCount: 1,
      articleCount: 0,
      readCount: 0,
      unreadCount: 0,
      starredCount: 0,
    });
  });

  it('deletes a feed', async () => {
    const createResult = await execute(`
      mutation {
        createFeed(input: { name: "A", url: "https://example.com/a", category: "News" }) {
          id
        }
      }
    `);
    const id = createResult.data?.createFeed.id as string;

    const deleteResult = await execute(
      `
      mutation ($id: ID!) {
        deleteFeed(id: $id)
      }
    `,
      { id },
    );
    expect(deleteResult.errors).toBeUndefined();
    expect(deleteResult.data?.deleteFeed).toBe(true);
  });

  it('updates a feed', async () => {
    const createResult = await execute(`
      mutation {
        createFeed(input: { name: "A", url: "https://example.com/a", category: "News" }) {
          id
        }
      }
    `);
    const id = createResult.data?.createFeed.id as string;

    const updateResult = await execute(
      `
      mutation ($id: ID!) {
        updateFeed(id: $id, input: { name: "B" }) { id name }
      }
    `,
      { id },
    );
    expect(updateResult.errors).toBeUndefined();
    expect(updateResult.data?.updateFeed.name).toBe('B');
  });

  it('marks an article as starred', async () => {
    const feedResult = await execute(`
      mutation {
        createFeed(input: { name: "A", url: "https://example.com/a", category: "News" }) {
          id
        }
      }
    `);
    const feedId = feedResult.data?.createFeed.id as string;
    const article = await repo.createArticle({
      feedId,
      title: 'A',
      link: 'https://example.com/1',
      snippet: 'x',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: false,
      isStarred: false,
    });

    const result = await execute(
      `
      mutation ($id: ID!) {
        markArticleStarred(id: $id, isStarred: true) { id isStarred }
      }
    `,
      { id: article.id },
    );
    expect(result.errors).toBeUndefined();
    expect(result.data?.markArticleStarred.isStarred).toBe(true);
  });

  it('deletes an article', async () => {
    const feedResult = await execute(`
      mutation {
        createFeed(input: { name: "A", url: "https://example.com/a", category: "News" }) {
          id
        }
      }
    `);
    const feedId = feedResult.data?.createFeed.id as string;
    const article = await repo.createArticle({
      feedId,
      title: 'A',
      link: 'https://example.com/1',
      snippet: 'x',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: false,
      isStarred: false,
    });

    const result = await execute(
      `
      mutation ($id: ID!) {
        deleteArticle(id: $id)
      }
    `,
      { id: article.id },
    );
    expect(result.errors).toBeUndefined();
    expect(result.data?.deleteArticle).toBe(true);
  });

  it('returns feed articles and article feed', async () => {
    const createResult = await execute(`
      mutation {
        createFeed(input: { name: "A", url: "https://example.com/a", category: "News" }) {
          id
        }
      }
    `);
    const feedId = createResult.data?.createFeed.id as string;
    const article = await repo.createArticle({
      feedId,
      title: 'A',
      link: 'https://example.com/1',
      snippet: 'x',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      isRead: false,
      isStarred: false,
    });

    const feedWithArticles = await execute(
      `
      query ($id: ID!) {
        feed(id: $id) {
          id
          articles { id title }
        }
      }
    `,
      { id: feedId },
    );
    expect(feedWithArticles.errors).toBeUndefined();
    expect(feedWithArticles.data?.feed.articles).toHaveLength(1);

    const articleWithFeed = await execute(
      `
      query ($id: ID!) {
        article(id: $id) {
          id
          feed { name }
        }
      }
    `,
      { id: article.id },
    );
    expect(articleWithFeed.errors).toBeUndefined();
    expect(articleWithFeed.data?.article.feed.name).toBe('A');
  });

  it('fetches feeds via resolver', async () => {
    await repo.createFeed({
      name: 'A',
      url: 'https://example.com/a',
      category: 'News',
    });
    const fakeFetcher = async (_url: string) => [
      {
        title: 'T',
        link: 'https://example.com/1',
        snippet: 's',
        publishedAt: new Date(),
      },
    ];
    const fetchService = new RssService(repo, pino({ level: 'silent' }), fakeFetcher);
    const fetchServer = new ApolloServer<RssContext>({
      typeDefs,
      resolvers: createRssResolvers(fetchService),
    });
    await fetchServer.start();

    const result = await fetchServer.executeOperation(
      {
        query: `
          mutation {
            fetchFeeds { feedName inserted updated }
          }
        `,
      },
      { contextValue: { user: adminUser, loaders } },
    );

    if (result.body.kind !== 'single') {
      expect(true).toBe(false);
      return;
    }
    const data = result.body.singleResult.data as Record<string, any> | null;
    expect(result.body.singleResult.errors).toBeUndefined();
    expect(data?.fetchFeeds).toHaveLength(1);
    expect(data?.fetchFeeds[0].inserted).toBe(1);

    await fetchServer.stop();
  });
});
