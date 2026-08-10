import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireRole, ROLES } from '../middleware/role';
import { validate } from '../middleware/validate';
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerQuerySchema,
  createCustomerNoteSchema,
  idParamSchema,
} from '../schemas';
import {
  sendSuccess,
  sendError,
  buildPagination,
  parsePagination,
} from '../utils/response';

export const customersRouter = Router();

// All customer routes require authentication
customersRouter.use(authenticate);

// ─── GET /api/customers ────────────────────────────────────────────────────────
customersRouter.get(
  '/',
  requireRole(...ROLES.CUSTOMER_READERS),
  validate(customerQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const { page, limit, skip } = parsePagination(req.query.page, req.query.limit);
      const { search, status, type } = req.query as {
        search?: string;
        status?: 'LEAD' | 'ACTIVE' | 'INACTIVE';
        type?: 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR';
      };

      const where: Record<string, unknown> = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { businessName: { contains: search, mode: 'insensitive' } },
          { mobile: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (status) where.status = status;
      if (type) where.customerType = type;

      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
            businessName: true,
            customerType: true,
            status: true,
            followUpDate: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { notes: true, challans: true } },
          },
        }),
        prisma.customer.count({ where }),
      ]);

      sendSuccess(res, customers, 200, buildPagination(page, limit, total));
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/customers ───────────────────────────────────────────────────────
customersRouter.post(
  '/',
  requireRole(...ROLES.CRM_WRITERS),
  validate(createCustomerSchema),
  async (req, res, next) => {
    try {
      const data = req.body;
      const customer = await prisma.customer.create({
        data: {
          ...data,
          email: data.email || null,
          gstNumber: data.gstNumber || null,
          followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        },
      });
      sendSuccess(res, customer, 201);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/customers/:id ────────────────────────────────────────────────────
customersRouter.get(
  '/:id',
  requireRole(...ROLES.CUSTOMER_READERS),
  validate(idParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: req.params.id },
        include: {
          notes: {
            include: {
              author: { select: { id: true, name: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          _count: { select: { challans: true } },
        },
      });

      if (!customer) {
        sendError(res, 404, 'Customer not found.', 'CUSTOMER_NOT_FOUND');
        return;
      }

      sendSuccess(res, customer);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/customers/:id ──────────────────────────────────────────────────
customersRouter.patch(
  '/:id',
  requireRole(...ROLES.CRM_WRITERS),
  validate(idParamSchema, 'params'),
  validate(updateCustomerSchema),
  async (req, res, next) => {
    try {
      const existing = await prisma.customer.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        sendError(res, 404, 'Customer not found.', 'CUSTOMER_NOT_FOUND');
        return;
      }

      const data = req.body;
      const customer = await prisma.customer.update({
        where: { id: req.params.id },
        data: {
          ...data,
          email: data.email !== undefined ? data.email || null : undefined,
          gstNumber: data.gstNumber !== undefined ? data.gstNumber || null : undefined,
          followUpDate:
            data.followUpDate !== undefined
              ? data.followUpDate
                ? new Date(data.followUpDate)
                : null
              : undefined,
        },
      });
      sendSuccess(res, customer);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/customers/:id/notes ─────────────────────────────────────────────
customersRouter.get(
  '/:id/notes',
  requireRole(...ROLES.CUSTOMER_READERS),
  validate(idParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: req.params.id },
      });
      if (!customer) {
        sendError(res, 404, 'Customer not found.', 'CUSTOMER_NOT_FOUND');
        return;
      }

      const notes = await prisma.customerNote.findMany({
        where: { customerId: req.params.id },
        include: {
          author: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      sendSuccess(res, notes);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/customers/:id/notes ────────────────────────────────────────────
customersRouter.post(
  '/:id/notes',
  requireRole(...ROLES.CRM_WRITERS),
  validate(idParamSchema, 'params'),
  validate(createCustomerNoteSchema),
  async (req, res, next) => {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: req.params.id },
      });
      if (!customer) {
        sendError(res, 404, 'Customer not found.', 'CUSTOMER_NOT_FOUND');
        return;
      }

      const note = await prisma.customerNote.create({
        data: {
          customerId: req.params.id,
          note: req.body.note,
          authorId: req.user!.userId,
        },
        include: {
          author: { select: { id: true, name: true, role: true } },
        },
      });

      sendSuccess(res, note, 201);
    } catch (err) {
      next(err);
    }
  }
);
