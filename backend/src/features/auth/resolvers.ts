import { AuthService } from './service';
import { AuthContext } from './guards';

export const createAuthResolvers = (authService: AuthService) => ({
  Query: {
    me: (_: unknown, __: unknown, ctx: AuthContext) => ctx?.user ?? null,
  },
  Mutation: {
    register: async (
      _: unknown,
      args: { input: { email: string; password: string; name?: string } },
      ctx: AuthContext,
    ) => {
      const user = await authService.register(args.input, {
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
      });
      return {
        token: authService.issueToken(user),
        user,
      };
    },
    login: async (
      _: unknown,
      args: { input: { email: string; password: string } },
      ctx: AuthContext,
    ) =>
      authService.login(args.input, {
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
      }),
  },
});
