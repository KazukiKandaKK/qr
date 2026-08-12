import {
  createContainer,
  asClass,
  asValue,
  InjectionMode,
} from 'awilix';
import { PrismaRssRepository, RssRepository } from '../features/rss/repository';
import { RssService } from '../features/rss/service';
import { parseFeed } from '../lib/rssParser';
import {
  PrismaUserRepository,
  UserRepository,
  PrismaAuditLogRepository,
  AuditLogRepository,
} from '../features/auth/repository';
import { AuthService } from '../features/auth/service';
import { prisma } from './prisma';
import { logger } from '../config/logger';
import { config } from '../config/config';

export interface ContainerOverrides {
  repository?: RssRepository;
  userRepository?: UserRepository;
  auditLogRepository?: AuditLogRepository;
}

function createAuthServiceOptions(
  auditLogRepository: AuditLogRepository,
): ConstructorParameters<typeof AuthService>[3] {
  return {
    auditLogRepository,
    maxFailedLogins: config.AUTH_MAX_FAILED_LOGINS,
    lockoutDurationMs: config.AUTH_LOCKOUT_DURATION_MS,
  };
}

export function createAppContainer(overrides: ContainerOverrides = {}) {
  const container = createContainer({
    injectionMode: InjectionMode.CLASSIC,
  })
    .register({
      prisma: asValue(prisma),
      logger: asValue(logger),
      jwtSecret: asValue(config.JWT_SECRET),
      jwtExpiresIn: asValue(config.JWT_EXPIRES_IN),
      fetchFeedFn: asValue(parseFeed),
    })
    .register({
      repository: asClass<RssRepository>(PrismaRssRepository)
        .classic()
        .singleton(),
      userRepository: asClass<UserRepository>(PrismaUserRepository)
        .classic()
        .singleton(),
      auditLogRepository: asClass<AuditLogRepository>(PrismaAuditLogRepository)
        .classic()
        .singleton(),
    })
    .register({
      rssService: asClass(RssService).classic().singleton(),
      authService: asClass(AuthService)
        .classic()
        .singleton()
        .inject((c) => ({
          options: createAuthServiceOptions(
            c.resolve<AuditLogRepository>('auditLogRepository'),
          ),
        })),
    });

  if (overrides.repository) {
    container.register({ repository: asValue(overrides.repository) });
  }
  if (overrides.userRepository) {
    container.register({ userRepository: asValue(overrides.userRepository) });
  }
  if (overrides.auditLogRepository) {
    container.register({
      auditLogRepository: asValue(overrides.auditLogRepository),
    });
  }

  return container;
}
