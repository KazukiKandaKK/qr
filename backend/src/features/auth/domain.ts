export type Role = 'ADMIN' | 'USER';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithCredentials extends User {
  passwordHash: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

export interface AuthPayload {
  token: string;
  user: User;
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}
