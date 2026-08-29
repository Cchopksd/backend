import { HttpException, HttpStatus } from '@nestjs/common';

class CartError extends HttpException {
  constructor(error: string, message: string, status: HttpStatus) {
    super({ error, message }, status);
  }
}

export class CartItemNotFoundError extends CartError {
  constructor() {
    super('CART_ITEM_NOT_FOUND', 'Cart item was not found', HttpStatus.NOT_FOUND);
  }
}

export class CartSkuNotFoundError extends CartError {
  constructor() {
    super('CART_SKU_NOT_FOUND', 'SKU was not found', HttpStatus.NOT_FOUND);
  }
}

export class CartSkuUnavailableError extends CartError {
  constructor() {
    super('CART_SKU_UNAVAILABLE', 'SKU is not available for purchase', HttpStatus.CONFLICT);
  }
}

export class CartQuantityLimitError extends CartError {
  constructor() {
    super('CART_QUANTITY_LIMIT', 'The requested quantity exceeds the available stock', HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
