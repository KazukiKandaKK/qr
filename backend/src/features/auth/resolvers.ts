import { AuthService } from './service';
import { AuthContext } from './guards';

export const createAuthResolvers = (authService: AuthService) => ({
  Query: {
    me: (_: unknown, __: unknown, ctx: AuthContext) => ctx.user ?? null,
  },
  Mutation: {
    register: async (
      _: unknown,
      args: { input: { email: string; password: string; name?: string } },
    ) => {
      const user = await authService.register(args.input);
      return {
        token: authService.issueToken(user),
        user,
      };
    },
    login: async (
      _: unknown,
      args: { input: { email: string; password: string } },
    ) => authService.login(args.input),
  },
});
