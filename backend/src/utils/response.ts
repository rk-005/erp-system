import { Response } from 'express';

/**
 * Consistent success response shape.
 * { data: T, pagination?: PaginationMeta }
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode = 200,
  pagination?: PaginationMeta
): void => {
  const body: Record<string, unknown> = { data };
  if (pagination) body.pagination = pagination;
  res.status(statusCode).json(body);
};

/**
 * Consistent error response shape.
 * { error: { message, code, details? } }
 */
export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  code: string,
  details?: unknown
): void => {
  const body: Record<string, unknown> = {
    error: { message, code, ...(details !== undefined ? { details } : {}) },
  };
  res.status(statusCode).json(body);
};

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Build pagination metadata from query params and total count.
 */
export const buildPagination = (
  page: number,
  limit: number,
  total: number
): PaginationMeta => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
});

/**
 * Parse and clamp pagination query params.
 */
export const parsePagination = (
  rawPage: unknown,
  rawLimit: unknown,
  defaultLimit = 20,
  maxLimit = 100
): { page: number; limit: number; skip: number } => {
  const page = Math.max(1, parseInt(String(rawPage || 1), 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(String(rawLimit || defaultLimit), 10) || defaultLimit)
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};
