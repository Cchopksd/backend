import { HttpException, HttpStatus } from '@nestjs/common';

export class FlashSaleNotFoundError extends HttpException {
  constructor() {
    super(
      { error: 'FLASH_SALE_NOT_FOUND', message: 'Flash sale was not found' },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class FlashSaleReservationError extends HttpException {
  constructor(message: string) {
    super(
      { error: 'FLASH_SALE_RESERVATION_REJECTED', message },
      HttpStatus.CONFLICT,
    );
  }
}
