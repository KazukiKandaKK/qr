/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from './service';
import { InMemoryUserRepository } from './repository';

describe('AuthService', () => {
  let userRepo: InMemoryUserRepository;
  let service: AuthService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    service = new AuthService(userRepo, 'test-secret', '1h');
  });

  it('registers the first user as admin', async () => {
    const user = await service.register({
      email: 'admin@example.com',
      password: 'password123',
      name: 'Admin',
    });
    expect(user.email).toBe('admin@example.com');
    expect(user.role).toBe('ADMIN');
    expect(user.name).toBe('Admin');
  });

  it('registers subsequent users as USER', async () => {
    await service.register({
      email: 'admin@example.com',
      password: 'password123',
    });
    const user = await service.register({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(user.role).toBe('USER');
  });

  it('rejects duplicate email registration', async () => {
    await service.register({ email: 'a@example.com', password: 'password123' });
    await expect(
      service.register({ email: 'a@example.com', password: 'password123' }),
    ).rejects.toThrow('Email already registered');
  });

  it('rejects registration with short password', async () => {
    await expect(
      service.register({ email: 'a@example.com', password: 'short' }),
    ).rejects.toThrow();
  });

  it('rejects registration with invalid email', async () => {
    await expect(
      service.register({ email: 'not-an-email', password: 'password123' }),
    ).rejects.toThrow();
  });

  it('logs in with valid credentials and returns a token', async () => {
    await service.register({
      email: 'a@example.com',
      password: 'password123',
    });
    const payload = await service.login({
      email: 'a@example.com',
      password: 'password123',
    });
    expect(payload.token).toBeDefined();
    expect(payload.user.email).toBe('a@example.com');
  });

  it('rejects login with wrong password', async () => {
    await service.register({
      email: 'a@example.com',
      password: 'password123',
    });
    await expect(
      service.login({ email: 'a@example.com', password: 'wrongpassword' }),
    ).rejects.toThrow('Invalid email or password');
  });

  it('rejects login for unknown email', async () => {
    await expect(
      service.login({ email: 'unknown@example.com', password: 'password123' }),
    ).rejects.toThrow('Invalid email or password');
  });

  it('verifies a valid token', async () => {
    const user = await service.register({
      email: 'a@example.com',
      password: 'password123',
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
      password: 'password123',
    });
    const token = service.issueToken(user);
    const verified = await service.verifyToken(`${token}tampered`);
    expect(verified).toBeNull();
  });
});
