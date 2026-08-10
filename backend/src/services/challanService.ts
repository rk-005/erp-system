import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InsufficientStockError {
  productId: string;
  productName: string;
  sku: string;
  required: number;
  available: number;
  shortfall: number;
}

// ─── Confirm Challan Transaction ──────────────────────────────────────────────

/**
 * Confirms a challan: transitions DRAFT → CONFIRMED.
 *
 * This is the highest-scrutiny function in the codebase.
 * MUST run as a single Prisma $transaction — no partial writes are allowed.
 *
 * Algorithm:
 * 1. Fetch challan + items (inside transaction)
 * 2. Validate challan is in DRAFT state
 * 3. Re-fetch CURRENT stock for all products (never trust frontend state)
 * 4. Check ALL items against stock — collect ALL failures before aborting
 * 5. If ANY check fails → throw 409 with full insufficient-stock details
 * 6. If ALL pass:
 *    a. Decrement stock per product (inside tx)
 *    b. Create StockMovement (OUT) per product (inside tx)
 *    c. Write productSnapshot to each ChallanItem (inside tx)
 *    d. Update Challan status to CONFIRMED (inside tx)
 *
 * The Prisma $transaction ensures steps 6a-6d are atomic.
 * The DB-level CHECK constraint (currentStock >= 0) provides a final safety net.
 *
 * @throws AppError(422) if challan is not in DRAFT state
 * @throws AppError(409) if any product has insufficient stock
 * @throws AppError(404) if challan or any product is not found
 */
export const confirmChallan = async (
  challanId: string,
  userId: string
): Promise<Prisma.ChallanGetPayload<{ include: { items: true; customer: true } }>> => {
  return await prisma.$transaction(async (tx) => {
    // ── Step 1: Fetch challan with items ──────────────────────────────────────
    const challan = await tx.challan.findUnique({
      where: { id: challanId },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!challan) {
      throw new AppError(404, 'Challan not found.', 'CHALLAN_NOT_FOUND');
    }

    // ── Step 2: Validate state ────────────────────────────────────────────────
    if (challan.status !== 'DRAFT') {
      throw new AppError(
        422,
        `Cannot confirm a challan that is in ${challan.status} state. Only DRAFT challans can be confirmed.`,
        'INVALID_CHALLAN_STATE'
      );
    }

    if (challan.items.length === 0) {
      throw new AppError(
        422,
        'Cannot confirm an empty challan. Add at least one product.',
        'EMPTY_CHALLAN'
      );
    }

    // ── Step 3: Re-fetch CURRENT stock for all products ───────────────────────
    // NEVER trust stale data from the challan items or frontend
    const productIds = challan.items
      .map((item) => item.productId)
      .filter((id): id is string => id !== null);

    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        sku: true,
        unitPrice: true,
        category: true,
        currentStock: true,
      },
    });

    // Build a map for O(1) lookup
    const productMap = new Map(products.map((p) => [p.id, p]));

    // ── Step 4: Check ALL items — collect all failures ────────────────────────
    const insufficientItems: InsufficientStockError[] = [];

    for (const item of challan.items) {
      if (!item.productId) {
        // Product was deleted after adding to challan — cannot confirm
        throw new AppError(
          422,
          'Challan contains an item for a deleted product. Remove it before confirming.',
          'DELETED_PRODUCT_IN_CHALLAN'
        );
      }

      const product = productMap.get(item.productId);
      if (!product) {
        throw new AppError(
          404,
          `Product with ID ${item.productId} not found.`,
          'PRODUCT_NOT_FOUND'
        );
      }

      if (product.currentStock < item.quantity) {
        insufficientItems.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          required: item.quantity,
          available: product.currentStock,
          shortfall: item.quantity - product.currentStock,
        });
      }
    }

    // ── Step 5: Abort if ANY check failed ─────────────────────────────────────
    // NO partial writes — abort the entire transaction
    if (insufficientItems.length > 0) {
      throw new AppError(
        409,
        `Insufficient stock for ${insufficientItems.length} product(s). No stock has been deducted.`,
        'INSUFFICIENT_STOCK',
        { insufficientItems }
      );
    }

    // ── Step 6: All checks passed — execute atomically ────────────────────────
    const reason = `Challan ${challan.challanNumber} confirmed`;
    const now = new Date();

    for (const item of challan.items) {
      const product = productMap.get(item.productId!)!;

      // 6a. Decrement stock
      await tx.product.update({
        where: { id: item.productId! },
        data: {
          currentStock: {
            decrement: item.quantity,
          },
        },
      });

      // 6b. Create StockMovement (OUT)
      await tx.stockMovement.create({
        data: {
          productId: item.productId!,
          quantityChanged: -item.quantity, // Negative: stock going OUT
          movementType: 'OUT',
          reason,
          createdById: userId,
          createdAt: now,
        },
      });

      // 6c. Write productSnapshot to ChallanItem
      const snapshot = {
        name: product.name,
        sku: product.sku,
        unitPrice: product.unitPrice.toString(),
        category: product.category,
      };

      await tx.challanItem.update({
        where: { id: item.id },
        data: {
          productSnapshot: snapshot,
        },
      });
    }

    // 6d. Update Challan status to CONFIRMED
    const confirmedChallan = await tx.challan.update({
      where: { id: challanId },
      data: {
        status: 'CONFIRMED',
        updatedAt: now,
      },
      include: {
        items: true,
        customer: true,
      },
    });

    return confirmedChallan;
  });
};

// ─── Cancel Challan Transaction ───────────────────────────────────────────────

/**
 * Cancels a challan.
 *
 * If the challan was CONFIRMED: restores stock and creates IN StockMovements.
 * If the challan was DRAFT: simply cancels it (no stock to restore).
 *
 * MUST NOT cancel an already-CANCELLED challan.
 *
 * @throws AppError(404) if challan not found
 * @throws AppError(422) if challan is already CANCELLED
 */
export const cancelChallan = async (
  challanId: string,
  userId: string
): Promise<Prisma.ChallanGetPayload<{ include: { items: true; customer: true } }>> => {
  return await prisma.$transaction(async (tx) => {
    // ── Fetch challan ─────────────────────────────────────────────────────────
    const challan = await tx.challan.findUnique({
      where: { id: challanId },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!challan) {
      throw new AppError(404, 'Challan not found.', 'CHALLAN_NOT_FOUND');
    }

    if (challan.status === 'CANCELLED') {
      throw new AppError(
        422,
        'Challan is already cancelled.',
        'ALREADY_CANCELLED'
      );
    }

    const wasConfirmed = challan.status === 'CONFIRMED';
    const now = new Date();
    const reason = `Challan ${challan.challanNumber} cancelled`;

    // ── Restore stock only if it was CONFIRMED ────────────────────────────────
    if (wasConfirmed) {
      for (const item of challan.items) {
        if (!item.productId) continue; // Product was deleted — skip stock restore

        // Restore stock
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: {
              increment: item.quantity,
            },
          },
        });

        // Create StockMovement (IN — stock coming back)
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantityChanged: item.quantity, // Positive: stock coming IN
            movementType: 'IN',
            reason,
            createdById: userId,
            createdAt: now,
          },
        });
      }
    }

    // ── Update Challan status to CANCELLED ────────────────────────────────────
    const cancelledChallan = await tx.challan.update({
      where: { id: challanId },
      data: {
        status: 'CANCELLED',
        updatedAt: now,
      },
      include: {
        items: true,
        customer: true,
      },
    });

    return cancelledChallan;
  });
};
