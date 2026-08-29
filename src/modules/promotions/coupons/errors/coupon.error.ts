import { HttpException, HttpStatus } from '@nestjs/common';

class CouponError extends HttpException {
  constructor(error: string, message: string, status: HttpStatus) {
    super({ error, message }, status);
  }
}

export class CouponNotFoundError extends CouponError {
  constructor() {
    super('COUPON_NOT_FOUND', 'Coupon was not found', HttpStatus.NOT_FOUND);
  }
}

export class CouponRedemptionError extends CouponError {
  constructor(message: string) {
    super('COUPON_REDEMPTION_REJECTED', message, HttpStatus.CONFLICT);
  }
}
