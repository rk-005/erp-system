import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { confirmChallan } from '../src/services/challanService';
import { AppError } from '../src/middleware/errorHandler';

// ─── Mock Prisma ───────────────────────────────────────────────────────────────
// We mock the entire prisma module so tests don't hit the real DB
const mockTx = {
  challan: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  stockMovement: {
    create: vi.fn(),
  },
  challanItem: {
    update: vi.fn(),
  },
};

vi.mock('../src/lib/prisma', () => ({
  default: {
    $transaction: vi.fn((fn) => fn(mockTx)),
  },
}));

// ─── Test Data Factories ───────────────────────────────────────────────────────

const makeChallan = (overrides = {}) => ({
  id: 'challan-1',
  challanNumber: 'CH-2026-00001',
  customerId: 'customer-1',
  status: 'DRAFT',
  totalQuantity: 10,
  createdById: 'user-1',
  items: [
    {
      id: 'item-1',
      challanId: 'challan-1',
      productId: 'product-1',
      quantity: 5,
      productSnapshot: {},
      lineTotal: 500,
    },
    {
      id: 'item-2',
      challanId: 'challan-1',
      productId: 'product-2',
      quantity: 5,
      productSnapshot: {},
      lineTotal: 300,
    },
  ],
  customer: { id: 'customer-1', name: 'Test Customer' },
  ...overrides,
});

const makeProducts = (stock1 = 100, stock2 = 100) => [
  {
    id: 'product-1',
    name: 'Widget A',
    sku: 'WID-001',
    unitPrice: { toString: () => '100.00' },
    category: 'Widgets',
    currentStock: stock1,
  },
  {
    id: 'product-2',
    name: 'Gadget B',
    sku: 'GAD-001',
    unitPrice: { toString: () => '60.00' },
    category: 'Gadgets',
    currentStock: stock2,
  },
];

// ─── Test Suites ───────────────────────────────────────────────────────────────

describe('confirmChallan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Test 1: Success path ──────────────────────────────────────────────────

  it('should confirm a challan with sufficient stock, decrement stock and create movements', async () => {
    const challan = makeChallan();
    const products = makeProducts(100, 100); // Both have ample stock

    mockTx.challan.findUnique.mockResolvedValueOnce(challan);
    mockTx.product.findMany.mockResolvedValueOnce(products);
    mockTx.product.update.mockResolvedValue({});
    mockTx.stockMovement.create.mockResolvedValue({});
    mockTx.challanItem.update.mockResolvedValue({});
    mockTx.challan.update.mockResolvedValueOnce({
      ...challan,
      status: 'CONFIRMED',
      items: challan.items,
      customer: challan.customer,
    });

    const result = await confirmChallan('challan-1', 'user-1');

    // Status should be CONFIRMED
    expect(result.status).toBe('CONFIRMED');

    // product.update should be called twice (once per item) with decrement
    expect(mockTx.product.update).toHaveBeenCalledTimes(2);
    expect(mockTx.product.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: { currentStock: { decrement: 5 } },
    });
    expect(mockTx.product.update).toHaveBeenCalledWith({
      where: { id: 'product-2' },
      data: { currentStock: { decrement: 5 } },
    });

    // StockMovement should be created twice
    expect(mockTx.stockMovement.create).toHaveBeenCalledTimes(2);
    expect(mockTx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: 'OUT',
          productId: 'product-1',
          quantityChanged: -5,
          reason: 'Challan CH-2026-00001 confirmed',
          createdById: 'user-1',
        }),
      })
    );

    // ChallanItem should be updated with snapshot
    expect(mockTx.challanItem.update).toHaveBeenCalledTimes(2);
    expect(mockTx.challanItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-1' },
        data: {
          productSnapshot: expect.objectContaining({
            name: 'Widget A',
            sku: 'WID-001',
          }),
        },
      })
    );
  });

  // ─── Test 2: Insufficient stock — one item fails ───────────────────────────

  it('should throw 409 and NOT modify any stock when one item has insufficient stock', async () => {
    const challan = makeChallan();
    // product-1 has only 2 stock but challan needs 5
    const products = makeProducts(2, 100);

    mockTx.challan.findUnique.mockResolvedValueOnce(challan);
    mockTx.product.findMany.mockResolvedValueOnce(products);

    await expect(confirmChallan('challan-1', 'user-1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'INSUFFICIENT_STOCK',
    });

    // CRITICAL: No stock should have been modified
    expect(mockTx.product.update).not.toHaveBeenCalled();
    expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    expect(mockTx.challanItem.update).not.toHaveBeenCalled();
    expect(mockTx.challan.update).not.toHaveBeenCalled();
  });

  it('should report ALL insufficient items in the error, not just the first one', async () => {
    const challan = makeChallan();
    // Both products have insufficient stock
    const products = makeProducts(2, 1); // Need 5 of each

    mockTx.challan.findUnique.mockResolvedValueOnce(challan);
    mockTx.product.findMany.mockResolvedValueOnce(products);

    let caughtError: AppError | undefined;
    try {
      await confirmChallan('challan-1', 'user-1');
    } catch (err) {
      caughtError = err as AppError;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError!.statusCode).toBe(409);

    const details = caughtError!.details as { insufficientItems: unknown[] };
    // Both items should be reported
    expect(details.insufficientItems).toHaveLength(2);
    expect(details.insufficientItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: 'product-1', required: 5, available: 2, shortfall: 3 }),
        expect.objectContaining({ productId: 'product-2', required: 5, available: 1, shortfall: 4 }),
      ])
    );
  });

  // ─── Test 3: Atomicity — non-DRAFT challan rejected ────────────────────────

  it('should throw 422 when trying to confirm a non-DRAFT challan', async () => {
    const challan = makeChallan({ status: 'CONFIRMED' });

    mockTx.challan.findUnique.mockResolvedValueOnce(challan);

    await expect(confirmChallan('challan-1', 'user-1')).rejects.toMatchObject({
      statusCode: 422,
      code: 'INVALID_CHALLAN_STATE',
    });

    // No DB mutations should happen
    expect(mockTx.product.findMany).not.toHaveBeenCalled();
    expect(mockTx.product.update).not.toHaveBeenCalled();
  });

  it('should throw 404 when challan does not exist', async () => {
    mockTx.challan.findUnique.mockResolvedValueOnce(null);

    await expect(confirmChallan('nonexistent-id', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'CHALLAN_NOT_FOUND',
    });
  });

  it('should throw 422 when trying to confirm an empty challan', async () => {
    const challan = makeChallan({ items: [] });
    mockTx.challan.findUnique.mockResolvedValueOnce(challan);

    await expect(confirmChallan('challan-1', 'user-1')).rejects.toMatchObject({
      statusCode: 422,
      code: 'EMPTY_CHALLAN',
    });
  });

  // ─── Test 4: Atomicity — mid-transaction failure ───────────────────────────

  it('should propagate DB errors from within the transaction (atomicity)', async () => {
    const challan = makeChallan();
    const products = makeProducts(100, 100);

    mockTx.challan.findUnique.mockResolvedValueOnce(challan);
    mockTx.product.findMany.mockResolvedValueOnce(products);
    // First product update succeeds
    mockTx.product.update.mockResolvedValueOnce({});
    // First stockMovement create throws (simulates DB failure mid-transaction)
    mockTx.stockMovement.create.mockRejectedValueOnce(
      new Error('DB connection lost mid-transaction')
    );

    await expect(confirmChallan('challan-1', 'user-1')).rejects.toThrow(
      'DB connection lost mid-transaction'
    );

    // The $transaction wrapper would rollback — challan.update should not have been called
    expect(mockTx.challan.update).not.toHaveBeenCalled();
  });
});
