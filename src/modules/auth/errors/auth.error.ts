import { HttpException, HttpStatus } from '@nestjs/common';

export class AuthError extends HttpException {
  constructor(error: string, message: string, status: HttpStatus) {
    super({ error, message }, status);
  }
}

export class OtpInvalidError extends AuthError {
  constructor() { super('AUTH_OTP_INVALID', 'The verification code is invalid', HttpStatus.UNAUTHORIZED); }
}

export class OtpExpiredError extends AuthError {
  constructor() { super('AUTH_OTP_EXPIRED', 'The verification code has expired', HttpStatus.UNAUTHORIZED); }
}

export class OtpRateLimitedError extends AuthError {
  constructor() { super('AUTH_OTP_RATE_LIMITED', 'Too many verification requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS); }
}

export class OtpResendCooldownError extends AuthError {
  constructor() { super('AUTH_OTP_RESEND_COOLDOWN', 'Please wait before requesting another code', HttpStatus.TOO_MANY_REQUESTS); }
}

export class AuthPermissionDeniedError extends AuthError {
  constructor() { super('AUTH_PERMISSION_DENIED', 'You do not have permission to perform this action', HttpStatus.FORBIDDEN); }
}
