import { GraphQLError } from 'graphql';
import { User } from './domain';

export interface AuthContext {
  user?: User;
}

export function requireAuth(ctx: AuthContext): User {
  if (!ctx.user) {
    throw new GraphQLError('Unauthorized', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return ctx.user;
}

export function requireAdmin(ctx: AuthContext): User {
  const user = requireAuth(ctx);
  if (user.role !== 'ADMIN') {
    throw new GraphQLError('Forbidden', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return user;
}
