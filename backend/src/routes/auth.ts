import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { loginSchema } from '../schemas';
import { sendSuccess, sendError } from '../utils/response';

export const authRouter = Router();

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Returns: { token, user: { id, name, email, role } }
 * Errors:
 *   400 — validation failure
 *   401 — invalid credentials (intentionally vague to prevent user enumeration)
 */
authRouter.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Look up user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        passwordHash: true,
      },
    });

    // 2. Intentionally vague error — prevents user enumeration attacks
    const INVALID_CREDENTIALS_MSG = 'Invalid email or password.';

    if (!user) {
      // Use bcrypt compare with a dummy hash to prevent timing attacks
      await bcrypt.compare(password, '$2b$12$invalid.hash.for.timing.attack.prevention');
      sendError(res, 401, INVALID_CREDENTIALS_MSG, 'INVALID_CREDENTIALS');
      return;
    }

    // 3. Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      sendError(res, 401, INVALID_CREDENTIALS_MSG, 'INVALID_CREDENTIALS');
      return;
    }

    // 4. Generate JWT
    const secret = process.env.JWT_SECRET!;
    const expiresIn = (process.env.JWT_EXPIRES_IN || '2h') as jwt.SignOptions['expiresIn'];

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      secret,
      { expiresIn }
    );

    // 5. Return token + safe user data (NEVER return passwordHash)
    sendSuccess(res, {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Returns the current authenticated user's details.
 * Protected — requires Bearer token.
 */
import { authenticate } from '../middleware/auth';

authRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      sendError(res, 404, 'User not found.', 'USER_NOT_FOUND');
      return;
    }

    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
});
