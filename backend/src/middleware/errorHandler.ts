import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { sendError } from '../utils/response';

/**
 * Global Express error handler.
 * Must be registered LAST with app.use() after all routes.
 *
 * Handles:
 *   - Prisma known request errors (P2002 unique, P2025 not found, etc.)
 *   - Prisma validation errors
 *   - Custom AppError instances
 *   - Unexpected errors (500)
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 1. Custom application errors
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.message, err.code, err.details);
    return;
  }

  // 2. Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        // Unique constraint violation
        const fields = (err.meta?.target as string[]) || ['field'];
        sendError(
          res,
          409,
          `A record with this ${fields.join(', ')} already exists.`,
          'UNIQUE_CONSTRAINT_VIOLATION',
          { fields }
        );
        return;
      }
      case 'P2025': {
        // Record not found
        sendError(res, 404, 'Record not found.', 'RECORD_NOT_FOUND');
        return;
      }
      case 'P2003': {
        // Foreign key constraint
        sendError(
          res,
          400,
          'Referenced record does not exist.',
          'FOREIGN_KEY_CONSTRAINT'
        );
        return;
      }
      case 'P2014': {
        // Required relation violation
        sendError(
          res,
          400,
          'Required relation record is missing.',
          'REQUIRED_RELATION_MISSING'
        );
        return;
      }
      default:
        console.error('Prisma error:', err.code, err.message);
        sendError(res, 500, 'A database error occurred.', 'DATABASE_ERROR');
        return;
    }
  }

  // 3. Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    sendError(res, 400, 'Invalid data provided to the database.', 'DB_VALIDATION_ERROR');
    return;
  }

  // 4. JSON parse errors from body-parser
  if (err instanceof SyntaxError && 'body' in err) {
    sendError(res, 400, 'Invalid JSON in request body.', 'INVALID_JSON');
    return;
  }

  // 5. CORS errors
  if (err.message.startsWith('CORS:')) {
    sendError(res, 403, err.message, 'CORS_REJECTED');
    return;
  }

  // 6. Unexpected errors — log and return 500
  console.error('Unhandled error:', err);
  sendError(
    res,
    500,
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred.'
      : err.message,
    'INTERNAL_SERVER_ERROR'
  );
};
