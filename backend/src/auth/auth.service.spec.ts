import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

type StoredUser = Record<string, any> | null;
type StoredVerification = Record<string, any> | null;

function authHarness(initialUser: StoredUser = null) {
  let user = initialUser ? { tokenVersion: 0, ...initialUser } : null;
  let verification: StoredVerification = null;
  let passwordReset: StoredVerification = null;

  const userApi = {
    findUnique: vi.fn(async ({ where }: any) => {
      if (where.email) return user?.email === where.email ? user : null;
      if (where.studentId) return user?.studentId === where.studentId ? user : null;
      return null;
    }),
    create: vi.fn(async ({ data }: any) => {
      user = { id: 'user-1', avatarUrl: null, isActive: true, tokenVersion: 0, ...data };
      return user;
    }),
    update: vi.fn(async ({ data }: any) => {
      const tokenVersion = data.tokenVersion?.increment
        ? (user?.tokenVersion || 0) + data.tokenVersion.increment
        : data.tokenVersion ?? user?.tokenVersion;
      user = { ...user, ...data, tokenVersion };
      return user;
    }),
  };

  const passwordResetApi = {
    findUnique: vi.fn(async () => passwordReset),
    upsert: vi.fn(async ({ create, update }: any) => {
      passwordReset = passwordReset
        ? { ...passwordReset, ...update }
        : { id: 'reset-1', ...create, resetTokenHash: null, resetTokenExpiresAt: null, createdAt: new Date(), updatedAt: new Date() };
      return passwordReset;
    }),
    update: vi.fn(async ({ data }: any) => {
      passwordReset = { ...passwordReset, ...data };
      return passwordReset;
    }),
    delete: vi.fn(async () => {
      const deleted = passwordReset;
      passwordReset = null;
      return deleted;
    }),
    deleteMany: vi.fn(async () => {
      passwordReset = null;
      return { count: 1 };
    }),
  };

  const verificationApi = {
    findUnique: vi.fn(async () => verification),
    upsert: vi.fn(async ({ create, update }: any) => {
      verification = verification
        ? { ...verification, ...update }
        : { id: 'otp-1', ...create, createdAt: new Date(), updatedAt: new Date() };
      return verification;
    }),
    update: vi.fn(async ({ data }: any) => {
      verification = { ...verification, ...data };
      return verification;
    }),
    delete: vi.fn(async () => {
      const deleted = verification;
      verification = null;
      return deleted;
    }),
    deleteMany: vi.fn(async () => {
      verification = null;
      return { count: 1 };
    }),
  };

  const prisma = {
    user: userApi,
    emailVerification: verificationApi,
    passwordReset: passwordResetApi,
    $transaction: vi.fn(async (callback: any) => callback({
      user: userApi,
      emailVerification: verificationApi,
      passwordReset: passwordResetApi,
    })),
  };
  const jwt = { sign: vi.fn(() => 'signed-jwt') };
  const email = {
    sendVerificationCode: vi.fn(async () => undefined),
    sendPasswordResetCode: vi.fn(async () => undefined),
    sendPasswordChangedNotice: vi.fn(async () => undefined),
  };
  const service = new AuthService(prisma as never, jwt as never, email as never);

  return {
    service,
    prisma,
    jwt,
    email,
    getUser: () => user,
    getVerification: () => verification,
    getPasswordReset: () => passwordReset,
  };
}

describe('email OTP authentication', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', 'test-secret-that-is-longer-than-thirty-two-characters');
    vi.stubEnv('SSO_ALLOWED_DOMAINS', '@binus.ac.id,@student.binus.ac.id');
    vi.stubEnv('PASSWORD_RESET_MIN_RESPONSE_MS', '0');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('keeps a new account unverified and issues no JWT before OTP verification', async () => {
    const harness = authHarness();
    const result = await harness.service.register({
      email: 'Student@binus.ac.id',
      password: 'password123',
      name: 'Student BINUS',
      studentId: '2440009999',
    });

    expect(result.verificationRequired).toBe(true);
    expect(harness.getUser()?.isVerified).toBe(false);
    expect(harness.jwt.sign).not.toHaveBeenCalled();
    expect(harness.email.sendVerificationCode).toHaveBeenCalledWith(
      'student@binus.ac.id',
      expect.stringMatching(/^\d{6}$/),
      'Student BINUS',
    );
    expect(harness.getVerification()?.codeHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('marks the account verified, consumes the OTP, and only then returns a JWT', async () => {
    const harness = authHarness();
    await harness.service.register({
      email: 'student@binus.ac.id',
      password: 'password123',
      name: 'Student BINUS',
      studentId: '2440009999',
    });
    const code = harness.email.sendVerificationCode.mock.calls[0][1];

    const result = await harness.service.verifyEmail({ email: 'student@binus.ac.id', code });

    expect(result.token).toBe('signed-jwt');
    expect(result.user.isVerified).toBe(true);
    expect(harness.getVerification()).toBeNull();
  });

  it('counts an invalid OTP attempt without verifying the account', async () => {
    const harness = authHarness();
    await harness.service.register({
      email: 'student@binus.ac.id',
      password: 'password123',
      name: 'Student BINUS',
      studentId: '2440009999',
    });

    await expect(harness.service.verifyEmail({
      email: 'student@binus.ac.id',
      code: '000000',
    })).rejects.toThrow(/Tersisa 4 percobaan/);

    expect(harness.getVerification()?.attempts).toBe(1);
    expect(harness.getUser()?.isVerified).toBe(false);
  });

  it('blocks login with the correct password until email is verified', async () => {
    const password = await bcrypt.hash('password123', 4);
    const harness = authHarness({
      id: 'user-1',
      email: 'student@binus.ac.id',
      password,
      name: 'Student BINUS',
      studentId: '2440009999',
      role: 'STUDENT',
      avatarUrl: null,
      isActive: true,
      isVerified: false,
    });

    await expect(harness.service.login({
      email: 'student@binus.ac.id',
      password: 'password123',
    })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'EMAIL_NOT_VERIFIED' }) });
    expect(harness.jwt.sign).not.toHaveBeenCalled();
  });

  it('sends a separate reset OTP without exposing it in the response', async () => {
    const password = await bcrypt.hash('password123', 4);
    const harness = authHarness({
      id: 'user-1', email: 'student@binus.ac.id', password, name: 'Student BINUS',
      role: 'STUDENT', isActive: true, isVerified: true,
    });

    const result = await harness.service.forgotPassword({ email: 'student@binus.ac.id' });

    expect(result).not.toHaveProperty('code');
    expect(harness.email.sendPasswordResetCode).toHaveBeenCalledWith(
      'student@binus.ac.id', expect.stringMatching(/^\d{6}$/), 'Student BINUS',
    );
    expect(harness.getPasswordReset()?.codeHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('requires the OTP, uses a one-time reset token, and invalidates old sessions', async () => {
    const password = await bcrypt.hash('password123', 4);
    const harness = authHarness({
      id: 'user-1', email: 'student@binus.ac.id', password, name: 'Student BINUS',
      role: 'STUDENT', isActive: true, isVerified: true,
    });
    await harness.service.forgotPassword({ email: 'student@binus.ac.id' });
    const code = harness.email.sendPasswordResetCode.mock.calls[0][1];
    const authorization = await harness.service.verifyPasswordReset({
      email: 'student@binus.ac.id', code,
    });

    expect(authorization.resetToken).toMatch(/^[a-f0-9]{64}$/);
    await harness.service.resetPassword({
      email: 'student@binus.ac.id',
      resetToken: authorization.resetToken,
      password: 'new-password-456',
      confirmPassword: 'new-password-456',
    });

    expect(await bcrypt.compare('new-password-456', harness.getUser()?.password)).toBe(true);
    expect(harness.getUser()?.tokenVersion).toBe(1);
    expect(harness.getPasswordReset()).toBeNull();
    expect(harness.email.sendPasswordChangedNotice).toHaveBeenCalledOnce();
    await expect(harness.service.resetPassword({
      email: 'student@binus.ac.id',
      resetToken: authorization.resetToken,
      password: 'another-password-789',
      confirmPassword: 'another-password-789',
    })).rejects.toThrow(/tidak valid/);
  });

  it('counts incorrect password-reset codes and does not issue a reset token', async () => {
    const password = await bcrypt.hash('password123', 4);
    const harness = authHarness({
      id: 'user-1', email: 'student@binus.ac.id', password, name: 'Student BINUS',
      role: 'STUDENT', isActive: true, isVerified: true,
    });
    await harness.service.forgotPassword({ email: 'student@binus.ac.id' });

    await expect(harness.service.verifyPasswordReset({
      email: 'student@binus.ac.id', code: '000000',
    })).rejects.toThrow(/Tersisa 4 percobaan/);
    expect(harness.getPasswordReset()?.attempts).toBe(1);
  });
});
