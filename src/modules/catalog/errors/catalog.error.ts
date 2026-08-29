import { HttpException, HttpStatus } from '@nestjs/common';

export class CatalogError extends HttpException {
  constructor(error: string, message: string, status: HttpStatus) {
    super({ error, message }, status);
  }
}

export class CatalogNotFoundError extends CatalogError {
  constructor(resource: string) {
    super('CATALOG_NOT_FOUND', `${resource} was not found`, HttpStatus.NOT_FOUND);
  }
}

export class CatalogConflictError extends CatalogError {
  constructor(message: string) {
    super('CATALOG_CONFLICT', message, HttpStatus.CONFLICT);
  }
}

export class CatalogInvalidStateError extends CatalogError {
  constructor(message: string) {
    super('CATALOG_INVALID_STATE', message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class CatalogPermissionDeniedError extends CatalogError {
  constructor() {
    super('CATALOG_PERMISSION_DENIED', 'You do not have permission to access this catalog resource', HttpStatus.FORBIDDEN);
  }
}
