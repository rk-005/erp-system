import React, { useEffect, useState, useCallback } from 'react';
import { Search, Plus, AlertTriangle, Package, RefreshCw } from 'lucide-react';
import { api, getErrorMessage } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/utils';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitPrice: string;
  currentStock: number;
  minStockAlert: number;
  warehouseLocation: string;
  updatedAt: string;
}

const ProductModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
}> = ({ open, onClose, onSuccess, product }) => {
  const [form, setForm] = useState({
    name: '', sku: '', category: '', unitPrice: '', currentStock: '0',
    minStockAlert: '10', warehouseLocation: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name, sku: product.sku, category: product.category,
        unitPrice: product.unitPrice, currentStock: String(product.currentStock),
        minStockAlert: String(product.minStockAlert), warehouseLocation: product.warehouseLocation,
      });
    } else {
      setForm({ name: '', sku: '', category: '', unitPrice: '', currentStock: '0', minStockAlert: '10', warehouseLocation: '' });
    }
  }, [product, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = {
        ...form,
        unitPrice: parseFloat(form.unitPrice),
        currentStock: parseInt(form.currentStock),
        minStockAlert: parseInt(form.minStockAlert),
      };
      if (product) {
        await api.patch(`/products/${product.id}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/products', payload);
        toast.success('Product created');
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border sticky top-0 bg-card">
          <h3 className="font-semibold text-foreground">{product ? 'Edit Product' : 'Add Product'}</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {([
              ['name', 'Product Name', 'text', true],
              ['sku', 'SKU', 'text', true],
              ['category', 'Category', 'text', true],
              ['unitPrice', 'Unit Price (₹)', 'number', true],
              ['currentStock', 'Current Stock', 'number', true],
              ['minStockAlert', 'Min Stock Alert', 'number', true],
              ['warehouseLocation', 'Warehouse Location', 'text', true],
            ] as [string, string, string, boolean][]).map(([key, label, type, required]) => (
              <div key={key} className={key === 'name' || key === 'warehouseLocation' ? 'col-span-2' : ''}>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{label}{required ? ' *' : ''}</label>
                <input
                  type={type}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="input-field"
                  required={required}
                  min={type === 'number' ? '0' : undefined}
                  step={key === 'unitPrice' ? '0.01' : undefined}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={isLoading} className="btn-primary flex-1 justify-center">
              {isLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
              {product ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ProductsPage: React.FC = () => {
  const { isRole } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  const canWrite = isRole('ADMIN', 'WAREHOUSE');
  const LIMIT = 15;

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      if (lowStockOnly) {
        const res = await api.get('/products/low-stock');
        setProducts(res.data.data);
        setTotal(res.data.data.length);
      } else {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(LIMIT),
          ...(search && { search }),
          ...(categoryFilter && { category: categoryFilter }),
        });
        const res = await api.get(`/products?${params}`);
        setProducts(res.data.data);
        setTotal(res.data.pagination.total);
        // Extract unique categories
        const cats = [...new Set(res.data.data.map((p: Product) => p.category))] as string[];
        if (cats.length) setCategories((prev) => [...new Set([...prev, ...cats])]);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, search, categoryFilter, lowStockOnly]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { setPage(1); }, [search, categoryFilter, lowStockOnly]);

  const isLowStock = (p: Product) => p.currentStock <= p.minStockAlert;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Products</h2>
          <p className="text-sm text-muted-foreground">{total} {lowStockOnly ? 'low stock' : 'total'} products</p>
        </div>
        {canWrite && (
          <button onClick={() => { setEditingProduct(null); setModalOpen(true); }} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input-field sm:w-40">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setLowStockOnly(!lowStockOnly)}
          className={`btn-secondary whitespace-nowrap ${lowStockOnly ? 'border-red-500/30 bg-red-500/10 text-red-400' : ''}`}
        >
          <AlertTriangle className="w-4 h-4" />
          {lowStockOnly ? 'Show All' : 'Low Stock'}
        </button>
        <button onClick={fetchProducts} className="btn-ghost p-2">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="text-left p-4 font-medium">Product</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">Category</th>
                <th className="text-left p-4 font-medium">Stock</th>
                <th className="text-left p-4 font-medium hidden sm:table-cell">Unit Price</th>
                <th className="text-left p-4 font-medium hidden lg:table-cell">Location</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/30">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="p-4"><div className="skeleton h-4 rounded" /></td>
                      ))}
                    </tr>
                  ))
                : products.length === 0
                ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No products found</p>
                    </td>
                  </tr>
                )
                : products.map((product) => {
                  const low = isLowStock(product);
                  return (
                    <tr
                      key={product.id}
                      className="border-b border-border/30 table-row-hover"
                      onClick={() => canWrite && (setEditingProduct(product), setModalOpen(true))}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {low && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
                          <div>
                            <p className="font-medium text-foreground">{product.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <span className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded-full">{product.category}</span>
                      </td>
                      <td className="p-4">
                        <div>
                          <span className={`font-bold ${low ? 'stock-low' : 'stock-ok'}`}>{product.currentStock}</span>
                          <span className="text-muted-foreground text-xs ml-1">/ {product.minStockAlert} min</span>
                        </div>
                        {low && (
                          <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden w-20">
                            <div
                              className="h-full rounded-full bg-red-500"
                              style={{ width: `${Math.min(100, (product.currentStock / product.minStockAlert) * 100)}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="p-4 hidden sm:table-cell text-foreground font-medium">
                        {formatCurrency(parseFloat(product.unitPrice))}
                      </td>
                      <td className="p-4 hidden lg:table-cell text-muted-foreground text-xs font-mono">
                        {product.warehouseLocation}
                      </td>
                      <td className="p-4" />
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && !lowStockOnly && (
          <div className="p-4 border-t border-border/50 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary py-1 px-3 text-xs">Prev</button>
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary py-1 px-3 text-xs">Next</button>
            </div>
          </div>
        )}
      </div>

      <ProductModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingProduct(null); }}
        onSuccess={fetchProducts}
        product={editingProduct}
      />
    </div>
  );
};
