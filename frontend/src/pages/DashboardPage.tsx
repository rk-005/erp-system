import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Package, FileText, AlertTriangle, TrendingUp, ArrowRight, CheckCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/utils';

interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  totalProducts: number;
  lowStockCount: number;
  draftChallans: number;
  confirmedChallansThisWeek: number;
  totalChallans: number;
}

interface LowStockProduct {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  minStockAlert: number;
  category: string;
}

const SkeletonCard = () => (
  <div className="stat-card">
    <div className="skeleton h-4 w-24 mb-2" />
    <div className="skeleton h-8 w-16 mb-1" />
    <div className="skeleton h-3 w-32" />
  </div>
);

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [customersRes, productsRes, challansRes, lowStockRes] = await Promise.all([
          api.get('/customers?limit=1'),
          api.get('/products?limit=1'),
          api.get('/challans?limit=100'),
          api.get('/products/low-stock'),
        ]);

        const challans = challansRes.data.data as { status: string; createdAt: string }[];
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const draftChallans = challans.filter((c) => c.status === 'DRAFT').length;
        const confirmedThisWeek = challans.filter(
          (c) => c.status === 'CONFIRMED' && new Date(c.createdAt) >= oneWeekAgo
        ).length;

        setStats({
          totalCustomers: customersRes.data.pagination.total,
          activeCustomers: 0,
          totalProducts: productsRes.data.pagination.total,
          lowStockCount: lowStockRes.data.data.length,
          draftChallans,
          confirmedChallansThisWeek: confirmedThisWeek,
          totalChallans: challansRes.data.pagination?.total || challans.length,
        });

        setLowStockProducts(lowStockRes.data.data.slice(0, 5));
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Banner */}
      <div className="gradient-border rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Welcome back, {user?.name?.split(' ')[0]} 👋
            </h2>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with your business today.
            </p>
          </div>
          <div className="hidden sm:block">
            <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${
              user?.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
              user?.role === 'SALES' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
              user?.role === 'WAREHOUSE' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
              'bg-green-500/20 text-green-400 border-green-500/30'
            }`}>
              {user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <Link to="/customers" className="stat-card hover:scale-[1.01] transition-transform">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-blue-500/15">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{stats?.totalCustomers ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Customers</p>
            </Link>

            <Link to="/products" className="stat-card hover:scale-[1.01] transition-transform">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-purple-500/15">
                  <Package className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-xs text-muted-foreground">Products</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{stats?.totalProducts ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-1">In catalog</p>
            </Link>

            <Link to="/products?lowStock=true" className={`stat-card hover:scale-[1.01] transition-transform ${(stats?.lowStockCount ?? 0) > 0 ? 'border-red-500/30 hover:border-red-500/50' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${(stats?.lowStockCount ?? 0) > 0 ? 'bg-red-500/15' : 'bg-green-500/15'}`}>
                  <AlertTriangle className={`w-5 h-5 ${(stats?.lowStockCount ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`} />
                </div>
                <span className="text-xs text-muted-foreground">Alert</span>
              </div>
              <p className={`text-3xl font-bold ${(stats?.lowStockCount ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {stats?.lowStockCount ?? 0}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Low stock items</p>
            </Link>

            <Link to="/challans" className="stat-card hover:scale-[1.01] transition-transform">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-green-500/15">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <span className="text-xs text-muted-foreground">This week</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{stats?.confirmedChallansThisWeek ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Confirmed challans</p>
            </Link>
          </>
        )}
      </div>

      {/* Quick Actions + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="glass-card p-6">
          <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { label: 'New Customer', href: '/customers?new=true', icon: Users, color: 'text-blue-400', roles: ['ADMIN', 'SALES'] },
              { label: 'New Challan', href: '/challans/new', icon: FileText, color: 'text-green-400', roles: ['ADMIN', 'SALES'] },
              { label: 'Add Product', href: '/products?new=true', icon: Package, color: 'text-purple-400', roles: ['ADMIN', 'WAREHOUSE'] },
              { label: 'View Challans', href: '/challans', icon: CheckCircle, color: 'text-orange-400', roles: ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'] },
            ]
              .filter((action) => action.roles.includes(user?.role || ''))
              .map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    to={action.href}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-secondary/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${action.color}`} />
                      <span className="text-sm text-foreground">{action.label}</span>
                    </div>
                    <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Link>
                );
              })}
          </div>
        </div>

        {/* Challan Status */}
        <div className="glass-card p-6">
          <h3 className="font-semibold text-foreground mb-4">Challan Overview</h3>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-10 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <span className="text-sm text-blue-400">Draft</span>
                <span className="font-bold text-blue-400">{stats?.draftChallans ?? 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <span className="text-sm text-green-400">Confirmed (this week)</span>
                <span className="font-bold text-green-400">{stats?.confirmedChallansThisWeek ?? 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border/50">
                <span className="text-sm text-muted-foreground">Total challans</span>
                <span className="font-bold text-foreground">{stats?.totalChallans ?? 0}</span>
              </div>
            </div>
          )}
        </div>

        {/* Low Stock Alert */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Low Stock Alert</h3>
            {(stats?.lowStockCount ?? 0) > 0 && (
              <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
                {stats?.lowStockCount} items
              </span>
            )}
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-8 rounded" />
              ))}
            </div>
          ) : lowStockProducts.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">All products are well-stocked</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockProducts.map((product) => (
                <Link
                  key={product.id}
                  to={`/products/${product.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.sku}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-sm font-bold text-red-400">{product.currentStock}</p>
                    <p className="text-xs text-muted-foreground">/ {product.minStockAlert} min</p>
                  </div>
                </Link>
              ))}
              {(stats?.lowStockCount ?? 0) > 5 && (
                <Link to="/products?lowStock=true" className="text-xs text-primary hover:underline block text-center pt-1">
                  View all {stats?.lowStockCount} low stock items →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
