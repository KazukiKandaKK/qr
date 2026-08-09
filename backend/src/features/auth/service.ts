import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { User, AuthPayload, Role, RequestMeta } from './domain';
import {
  UserRepository,
  AuditLogRepository,
  InMemoryAuditLogRepository,
} from './repository';
import { registerInputSchema, loginInputSchema } from './schemas';

export interface AuthServiceOptions {
  auditLogRepository?: AuditLogRepository;
  maxFailedLogins?: number;
  lockoutDurationMs?: number;
}

export class AuthService {
  private readonly auditLogRepository: AuditLogRepository;
  private readonly maxFailedLogins: number;
  private readonly lockoutDurationMs: number;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtSecret: string,
    private readonly jwtExpiresIn: string,
    options: AuthServiceOptions = {},
  ) {
    this.auditLogRepository =
      options.auditLogRepository ?? new InMemoryAuditLogRepository();
    this.maxFailedLogins = options.maxFailedLogins ?? 5;
    this.lockoutDurationMs = options.lockoutDurationMs ?? 15 * 60 * 1000;
  }

  async register(
    input: { email: string; password: string; name?: string },
    requestMeta?: RequestMeta,
  ): Promise<User> {
    const validated = registerInputSchema.parse(input);

    const existing = await this.userRepository.findByEmail(validated.email);
    if (existing) {
      throw new Error('Email already registered');
    }

    const passwordHash = await bcrypt.hash(validated.password, 10);
    const userCount = await this.userRepository.count();
    const role: Role = userCount === 0 ? 'ADMIN' : 'USER';

    const user = await this.userRepository.create({
      email: validated.email,
      name: validated.name,
      passwordHash,
      role,
    });

    await this.auditLogRepository.create({
      action: 'REGISTER',
      actorId: user.id,
      actorEmail: user.email,
      ip: requestMeta?.ip,
      userAgent: requestMeta?.userAgent,
    });

    return user;
  }

  async login(
    input: { email: string; password: string },
    requestMeta?: RequestMeta,
  ): Promise<AuthPayload> {
    const validated = loginInputSchema.parse(input);

    const userWithHash = await this.userRepository.findByEmailWithHash(
      validated.email,
    );
    const now = Date.now();

    const commonAuditFields = {
      ip: requestMeta?.ip,
      userAgent: requestMeta?.userAgent,
    };

    if (!userWithHash) {
      await this.auditLogRepository.create({
        action: 'LOGIN_FAILURE',
        actorEmail: validated.email,
        ...commonAuditFields,
        metadata: { reason: 'UNKNOWN_EMAIL' },
      });
      throw new Error('Invalid email or password');
    }

    if (userWithHash.lockedUntil) {
      if (userWithHash.lockedUntil.getTime() > now) {
        await this.auditLogRepository.create({
          action: 'LOGIN_FAILURE',
          actorId: userWithHash.id,
          actorEmail: userWithHash.email,
          ...commonAuditFields,
          metadata: {
            reason: 'ACCOUNT_LOCKED',
            lockedUntil: userWithHash.lockedUntil.toISOString(),
          },
        });
        throw new Error(
          'Account temporarily locked due to too many failed login attempts',
        );
      }

      await this.userRepository.updateFailedLoginAttempts(
        userWithHash.id,
        0,
        null,
      );
      userWithHash.failedLoginAttempts = 0;
      userWithHash.lockedUntil = null;
    }

    const valid = await bcrypt.compare(
      validated.password,
      userWithHash.passwordHash,
    );
    if (!valid) {
      const attempts = userWithHash.failedLoginAttempts + 1;
      const shouldLock = attempts >= this.maxFailedLogins;
      const lockedUntil = shouldLock
        ? new Date(now + this.lockoutDurationMs)
        : null;

      await this.userRepository.updateFailedLoginAttempts(
        userWithHash.id,
        attempts,
        lockedUntil,
      );

      await this.auditLogRepository.create({
        action: 'LOGIN_FAILURE',
        actorId: userWithHash.id,
        actorEmail: userWithHash.email,
        ...commonAuditFields,
        metadata: {
          reason: 'INVALID_PASSWORD',
          attempts,
          lockedUntil: lockedUntil?.toISOString(),
        },
      });

      if (shouldLock) {
        await this.auditLogRepository.create({
          action: 'ACCOUNT_LOCKED',
          actorId: userWithHash.id,
          actorEmail: userWithHash.email,
          ...commonAuditFields,
          metadata: {
            attempts,
            lockedUntil: lockedUntil!.toISOString(),
          },
        });
      }

      throw new Error('Invalid email or password');
    }

    await this.userRepository.updateFailedLoginAttempts(
      userWithHash.id,
      0,
      null,
    );

    await this.auditLogRepository.create({
      action: 'LOGIN_SUCCESS',
      actorId: userWithHash.id,
      actorEmail: userWithHash.email,
      ...commonAuditFields,
    });

    const {
      passwordHash: _,
      failedLoginAttempts: __,
      lockedUntil: ___,
      ...publicUser
    } = userWithHash;

    return {
      token: this.issueToken(publicUser),
      user: publicUser,
    };
  }

  issueToken(user: User): string {
    return jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn as SignOptions['expiresIn'] },
    );
  }

  async verifyToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as {
        sub: string;
      };
      return this.userRepository.findById(decoded.sub);
    } catch {
      return null;
    }
  }
}
