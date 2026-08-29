import { HttpException, HttpStatus } from '@nestjs/common';

export class BundleNotFoundError extends HttpException {
  constructor() {
    super(
      { error: 'BUNDLE_NOT_FOUND', message: 'Bundle was not found' },
      HttpStatus.NOT_FOUND,
    );
  }
}
