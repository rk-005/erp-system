import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response';

export interface JwtPayload {
  userId: string;
  role: string;
}

// Extend Express Request to carry the verified user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Authentication middleware.
 * Validates the Bearer JWT in the Authorization header.
 *
 * Returns:
 *   401 — missing token, malformed token, invalid signature, expired token
 *   Never returns 403 — that is the job of requireRole()
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  // 1. Check Authorization header
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7); // Remove "Bearer " prefix
  } 
  // 1.5 Fallback to query param for file downloads (like PDFs)
  else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token || token.trim() === '') {
    sendError(res, 401, 'Authentication required. Provide a Bearer token or token parameter.', 'MISSING_TOKEN');
    return;
  }

  // 2. Verify the token
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // This is a server configuration error — should never happen in production
    console.error('FATAL: JWT_SECRET environment variable is not set');
    sendError(res, 500, 'Server configuration error.', 'SERVER_CONFIG_ERROR');
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;

    // 3. Validate payload shape
    if (!decoded.userId || !decoded.role) {
      sendError(res, 401, 'Token payload is invalid.', 'INVALID_TOKEN_PAYLOAD');
      return;
    }

    // 4. Attach verified user to request
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      sendError(res, 401, 'Authentication token has expired. Please log in again.', 'TOKEN_EXPIRED');
      return;
    }
    if (err instanceof jwt.JsonWebTokenError) {
      sendError(res, 401, 'Authentication token is invalid or malformed.', 'INVALID_TOKEN');
      return;
    }
    // Unexpected error
    sendError(res, 401, 'Authentication failed.', 'AUTH_FAILED');
  }
};
