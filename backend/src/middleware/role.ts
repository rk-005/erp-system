import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { sendError } from '../utils/response';

/**
 * Role-based access control middleware factory.
 *
 * Usage: requireRole(Role.ADMIN, Role.SALES)
 *
 * Returns:
 *   403 — valid token but role not in allowed set
 *   (401 is handled upstream by authenticate() — never conflate)
 *
 * IMPORTANT: Always apply authenticate() before requireRole() in route chains.
 * requireRole() trusts that req.user is already populated.
 */
export const requireRole = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // If authenticate() was skipped somehow, guard defensively
    if (!req.user) {
      sendError(
        res,
        401,
        'Authentication required.',
        'MISSING_AUTH_CONTEXT'
      );
      return;
    }

    const userRole = req.user.role as Role;

    if (!roles.includes(userRole)) {
      sendError(
        res,
        403,
        `Access denied. This action requires one of the following roles: ${roles.join(', ')}. Your role: ${userRole}.`,
        'INSUFFICIENT_ROLE'
      );
      return;
    }

    next();
  };
};

/**
 * Shorthand combinators for common role groups used across routes.
 * These return pre-configured middleware arrays for use with route definitions.
 */
export const ROLES = {
  /** All authenticated users can access */
  ALL: [Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.ACCOUNTS] as Role[],
  /** Only Admin */
  ADMIN_ONLY: [Role.ADMIN] as Role[],
  /** Admin + Warehouse (stock operations) */
  STOCK_MANAGERS: [Role.ADMIN, Role.WAREHOUSE] as Role[],
  /** Admin + Sales (challan operations) */
  CHALLAN_MANAGERS: [Role.ADMIN, Role.SALES] as Role[],
  /** Admin + Sales (customer CRM write operations) */
  CRM_WRITERS: [Role.ADMIN, Role.SALES] as Role[],
  /** Everyone except WAREHOUSE for customer reads */
  CUSTOMER_READERS: [Role.ADMIN, Role.SALES, Role.ACCOUNTS] as Role[],
};
