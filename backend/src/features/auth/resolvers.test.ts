/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApolloServer } from '@apollo/server';
import { typeDefs } from '../../graphql/schema';
import { createAuthResolvers } from './resolvers';
import { AuthService } from './service';
import { InMemoryUserRepository } from './repository';
import { User } from './domain';

interface ExecutionResponse {
  data: Record<string, any> | null;
  errors: readonly any[] | undefined;
}

describe('Auth GraphQL resolvers', () => {
  let server: ApolloServer;
  let authService: AuthService;
  let userRepo: InMemoryUserRepository;

  beforeEach(async () => {
    userRepo = new InMemoryUserRepository();
    authService = new AuthService(userRepo, 'test-secret', '1h');
    server = new ApolloServer({
      typeDefs,
      resolvers: createAuthResolvers(authService),
    });
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  const execute = async (
    query: string,
    variables?: Record<string, unknown>,
    contextValue?: { user?: User },
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

  it('registers a user and returns a token', async () => {
    const result = await execute(`
      mutation {
        register(input: { email: "test@example.com", password: "Password123" }) {
          token
          user { id email role }
        }
      }
    `);
    expect(result.errors).toBeUndefined();
    expect(result.data?.register.user.email).toBe('test@example.com');
    expect(result.data?.register.user.role).toBe('ADMIN');
    expect(result.data?.register.token).toBeDefined();
  });

  it('logs in an existing user', async () => {
    await authService.register({
      email: 'test@example.com',
      password: 'Password123',
    });
    const result = await execute(`
      mutation {
        login(input: { email: "test@example.com", password: "Password123" }) {
          token
          user { email role }
        }
      }
    `);
    expect(result.errors).toBeUndefined();
    expect(result.data?.login.user.email).toBe('test@example.com');
  });

  it('rejects login with invalid credentials', async () => {
    const result = await execute(`
      mutation {
        login(input: { email: "unknown@example.com", password: "Password123" }) {
          token
        }
      }
    `);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(result.errors?.[0].message).toContain('Invalid email or password');
  });

  it('returns the current user from me', async () => {
    const user = await authService.register({
      email: 'test@example.com',
      password: 'Password123',
    });
    const result = await execute(
      `query { me { id email role } }`,
      {},
      { user },
    );
    expect(result.errors).toBeUndefined();
    expect(result.data?.me.email).toBe('test@example.com');
    expect(result.data?.me.role).toBe('ADMIN');
  });

  it('returns null for me when unauthenticated', async () => {
    const result = await execute(`query { me { id } }`);
    expect(result.errors).toBeUndefined();
    expect(result.data?.me).toBeNull();
  });
});
