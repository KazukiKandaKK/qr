/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './service';
import {
  InMemoryUserRepository,
  InMemoryAuditLogRepository,
} from './repository';

const TEST_PASSWORD = 'Password123';

describe('AuthService', () => {
  let userRepo: InMemoryUserRepository;
  let auditRepo: InMemoryAuditLogRepository;
  let service: AuthService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    auditRepo = new InMemoryAuditLogRepository();
    service = new AuthService(userRepo, 'test-secret', '1h', {
      auditLogRepository: auditRepo,
      maxFailedLogins: 3,
      lockoutDurationMs: 15 * 60 * 1000,
    });
  });

  it('registers the first user as admin', async () => {
    const user = await service.register({
      email: 'admin@example.com',
      password: TEST_PASSWORD,
      name: 'Admin',
    });
    expect(user.email).toBe('admin@example.com');
    expect(user.role).toBe('ADMIN');
    expect(user.name).toBe('Admin');
  });

  it('registers subsequent users as USER', async () => {
    await service.register({
      email: 'admin@example.com',
      password: TEST_PASSWORD,
    });
    const user = await service.register({
      email: 'user@example.com',
      password: TEST_PASSWORD,
    });
    expect(user.role).toBe('USER');
  });

  it('rejects duplicate email registration', async () => {
    await service.register({ email: 'a@example.com', password: TEST_PASSWORD });
    await expect(
      service.register({ email: 'a@example.com', password: TEST_PASSWORD }),
    ).rejects.toThrow('Email already registered');
  });

  it('rejects registration with short password', async () => {
    await expect(
      service.register({ email: 'a@example.com', password: 'short' }),
    ).rejects.toThrow();
  });

  it('rejects registration with weak password without uppercase', async () => {
    await expect(
      service.register({ email: 'a@example.com', password: 'password123' }),
    ).rejects.toThrow(/uppercase/);
  });

  it('rejects registration with invalid email', async () => {
    await expect(
      service.register({ email: 'not-an-email', password: TEST_PASSWORD }),
    ).rejects.toThrow();
  });

  it('logs in with valid credentials and returns a token', async () => {
    await service.register({
      email: 'a@example.com',
      password: TEST_PASSWORD,
    });
    const payload = await service.login({
      email: 'a@example.com',
      password: TEST_PASSWORD,
    });
    expect(payload.token).toBeDefined();
    expect(payload.user.email).toBe('a@example.com');
  });

  it('rejects login with wrong password', async () => {
    await service.register({
      email: 'a@example.com',
      password: TEST_PASSWORD,
    });
    await expect(
      service.login({ email: 'a@example.com', password: 'WrongPass123' }),
    ).rejects.toThrow('Invalid email or password');
  });

  it('rejects login for unknown email', async () => {
    await expect(
      service.login({ email: 'unknown@example.com', password: TEST_PASSWORD }),
    ).rejects.toThrow('Invalid email or password');
  });

  it('locks an account after too many failed login attempts', async () => {
    await service.register({ email: 'a@example.com', password: TEST_PASSWORD });

    for (let i = 0; i < 3; i += 1) {
      await expect(
        service.login({ email: 'a@example.com', password: 'WrongPass123' }),
      ).rejects.toThrow('Invalid email or password');
    }

    await expect(
      service.login({ email: 'a@example.com', password: TEST_PASSWORD }),
    ).rejects.toThrow('Account temporarily locked');
  });

  it('resets failed attempts after a successful login', async () => {
    await service.register({ email: 'a@example.com', password: TEST_PASSWORD });

    await expect(
      service.login({ email: 'a@example.com', password: 'WrongPass123' }),
    ).rejects.toThrow('Invalid email or password');

    const payload = await service.login({
      email: 'a@example.com',
      password: TEST_PASSWORD,
    });
    expect(payload.user.email).toBe('a@example.com');

    await expect(
      service.login({ email: 'a@example.com', password: 'WrongPass123' }),
    ).rejects.toThrow('Invalid email or password');
    await expect(
      service.login({ email: 'a@example.com', password: TEST_PASSWORD }),
    ).resolves.toBeDefined();
  });

  it('resets lockout after the lock duration expires', async () => {
    vi.useFakeTimers();
    await service.register({ email: 'a@example.com', password: TEST_PASSWORD });

    for (let i = 0; i < 3; i += 1) {
      await expect(
        service.login({ email: 'a@example.com', password: 'WrongPass123' }),
      ).rejects.toThrow('Invalid email or password');
    }

    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    const payload = await service.login({
      email: 'a@example.com',
      password: TEST_PASSWORD,
    });
    expect(payload.user.email).toBe('a@example.com');

    vi.useRealTimers();
  });

  it('writes audit logs for auth events', async () => {
    await service.register({
      email: 'a@example.com',
      password: TEST_PASSWORD,
    });
    await service.login({
      email: 'a@example.com',
      password: 'WrongPass123',
    }).catch(() => {});

    const actions = auditRepo.getLogs().map((entry) => entry.action);
    expect(actions).toContain('REGISTER');
    expect(actions).toContain('LOGIN_FAILURE');
  });

  it('verifies a valid token', async () => {
    const user = await service.register({
      email: 'a@example.com',
      password: TEST_PASSWORD,
    });
    const token = service.issueToken(user);
    const verified = await service.verifyToken(token);
    expect(verified?.id).toBe(user.id);
    expect(verified?.email).toBe(user.email);
  });

  it('returns null for an invalid token', async () => {
    const verified = await service.verifyToken('invalid-token');
    expect(verified).toBeNull();
  });

  it('returns null for a tampered token', async () => {
    const user = await service.register({
      email: 'a@example.com',
      password: TEST_PASSWORD,
    });
    const token = service.issueToken(user);
    const verified = await service.verifyToken(`${token}tampered`);
    expect(verified).toBeNull();
  });

  it('exports user data with audit logs', async () => {
    const user = await service.register({
      email: 'a@example.com',
      password: TEST_PASSWORD,
    });
    await service.login({ email: 'a@example.com', password: TEST_PASSWORD });

    const exported = await service.exportMyData(user.id);
    expect(exported.user.email).toBe('a@example.com');
    expect(exported.auditLogs.length).toBeGreaterThanOrEqual(2);
  });

  it('deletes the user account and related audit logs', async () => {
    const user = await service.register({
      email: 'a@example.com',
      password: TEST_PASSWORD,
    });
    await service.deleteMyAccount(user.id);

    expect(await service.verifyToken(service.issueToken(user))).toBeNull();
    expect(await service.exportMyData(user.id).catch((e) => e.message)).toBe(
      'User not found',
    );
  });

  it('allows admins to list audit logs', async () => {
    const admin = await service.register({
      email: 'admin@example.com',
      password: TEST_PASSWORD,
    });
    const logs = await service.listAuditLogs(admin, { limit: 10 });
    expect(logs.length).toBeGreaterThan(0);
  });

  it('prevents non-admins from listing audit logs', async () => {
    await service.register({
      email: 'admin@example.com',
      password: TEST_PASSWORD,
    });
    const user = await service.register({
      email: 'user@example.com',
      password: TEST_PASSWORD,
    });
    await expect(
      service.listAuditLogs(user, { limit: 10 }),
    ).rejects.toThrow('Forbidden');
  });
});
