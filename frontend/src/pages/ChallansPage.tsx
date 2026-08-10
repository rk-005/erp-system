import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, FileText, ChevronRight, RefreshCw, TrendingDown } from 'lucide-react';
import { api, getErrorMessage } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatCurrency } from '../lib/utils';
import toast from 'react-hot-toast';

interface ChallanSummary {
  id: string;
  challanNumber: string;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  totalQuantity: number;
  createdAt: string;
  customer: { id: string; name: string; businessName: string };
  createdBy: { name: string };
  _count: { items: number };
}

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'badge-draft',
  CONFIRMED: 'badge-confirmed',
  CANCELLED: 'badge-cancelled',
};

export const ChallansPage: React.FC = () => {
  const { isRole } = useAuth();
  const [searchParams] = useSearchParams();
  const [challans, setChallans] = useState<ChallanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const canCreate = isRole('ADMIN', 'SALES');
  const LIMIT = 15;

  const fetchChallans = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(statusFilter && { status: statusFilter }),
        ...(searchParams.get('customerId') ? { customerId: searchParams.get('customerId')! } : {}),
      });
      const res = await api.get(`/challans?${params}`);
      setChallans(res.data.data);
      setTotal(res.data.pagination.total);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, searchParams]);

  useEffect(() => { fetchChallans(); }, [fetchChallans]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Sales Challans</h2>
          <p className="text-sm text-muted-foreground">{total} total challans</p>
        </div>
        {canCreate && (
          <Link to="/challans/new" className="btn-primary">
            <Plus className="w-4 h-4" />
            New Challan
          </Link>
        )}
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 flex-wrap">
        {['', 'DRAFT', 'CONFIRMED', 'CANCELLED'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              statusFilter === status
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {status || 'All'}
          </button>
        ))}
        <button onClick={fetchChallans} className="btn-ghost p-2 ml-auto">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="text-left p-4 font-medium">Challan No.</th>
                <th className="text-left p-4 font-medium">Customer</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium hidden sm:table-cell">Items</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">Created</th>
                <th className="text-left p-4 font-medium hidden lg:table-cell">By</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/30">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="p-4"><div className="skeleton h-4 rounded" /></td>
                      ))}
                    </tr>
                  ))
                : challans.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No challans found</p>
                      {canCreate && (
                        <Link to="/challans/new" className="btn-primary mt-4 inline-flex">
                          <Plus className="w-4 h-4" />
                          Create first challan
                        </Link>
                      )}
                    </td>
                  </tr>
                )
                : challans.map((challan) => (
                  <tr key={challan.id} className="border-b border-border/30 table-row-hover">
                    <td className="p-4">
                      <Link to={`/challans/${challan.id}`} className="font-mono text-primary font-medium hover:underline">
                        {challan.challanNumber}
                      </Link>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-foreground">{challan.customer.name}</p>
                      <p className="text-xs text-muted-foreground">{challan.customer.businessName}</p>
                    </td>
                    <td className="p-4">
                      <span className={STATUS_CLASSES[challan.status]}>{challan.status}</span>
                    </td>
                    <td className="p-4 hidden sm:table-cell text-muted-foreground">
                      {challan._count.items} items · {challan.totalQuantity} qty
                    </td>
                    <td className="p-4 hidden md:table-cell text-muted-foreground">
                      {formatDate(challan.createdAt)}
                    </td>
                    <td className="p-4 hidden lg:table-cell text-muted-foreground">
                      {challan.createdBy.name}
                    </td>
                    <td className="p-4">
                      <Link to={`/challans/${challan.id}`} className="text-muted-foreground hover:text-primary">
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border/50 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary py-1 px-3 text-xs">Prev</button>
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary py-1 px-3 text-xs">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
