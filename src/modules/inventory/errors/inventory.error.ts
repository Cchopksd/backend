import { HttpException, HttpStatus } from '@nestjs/common';

class InventoryError extends HttpException {
  constructor(error: string, message: string, status: HttpStatus) {
    super({ error, message }, status);
  }
}

export class InventoryNotFoundError extends InventoryError {
  constructor() {
    super(
      'INVENTORY_NOT_FOUND',
      'Inventory was not found for this SKU',
      HttpStatus.NOT_FOUND,
    );
  }
}

export class InsufficientStockError extends InventoryError {
  constructor() {
    super(
      'INVENTORY_INSUFFICIENT_STOCK',
      'The requested stock is not available',
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidInventoryMutationError extends InventoryError {
  constructor(message: string) {
    super('INVENTORY_INVALID_MUTATION', message, HttpStatus.BAD_REQUEST);
  }
}
