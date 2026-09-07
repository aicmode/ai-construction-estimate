import "server-only";

export interface DemoCredentials {
  email: string;
  password: string;
}

/**
 * Demo credentials are intentionally read only from server-side environment
 * variables. This module must never be imported by a Client Component.
 */
export function getDemoCredentials(): DemoCredentials | null {
  const email = process.env.DEMO_USER_EMAIL?.trim();
  const password = process.env.DEMO_USER_PASSWORD?.trim();

  if (!email || !password) return null;
  return { email, password };
}

export function isDemoLoginConfigured(): boolean {
  return getDemoCredentials() !== null;
}
