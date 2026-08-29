import { HttpException, HttpStatus } from '@nestjs/common';

class PaymentAttemptError extends HttpException {
  constructor(error: string, message: string, status: HttpStatus) {
    super({ error, message }, status);
  }
}

export class PaymentAttemptNotFoundError extends PaymentAttemptError {
  constructor() {
    super(
      'PAYMENT_ATTEMPT_NOT_FOUND',
      'Payment attempt was not found',
      HttpStatus.NOT_FOUND,
    );
  }
}

export class PaymentAttemptConflictError extends PaymentAttemptError {
  constructor(message: string) {
    super('PAYMENT_ATTEMPT_CONFLICT', message, HttpStatus.CONFLICT);
  }
}

export class PaymentAttemptInvalidInputError extends PaymentAttemptError {
  constructor(message: string) {
    super('PAYMENT_ATTEMPT_INVALID_INPUT', message, HttpStatus.BAD_REQUEST);
  }
}
