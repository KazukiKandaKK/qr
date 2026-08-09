import type { PrismaClient } from '@prisma/client';
import { User, UserWithCredentials } from './domain';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByEmailWithHash(email: string): Promise<UserWithCredentials | null>;
  create(data: {
    email: string;
    name?: string | null;
    passwordHash: string;
    role: string;
  }): Promise<User>;
  count(): Promise<number>;
  updateFailedLoginAttempts(
    id: string,
    failedLoginAttempts: number,
    lockedUntil: Date | null,
  ): Promise<void>;
}

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  passwordHash: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as 'ADMIN' | 'USER',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toUserWithCredentials(row: UserRow): UserWithCredentials {
  return {
    ...toUser(row),
    passwordHash: row.passwordHash,
    failedLoginAttempts: row.failedLoginAttempts,
    lockedUntil: row.lockedUntil,
  };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorId?: string;
  actorEmail?: string;
  targetId?: string;
  targetType?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateAuditLogInput {
  action: string;
  actorId?: string;
  actorEmail?: string;
  targetId?: string;
  targetType?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogRepository {
  create(input: CreateAuditLogInput): Promise<AuditLogEntry>;
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
        passwordHash: true,
      },
    });
    return row ? toUser(row as UserRow) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
        passwordHash: true,
      },
    });
    return row ? toUser(row as UserRow) : null;
  }

  async findByEmailWithHash(
    email: string,
  ): Promise<UserWithCredentials | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? toUserWithCredentials(row as UserRow) : null;
  }

  async create(data: {
    email: string;
    name?: string | null;
    passwordHash: string;
    role: string;
  }): Promise<User> {
    const row = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        role: data.role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
        passwordHash: true,
      },
    });
    return toUser(row as UserRow);
  }

  async count(): Promise<number> {
    return this.prisma.user.count();
  }

  async updateFailedLoginAttempts(
    id: string,
    failedLoginAttempts: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts, lockedUntil },
    });
  }
}

interface StoredUser extends User {
  passwordHash: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

export class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, StoredUser>();
  private idSeq = 0;

  private nextId(): string {
    this.idSeq += 1;
    return `user-${this.idSeq}`;
  }

  async findById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    return user ? toUser(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find((u) => u.email === email);
    return user ? toUser(user) : null;
  }

  async findByEmailWithHash(
    email: string,
  ): Promise<UserWithCredentials | null> {
    const user = Array.from(this.users.values()).find((u) => u.email === email);
    return user ? toUserWithCredentials(user) : null;
  }

  async create(data: {
    email: string;
    name?: string | null;
    passwordHash: string;
    role: string;
  }): Promise<User> {
    const now = new Date();
    const user: StoredUser = {
      id: this.nextId(),
      email: data.email,
      name: data.name ?? null,
      role: data.role as 'ADMIN' | 'USER',
      passwordHash: data.passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return toUser(user);
  }

  async count(): Promise<number> {
    return this.users.size;
  }

  async updateFailedLoginAttempts(
    id: string,
    failedLoginAttempts: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    const user = this.users.get(id);
    if (!user) return;
    user.failedLoginAttempts = failedLoginAttempts;
    user.lockedUntil = lockedUntil;
  }
}

function toAuditLog(row: {
  id: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  targetId: string | null;
  targetType: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: string | null;
  createdAt: Date;
}): AuditLogEntry {
  return {
    id: row.id,
    action: row.action,
    actorId: row.actorId ?? undefined,
    actorEmail: row.actorEmail ?? undefined,
    targetId: row.targetId ?? undefined,
    targetType: row.targetType ?? undefined,
    ip: row.ip ?? undefined,
    userAgent: row.userAgent ?? undefined,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
    createdAt: row.createdAt,
  };
}

export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateAuditLogInput): Promise<AuditLogEntry> {
    const row = await this.prisma.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        targetId: input.targetId,
        targetType: input.targetType,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
    return toAuditLog(row);
  }
}

export class InMemoryAuditLogRepository implements AuditLogRepository {
  private logs: AuditLogEntry[] = [];
  private idSeq = 0;

  async create(input: CreateAuditLogInput): Promise<AuditLogEntry> {
    this.idSeq += 1;
    const entry: AuditLogEntry = {
      id: `audit-${this.idSeq}`,
      ...input,
      createdAt: new Date(),
    };
    this.logs.push(entry);
    return entry;
  }

  getLogs(): AuditLogEntry[] {
    return this.logs;
  }
}
