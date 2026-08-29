import { HttpException, HttpStatus } from '@nestjs/common';

export class CheckoutError extends HttpException {
  constructor(error: string, message: string, status = HttpStatus.CONFLICT) {
    super({ error, message }, status);
  }
}

export class CheckoutCartEmptyError extends CheckoutError {
  constructor() {
    super(
      'CHECKOUT_CART_EMPTY',
      'No selected cart items are available for checkout',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class CheckoutPromotionError extends CheckoutError {
  constructor(message: string) {
    super(
      'CHECKOUT_PROMOTION_INVALID',
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
