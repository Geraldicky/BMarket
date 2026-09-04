// src/common/filters/http-exception.filter.ts
// Filter global untuk format semua error response secara konsisten

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Terjadi kesalahan server.';
    let code: string | undefined;
    let retryAfterSeconds: number | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        code = (exceptionResponse as any).code;
        retryAfterSeconds = (exceptionResponse as any).retryAfterSeconds;
      }
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message ?? message;

      // Kalau message adalah array (dari class-validator), ambil yang pertama
      if (Array.isArray(message)) {
        message = message[0];
      }
    } else {
      const detail = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error('Unhandled request error', detail);
    }

    response.status(status).json({
      success: false,
      message,
      statusCode: status,
      ...(code ? { code } : {}),
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
    });
  }
}
