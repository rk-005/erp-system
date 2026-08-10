import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Plus, ChevronRight, Phone, Mail, Building2, RefreshCw } from 'lucide-react';
import { api, getErrorMessage } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../lib/utils';
import toast from 'react-hot-toast';

interface Customer {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  businessName: string;
  customerType: 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR';
  status: 'LEAD' | 'ACTIVE' | 'INACTIVE';
  followUpDate: string | null;
  createdAt: string;
  _count: { notes: number; challans: number };
}

interface CustomerFormData {
  name: string;
  mobile: string;
  email: string;
  businessName: string;
  gstNumber: string;
  customerType: string;
  address: string;
  status: string;
  followUpDate: string;
}

const STATUS_CLASSES: Record<string, string> = {
  ACTIVE: 'badge-active',
  LEAD: 'badge-lead',
  INACTIVE: 'badge-inactive',
};

const TYPE_COLORS: Record<string, string> = {
  RETAIL: 'text-blue-400',
  WHOLESALE: 'text-purple-400',
  DISTRIBUTOR: 'text-orange-400',
};

const CustomerModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customer?: Customer | null;
}> = ({ open, onClose, onSuccess, customer }) => {
  const [form, setForm] = useState<CustomerFormData>({
    name: '',
    mobile: '',
    email: '',
    businessName: '',
    gstNumber: '',
    customerType: 'RETAIL',
    address: '',
    status: 'LEAD',
    followUpDate: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name,
        mobile: customer.mobile,
        email: customer.email || '',
        businessName: customer.businessName,
        gstNumber: '',
        customerType: customer.customerType,
        address: '',
        status: customer.status,
        followUpDate: customer.followUpDate ? customer.followUpDate.split('T')[0] : '',
      });
    } else {
      setForm({ name: '', mobile: '', email: '', businessName: '', gstNumber: '', customerType: 'RETAIL', address: '', status: 'LEAD', followUpDate: '' });
    }
  }, [customer, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = {
        ...form,
        email: form.email || undefined,
        gstNumber: form.gstNumber || undefined,
        followUpDate: form.followUpDate ? new Date(form.followUpDate).toISOString() : undefined,
      };
      if (customer) {
        await api.patch(`/customers/${customer.id}`, payload);
        toast.success('Customer updated');
      } else {
        await api.post('/customers', payload);
        toast.success('Customer created');
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const field = (key: keyof CustomerFormData, label: string, type = 'text', required = false) => (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}{required && ' *'}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="input-field"
        required={required}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border sticky top-0 bg-card">
          <h3 className="font-semibold text-foreground">{customer ? 'Edit Customer' : 'Add Customer'}</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {field('name', 'Full Name', 'text', true)}
            {field('mobile', 'Mobile', 'tel', true)}
            {field('email', 'Email', 'email')}
            {field('businessName', 'Business Name', 'text', true)}
            {field('gstNumber', 'GST Number')}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Customer Type *</label>
              <select value={form.customerType} onChange={(e) => setForm((f) => ({ ...f, customerType: e.target.value }))} className="input-field">
                <option value="RETAIL">Retail</option>
                <option value="WHOLESALE">Wholesale</option>
                <option value="DISTRIBUTOR">Distributor</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Status *</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="input-field">
                <option value="LEAD">Lead</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            {field('followUpDate', 'Follow Up Date', 'date')}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Address *</label>
            <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="input-field resize-none" rows={2} required />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={isLoading} className="btn-primary flex-1 justify-center">
              {isLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
              {customer ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const CustomersPage: React.FC = () => {
  const { isRole } = useAuth();
  const [searchParams] = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === 'true');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const canWrite = isRole('ADMIN', 'SALES');
  const LIMIT = 15;

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });
      const res = await api.get(`/customers?${params}`);
      setCustomers(res.data.data);
      setTotal(res.data.pagination.total);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Customers</h2>
          <p className="text-sm text-muted-foreground">{total} total customers</p>
        </div>
        {canWrite && (
          <button onClick={() => { setEditingCustomer(null); setModalOpen(true); }} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, mobile, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field sm:w-40">
          <option value="">All Status</option>
          <option value="LEAD">Lead</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <button onClick={fetchCustomers} className="btn-ghost p-2">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="text-left p-4 font-medium">Customer</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">Contact</th>
                <th className="text-left p-4 font-medium hidden lg:table-cell">Type</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium hidden sm:table-cell">Follow Up</th>
                <th className="text-left p-4 font-medium hidden xl:table-cell">Challans</th>
                <th className="w-8 p-4" />
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
                : customers.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No customers found</p>
                    </td>
                  </tr>
                )
                : customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-border/30 table-row-hover"
                    onClick={() => canWrite && (setEditingCustomer(customer), setModalOpen(true))}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {customer.name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{customer.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-3 h-3" />{customer.businessName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <p className="flex items-center gap-1 text-muted-foreground"><Phone className="w-3 h-3" />{customer.mobile}</p>
                      {customer.email && <p className="flex items-center gap-1 text-muted-foreground text-xs mt-0.5"><Mail className="w-3 h-3" />{customer.email}</p>}
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <span className={`text-xs font-medium ${TYPE_COLORS[customer.customerType]}`}>{customer.customerType}</span>
                    </td>
                    <td className="p-4">
                      <span className={STATUS_CLASSES[customer.status]}>{customer.status}</span>
                    </td>
                    <td className="p-4 hidden sm:table-cell">
                      {customer.followUpDate ? (
                        <span className="text-xs text-yellow-400">{formatDate(customer.followUpDate)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4 hidden xl:table-cell text-muted-foreground">{customer._count.challans}</td>
                    <td className="p-4">
                      <Link to={`/customers/${customer.id}`} onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-primary">
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

      <CustomerModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingCustomer(null); }}
        onSuccess={fetchCustomers}
        customer={editingCustomer}
      />
    </div>
  );
};
