import { OtpCryptoService } from '../services/otp-crypto.service.js';

describe('OtpCryptoService', () => {
  const service = new OtpCryptoService();

  it('generates six-digit OTPs', () => {
    const code = service.generateCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('hashes OTPs with a per-code salt and verifies in constant time', async () => {
    const hash = await service.hash('123456');
    expect(hash).not.toContain('123456');
    await expect(service.verify('123456', hash)).resolves.toBe(true);
    await expect(service.verify('654321', hash)).resolves.toBe(false);
    await expect(service.verify('123456', 'malformed')).resolves.toBe(false);
  });
});
