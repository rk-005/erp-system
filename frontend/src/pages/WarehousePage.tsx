import React, { useEffect, useState, useCallback } from 'react';
import { Search, RefreshCw, AlertTriangle, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, getErrorMessage } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
}

interface StockMovement {
  id: string;
  productId: string;
  quantityChanged: number;
  movementType: 'IN' | 'OUT';
  reason: string;
  createdAt: string;
  product: { id: string; name: string; sku: string };
  createdBy: { id: string; name: string; role: string };
}

interface AdjustmentFormData {
  productId: string;
  movementType: 'IN' | 'OUT';
  quantityChanged: number;
  reason: string;
}

export const WarehousePage: React.FC = () => {
  const { isRole } = useAuth();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [productFilter, setProductFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<AdjustmentFormData>({
    productId: '',
    movementType: 'IN',
    quantityChanged: 1,
    reason: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canAdjust = isRole('ADMIN', 'WAREHOUSE');
  const LIMIT = 15;

  const fetchMovements = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(productFilter && { productId: productFilter }),
        ...(typeFilter && { movementType: typeFilter }),
      });
      const res = await api.get(`/stock-movements?${params}`);
      setMovements(res.data.data);
      setTotal(res.data.pagination.total);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, productFilter, typeFilter]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get('/products?limit=100');
      setProducts(res.data.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  useEffect(() => {
    if (modalOpen) {
      fetchProducts();
    }
  }, [modalOpen, fetchProducts]);

  useEffect(() => {
    setPage(1);
  }, [productFilter, typeFilter]);

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productId) {
      toast.error('Please select a product');
      return;
    }
    if (form.quantityChanged <= 0) {
      toast.error('Quantity must be greater than zero');
      return;
    }
    if (!form.reason.trim()) {
      toast.error('Please specify an adjustment reason');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/stock-movements', {
        ...form,
        quantityChanged: Number(form.quantityChanged),
      });
      toast.success('Stock adjustment logged successfully');
      setModalOpen(false);
      setForm({ productId: '', movementType: 'IN', quantityChanged: 1, reason: '' });
      fetchMovements();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Stock Movement Log</h2>
          <p className="text-sm text-muted-foreground">{total} historical movements logged</p>
        </div>
        {canAdjust && (
          <button onClick={() => setModalOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Adjust Stock Manually
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="input-field"
          >
            <option value="">Filter by Product...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </select>
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="input-field sm:w-48"
        >
          <option value="">All Types (IN / OUT)</option>
          <option value="IN">IN (Add Stock)</option>
          <option value="OUT">OUT (Remove Stock)</option>
        </select>
        <button onClick={fetchMovements} className="btn-ghost p-2 shrink-0">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Movements Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="text-left p-4 font-medium">Timestamp</th>
                <th className="text-left p-4 font-medium">Product</th>
                <th className="text-left p-4 font-medium">Type</th>
                <th className="text-left p-4 font-medium">Qty Changed</th>
                <th className="text-left p-4 font-medium">Reason</th>
                <th className="text-left p-4 font-medium">Adjusted By</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="p-4">
                        <div className="skeleton h-4 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    No stock movements logged.
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                    <td className="p-4 text-muted-foreground">{formatDateTime(m.createdAt)}</td>
                    <td className="p-4">
                      <p className="font-medium text-foreground">{m.product.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{m.product.sku}</p>
                    </td>
                    <td className="p-4">
                      <span className={m.movementType === 'IN' ? 'badge-confirmed' : 'badge-cancelled'}>
                        {m.movementType}
                      </span>
                    </td>
                    <td className={`p-4 font-semibold ${m.movementType === 'IN' ? 'text-green-400' : 'text-red-400'}`}>
                      {m.movementType === 'IN' ? `+${Math.abs(m.quantityChanged)}` : `-${Math.abs(m.quantityChanged)}`}
                    </td>
                    <td className="p-4 text-muted-foreground max-w-xs truncate" title={m.reason}>
                      {m.reason}
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-foreground">{m.createdBy.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{m.createdBy.role}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border/50 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn-secondary py-1 px-3 text-xs"
              >
                Prev
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary py-1 px-3 text-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Adjustment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-border bg-card">
              <h3 className="font-semibold text-foreground">Manual Stock Adjustment</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Logs stock changes directly in the database</p>
            </div>
            <form onSubmit={handleAdjustmentSubmit} className="p-6 space-y-4">
              {/* Product */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Product *</label>
                <select
                  value={form.productId}
                  onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                  className="input-field"
                  required
                >
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) · Stock: {p.currentStock}
                    </option>
                  ))}
                </select>
              </div>

              {/* Movement Type */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Adjustment Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, movementType: 'IN' }))}
                    className={`py-2 rounded-lg text-sm border font-medium transition-all ${
                      form.movementType === 'IN'
                        ? 'border-green-500 bg-green-500/10 text-green-400'
                        : 'border-border bg-secondary hover:border-muted-foreground/30'
                    }`}
                  >
                    IN (Replenish / Add)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, movementType: 'OUT' }))}
                    className={`py-2 rounded-lg text-sm border font-medium transition-all ${
                      form.movementType === 'OUT'
                        ? 'border-red-500 bg-red-500/10 text-red-400'
                        : 'border-border bg-secondary hover:border-muted-foreground/30'
                    }`}
                  >
                    OUT (Deduct / Audit)
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  value={form.quantityChanged}
                  onChange={(e) => setForm((f) => ({ ...f, quantityChanged: Math.max(1, parseInt(e.target.value) || 1) }))}
                  className="input-field"
                  required
                />
              </div>

              {/* Reason */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Reason *</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="E.g., Supplier delivery, Stock auditing audit, damaged goods write-off..."
                  className="input-field resize-none"
                  rows={3}
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-secondary flex-1 justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1 justify-center"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Apply Adjustment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
