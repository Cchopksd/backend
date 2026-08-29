import { HttpStatus } from '@nestjs/common';
import { AuthService } from '../services/auth.service.js';
import { OtpExpiredError, OtpInvalidError, OtpRateLimitedError, OtpResendCooldownError } from '../errors/auth.error.js';

describe('AuthService', () => {
  const emailSender = { sendOtp: vi.fn() };
  const repository = {
    findLatestActiveChallenge: vi.fn(),
    replaceChallenge: vi.fn(),
    withLockedChallenge: vi.fn(),
    invalidateChallenge: vi.fn(),
    upsertUser: vi.fn(),
    findUserByFirebaseUid: vi.fn(),
  };
  const firebase = { getOrCreateUserByVerifiedEmail: vi.fn(), createCustomToken: vi.fn() };
  const redis = { getClient: () => ({ incr: vi.fn().mockResolvedValue(1), expire: vi.fn() }) };
  const otpCrypto = { generateCode: vi.fn(() => '123456'), hash: vi.fn().mockResolvedValue('hash'), verify: vi.fn() };
  const service = new AuthService(repository, firebase, redis, otpCrypto, emailSender);

  beforeEach(() => vi.clearAllMocks());

  it('creates a hashed challenge and sends the plaintext OTP only to the email adapter', async () => {
    repository.findLatestActiveChallenge.mockResolvedValue(null);
    repository.replaceChallenge.mockResolvedValue({ id: 'challenge-id', expiresAt: new Date('2026-08-29T01:05:00.000Z') });

    const result = await service.requestEmailOtp(' Customer@Example.com ', '127.0.0.1');

    expect(repository.replaceChallenge).toHaveBeenCalledWith(expect.objectContaining({ email: 'customer@example.com', codeHash: 'hash' }));
    expect(emailSender.sendOtp).toHaveBeenCalledWith(expect.objectContaining({ email: 'customer@example.com', code: '123456' }));
    expect(result.challengeId).toBe('challenge-id');
  });

  it('enforces the resend cooldown', async () => {
    repository.findLatestActiveChallenge.mockResolvedValue({ createdAt: new Date() });
    await expect(service.requestEmailOtp('customer@example.com', '127.0.0.1')).rejects.toBeInstanceOf(OtpResendCooldownError);
  });

  it('replaces the prior active challenge when an email is resent after the cooldown', async () => {
    repository.findLatestActiveChallenge.mockResolvedValue({ createdAt: new Date(Date.now() - 60_001) });
    repository.replaceChallenge.mockResolvedValue({ id: 'replacement-challenge', expiresAt: new Date(Date.now() + 300_000) });

    await service.requestEmailOtp('customer@example.com', '127.0.0.1');

    expect(repository.replaceChallenge).toHaveBeenCalledOnce();
    expect(emailSender.sendOtp).toHaveBeenCalledOnce();
  });

  it('consumes a valid OTP once and returns a Firebase custom token', async () => {
    const markUsed = vi.fn();
    repository.withLockedChallenge.mockImplementation(async (_id: string, callback: (challenge: unknown, commands: unknown) => Promise<string>) => callback({ email: 'customer@example.com', expiresAt: new Date(Date.now() + 60_000), attempts: 0, usedAt: null, codeHash: 'hash' }, { markUsed, incrementAttempts: vi.fn() }));
    otpCrypto.verify.mockResolvedValue(true);
    firebase.getOrCreateUserByVerifiedEmail.mockResolvedValue({ uid: 'firebase-user' });
    repository.upsertUser.mockResolvedValue({ id: 'local-user', firebaseUid: 'firebase-user', email: 'customer@example.com', displayName: null, role: 'CUSTOMER' });
    firebase.createCustomToken.mockResolvedValue('custom-token');

    await expect(service.verifyEmailOtp('challenge-id', '123456')).resolves.toEqual(expect.objectContaining({ customToken: 'custom-token' }));
    expect(markUsed).toHaveBeenCalledOnce();
  });

  it('rejects expired and invalid challenges without creating Firebase users', async () => {
    repository.withLockedChallenge.mockImplementation(async (_id: string, callback: (challenge: unknown, commands: unknown) => Promise<string>) => callback({ email: 'customer@example.com', expiresAt: new Date(Date.now() - 1), attempts: 0, usedAt: null, codeHash: 'hash' }, { markUsed: vi.fn(), incrementAttempts: vi.fn() }));
    await expect(service.verifyEmailOtp('challenge-id', '123456')).rejects.toBeInstanceOf(OtpExpiredError);

    repository.withLockedChallenge.mockResolvedValue(null);
    await expect(service.verifyEmailOtp('challenge-id', '123456')).rejects.toBeInstanceOf(OtpInvalidError);
    expect(firebase.getOrCreateUserByVerifiedEmail).not.toHaveBeenCalled();
  });

  it('increments attempts for an invalid OTP and blocks an exhausted challenge', async () => {
    const incrementAttempts = vi.fn();
    repository.withLockedChallenge.mockImplementation(async (_id: string, callback: (challenge: unknown, commands: unknown) => Promise<string>) => callback({ email: 'customer@example.com', expiresAt: new Date(Date.now() + 60_000), attempts: 0, usedAt: null, codeHash: 'hash' }, { markUsed: vi.fn(), incrementAttempts }));
    otpCrypto.verify.mockResolvedValue(false);

    await expect(service.verifyEmailOtp('challenge-id', '000000')).rejects.toBeInstanceOf(OtpInvalidError);
    expect(incrementAttempts).toHaveBeenCalledOnce();

    repository.withLockedChallenge.mockImplementation(async (_id: string, callback: (challenge: unknown, commands: unknown) => Promise<string>) => callback({ email: 'customer@example.com', expiresAt: new Date(Date.now() + 60_000), attempts: 5, usedAt: null, codeHash: 'hash' }, { markUsed: vi.fn(), incrementAttempts: vi.fn() }));
    await expect(service.verifyEmailOtp('challenge-id', '000000')).rejects.toBeInstanceOf(OtpRateLimitedError);
    expect(otpCrypto.verify).toHaveBeenCalledOnce();
  });

  it('rate limits OTP requests by either email or IP', async () => {
    const increment = vi.fn().mockResolvedValue(6);
    const rateLimitedService = new AuthService(repository, firebase, { getClient: () => ({ incr: increment, expire: vi.fn() }) }, otpCrypto, emailSender);

    await expect(rateLimitedService.requestEmailOtp('customer@example.com', '127.0.0.1')).rejects.toBeInstanceOf(OtpRateLimitedError);
    expect(increment).toHaveBeenCalledWith('auth:otp:email:customer@example.com');

    const ipIncrement = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(6);
    const ipRateLimitedService = new AuthService(repository, firebase, { getClient: () => ({ incr: ipIncrement, expire: vi.fn() }) }, otpCrypto, emailSender);
    await expect(ipRateLimitedService.requestEmailOtp('another@example.com', '127.0.0.1')).rejects.toBeInstanceOf(OtpRateLimitedError);
    expect(ipIncrement).toHaveBeenLastCalledWith('auth:otp:ip:127.0.0.1');
  });

  it('does not accept client-provided Google roles', async () => {
    repository.upsertUser.mockResolvedValue({ id: 'local-user', firebaseUid: 'firebase-user', email: 'customer@example.com', displayName: null, role: 'CUSTOMER' });
    const user = await service.resolveGoogleUser({ uid: 'firebase-user', email: 'customer@example.com', emailVerified: true, signInProvider: 'google.com' });
    expect(user.role).toBe('CUSTOMER');
    expect(repository.upsertUser).toHaveBeenCalledWith(expect.not.objectContaining({ role: expect.anything() }));
  });

  it('uses stable status codes for typed errors', () => {
    expect(new OtpInvalidError().getStatus()).toBe(HttpStatus.UNAUTHORIZED);
  });
});
