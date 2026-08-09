import { AuthService } from './service';
import { AuthContext, requireAuth, requireAdmin } from './guards';
import { AuditLogEntry } from './repository';

export const createAuthResolvers = (authService: AuthService) => ({
  AuditLog: {
    metadata: (log: AuditLogEntry) =>
      log.metadata ? JSON.stringify(log.metadata) : null,
  },
  Query: {
    me: (_: unknown, __: unknown, ctx: AuthContext) => ctx?.user ?? null,
    auditLogs: (
      _: unknown,
      args: { limit?: number; offset?: number },
      ctx: AuthContext,
    ) => {
      const user = requireAdmin(ctx);
      return authService.listAuditLogs(user, args);
    },
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
    exportMyData: async (_: unknown, __: unknown, ctx: AuthContext) => {
      const user = requireAuth(ctx);
      return authService.exportMyData(user.id);
    },
    deleteMyAccount: async (_: unknown, __: unknown, ctx: AuthContext) => {
      const user = requireAuth(ctx);
      await authService.deleteMyAccount(user.id, {
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
      });
      return true;
    },
  },
});
