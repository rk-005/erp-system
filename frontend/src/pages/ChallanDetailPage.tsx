import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Download, CheckCircle, XCircle, AlertCircle, Package } from 'lucide-react';
import { api, getErrorMessage, getErrorDetails } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatDateTime, formatCurrency } from '../lib/utils';
import toast from 'react-hot-toast';

interface ChallanDetail {
  id: string;
  challanNumber: string;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  totalQuantity: number;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; businessName: string; mobile: string; address: string; gstNumber?: string };
  createdBy: { name: string; role: string };
  items: {
    id: string;
    productId?: string | null;
    quantity: number;
    lineTotal: string;
    productSnapshot: { name: string; sku: string; unitPrice: string; category: string };
    product?: { id: string; name: string; currentStock: number } | null;
  }[];
}

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'badge-draft', CONFIRMED: 'badge-confirmed', CANCELLED: 'badge-cancelled',
};

export const ChallanDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRole } = useAuth();
  const [challan, setChallan] = useState<ChallanDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [stockErrors, setStockErrors] = useState<unknown[]>([]);

  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editableItems, setEditableItems] = useState<{
    productId: string;
    quantity: number;
    productSnapshot: { name: string; sku: string; unitPrice: string; category: string };
    currentStock: number;
  }[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [searchedProducts, setSearchedProducts] = useState<{
    id: string; name: string; sku: string; unitPrice: string; currentStock: number; category: string;
  }[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const canManage = isRole('ADMIN', 'SALES');

  const fetchChallan = useCallback(async () => {
    try {
      const res = await api.get(`/challans/${id}`);
      setChallan(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchChallan(); }, [fetchChallan]);

  // Fetch products for adding during edit
  useEffect(() => {
    if (!isEditing || !productSearch) {
      setSearchedProducts([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await api.get(`/products?limit=10&search=${productSearch}`);
        setSearchedProducts(res.data.data);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [productSearch, isEditing]);

  const handleStartEdit = () => {
    if (!challan) return;
    setEditableItems(
      challan.items.map((item) => ({
        productId: item.product?.id || item.productId,
        quantity: item.quantity,
        productSnapshot: item.productSnapshot,
        currentStock: item.product?.currentStock ?? 9999, // default if deleted
      }))
    );
    setIsEditing(true);
    setStockErrors([]);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setProductSearch('');
  };

  const handleUpdateQuantity = (productId: string, qty: number) => {
    setEditableItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity: Math.max(1, qty) } : item
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setEditableItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleAddProduct = (prod: typeof searchedProducts[0]) => {
    if (editableItems.some((item) => item.productId === prod.id)) {
      toast('Product already in challan.');
      return;
    }
    setEditableItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        quantity: 1,
        productSnapshot: {
          name: prod.name,
          sku: prod.sku,
          unitPrice: prod.unitPrice,
          category: prod.category,
        },
        currentStock: prod.currentStock,
      },
    ]);
    setProductSearch('');
  };

  const handleSaveEdit = async () => {
    if (editableItems.length === 0) {
      toast.error('Challan must contain at least one item');
      return;
    }
    setSavingEdit(true);
    try {
      await api.patch(`/challans/${id}`, {
        items: editableItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      });
      toast.success('Challan draft updated');
      setIsEditing(false);
      fetchChallan();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    setStockErrors([]);
    try {
      await api.post(`/challans/${id}/confirm`);
      toast.success('Challan confirmed! Stock has been updated.');
      fetchChallan();
    } catch (err) {
      const details = getErrorDetails(err);
      if (details?.insufficientItems) {
        setStockErrors(details.insufficientItems);
        toast.error(`Insufficient stock for ${details.insufficientItems.length} product(s). No stock was deducted.`);
      } else {
        toast.error(getErrorMessage(err));
      }
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this challan?')) return;
    setCancelling(true);
    try {
      await api.post(`/challans/${id}/cancel`);
      toast.success(challan?.status === 'CONFIRMED' ? 'Challan cancelled. Stock restored.' : 'Challan cancelled.');
      fetchChallan();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  const handleDownloadPDF = () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const token = localStorage.getItem('erp_token');
    window.open(`${API_URL}/challans/${id}/pdf?token=${token}`, '_blank');
    toast.success('PDF download started');
  };

  const grandTotal = isEditing
    ? editableItems.reduce((sum, item) => sum + parseFloat(item.productSnapshot.unitPrice) * item.quantity, 0)
    : challan?.items.reduce((sum, item) => sum + parseFloat(item.lineTotal), 0) ?? 0;

  const totalQuantity = isEditing
    ? editableItems.reduce((sum, item) => sum + item.quantity, 0)
    : challan?.totalQuantity ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in max-w-4xl mx-auto">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="glass-card p-6"><div className="skeleton h-64 rounded" /></div>
      </div>
    );
  }

  if (!challan) return <div className="text-center p-12 text-muted-foreground">Challan not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/challans')} className="btn-ghost p-2" disabled={isEditing}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-foreground font-mono">{challan.challanNumber}</h2>
              <span className={STATUS_CLASSES[challan.status]}>{challan.status}</span>
            </div>
            <p className="text-sm text-muted-foreground">Created {formatDateTime(challan.createdAt)} by {challan.createdBy.name}</p>
          </div>
        </div>
        <div className="flex gap-2 sm:ml-auto flex-wrap">
          {!isEditing ? (
            <>
               <button onClick={() => setShowPreview(true)} className="btn-secondary">
                 👁️ Preview
               </button>
               <button onClick={handleDownloadPDF} className="btn-secondary">
                 <Download className="w-4 h-4" />
                 Download
               </button>
              {canManage && challan.status === 'DRAFT' && (
                <>
                  <button onClick={handleStartEdit} className="btn-secondary">
                    ✏️ Edit Draft
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={confirming}
                    className="btn-primary"
                  >
                    {confirming ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Confirm
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="btn-danger"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancel
                  </button>
                </>
              )}
              {canManage && challan.status === 'CONFIRMED' && (
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="btn-danger"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel & Restore Stock
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={handleCancelEdit} disabled={savingEdit} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="btn-primary">
                {savingEdit ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '💾 Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stock errors */}
      {stockErrors.length > 0 && (
        <div className="glass-card p-4 border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 text-red-400 font-semibold mb-3">
            <AlertCircle className="w-5 h-5" />
            Insufficient Stock — Challan remains as DRAFT. No stock was deducted.
          </div>
          <div className="space-y-2">
            {(stockErrors as { productName: string; sku: string; required: number; available: number; shortfall: number }[]).map((e) => (
              <div key={e.productName} className="text-sm bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                <span className="font-medium text-foreground">{e.productName}</span>
                <span className="text-muted-foreground ml-1">({e.sku})</span>
                <span className="text-red-400 ml-2">
                  — Need {e.required}, have {e.available} (short by {e.shortfall})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Product (only shown when editing draft) */}
      {isEditing && (
        <div className="glass-card p-4">
          <label className="text-xs font-semibold text-muted-foreground block mb-2">Search and add more products to this draft</label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products to add..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          {productSearch && (
            <div className="mt-2 border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              {searchedProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleAddProduct(p)}
                  className="flex items-center justify-between p-3 hover:bg-secondary cursor-pointer border-b border-border/50 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sku} · Stock: {p.currentStock}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{formatCurrency(parseFloat(p.unitPrice))}</p>
                    <span className="text-xs text-primary">+ Add</span>
                  </div>
                </div>
              ))}
              {searchedProducts.length === 0 && <p className="p-3 text-center text-muted-foreground text-sm">No products found</p>}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <h3 className="font-semibold text-foreground">Line Items</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left p-4 font-medium">#</th>
                    <th className="text-left p-4 font-medium">Product</th>
                    <th className="text-left p-4 font-medium hidden sm:table-cell">Unit Price</th>
                    <th className="text-left p-4 font-medium">Qty</th>
                    <th className="text-left p-4 font-medium">Total</th>
                    {isEditing && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody>
                  {!isEditing ? (
                    challan.items.map((item, idx) => {
                      const snapshot = item.productSnapshot;
                      return (
                        <tr key={item.id} className="border-b border-border/30">
                          <td className="p-4 text-muted-foreground">{idx + 1}</td>
                          <td className="p-4">
                            <p className="font-medium text-foreground">{snapshot.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{snapshot.sku}</p>
                            <span className="text-xs bg-secondary text-muted-foreground px-1.5 py-0.5 rounded mt-0.5 inline-block">
                              {snapshot.category}
                            </span>
                          </td>
                          <td className="p-4 hidden sm:table-cell text-muted-foreground">
                            {formatCurrency(parseFloat(snapshot.unitPrice))}
                          </td>
                          <td className="p-4 font-medium text-foreground">{item.quantity}</td>
                          <td className="p-4 font-semibold text-foreground">
                            {formatCurrency(parseFloat(item.lineTotal))}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    editableItems.map((item, idx) => {
                      const snapshot = item.productSnapshot;
                      const lineTotal = parseFloat(snapshot.unitPrice) * item.quantity;
                      return (
                        <tr key={item.productId} className="border-b border-border/30">
                          <td className="p-4 text-muted-foreground">{idx + 1}</td>
                          <td className="p-4">
                            <p className="font-medium text-foreground">{snapshot.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{snapshot.sku}</p>
                          </td>
                          <td className="p-4 hidden sm:table-cell text-muted-foreground">
                            {formatCurrency(parseFloat(snapshot.unitPrice))}
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleUpdateQuantity(item.productId, parseInt(e.target.value) || 1)}
                              min="1"
                              className="input-field w-20 text-center"
                            />
                            <div className="mt-1 text-center">
                              {item.quantity > item.currentStock ? (
                                <span className="text-[10px] text-red-400 font-semibold block">
                                  Exceeds stock ({item.currentStock})
                                </span>
                              ) : (
                                <span className="text-[10px] text-green-400 block">
                                  Stock: {item.currentStock}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 font-semibold text-foreground">
                            {formatCurrency(lineTotal)}
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => handleRemoveItem(item.productId)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              ❌
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border">
                    <td colSpan={3} className="p-4 text-muted-foreground text-sm">
                      {isEditing ? editableItems.length : challan.items.length} products · {totalQuantity} total qty
                    </td>
                    <td colSpan={2} className="p-4">
                      <p className="text-xs text-muted-foreground">Grand Total</p>
                      <p className="text-xl font-bold text-foreground">{formatCurrency(grandTotal)}</p>
                    </td>
                    {isEditing && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Customer & meta info */}
        <div className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Customer
            </h3>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">{challan.customer.name}</p>
              <p className="text-muted-foreground">{challan.customer.businessName}</p>
              <p className="text-muted-foreground">{challan.customer.mobile}</p>
              <p className="text-muted-foreground text-xs">{challan.customer.address}</p>
              {challan.customer.gstNumber && (
                <p className="text-xs text-muted-foreground font-mono">GST: {challan.customer.gstNumber}</p>
              )}
              <Link to={`/customers/${challan.customer.id}`} className="text-xs text-primary hover:underline block pt-1">
                View customer →
              </Link>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-semibold text-foreground mb-3">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className={STATUS_CLASSES[challan.status]}>{challan.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="text-foreground">{formatDate(challan.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span className="text-foreground">{formatDate(challan.updatedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">By</span>
                <span className="text-foreground">{challan.createdBy.name}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-card shrink-0">
              <div>
                <h3 className="font-semibold text-foreground">Invoice Preview — {challan.challanNumber}</h3>
                <p className="text-xs text-muted-foreground">Generated by PDFKit engine</p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="btn-secondary px-3 py-1 text-xs"
              >
                Close ✕
              </button>
            </div>
            <div className="flex-1 bg-secondary/30 p-2 min-h-0">
              <iframe
                src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/challans/${id}/pdf?token=${localStorage.getItem('erp_token')}&inline=true`}
                className="w-full h-full rounded border border-border bg-white"
                title="Challan PDF Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
