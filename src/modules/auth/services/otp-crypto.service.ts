import { Injectable } from '@nestjs/common';
import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';

@Injectable()
export class OtpCryptoService {
  generateCode(): string {
    return randomInt(100000, 1_000_000).toString();
  }

  async hash(code: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await this.deriveKey(code, salt);
    return `${salt.toString('base64url')}:${derived.toString('base64url')}`;
  }

  async verify(code: string, encodedHash: string): Promise<boolean> {
    const [saltValue, hashValue] = encodedHash.split(':');
    if (!saltValue || !hashValue) return false;
    const expected = Buffer.from(hashValue, 'base64url');
    if (expected.length !== 32) return false;
    const actual = await this.deriveKey(code, Buffer.from(saltValue, 'base64url'), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private deriveKey(code: string, salt: Buffer, length = 32): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(code, salt, length, (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      });
    });
  }
}
