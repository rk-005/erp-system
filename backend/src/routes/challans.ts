import { Router } from 'express';
import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireRole, ROLES } from '../middleware/role';
import { validate } from '../middleware/validate';
import {
  createChallanSchema,
  updateChallanSchema,
  challanQuerySchema,
  idParamSchema,
} from '../schemas';
import {
  sendSuccess,
  sendError,
  buildPagination,
  parsePagination,
} from '../utils/response';
import { generateChallanNumber } from '../utils/challanNumber';
import { confirmChallan, cancelChallan } from '../services/challanService';

export const challansRouter = Router();

// All challan routes require authentication
challansRouter.use(authenticate);

// ─── GET /api/challans ─────────────────────────────────────────────────────────
challansRouter.get(
  '/',
  requireRole(...ROLES.ALL),
  validate(challanQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const { page, limit, skip } = parsePagination(req.query.page, req.query.limit);
      const { status, customerId, from, to } = req.query as {
        status?: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
        customerId?: string;
        from?: string;
        to?: string;
      };

      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (customerId) where.customerId = customerId;
      if (from || to) {
        where.createdAt = {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        };
      }

      const [challans, total] = await Promise.all([
        prisma.challan.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { id: true, name: true, businessName: true } },
            createdBy: { select: { id: true, name: true } },
            _count: { select: { items: true } },
          },
        }),
        prisma.challan.count({ where }),
      ]);

      sendSuccess(res, challans, 200, buildPagination(page, limit, total));
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/challans ────────────────────────────────────────────────────────
challansRouter.post(
  '/',
  requireRole(...ROLES.CHALLAN_MANAGERS),
  validate(createChallanSchema),
  async (req, res, next) => {
    try {
      const { customerId, items, status } = req.body;

      // Verify customer exists
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        sendError(res, 404, 'Customer not found.', 'CUSTOMER_NOT_FOUND');
        return;
      }

      // Verify all products exist and fetch prices
      const productIds = items.map((i: { productId: string }) => i.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
      });

      if (products.length !== productIds.length) {
        const foundIds = new Set(products.map((p) => p.id));
        const missing = productIds.filter((id: string) => !foundIds.has(id));
        sendError(res, 404, 'Some products not found.', 'PRODUCTS_NOT_FOUND', { missingIds: missing });
        return;
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      // Calculate totals
      let totalQuantity = 0;
      const challanItems = items.map((item: { productId: string; quantity: number }) => {
        const product = productMap.get(item.productId)!;
        const lineTotal = Number(product.unitPrice) * item.quantity;
        totalQuantity += item.quantity;
        return {
          productId: item.productId,
          quantity: item.quantity,
          lineTotal,
          // Snapshot is populated at confirmation time, not here
          productSnapshot: {
            name: product.name,
            sku: product.sku,
            unitPrice: product.unitPrice.toString(),
            category: product.category,
          },
        };
      });

      const challanNumber = await generateChallanNumber();

      const challan = await prisma.challan.create({
        data: {
          challanNumber,
          customerId,
          status: 'DRAFT',
          totalQuantity,
          createdById: req.user!.userId,
          items: {
            create: challanItems,
          },
        },
        include: {
          customer: true,
          items: true,
          createdBy: { select: { id: true, name: true } },
        },
      });

      // If status is CONFIRMED, confirm immediately
      if (status === 'CONFIRMED') {
        try {
          const confirmed = await confirmChallan(challan.id, req.user!.userId);
          sendSuccess(res, confirmed, 201);
          return;
        } catch (err) {
          // Challan was created as DRAFT but confirm failed — delete it
          await prisma.challan.delete({ where: { id: challan.id } });
          throw err;
        }
      }

      sendSuccess(res, challan, 201);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/challans/:id ─────────────────────────────────────────────────────
challansRouter.get(
  '/:id',
  requireRole(...ROLES.ALL),
  validate(idParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const challan = await prisma.challan.findUnique({
        where: { id: req.params.id },
        include: {
          customer: true,
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, currentStock: true } },
            },
          },
          createdBy: { select: { id: true, name: true, role: true } },
        },
      });

      if (!challan) {
        sendError(res, 404, 'Challan not found.', 'CHALLAN_NOT_FOUND');
        return;
      }

      sendSuccess(res, challan);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/challans/:id ───────────────────────────────────────────────────
// Only DRAFT challans can be edited
challansRouter.patch(
  '/:id',
  requireRole(...ROLES.CHALLAN_MANAGERS),
  validate(idParamSchema, 'params'),
  validate(updateChallanSchema),
  async (req, res, next) => {
    try {
      const existing = await prisma.challan.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      });

      if (!existing) {
        sendError(res, 404, 'Challan not found.', 'CHALLAN_NOT_FOUND');
        return;
      }

      if (existing.status !== 'DRAFT') {
        sendError(
          res,
          422,
          `Cannot edit a challan in ${existing.status} state. Only DRAFT challans can be edited.`,
          'INVALID_CHALLAN_STATE'
        );
        return;
      }

      const { customerId, items } = req.body;

      let totalQuantity = existing.totalQuantity;

      const challan = await prisma.$transaction(async (tx) => {
        // Update items if provided
        if (items) {
          // Delete existing items
          await tx.challanItem.deleteMany({ where: { challanId: req.params.id } });

          // Fetch products for new items
          const productIds = items.map((i: { productId: string }) => i.productId);
          const products = await tx.product.findMany({
            where: { id: { in: productIds } },
          });
          const productMap = new Map(products.map((p) => [p.id, p]));

          totalQuantity = 0;
          const newItems = items.map((item: { productId: string; quantity: number }) => {
            const product = productMap.get(item.productId)!;
            const lineTotal = Number(product.unitPrice) * item.quantity;
            totalQuantity += item.quantity;
            return {
              challanId: req.params.id,
              productId: item.productId,
              quantity: item.quantity,
              lineTotal,
              productSnapshot: {
                name: product.name,
                sku: product.sku,
                unitPrice: product.unitPrice.toString(),
                category: product.category,
              },
            };
          });

          await tx.challanItem.createMany({ data: newItems });
        }

        return await tx.challan.update({
          where: { id: req.params.id },
          data: {
            ...(customerId ? { customerId } : {}),
            totalQuantity,
          },
          include: {
            customer: true,
            items: true,
            createdBy: { select: { id: true, name: true } },
          },
        });
      });

      sendSuccess(res, challan);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/challans/:id/confirm ───────────────────────────────────────────
challansRouter.post(
  '/:id/confirm',
  requireRole(...ROLES.CHALLAN_MANAGERS),
  validate(idParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const confirmed = await confirmChallan(req.params.id, req.user!.userId);
      sendSuccess(res, confirmed);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/challans/:id/cancel ────────────────────────────────────────────
challansRouter.post(
  '/:id/cancel',
  requireRole(...ROLES.CHALLAN_MANAGERS),
  validate(idParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const cancelled = await cancelChallan(req.params.id, req.user!.userId);
      sendSuccess(res, cancelled);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/challans/:id/pdf ────────────────────────────────────────────────
challansRouter.get(
  '/:id/pdf',
  requireRole(...ROLES.ALL),
  validate(idParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const challan = await prisma.challan.findUnique({
        where: { id: req.params.id },
        include: {
          customer: true,
          items: true,
          createdBy: { select: { name: true } },
        },
      });

      if (!challan) {
        sendError(res, 404, 'Challan not found.', 'CHALLAN_NOT_FOUND');
        return;
      }

      // Generate PDF using pdfkit
      const doc = new PDFDocument({ margin: 50 });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="challan-${challan.challanNumber}.pdf"`
      );
      doc.pipe(res);

      // ── Header ──────────────────────────────────────────────────────────────
      doc.fontSize(20).font('Helvetica-Bold').text('ERP OPERATIONS PORTAL', 50, 50);
      doc.fontSize(10).font('Helvetica').text('Your Trusted Wholesale Distribution Partner', 50, 75);
      doc.moveTo(50, 95).lineTo(545, 95).stroke();

      // Status watermark for non-confirmed challans
      if (challan.status !== 'CONFIRMED') {
        doc.save();
        doc.opacity(0.15);
        doc.fontSize(72).font('Helvetica-Bold').fillColor('red');
        doc.rotate(-45, { origin: [300, 400] });
        doc.text(challan.status, 100, 350);
        doc.restore();
      }

      // ── Challan Info ─────────────────────────────────────────────────────────
      doc.fontSize(16).font('Helvetica-Bold').fillColor('black').text('SALES CHALLAN', 50, 110);

      doc.fontSize(10).font('Helvetica');
      doc.text(`Challan No: ${challan.challanNumber}`, 50, 135);
      doc.text(`Date: ${new Date(challan.createdAt).toLocaleDateString('en-IN')}`, 50, 150);
      doc.text(`Status: ${challan.status}`, 50, 165);
      doc.text(`Created By: ${challan.createdBy.name}`, 50, 180);

      // ── Customer Info ─────────────────────────────────────────────────────────
      doc.fontSize(12).font('Helvetica-Bold').text('Bill To:', 300, 135);
      doc.fontSize(10).font('Helvetica');
      doc.text(challan.customer.name, 300, 150);
      doc.text(challan.customer.businessName, 300, 165);
      doc.text(challan.customer.address, 300, 180, { width: 200 });
      if (challan.customer.gstNumber) {
        doc.text(`GST: ${challan.customer.gstNumber}`, 300, 210);
      }

      // ── Items Table ───────────────────────────────────────────────────────────
      const tableTop = 250;
      doc.moveTo(50, tableTop - 5).lineTo(545, tableTop - 5).stroke();

      // Table Headers
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('#', 50, tableTop);
      doc.text('Product', 70, tableTop);
      doc.text('SKU', 250, tableTop);
      doc.text('Category', 320, tableTop);
      doc.text('Qty', 400, tableTop);
      doc.text('Unit Price', 430, tableTop);
      doc.text('Total', 500, tableTop);

      doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

      // Table Rows
      let y = tableTop + 25;
      let grandTotal = 0;

      challan.items.forEach((item, index) => {
        const snapshot = item.productSnapshot as {
          name: string;
          sku: string;
          unitPrice: string;
          category: string;
        };
        const unitPrice = parseFloat(snapshot.unitPrice);
        const lineTotal = unitPrice * item.quantity;
        grandTotal += lineTotal;

        doc.fontSize(9).font('Helvetica');
        doc.text(String(index + 1), 50, y);
        doc.text(snapshot.name, 70, y, { width: 175 });
        doc.text(snapshot.sku, 250, y, { width: 65 });
        doc.text(snapshot.category, 320, y, { width: 75 });
        doc.text(String(item.quantity), 400, y);
        doc.text(`₹${unitPrice.toFixed(2)}`, 430, y);
        doc.text(`₹${lineTotal.toFixed(2)}`, 500, y);

        y += 20;

        // Page break if needed
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
      });

      // ── Totals ─────────────────────────────────────────────────────────────────
      doc.moveTo(50, y + 5).lineTo(545, y + 5).stroke();
      y += 15;

      doc.fontSize(10).font('Helvetica');
      doc.text(`Total Quantity: ${challan.totalQuantity}`, 50, y);
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text(`Grand Total: ₹${grandTotal.toFixed(2)}`, 380, y);

      // ── Footer ─────────────────────────────────────────────────────────────────
      y += 60;
      doc.moveTo(50, y).lineTo(545, y).stroke();
      doc.fontSize(8).font('Helvetica').fillColor('grey');
      doc.text('This is a computer-generated document. No signature required.', 50, y + 10);
      doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, 50, y + 22);

      doc.end();
    } catch (err) {
      next(err);
    }
  }
);
