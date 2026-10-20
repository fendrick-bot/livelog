import type { ErrorRequestHandler, RequestHandler } from 'express';
import {
  AppError,
  Errors,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
  pgErrorCode,
} from '../lib/errors';
import type { Logger } from '../lib/logger';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(Errors.notFound(`Route ${req.method} ${req.path}`));
};

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error, req, res, _next) => {
    let appError: AppError;

    if (error instanceof AppError) {
      appError = error;
    } else if (error?.type === 'entity.parse.failed') {
      appError = Errors.badRequest('The request body is not valid JSON', 'INVALID_JSON');
    } else if (error?.type === 'entity.too.large') {
      appError = new AppError(413, 'PAYLOAD_TOO_LARGE', 'That request is too large');
    } else if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
      appError = Errors.conflict('That already exists', 'ALREADY_EXISTS');
    } else if (pgErrorCode(error) === PG_FOREIGN_KEY_VIOLATION) {
      appError = Errors.conflict(
        'A related record is missing or still in use',
        'REFERENCE_CONFLICT',
      );
    } else {
      logger.error({ err: error, method: req.method, path: req.path }, 'unhandled error');
      appError = new AppError(500, 'INTERNAL', 'Something went wrong on our side');
    }

    if (appError.status >= 500 && error instanceof AppError) {
      logger.error({ err: error, path: req.path }, appError.message);
    }

    res.status(appError.status).json({
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details === undefined ? {} : { details: appError.details }),
      },
    });
  };
}
