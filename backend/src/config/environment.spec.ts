import { describe, expect, it } from 'vitest'; import { allowedOrigins, validateEnvironment } from './environment';
describe('environment configuration', () => {
  it('rejects a short JWT secret', () => expect(() => validateEnvironment({ DATABASE_URL: 'postgresql://localhost/test', JWT_SECRET: 'short' })).toThrow(/minimal 32/));
  it('requires database and JWT configuration', () => expect(() => validateEnvironment({})).toThrow(/DATABASE_URL, JWT_SECRET/));
  it('parses an origin allowlist', () => expect(allowedOrigins('https://one.test, https://two.test')).toEqual(['https://one.test', 'https://two.test']));
  it('requires SMTP credentials in production', () => expect(() => validateEnvironment({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://localhost/test',
    JWT_SECRET: 'a-secure-secret-that-is-at-least-32-characters',
  })).toThrow(/SMTP_USER, SMTP_PASS/));
});
