import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export const EMAIL_OTP_SENDER = Symbol('EMAIL_OTP_SENDER');

export interface EmailOtpSender {
  sendOtp(input: { email: string; code: string; expiresAt: Date }): Promise<void>;
}

@Injectable()
export class UnconfiguredEmailOtpSender implements EmailOtpSender {
  async sendOtp(): Promise<void> {
    throw new ServiceUnavailableException({ error: 'AUTH_EMAIL_UNAVAILABLE', message: 'Email verification is temporarily unavailable' });
  }
}
