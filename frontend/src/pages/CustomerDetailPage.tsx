import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Phone, Mail, MapPin, Building2, MessageSquare } from 'lucide-react';
import { api, getErrorMessage } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatDateTime, getInitials } from '../lib/utils';
import toast from 'react-hot-toast';

interface CustomerDetail {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  businessName: string;
  gstNumber: string | null;
  customerType: string;
  status: string;
  address: string;
  followUpDate: string | null;
  createdAt: string;
  notes: {
    id: string;
    note: string;
    createdAt: string;
    author: { name: string; role: string };
  }[];
  _count: { challans: number };
}

const STATUS_CLASSES: Record<string, string> = {
  ACTIVE: 'badge-active', LEAD: 'badge-lead', INACTIVE: 'badge-inactive',
};

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isRole } = useAuth();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [note, setNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const canWrite = isRole('ADMIN', 'SALES');

  const fetchCustomer = useCallback(async () => {
    try {
      const res = await api.get(`/customers/${id}`);
      setCustomer(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchCustomer(); }, [fetchCustomer]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setAddingNote(true);
    try {
      await api.post(`/customers/${id}/notes`, { note: note.trim() });
      setNote('');
      toast.success('Note added');
      fetchCustomer();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAddingNote(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="skeleton h-8 w-40 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-6"><div className="skeleton h-48 rounded" /></div>
          <div className="glass-card p-6"><div className="skeleton h-48 rounded" /></div>
        </div>
      </div>
    );
  }

  if (!customer) return <div className="text-muted-foreground p-8 text-center">Customer not found.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link to="/customers" className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-foreground">{customer.name}</h2>
          <p className="text-sm text-muted-foreground">{customer.businessName}</p>
        </div>
        <div className="ml-auto">
          <span className={STATUS_CLASSES[customer.status]}>{customer.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-6">
            <h3 className="font-semibold text-foreground mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: Phone, label: 'Mobile', value: customer.mobile },
                { icon: Mail, label: 'Email', value: customer.email || '—' },
                { icon: Building2, label: 'Customer Type', value: customer.customerType },
                { icon: Building2, label: 'GST Number', value: customer.gstNumber || '—' },
                { icon: MapPin, label: 'Address', value: customer.address },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm text-foreground">{value}</p>
                  </div>
                </div>
              ))}
              {customer.followUpDate && (
                <div className="flex items-start gap-3">
                  <Building2 className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Follow Up Date</p>
                    <p className="text-sm text-yellow-400 font-medium">{formatDate(customer.followUpDate)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes Timeline */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Follow-up Notes
                <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                  {customer.notes.length}
                </span>
              </h3>
            </div>

            {/* Add note form */}
            {canWrite && (
              <form onSubmit={handleAddNote} className="mb-6">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a follow-up note..."
                  className="input-field resize-none mb-2"
                  rows={2}
                />
                <button type="submit" disabled={addingNote || !note.trim()} className="btn-primary">
                  <Plus className="w-4 h-4" />
                  Add Note
                </button>
              </form>
            )}

            {/* Notes list */}
            {customer.notes.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No notes yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {customer.notes.map((n) => (
                  <div key={n.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                      {getInitials(n.author.name)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">{n.author.name}</span>
                        <span className="text-xs text-muted-foreground">{n.author.role}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{formatDateTime(n.createdAt)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3">{n.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar stats */}
        <div className="space-y-4">
          <div className="glass-card p-6">
            <h3 className="font-semibold text-foreground mb-4">Account Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Total Challans</span>
                <span className="font-semibold text-foreground">{customer._count.challans}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Notes</span>
                <span className="font-semibold text-foreground">{customer.notes.length}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">Customer Since</span>
                <span className="font-semibold text-foreground">{formatDate(customer.createdAt)}</span>
              </div>
            </div>
          </div>

          <Link
            to={`/challans?customerId=${customer.id}`}
            className="glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors"
          >
            <span className="text-sm font-medium text-foreground">View Challans</span>
            <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
          </Link>
        </div>
      </div>
    </div>
  );
};
