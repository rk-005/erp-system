import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response';

type ValidateTarget = 'body' | 'query' | 'params';

/**
 * Zod validation middleware factory.
 * Validates req[target] against the provided schema.
 * On failure: 400 with field-level error details.
 * On success: replaces req[target] with the parsed (coerced) data.
 */
export const validate = (schema: ZodSchema, target: ValidateTarget = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const details = (result.error as ZodError).errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      sendError(res, 400, 'Validation failed. Check the details field for specific errors.', 'VALIDATION_ERROR', details);
      return;
    }

    // Replace with parsed/coerced data (e.g. string → number conversions)
    req[target] = result.data;
    next();
  };
};
