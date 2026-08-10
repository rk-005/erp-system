import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, ArrowLeft, AlertCircle } from 'lucide-react';
import { api, getErrorMessage, getErrorDetails } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import toast from 'react-hot-toast';

interface Customer {
  id: string;
  name: string;
  businessName: string;
  mobile: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  unitPrice: string;
  currentStock: number;
  category: string;
}

interface LineItem {
  productId: string;
  product: Product;
  quantity: number;
}

interface InsufficientStockItem {
  productName: string;
  sku: string;
  required: number;
  available: number;
  shortfall: number;
}

export const NewChallanPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'customer' | 'products'>('customer');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stockErrors, setStockErrors] = useState<InsufficientStockItem[]>([]);

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await api.get(`/customers?limit=100${customerSearch ? `&search=${customerSearch}` : ''}`);
        setCustomers(res.data.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCustomers();
  }, [customerSearch]);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get(`/products?limit=100${productSearch ? `&search=${productSearch}` : ''}`);
        setProducts(res.data.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchProducts();
  }, [productSearch]);

  const addProduct = (product: Product) => {
    if (lineItems.find((i) => i.productId === product.id)) {
      toast('Product already added. Update quantity below.');
      return;
    }
    setLineItems((prev) => [...prev, { productId: product.id, product, quantity: 1 }]);
    setProductSearch('');
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setLineItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity: Math.max(1, quantity) } : i))
    );
  };

  const removeItem = (productId: string) => {
    setLineItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const grandTotal = lineItems.reduce(
    (sum, item) => sum + parseFloat(item.product.unitPrice) * item.quantity, 0
  );
  const totalQuantity = lineItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleSubmit = async (confirm: boolean) => {
    if (!selectedCustomer) { toast.error('Select a customer'); return; }
    if (lineItems.length === 0) { toast.error('Add at least one product'); return; }

    setIsLoading(true);
    setStockErrors([]);

    try {
      const payload = {
        customerId: selectedCustomer.id,
        items: lineItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        status: confirm ? 'CONFIRMED' : 'DRAFT',
      };

      const res = await api.post('/challans', payload);
      const challan = res.data.data;

      toast.success(confirm ? `Challan ${challan.challanNumber} confirmed! Stock updated.` : `Challan saved as draft`);
      navigate(`/challans/${challan.id}`);
    } catch (err) {
      const details = getErrorDetails(err);
      if (details?.insufficientItems) {
        setStockErrors(details.insufficientItems);
        toast.error(`Insufficient stock for ${details.insufficientItems.length} product(s)`);
      } else {
        toast.error(getErrorMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/challans')} className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-foreground">New Sales Challan</h2>
          <p className="text-sm text-muted-foreground">
            {step === 'customer' ? 'Step 1: Select Customer' : `Step 2: Add Products — ${selectedCustomer?.name}`}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {['customer', 'products'].map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 ${step === s ? 'text-primary' : step === 'products' && s === 'customer' ? 'text-green-400' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${step === s ? 'border-primary bg-primary/20' : step === 'products' && s === 'customer' ? 'border-green-500 bg-green-500/20' : 'border-border bg-secondary'}`}>
                {i + 1}
              </div>
              <span className="text-sm font-medium capitalize">{s}</span>
            </div>
            {i < 1 && <div className="flex-1 h-px bg-border" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Customer Selection */}
      {step === 'customer' && (
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-semibold text-foreground">Select Customer</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search customers..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {customers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => { setSelectedCustomer(customer); setStep('products'); }}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedCustomer?.id === customer.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50 hover:bg-secondary/50'
                }`}
              >
                <p className="font-medium text-foreground">{customer.name}</p>
                <p className="text-xs text-muted-foreground">{customer.businessName} · {customer.mobile}</p>
              </div>
            ))}
            {customers.length === 0 && (
              <p className="text-muted-foreground text-center py-4">No customers found</p>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Products */}
      {step === 'products' && (
        <div className="space-y-4">
          {/* Stock errors */}
          {stockErrors.length > 0 && (
            <div className="glass-card p-4 border-red-500/30 bg-red-500/5">
              <div className="flex items-center gap-2 text-red-400 font-semibold mb-3">
                <AlertCircle className="w-5 h-5" />
                Insufficient Stock — No stock was deducted
              </div>
              <div className="space-y-2">
                {stockErrors.map((e) => (
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

          {/* Product search */}
          <div className="glass-card p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search and add products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="input-field pl-9"
              />
            </div>
            {productSearch && (
              <div className="mt-2 border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {products.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className="flex items-center justify-between p-3 hover:bg-secondary cursor-pointer border-b border-border/50 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.sku} · Stock: {p.currentStock}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">{formatCurrency(parseFloat(p.unitPrice))}</p>
                      <button className="text-xs text-primary">
                        <Plus className="w-3 h-3 inline" /> Add
                      </button>
                    </div>
                  </div>
                ))}
                {products.length === 0 && <p className="p-3 text-center text-muted-foreground text-sm">No products found</p>}
              </div>
            )}
          </div>

          {/* Line items */}
          {lineItems.length > 0 ? (
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="text-left p-4 font-medium">Product</th>
                      <th className="text-left p-4 font-medium hidden sm:table-cell">Unit Price</th>
                      <th className="text-left p-4 font-medium">Quantity</th>
                      <th className="text-left p-4 font-medium">Line Total</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => {
                      const lineTotal = parseFloat(item.product.unitPrice) * item.quantity;
                      const hasStockError = stockErrors.some((e) => e.productName === item.product.name);
                      return (
                        <tr key={item.productId} className={`border-b border-border/30 ${hasStockError ? 'bg-red-500/5' : ''}`}>
                          <td className="p-4">
                            <p className="font-medium text-foreground">{item.product.name}</p>
                            <p className="text-xs text-muted-foreground">{item.product.sku}</p>
                            {hasStockError && (
                              <p className="text-xs text-red-400 mt-0.5 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Insufficient stock
                              </p>
                            )}
                          </td>
                          <td className="p-4 hidden sm:table-cell text-muted-foreground">
                            {formatCurrency(parseFloat(item.product.unitPrice))}
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value) || 1)}
                              min="1"
                              max={item.product.currentStock}
                              className="input-field w-24 text-center"
                            />
                          </td>
                          <td className="p-4 font-semibold text-foreground">
                            {formatCurrency(lineTotal)}
                          </td>
                          <td className="p-4">
                            <button onClick={() => removeItem(item.productId)} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border">
                      <td colSpan={2} className="p-4 text-muted-foreground">
                        Total: {lineItems.length} products · {totalQuantity} items
                      </td>
                      <td colSpan={3} className="p-4 text-right">
                        <span className="text-xl font-bold text-foreground">{formatCurrency(grandTotal)}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <Plus className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Search and add products above</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <button onClick={() => setStep('customer')} className="btn-ghost">
              ← Back
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={isLoading || lineItems.length === 0}
              className="btn-secondary"
            >
              {isLoading ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : null}
              Save as Draft
            </button>
            <button
              onClick={() => handleSubmit(true)}
              disabled={isLoading || lineItems.length === 0}
              className="btn-primary"
            >
              {isLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
              Confirm Challan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
