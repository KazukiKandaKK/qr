import type { PrismaClient } from '@prisma/client';
import { User, Role } from './domain';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByEmailWithHash(
    email: string,
  ): Promise<(User & { passwordHash: string }) | null>;
  create(data: {
    email: string;
    name?: string | null;
    passwordHash: string;
    role: Role;
  }): Promise<User>;
  count(): Promise<number>;
}

function toUser(row: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as Role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
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
        createdAt: true,
        updatedAt: true,
      },
    });
    return row ? toUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return row ? toUser(row) : null;
  }

  async findByEmailWithHash(email: string): Promise<(User & { passwordHash: string }) | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row
      ? {
          ...toUser(row),
          passwordHash: row.passwordHash,
        }
      : null;
  }

  async create(data: {
    email: string;
    name?: string | null;
    passwordHash: string;
    role: Role;
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
        createdAt: true,
        updatedAt: true,
      },
    });
    return toUser(row);
  }

  async count(): Promise<number> {
    return this.prisma.user.count();
  }
}

export class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User>();
  private passwordHashes = new Map<string, string>();
  private idSeq = 0;

  private nextId(): string {
    this.idSeq += 1;
    return `user-${this.idSeq}`;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return (
      Array.from(this.users.values()).find((u) => u.email === email) ?? null
    );
  }

  async findByEmailWithHash(
    email: string,
  ): Promise<(User & { passwordHash: string }) | null> {
    const user = await this.findByEmail(email);
    if (!user) return null;
    const passwordHash = this.passwordHashes.get(user.id);
    return passwordHash ? { ...user, passwordHash } : null;
  }

  async create(data: {
    email: string;
    name?: string | null;
    passwordHash: string;
    role: Role;
  }): Promise<User> {
    const now = new Date();
    const user: User = {
      id: this.nextId(),
      email: data.email,
      name: data.name ?? null,
      role: data.role,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    this.passwordHashes.set(user.id, data.passwordHash);
    return user;
  }

  async count(): Promise<number> {
    return this.users.size;
  }
}
