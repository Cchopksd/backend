import { HttpException, HttpStatus } from '@nestjs/common';

export class PricingError extends HttpException {
  constructor(message: string) {
    super(
      { error: 'PRICING_INVALID_REQUEST', message },
      HttpStatus.BAD_REQUEST,
    );
  }
}
