import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

type ErrorResponse = { error?: unknown; message?: unknown };

function isErrorResponse(value: unknown): value is ErrorResponse {
  return typeof value === 'object' && value !== null;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException
      ? exception.getResponse()
      : undefined;
    const details = isErrorResponse(exceptionResponse)
      ? exceptionResponse
      : undefined;
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (details?.message ?? 'Internal server error');
    const error =
      typeof details?.error === 'string'
        ? details.error
        : (HttpStatus[statusCode] ?? 'Internal Server Error');

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        {
          err: exception,
          method: request.method,
          path: request.url,
          statusCode,
        },
        'Unhandled request exception',
      );
    } else {
      this.logger.warn(
        { method: request.method, path: request.url, statusCode },
        'Request rejected',
      );
    }

    response.status(statusCode).json({
      statusCode,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
