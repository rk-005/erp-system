import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireRole, ROLES } from '../middleware/role';
import { validate } from '../middleware/validate';
import {
  createStockMovementSchema,
  stockMovementQuerySchema,
} from '../schemas';
import {
  sendSuccess,
  sendError,
  buildPagination,
  parsePagination,
} from '../utils/response';
import { AppError } from '../middleware/errorHandler';

export const stockMovementsRouter = Router();

// All stock movement routes require authentication
stockMovementsRouter.use(authenticate);

// ─── GET /api/stock-movements ──────────────────────────────────────────────────
stockMovementsRouter.get(
  '/',
  requireRole(...ROLES.ALL),
  validate(stockMovementQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const { page, limit, skip } = parsePagination(req.query.page, req.query.limit);
      const { productId, movementType } = req.query as {
        productId?: string;
        movementType?: 'IN' | 'OUT';
      };

      const where: Record<string, unknown> = {};
      if (productId) where.productId = productId;
      if (movementType) where.movementType = movementType;

      const [movements, total] = await Promise.all([
        prisma.stockMovement.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            product: { select: { id: true, name: true, sku: true } },
            createdBy: { select: { id: true, name: true, role: true } },
          },
        }),
        prisma.stockMovement.count({ where }),
      ]);

      sendSuccess(res, movements, 200, buildPagination(page, limit, total));
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/stock-movements ─────────────────────────────────────────────────
// Only ADMIN and WAREHOUSE can manually adjust stock
stockMovementsRouter.post(
  '/',
  requireRole(...ROLES.STOCK_MANAGERS),
  validate(createStockMovementSchema),
  async (req, res, next) => {
    try {
      const { productId, quantityChanged, movementType, reason } = req.body;

      // Fetch current product
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        sendError(res, 404, 'Product not found.', 'PRODUCT_NOT_FOUND');
        return;
      }

      // Validate: OUT movements cannot bring stock below 0
      if (movementType === 'OUT') {
        const deduction = Math.abs(quantityChanged);
        if (product.currentStock < deduction) {
          throw new AppError(
            409,
            `Insufficient stock. Available: ${product.currentStock}, Requested: ${deduction}.`,
            'INSUFFICIENT_STOCK',
            { available: product.currentStock, requested: deduction }
          );
        }
      }

      // Run as a transaction to keep movement and stock in sync
      const movement = await prisma.$transaction(async (tx) => {
        const newMovement = await tx.stockMovement.create({
          data: {
            productId,
            quantityChanged: movementType === 'OUT' ? -Math.abs(quantityChanged) : Math.abs(quantityChanged),
            movementType,
            reason,
            createdById: req.user!.userId,
          },
          include: {
            product: { select: { id: true, name: true, sku: true } },
            createdBy: { select: { id: true, name: true, role: true } },
          },
        });

        // Update stock
        await tx.product.update({
          where: { id: productId },
          data: {
            currentStock:
              movementType === 'IN'
                ? { increment: Math.abs(quantityChanged) }
                : { decrement: Math.abs(quantityChanged) },
          },
        });

        return newMovement;
      });

      sendSuccess(res, movement, 201);
    } catch (err) {
      next(err);
    }
  }
);
