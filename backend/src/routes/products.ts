import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireRole, ROLES } from '../middleware/role';
import { validate } from '../middleware/validate';
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
  idParamSchema,
} from '../schemas';
import {
  sendSuccess,
  sendError,
  buildPagination,
  parsePagination,
} from '../utils/response';

export const productsRouter = Router();

// All product routes require authentication
productsRouter.use(authenticate);

// ─── GET /api/products ─────────────────────────────────────────────────────────
productsRouter.get(
  '/',
  requireRole(...ROLES.ALL),
  validate(productQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const { page, limit, skip } = parsePagination(req.query.page, req.query.limit);
      const { search, category, lowStock } = req.query as {
        search?: string;
        category?: string;
        lowStock?: boolean;
      };

      const where: Record<string, unknown> = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (category) {
        where.category = { equals: category, mode: 'insensitive' };
      }
      if (lowStock === true) {
        // currentStock <= minStockAlert (Prisma doesn't support column-to-column comparison directly)
        // We'll filter post-query for this case or use raw query
        where.AND = [{ currentStock: { lte: prisma.product.fields.minStockAlert } }];
      }

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where: lowStock
            ? {
                ...where,
                AND: undefined,
              }
            : where,
          skip,
          take: limit,
          orderBy: { name: 'asc' },
        }),
        prisma.product.count({ where: lowStock ? { ...where, AND: undefined } : where }),
      ]);

      // Filter for low stock post-query (column comparison)
      const filtered = lowStock
        ? products.filter((p) => p.currentStock <= p.minStockAlert)
        : products;

      sendSuccess(res, filtered, 200, buildPagination(page, limit, lowStock ? filtered.length : total));
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/products/low-stock ───────────────────────────────────────────────
// Must be before /:id to avoid route collision
productsRouter.get(
  '/low-stock',
  requireRole(...ROLES.ALL),
  async (req, res, next) => {
    try {
      const products = await prisma.product.findMany({
        orderBy: { currentStock: 'asc' },
      });

      const lowStockProducts = products.filter(
        (p) => p.currentStock <= p.minStockAlert
      );

      sendSuccess(res, lowStockProducts);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/products ────────────────────────────────────────────────────────
productsRouter.post(
  '/',
  requireRole(...ROLES.STOCK_MANAGERS),
  validate(createProductSchema),
  async (req, res, next) => {
    try {
      const product = await prisma.product.create({
        data: req.body,
      });
      sendSuccess(res, product, 201);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/products/:id ─────────────────────────────────────────────────────
productsRouter.get(
  '/:id',
  requireRole(...ROLES.ALL),
  validate(idParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const product = await prisma.product.findUnique({
        where: { id: req.params.id },
        include: {
          stockMovements: {
            include: {
              createdBy: { select: { id: true, name: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
      });

      if (!product) {
        sendError(res, 404, 'Product not found.', 'PRODUCT_NOT_FOUND');
        return;
      }

      sendSuccess(res, product);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/products/:id ───────────────────────────────────────────────────
productsRouter.patch(
  '/:id',
  requireRole(...ROLES.STOCK_MANAGERS),
  validate(idParamSchema, 'params'),
  validate(updateProductSchema),
  async (req, res, next) => {
    try {
      const existing = await prisma.product.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        sendError(res, 404, 'Product not found.', 'PRODUCT_NOT_FOUND');
        return;
      }

      // Prevent setting stock below 0 via direct update
      if (req.body.currentStock !== undefined && req.body.currentStock < 0) {
        sendError(res, 400, 'Stock cannot be set below 0.', 'NEGATIVE_STOCK');
        return;
      }

      const product = await prisma.product.update({
        where: { id: req.params.id },
        data: req.body,
      });
      sendSuccess(res, product);
    } catch (err) {
      next(err);
    }
  }
);
