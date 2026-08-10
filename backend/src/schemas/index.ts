import { z } from 'zod';

// ─── Auth Schemas ─────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Pagination Schema ────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Customer Schemas ─────────────────────────────────────────────────────────

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number'),
  email: z.string().email('Must be a valid email').optional().or(z.literal('')),
  businessName: z.string().min(1, 'Business name is required').max(300),
  gstNumber: z
    .string()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      'Must be a valid GST number'
    )
    .optional()
    .or(z.literal('')),
  customerType: z.enum(['RETAIL', 'WHOLESALE', 'DISTRIBUTOR']),
  address: z.string().min(1, 'Address is required').max(500),
  status: z.enum(['LEAD', 'ACTIVE', 'INACTIVE']).default('LEAD'),
  followUpDate: z.string().datetime().optional().or(z.literal('')),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const customerQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(['LEAD', 'ACTIVE', 'INACTIVE']).optional(),
  type: z.enum(['RETAIL', 'WHOLESALE', 'DISTRIBUTOR']).optional(),
});

export const createCustomerNoteSchema = z.object({
  note: z.string().min(1, 'Note content is required').max(2000),
});

// ─── Product Schemas ──────────────────────────────────────────────────────────

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(300),
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(100)
    .regex(/^[A-Z0-9\-_]+$/i, 'SKU must contain only letters, numbers, hyphens, and underscores'),
  category: z.string().min(1, 'Category is required').max(100),
  unitPrice: z.coerce
    .number()
    .positive('Unit price must be greater than 0')
    .max(9999999.99, 'Unit price too large'),
  currentStock: z.coerce.number().int().min(0, 'Stock cannot be negative').default(0),
  minStockAlert: z.coerce.number().int().min(0).default(10),
  warehouseLocation: z.string().min(1, 'Warehouse location is required').max(200),
});

export const updateProductSchema = createProductSchema.partial();

export const productQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  category: z.string().optional(),
  lowStock: z.coerce.boolean().optional(),
});

// ─── Stock Movement Schemas ───────────────────────────────────────────────────

export const createStockMovementSchema = z.object({
  productId: z.string().cuid('Must be a valid product ID'),
  quantityChanged: z.number().int().refine((n) => n !== 0, 'Quantity cannot be zero'),
  movementType: z.enum(['IN', 'OUT']),
  reason: z.string().min(1, 'Reason is required').max(500),
});

export const stockMovementQuerySchema = paginationSchema.extend({
  productId: z.string().optional(),
  movementType: z.enum(['IN', 'OUT']).optional(),
});

// ─── Challan Schemas ──────────────────────────────────────────────────────────

export const challanItemSchema = z.object({
  productId: z.string().cuid('Must be a valid product ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

export const createChallanSchema = z.object({
  customerId: z.string().cuid('Must be a valid customer ID'),
  items: z
    .array(challanItemSchema)
    .min(1, 'At least one product is required'),
  status: z.enum(['DRAFT', 'CONFIRMED']).default('DRAFT'),
});

export const updateChallanSchema = z.object({
  customerId: z.string().cuid().optional(),
  items: z.array(challanItemSchema).min(1).optional(),
});

export const challanQuerySchema = paginationSchema.extend({
  status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).optional(),
  customerId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});
