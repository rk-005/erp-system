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
    // Open in new tab with auth — browser download handles it
    window.open(`${API_URL}/challans/${id}/pdf?token=${token}`, '_blank');
    // Note: In production use proper auth headers via fetch + blob download
    // For now using query param approach for simplicity
    toast.success('PDF download started');
  };

  const grandTotal = challan?.items.reduce(
    (sum, item) => sum + parseFloat(item.lineTotal),
    0
  ) ?? 0;

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
          <button onClick={() => navigate('/challans')} className="btn-ghost p-2">
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
          <button onClick={handleDownloadPDF} className="btn-secondary">
            <Download className="w-4 h-4" />
            PDF
          </button>
          {canManage && challan.status === 'DRAFT' && (
            <>
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
                  </tr>
                </thead>
                <tbody>
                  {challan.items.map((item, idx) => {
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
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border">
                    <td colSpan={3} className="p-4 text-muted-foreground text-sm">
                      {challan.items.length} products · {challan.totalQuantity} total qty
                    </td>
                    <td colSpan={2} className="p-4">
                      <p className="text-xs text-muted-foreground">Grand Total</p>
                      <p className="text-xl font-bold text-foreground">{formatCurrency(grandTotal)}</p>
                    </td>
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
    </div>
  );
};
