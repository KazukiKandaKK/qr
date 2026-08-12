import type { APIRequestContext } from '@playwright/test';

export interface AdminCredentials {
  email: string;
  password: string;
}

export interface AdminSession extends AdminCredentials {
  token: string;
  role: string;
}

const ADMIN_EMAIL = 'e2e-admin@example.com';
const ADMIN_PASSWORD = 'Password123';

export async function ensureAdminUser(
  request: APIRequestContext,
): Promise<AdminSession> {
  const register = await request.post('/graphql', {
    data: {
      query: `
        mutation {
          register(input: { email: "${ADMIN_EMAIL}", password: "${ADMIN_PASSWORD}", name: "E2E Admin" }) {
            token
            user { id role }
          }
        }
      `,
    },
  });
  const registerJson = await register.json();
  if (registerJson.data?.register?.token) {
    return {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      token: registerJson.data.register.token,
      role: registerJson.data.register.user.role,
    };
  }

  const login = await request.post('/graphql', {
    data: {
      query: `
        mutation {
          login(input: { email: "${ADMIN_EMAIL}", password: "${ADMIN_PASSWORD}" }) {
            token
            user { id role }
          }
        }
      `,
    },
  });
  const loginJson = await login.json();
  if (!loginJson.data?.login?.token) {
    throw new Error('Failed to obtain admin token for E2E screenshots');
  }
  return {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    token: loginJson.data.login.token,
    role: loginJson.data.login.user.role,
  };
}
