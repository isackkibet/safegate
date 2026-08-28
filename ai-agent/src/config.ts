import 'dotenv/config';

export function env(name: string, fallback = ''): string {
  const value = process.env[name]?.trim();
  return value === undefined || value === '' ? fallback : value;
}

export function getDatabaseUrl(): string {
  const url = env('DATABASE_URL', 'postgres://safegate:safegate@localhost:5432/safegate');
  return url;
}

export function getRedisUrl(): string {
  return env('REDIS_URL', 'redis://localhost:6379');
}

export function getBackendPort(): number {
  return Number(env('PORT', '4000'));
}

export function getJwtSecret(): string {
  const secret = env('JWT_SECRET', 'dev-insecure-secret-change-me');
  return secret;
}
