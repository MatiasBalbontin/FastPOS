import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Search,
  Package,
  BarChart3,
  ShoppingCart,
  AlertTriangle,
  Plus,
  X,
  Check,
  TrendingUp,
  ArrowRight,
  Download,
  Upload,
  Eye,
  EyeOff,
  Trash2,
  CreditCard,
  Banknote,
  Minus,
  Edit2,
  Lock,
  FileSpreadsheet,
  FileUp,
  FileMinus,
  Receipt,
  History,
  FileText,
  Settings,
  Users
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList
} from 'recharts';
import { cn } from './lib/utils';

// --- Types ---
interface Product {
  id: string;
  name: string;
  type: string;
  sale_price: number;
  total_stock: number;
  has_zero_cost: boolean;
  cost?: number; // Added for display
  active: number; // 1 for active, 0 for inactive
}

interface Analytics {
  topProducts: { name: string; volume: number; revenue: number }[];
  categoryAnalysis: { type: string; volume: number; revenue: number }[];
  summary: { 
    total_revenue: number; total_cost: number; total_profit: number; 
    collected_revenue: number; collected_cost: number;
    receivables_revenue: number; receivables_cost: number;
    cash_revenue: number; card_revenue: number;
    total_expenses: number; cash_expenses: number; card_expenses: number;
    total_inventory_value: number;
    total_receivables: number;
    total_fixed_costs: number;
  };
  inventoryByFamily: { type: string; total_stock: number; total_value: number }[];
}

// --- Search Normalization Utilities ---
const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const matchProduct = (product: Product, query: string): boolean => {
  const queryNormalized = normalizeString(query).trim();
  if (!queryNormalized) return false;
  
  const queryTokens = queryNormalized.split(/\s+/);
  const nameNormalized = normalizeString(product.name);
  const idNormalized = normalizeString(product.id);
  
  return queryTokens.every(token => 
    nameNormalized.includes(token) || idNormalized.includes(token)
  );
};

const matchCustomer = (customer: any, query: string): boolean => {
  const queryNormalized = normalizeString(query).trim();
  if (!queryNormalized) return false;
  
  const queryTokens = queryNormalized.split(/\s+/);
  const fullNameNormalized = normalizeString(`${customer.first_name || ''} ${customer.last_name || ''}`);
  const rutNormalized = normalizeString(customer.rut || '');
  const contactNormalized = normalizeString(customer.contact || '');
  
  return queryTokens.every(token => 
    fullNameNormalized.includes(token) || 
    rutNormalized.includes(token) ||
    contactNormalized.includes(token)
  );
};

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold transition-all rounded-lg mb-1",
      active
        ? "bg-[var(--primary)] text-white shadow-md shadow-blue-200"
        : "text-gray-500 hover:bg-gray-100 hover:text-[var(--ink)]"
    )}
  >
    <Icon size={18} />
    <span>{label}</span>
  </button>
);

export default function App() {
  const [view, setView] = useState<'sales' | 'inventory' | 'analytics' | 'history' | 'expenses' | 'receivables' | 'fixed_costs' | 'quotes' | 'configuration' | 'entities'>('sales');
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isExpressModalOpen, setIsExpressModalOpen] = useState(false);
  const [scannedId, setScannedId] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(5);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showArchived, setShowArchived] = useState(false);

  const fetchProducts = async (includeInactive = false) => {
    const res = await fetch(`/api/products?includeInactive=${includeInactive}`);
    const data = await res.json();
    setProducts(data);
  };

  const fetchAnalytics = async () => {
    const res = await fetch(`/api/analytics?startDate=${startDate}T00:00:00&endDate=${endDate}T23:59:59`);
    const data = await res.json();
    setAnalytics(data);
  };

  useEffect(() => {
    fetchProducts(showArchived);
  }, [showArchived]);

  useEffect(() => {
    fetchAnalytics();
  }, [startDate, endDate]);

  useEffect(() => {
    if (view === 'analytics') {
      fetchAnalytics();
    }
  }, [view]);

  useEffect(() => {
    // Auto-focus search input
    if (view === 'sales' && !isExpressModalOpen) {
      searchInputRef.current?.focus();
    }
  }, [view, isExpressModalOpen]);

  const handleSale = async (items: { product_id: string; quantity: number }[], method: string, customer_id?: string) => {
    const res = await fetch('/api/sales/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, method, customer_id })
    });

    if (res.ok) {
      toast.success('Venta cargada con éxito');
      fetchProducts();
      fetchAnalytics();
      return true;
    } else {
      const data = await res.json();
      toast.error(data.error);
      return false;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Toaster position="top-right" theme="light" />

      {/* Sidebar */}
      <div className="w-64 border-r border-[var(--line)] flex flex-col bg-white p-4">
        <div className="mb-8 px-2">
          <h1 className="text-xl font-bold tracking-tight text-[var(--primary)]">FastPOS</h1>
          <div className="inline-block bg-[var(--accent)] text-[var(--ink)] text-[9px] font-bold px-2 py-0.5 rounded-full mt-1 uppercase tracking-wider">
            POS_EDITION v1.2.0
          </div>
        </div>

        <nav className="flex-1 mt-4">
          <SidebarItem
            icon={ShoppingCart}
            label="Terminal POS"
            active={view === 'sales'}
            onClick={() => setView('sales')}
          />
          <SidebarItem
            icon={Package}
            label="Inventario"
            active={view === 'inventory'}
            onClick={() => setView('inventory')}
          />
          <SidebarItem
            icon={BarChart3}
            label="Reportes"
            active={view === 'analytics'}
            onClick={() => setView('analytics')}
          />
          <SidebarItem
            icon={History}
            label="Historial"
            active={view === 'history'}
            onClick={() => setView('history')}
          />
          <SidebarItem
            icon={CreditCard}
            label="Cuentas por Cobrar"
            active={view === 'receivables'}
            onClick={() => setView('receivables')}
          />
          <SidebarItem
            icon={Users}
            label="Entidades"
            active={view === 'entities'}
            onClick={() => setView('entities')}
          />
          <SidebarItem
            icon={Receipt}
            label="Gastos de Caja"
            active={view === 'expenses'}
            onClick={() => setView('expenses')}
          />
          <SidebarItem
            icon={Lock}
            label="Costos Fijos"
            active={view === 'fixed_costs'}
            onClick={() => setView('fixed_costs')}
          />
          <SidebarItem
            icon={FileText}
            label="Cotizaciones"
            active={view === 'quotes'}
            onClick={() => setView('quotes')}
          />
          <SidebarItem
            icon={Settings}
            label="Configuración"
            active={view === 'configuration'}
            onClick={() => setView('configuration')}
          />
        </nav>

        <div className="p-4 border-t border-[var(--line)] space-y-2">
          {products.some(p => p.has_zero_cost) && (
            <div className="flex items-center gap-2 text-amber-600 animate-pulse">
              <AlertTriangle size={14} />
              <span className="text-[10px] font-bold uppercase">Costos pendientes ($0)</span>
            </div>
          )}
          {products.some(p => p.total_stock < lowStockThreshold) && (
            <div className="flex items-center gap-2 text-red-600 animate-pulse">
              <Package size={14} />
              <span className="text-[10px] font-bold uppercase">Stock Crítico</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative bg-[#F3F4F6]">
        {view === 'sales' && (
          <SalesView
            searchInputRef={searchInputRef}
            onSale={handleSale}
            products={products}
            onProductNotFound={(id: string) => {
              setScannedId(id.trim());
              setIsExpressModalOpen(true);
            }}
          />
        )}
        {view === 'inventory' && (
          <InventoryView
            products={products}
            onRefresh={() => fetchProducts(showArchived)}
            onAddProduct={() => {
              setScannedId('');
              setIsExpressModalOpen(true);
            }}
            lowStockThreshold={lowStockThreshold}
            setLowStockThreshold={setLowStockThreshold}
            showArchived={showArchived}
            setShowArchived={setShowArchived}
          />
        )}
        {view === 'analytics' && (
          <AnalyticsView
            analytics={analytics}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
          />
        )}
        {view === 'history' && (
          <HistoryView 
            onRefresh={() => {
              fetchProducts();
              fetchAnalytics();
            }}
          />
        )}
        {view === 'receivables' && (
          <ReceivablesView 
            onRefresh={() => {
              fetchAnalytics();
            }}
          />
        )}
        {view === 'expenses' && (
          <ExpensesView 
            onRefresh={() => {
              fetchAnalytics();
            }}
          />
        )}
        {view === 'fixed_costs' && (
          <FixedCostsView />
        )}
        {view === 'quotes' && (
          <QuotesView products={products} />
        )}
        {view === 'configuration' && (
          <ConfigurationView />
        )}
        {view === 'entities' && (
          <EntitiesView />
        )}
      </main>

      {/* Express Creation Modal */}
      {isExpressModalOpen && (
        <ExpressModal
          initialId={scannedId}
          onClose={() => {
            setIsExpressModalOpen(false);
            setScannedId('');
          }}
          onSuccess={() => {
            setIsExpressModalOpen(false);
            setScannedId('');
            fetchProducts();
          }}
        />
      )}
    </div>
  );
}

// --- Sub-Views ---

function SalesView({ searchInputRef, onSale, products, onProductNotFound }: any) {
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const filtered = query.trim() ? products.filter((p: any) =>
    matchProduct(p, query)
  ).slice(0, 5) : [];

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setQuery('');
    setSelectedIndex(-1);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const currentQty = typeof item.quantity === 'number' ? item.quantity : 0;
        const newQty = Math.max(1, currentQty + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const setQuantityExact = (productId: string, val: string) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        if (val === '') return { ...item, quantity: '' as any };
        const parsed = parseInt(val);
        const newQty = isNaN(parsed) ? 1 : Math.max(1, parsed);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const total = cart.reduce((acc, item) => acc + (item.product.sale_price * (Number(item.quantity) || 0)), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = query.trim().toUpperCase();
    if (!cleanQuery) return;

    // 1. Exact ID/barcode match
    const exactMatch = products.find((p: any) => p.id === cleanQuery);
    if (exactMatch) {
      addToCart(exactMatch);
      setQuery('');
      setSelectedIndex(-1);
      return;
    }

    // 2. Select highlighted item from keyboard navigation
    if (selectedIndex >= 0 && selectedIndex < filtered.length) {
      addToCart(filtered[selectedIndex]);
      setQuery('');
      setSelectedIndex(-1);
      return;
    }

    // 3. Fallback: select first match in suggestions
    if (filtered.length > 0) {
      addToCart(filtered[0]);
      setQuery('');
      setSelectedIndex(-1);
      return;
    }

    // 4. No matches: trigger creation modal
    onProductNotFound(cleanQuery);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setQuery('');
      setSelectedIndex(-1);
    }
  };

  const handleFinishSale = async (method: string, customer_id?: string) => {
    const items = cart.map(item => ({ product_id: item.product.id, quantity: item.quantity }));
    const success = await onSale(items, method, customer_id);
    if (success) {
      setCart([]);
      setIsPaymentModalOpen(false);
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        if (cart.length > 0) {
          setIsPaymentModalOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [cart]);

  return (
    <div className="flex h-full">
      {/* POS Left: Search & Results */}
      <div className="flex-1 p-8 flex flex-col">
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)] mb-1">Terminal POS</h2>
          <p className="text-sm text-gray-500">Escanee productos para cargar la comanda.</p>
        </div>

        <form onSubmit={handleSubmit} className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value.toUpperCase());
              setSelectedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder="ESCANEAR O BUSCAR PRODUCTO..."
            className="w-full bg-white border border-[var(--line)] py-4 pl-12 pr-4 text-lg font-medium rounded-xl shadow-sm focus:outline-none focus:ring-2 ring-[var(--primary)]/20 transition-all"
            autoFocus
          />

          {query && filtered.length > 0 && (
            <div className="absolute top-full left-0 w-full bg-white border border-[var(--line)] border-t-0 shadow-2xl z-10">
              {filtered.map((p: any, index: number) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  className={cn(
                    "w-full flex items-center justify-between p-4 hover:bg-gray-100 transition-colors group border-b border-[var(--line)] last:border-0",
                    index === selectedIndex ? "bg-blue-50 text-[var(--primary)] border-l-4 border-l-[var(--primary)]" : "bg-white text-[var(--ink)]"
                  )}
                >
                  <div className="text-left">
                    <div className="font-bold uppercase text-sm">{p.name}</div>
                    <div className="text-[10px] font-mono opacity-50">{p.id} // STOCK: {p.total_stock}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="font-mono text-lg">${p.sale_price.toLocaleString()}</div>
                    <Plus size={16} className="opacity-30 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* POS Right: Cart / Comanda */}
      <div className="w-96 border-l border-[var(--line)] bg-white flex flex-col shadow-2xl">
        <div className="p-6 border-b border-[var(--line)] bg-[var(--primary)] text-white">
          <div className="flex justify-between items-center">
            <h3 className="font-bold uppercase tracking-wider text-sm flex items-center gap-2">
              <ShoppingCart size={16} /> Detalle Comanda
            </h3>
            <span className="text-[10px] font-mono opacity-80 bg-white/20 px-2 py-0.5 rounded">#{new Date().getTime().toString().slice(-6)}</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3 bg-gray-50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 italic text-sm">
              <Package size={48} className="mb-4" />
              Comanda vacía
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="p-3 border border-[var(--line)] bg-[#F4F3F0] group">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-xs uppercase truncate pr-2">{item.product.name}</div>
                  <button onClick={() => removeFromCart(item.product.id)} className="opacity-0 group-hover:opacity-100 text-red-600 transition-opacity">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center border border-[var(--line)] bg-white rounded overflow-hidden">
                    <button onClick={() => updateQuantity(item.product.id, -1)} className="p-2 hover:bg-gray-100 border-r border-[var(--line)]"><Minus size={12} /></button>
                    <input 
                      type="number" 
                      min="1"
                      value={item.quantity} 
                      onChange={(e) => setQuantityExact(item.product.id, e.target.value)}
                      onBlur={(e) => {
                        if (e.target.value === '' || Number(e.target.value) < 1) {
                           setQuantityExact(item.product.id, '1');
                        }
                      }}
                      className="w-12 text-center font-mono text-xs py-1 focus:outline-none focus:bg-blue-50"
                    />
                    <button onClick={() => updateQuantity(item.product.id, 1)} className="p-2 hover:bg-gray-100 border-l border-[var(--line)]"><Plus size={12} /></button>
                  </div>
                  <div className="font-mono text-sm font-bold">
                    ${(item.product.sale_price * (Number(item.quantity) || 0)).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 border-t border-[var(--line)] bg-white">
          <div className="flex justify-between items-end mb-6">
            <div className="text-[10px] font-bold uppercase text-gray-400">Total a Pagar</div>
            <div className="text-4xl font-bold tracking-tight text-[var(--primary)]">${total.toLocaleString()}</div>
          </div>
          <button
            disabled={cart.length === 0}
            onClick={() => setIsPaymentModalOpen(true)}
            className="w-full bg-[var(--primary)] text-white py-4 rounded-xl font-bold uppercase tracking-wider text-sm hover:bg-[var(--primary-dark)] shadow-lg shadow-blue-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            Ir a Pagar [F10] <ArrowRight size={18} />
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <PaymentModal
          total={total}
          onClose={() => setIsPaymentModalOpen(false)}
          onConfirm={handleFinishSale}
        />
      )}
    </div>
  );
}

function PaymentModal({ total, onClose, onConfirm }: any) {
  const [method, setMethod] = useState<'cash' | 'card' | 'cuenta_por_cobrar' | null>(null);
  const [received, setReceived] = useState('');
  const [confirmCard, setConfirmCard] = useState(false);

  // Cuenta por Cobrar state
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ rut: '', first_name: '', last_name: '' });
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1);

  useEffect(() => {
    if (method === 'cuenta_por_cobrar') {
      fetch('/api/customers?type=cliente').then(res => res.json()).then(setCustomers);
    }
  }, [method]);

  const handleCreateCustomer = async () => {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCustomer)
    });
    if (res.ok) {
      const data = await res.json();
      const newC = { ...newCustomer, id: data.id };
      setCustomers([...customers, newC]);
      setSelectedCustomer(newC);
      setIsCreatingCustomer(false);
      setSearchCustomer('');
    } else {
      try {
        const data = await res.json();
        toast.error(data.error || "Error al crear cliente");
      } catch (e) {
        toast.error("Error de servidor. ¿Reiniciaste la consola (npm run dev)?");
      }
    }
  };

  const filteredCustomers = searchCustomer.trim() ? customers.filter(c => 
    matchCustomer(c, searchCustomer)
  ) : [];

  const handleCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCustomerIndex(prev => (prev < filteredCustomers.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCustomerIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setSearchCustomer('');
      setSelectedCustomerIndex(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedCustomerIndex >= 0 && selectedCustomerIndex < filteredCustomers.length) {
        setSelectedCustomer(filteredCustomers[selectedCustomerIndex]);
        setSearchCustomer('');
        setSelectedCustomerIndex(-1);
      } else if (filteredCustomers.length > 0) {
        setSelectedCustomer(filteredCustomers[0]);
        setSearchCustomer('');
        setSelectedCustomerIndex(-1);
      }
    }
  };

  const change = method === 'cash' ? (parseFloat(received) || 0) - total : 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[60] p-4">
      <div className="bg-[var(--bg)] border-2 border-[var(--line)] w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-[var(--line)] flex justify-between items-center bg-[var(--ink)] text-[var(--bg)]">
          <h3 className="font-bold uppercase italic tracking-widest text-sm">Finalizar Venta // Pago</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="p-8 space-y-8">
          <div className="text-center">
            <div className="text-[10px] font-bold uppercase opacity-50 mb-1">Monto Total</div>
            <div className="text-5xl font-mono font-bold tracking-tighter">${total.toLocaleString()}</div>
          </div>

          {!method ? (
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => setMethod('cash')}
                className="flex flex-col items-center gap-4 p-6 border-2 border-[var(--line)] hover:bg-[var(--ink)] hover:text-[var(--bg)] transition-all group rounded-xl"
              >
                <Banknote size={40} className="opacity-40 group-hover:opacity-100" />
                <span className="font-bold uppercase text-xs tracking-widest text-center">Efectivo</span>
              </button>
              <button
                onClick={() => setMethod('card')}
                className="flex flex-col items-center gap-4 p-6 border-2 border-[var(--line)] hover:bg-[var(--ink)] hover:text-[var(--bg)] transition-all group rounded-xl"
              >
                <CreditCard size={40} className="opacity-40 group-hover:opacity-100" />
                <span className="font-bold uppercase text-xs tracking-widest text-center">Tarjeta</span>
              </button>
              <button
                onClick={() => setMethod('cuenta_por_cobrar')}
                className="flex flex-col items-center gap-4 p-6 border-2 border-[var(--line)] hover:bg-[var(--ink)] hover:text-[var(--bg)] transition-all group rounded-xl"
              >
                <FileMinus size={40} className="opacity-40 group-hover:opacity-100" />
                <span className="font-bold uppercase text-xs tracking-widest text-center">Por Cobrar</span>
              </button>
            </div>
          ) : method === 'cash' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <label className="text-[10px] font-bold uppercase opacity-50 block mb-2 text-center">Efectivo Recibido</label>
                <input
                  type="number"
                  autoFocus
                  value={received}
                  onChange={e => setReceived(e.target.value)}
                  placeholder="0"
                  className="w-full bg-white border-2 border-[var(--line)] p-4 text-3xl font-mono text-center focus:outline-none focus:ring-4 ring-black/5"
                />
              </div>

              <div className="p-6 border-2 border-dashed border-[var(--line)] bg-white/50 text-center">
                <div className="text-[10px] font-bold uppercase opacity-50 mb-1">Vuelto a Entregar</div>
                <div className={cn(
                  "text-4xl font-mono font-bold",
                  change < 0 ? "text-red-500" : "text-green-600"
                )}>
                  ${change.toLocaleString()}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setMethod(null)}
                  className="flex-1 border border-[var(--line)] py-4 font-bold uppercase text-xs hover:bg-white transition-colors"
                >
                  Volver
                </button>
                <button
                  disabled={change < 0}
                  onClick={() => onConfirm('cash')}
                  className="flex-[2] bg-[var(--ink)] text-[var(--bg)] py-4 font-bold uppercase text-xs hover:opacity-90 transition-opacity disabled:opacity-30"
                >
                  Confirmar Venta
                </button>
              </div>
            </div>
          ) : method === 'card' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 text-center">
              {!confirmCard ? (
                <>
                  <div className="py-8">
                    <CreditCard size={64} className="mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-bold italic serif">¿Procesar pago con tarjeta?</p>
                    <p className="text-xs opacity-50 mt-2">Asegúrese de que la transacción en el terminal sea exitosa.</p>
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setMethod(null)}
                      className="flex-1 border border-[var(--line)] py-4 font-bold uppercase text-xs hover:bg-white transition-colors"
                    >
                      Volver
                    </button>
                    <button
                      onClick={() => setConfirmCard(true)}
                      className="flex-[2] bg-[var(--ink)] text-[var(--bg)] py-4 font-bold uppercase text-xs hover:opacity-90 transition-opacity"
                    >
                      Sí, Procesar
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="py-8 bg-amber-50 border-2 border-amber-200 p-6">
                    <AlertTriangle size={32} className="mx-auto mb-4 text-amber-600" />
                    <p className="text-sm font-bold uppercase tracking-widest">Confirmación de Seguridad</p>
                    <p className="text-xs opacity-70 mt-2">¿Está seguro de que desea cargar esta venta a tarjeta?</p>
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setConfirmCard(false)}
                      className="flex-1 border border-[var(--line)] py-4 font-bold uppercase text-xs hover:bg-white transition-colors"
                    >
                      No, Revisar
                    </button>
                    <button
                      onClick={() => onConfirm('card')}
                      className="flex-[2] bg-green-600 text-white py-4 font-bold uppercase text-xs hover:opacity-90 transition-opacity"
                    >
                      Confirmar y Rebajar Stock
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : method === 'cuenta_por_cobrar' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 text-left">
              {!isCreatingCustomer ? (
                <>
                  {!selectedCustomer ? (
                    <div>
                      <label className="text-[10px] font-bold uppercase opacity-50 block mb-2">Buscar Cliente</label>
                      <input
                        type="text"
                        autoFocus
                        value={searchCustomer}
                        onChange={e => {
                          setSearchCustomer(e.target.value);
                          setSelectedCustomerIndex(-1);
                        }}
                        onKeyDown={handleCustomerKeyDown}
                        placeholder="Nombre, Apellido o RUT..."
                        className="w-full bg-white border border-[var(--line)] p-3 text-sm rounded focus:outline-none focus:ring-2 ring-blue-100 mb-2"
                      />
                      {searchCustomer && (
                        <div className="max-h-40 overflow-y-auto border border-[var(--line)] rounded-lg bg-white shadow-sm mb-4">
                          {filteredCustomers.length > 0 ? (
                            filteredCustomers.map((c, index) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCustomer(c);
                                  setSearchCustomer('');
                                }}
                                className={cn(
                                  "w-full text-left p-3 hover:bg-gray-50 border-b border-[var(--line)] text-sm transition-colors",
                                  index === selectedCustomerIndex ? "bg-blue-50 text-[var(--primary)] border-l-4 border-l-[var(--primary)]" : "bg-white text-gray-700"
                                )}
                              >
                                <div className="font-bold">{c.first_name} {c.last_name}</div>
                                <div className="text-xs text-gray-500">{c.rut}</div>
                              </button>
                            ))
                          ) : (
                            <div className="p-4 text-center text-sm text-gray-500">No se encontraron clientes.</div>
                          )}
                        </div>
                      )}
                      <button onClick={() => setIsCreatingCustomer(true)} className="w-full border border-dashed border-[var(--primary)] text-[var(--primary)] py-3 rounded text-sm font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                        <Plus size={16} /> Crear Nuevo Cliente
                      </button>
                    </div>
                  ) : (
                    <div className="p-6 border border-green-200 bg-green-50 rounded-xl text-center relative">
                      <button onClick={() => setSelectedCustomer(null)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-700"><X size={16}/></button>
                      <div className="text-[10px] font-bold text-green-700 uppercase tracking-widest mb-1">Cliente Seleccionado</div>
                      <div className="text-xl font-bold text-green-900">{selectedCustomer.first_name} {selectedCustomer.last_name}</div>
                      <div className="text-xs text-green-700 opacity-70 mt-1">{selectedCustomer.rut}</div>
                    </div>
                  )}

                  <div className="flex gap-4 mt-6">
                    <button onClick={() => { setMethod(null); setSelectedCustomer(null); setSearchCustomer(''); }} className="flex-1 border border-[var(--line)] py-4 font-bold uppercase text-xs hover:bg-white transition-colors text-center">Volver</button>
                    <button 
                      disabled={!selectedCustomer}
                      onClick={() => onConfirm('cuenta_por_cobrar', selectedCustomer?.id)} 
                      className="flex-[2] bg-[var(--ink)] text-[var(--bg)] py-4 font-bold uppercase text-xs hover:opacity-90 transition-opacity disabled:opacity-30"
                    >
                      Confirmar Fiado
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-sm">Nuevo Cliente</h4>
                    <button onClick={() => setIsCreatingCustomer(false)} className="text-gray-400 hover:text-gray-700"><X size={16}/></button>
                  </div>
                  <input type="text" placeholder="RUT (Opcional)" value={newCustomer.rut} onChange={e => setNewCustomer({...newCustomer, rut: e.target.value})} className="w-full bg-white border border-[var(--line)] p-3 text-sm rounded focus:outline-none" />
                  <input type="text" placeholder="Nombre *" value={newCustomer.first_name} onChange={e => setNewCustomer({...newCustomer, first_name: e.target.value})} className="w-full bg-white border border-[var(--line)] p-3 text-sm rounded focus:outline-none" />
                  <input type="text" placeholder="Apellido *" value={newCustomer.last_name} onChange={e => setNewCustomer({...newCustomer, last_name: e.target.value})} className="w-full bg-white border border-[var(--line)] p-3 text-sm rounded focus:outline-none" />
                  
                  <div className="flex gap-4 pt-2">
                    <button onClick={() => setIsCreatingCustomer(false)} className="flex-1 border border-[var(--line)] py-3 font-bold uppercase text-xs hover:bg-white transition-colors text-center">Cancelar</button>
                    <button disabled={!newCustomer.first_name || !newCustomer.last_name} onClick={handleCreateCustomer} className="flex-1 bg-[var(--primary)] text-white py-3 font-bold uppercase text-xs hover:opacity-90 transition-opacity disabled:opacity-30">Guardar</button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InventoryView({ products, onRefresh, onAddProduct, lowStockThreshold, setLowStockThreshold, showArchived, setShowArchived }: any) {
  const [search, setSearch] = useState('');
  const [showCosts, setShowCosts] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const filtered = products.filter((p: any) => {
    if (!search.trim()) return true;
    return matchProduct(p, search);
  });

  const exactMatch = products.find((p: any) => p.id === search);

  const handleEditClick = (product: any) => {
    setEditingProduct(product);
  };

  const handleExportExcel = async () => {
    const res = await fetch('/api/export');
    const data = await res.json();

    // Flatten data for Excel
    const exportData = data.products.map((p: any) => {
      const productBatches = data.batches.filter((b: any) => b.product_id === p.id);
      const totalStock = productBatches.reduce((sum: number, b: any) => sum + b.quantity, 0);
      const oldestBatch = productBatches[0];
      const productSales = data.sales ? data.sales.filter((s: any) => s.product_id === p.id) : [];
      const rotation = productSales.reduce((sum: number, s: any) => sum + s.quantity, 0);
      const coverage = rotation > 0 ? Math.round(totalStock / (rotation / 30)) : '∞';

      return {
        'ID_BARCODE': p.id,
        'NOMBRE': p.name,
        'CATEGORIA': p.type,
        'PRECIO_VENTA': p.sale_price,
        'STOCK_ACTUAL': totalStock,
        'COSTO_REF': oldestBatch ? oldestBatch.cost : 0,
        'ROTACION_30D': rotation,
        'COBERTURA_DIAS': coverage
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
    XLSX.writeFile(workbook, `inventario_fastpos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)]">
            {showArchived ? 'Productos Archivados' : 'Inventario Maestro'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {showArchived ? 'Historial de productos que ya no están en venta.' : 'Control total de existencias y lotes FIFO.'}
          </p>
        </div>
        <div className="flex gap-4 items-center">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 border border-[var(--line)] px-4 py-2 bg-white rounded-lg text-[10px] font-bold uppercase hover:bg-gray-50 transition-all shadow-sm"
          >
            <Download size={14} /> Exportar Excel
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 border border-[var(--line)] px-4 py-2 bg-white rounded-lg text-[10px] font-bold uppercase hover:bg-gray-50 transition-all shadow-sm"
          >
            <Upload size={14} /> Importar
          </button>

          <button
            onClick={() => onAddProduct()}
            className="flex items-center gap-2 bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase hover:opacity-90 transition-all shadow-md shadow-blue-100"
          >
            <Plus size={14} /> Nuevo Producto
          </button>

          <button
            onClick={() => setShowArchived(!showArchived)}
            className={cn(
              "flex items-center gap-2 border px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm",
              showArchived 
                ? "bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200" 
                : "bg-white border-[var(--line)] text-gray-500 hover:bg-gray-50"
            )}
          >
            {showArchived ? <EyeOff size={14} /> : <Eye size={14} />}
            {showArchived ? 'Ver Activos' : 'Ver Archivados'}
          </button>

          <div className="flex items-center gap-2 border border-[var(--line)] px-4 py-2 bg-white rounded-lg shadow-sm">
            <span className="text-[10px] font-bold uppercase text-gray-400">Umbral Stock:</span>
            <input
              type="number"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 0)}
              className="w-12 bg-transparent font-bold text-xs focus:outline-none"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="ESCANEAR O BUSCAR..."
              value={search}
              onChange={(e) => setSearch(e.target.value.toUpperCase())}
              className={cn(
                "bg-white border border-[var(--line)] py-2 pl-10 pr-4 text-xs rounded-lg shadow-sm focus:outline-none focus:ring-2 ring-[var(--primary)]/20 transition-all w-64",
                exactMatch && "border-green-600 ring-green-100"
              )}
            />
          </div>
        </div>
      </div>

      {exactMatch && (
        <div className="mb-6 p-6 border-2 border-green-600 bg-green-50 rounded-2xl flex justify-between items-center animate-in zoom-in-95 duration-300">
          <div>
            <div className="text-[10px] font-bold text-green-700 uppercase tracking-widest mb-1">Producto Encontrado</div>
            <div className="text-2xl font-bold text-green-900 uppercase">{exactMatch.name}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-green-700 uppercase tracking-widest mb-1">Precio de Venta</div>
            <div className="text-4xl font-bold text-green-900">${exactMatch.sale_price.toLocaleString()}</div>
          </div>
        </div>
      )}

      <div className="border border-[var(--line)] bg-white rounded-2xl overflow-hidden shadow-xl">
        <div className="grid grid-cols-[90px_minmax(150px,3fr)_1fr_70px_80px_80px_90px_90px_1.2fr_60px] col-header bg-gray-50/50">
          <div className="truncate">ID</div>
          <div className="truncate">PRODUCTO</div>
          <div className="truncate">CATEGORÍA</div>
          <div className="text-center truncate">STOCK</div>
          <div className="text-center truncate" title="Ventas en los últimos 30 días">ROTACIÓN</div>
          <div className="text-center truncate" title="Días estimados que durará el stock">COBERTURA</div>
          <div className="text-right flex items-center justify-end gap-1 truncate">
            COSTO
            <button onClick={() => setShowCosts(!showCosts)} className="text-gray-400 hover:text-[var(--primary)] flex-shrink-0">
              {showCosts ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </div>
          <div className="text-right truncate">P_VENTA</div>
          <div className="text-center truncate">ESTADO</div>
          <div className="text-center truncate">ACCIONES</div>
        </div>
        <div className="max-h-[calc(100vh-280px)] overflow-auto">
          {filtered.map((p: any) => {
            const isLowStock = p.total_stock < lowStockThreshold;
            return (
              <div key={p.id} className={cn(
                "grid grid-cols-[90px_minmax(150px,3fr)_1fr_70px_80px_80px_90px_90px_1.2fr_60px] data-row text-sm items-center hover:bg-gray-50/50 transition-colors",
                isLowStock && p.active === 1 && "bg-red-50/30",
                exactMatch?.id === p.id && "bg-green-50"
              )}>
                <div className="text-[10px] font-mono text-gray-400 truncate pr-2">{p.id}</div>
                <div className="font-bold uppercase truncate pr-4 text-[var(--ink)]">
                  {p.name}
                </div>
                <div className="text-xs text-gray-500 truncate">{p.type}</div>
                <div className={cn(
                  "text-center font-bold",
                  isLowStock && p.active === 1 ? "text-red-600" : "text-gray-700"
                )}>
                  {p.total_stock}
                </div>
                <div className="text-center font-semibold text-xs text-gray-600">
                  {p.sales_30_days || 0} U
                </div>
                <div className="text-center font-semibold text-xs text-gray-600">
                  {p.sales_30_days > 0 ? `${Math.round(p.total_stock / (p.sales_30_days / 30))} d` : '∞'}
                </div>
                <div className="text-right font-mono text-gray-600">
                  {showCosts ? `$${(p.cost || 0).toLocaleString()}` : '••••••'}
                </div>
                <div className="text-right font-bold text-[var(--primary)]">${p.sale_price.toLocaleString()}</div>
                <div className="flex flex-wrap justify-center items-center gap-1.5 px-2 min-h-[32px]">
                  {p.active === 0 ? (
                    <span className="bg-gray-100 text-gray-500 text-[9px] px-2 py-0.5 font-bold uppercase rounded-full border border-gray-200">Archivado</span>
                  ) : (
                    <>
                      {isLowStock ? (
                        <span className="bg-red-50 text-red-600 text-[9px] px-2 py-0.5 font-bold uppercase rounded-full border border-red-100 flex items-center gap-1">
                          <AlertTriangle size={10} /> Stock Bajo
                        </span>
                      ) : null}
                      {p.has_zero_cost ? (
                        <span className="bg-amber-50 text-amber-600 text-[9px] px-2 py-0.5 font-bold uppercase rounded-full border border-amber-100">Sin Costo</span>
                      ) : null}
                      {(!isLowStock && !p.has_zero_cost) ? (
                        <span className="bg-green-50 text-green-600 text-[9px] px-2 py-0.5 font-bold uppercase rounded-full border border-green-100">Disponible</span>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => handleEditClick(p)}
                    className="p-2 text-gray-400 hover:text-[var(--primary)] hover:bg-blue-50 rounded-lg transition-all"
                    title="Editar Producto"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isImportModalOpen && (
        <ImportModal
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            setIsImportModalOpen(false);
            onRefresh();
          }}
        />
      )}



      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => {
            setEditingProduct(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

function AnalyticsView({ analytics, startDate, setStartDate, endDate, setEndDate }: {
  analytics: Analytics | null;
  startDate: string;
  setStartDate: (d: string) => void;
  endDate: string;
  setEndDate: (d: string) => void;
}) {
  const [metric, setMetric] = useState<'monto' | 'cantidad'>('monto');
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);

  useEffect(() => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
  }, [startDate, endDate]);

  if (!analytics) return null;

  const COLORS = ['#005EB8', '#FFC785', '#10B981', '#F59E0B', '#6366F1'];

  const currentRevenue = analytics.summary.collected_revenue || 0;
  const currentCost = analytics.summary.collected_cost || 0;
  const currentProfit = currentRevenue - currentCost;
  const margin = currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0;

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)]">Reportes y Análisis</h2>
          <p className="text-sm text-gray-500 mt-1">Visualización de rendimiento y rentabilidad.</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold uppercase text-[var(--primary)] mb-1">Visualizar Gráficos por</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as any)}
              className="bg-white border border-[var(--primary)] text-[var(--primary)] font-bold text-xs p-2 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all hover:bg-blue-50"
            >
              <option value="monto">Monto ($)</option>
              <option value="cantidad">Cantidad Unit. (#)</option>
            </select>
          </div>
          
          <div className="flex gap-4 items-center bg-white p-3 rounded-xl border border-[var(--line)] shadow-sm">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold uppercase text-gray-400 mb-1">Desde</label>
              <input
                type="date"
                value={tempStartDate}
                onChange={(e) => setTempStartDate(e.target.value)}
                className="text-xs font-semibold focus:outline-none"
              />
            </div>
            <div className="w-px h-8 bg-[var(--line)]" />
            <div className="flex flex-col">
              <label className="text-[10px] font-bold uppercase text-gray-400 mb-1">Hasta</label>
              <input
                type="date"
                value={tempEndDate}
                onChange={(e) => setTempEndDate(e.target.value)}
                className="text-xs font-semibold focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={() => {
              setStartDate(tempStartDate);
              setEndDate(tempEndDate);
            }}
            className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold uppercase tracking-wider text-xs px-6 py-3 rounded-xl transition-all shadow-md shadow-blue-100 h-[46px] flex items-center"
          >
            Filtrar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        <StatCard label="Ingresos Cobrados" value={`$${currentRevenue.toLocaleString()}`} />
        <StatCard label="Costo (Efectivo/Tj)" value={`$${currentCost.toLocaleString()}`} />
        <StatCard label="Utilidad Real (FIFO)" value={`$${currentProfit.toLocaleString()}`} trend />
        <StatCard 
          label="Margen de Utilidad" 
          value={`${margin.toFixed(2)}%`} 
          highlight={margin > 20}
        />
        <StatCard label="Valor Inventario" value={`$${analytics.summary.total_inventory_value?.toLocaleString() || 0}`} />
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="p-6 border border-[var(--line)] bg-white rounded-2xl shadow-sm flex items-center justify-between border-l-4 border-l-green-500">
          <div>
            <div className="text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-1">Caja Efectivo (Neto)</div>
            <div className="text-3xl font-mono font-bold text-green-700">${((analytics.summary.cash_revenue || 0) - (analytics.summary.cash_expenses || 0)).toLocaleString()}</div>
          </div>
          <Banknote size={32} className="opacity-20 text-green-700" />
        </div>
        <div className="p-6 border border-[var(--line)] bg-white rounded-2xl shadow-sm flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <div className="text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-1">Pagos con Tarjeta (Neto)</div>
            <div className="text-3xl font-mono font-bold text-blue-700">${((analytics.summary.card_revenue || 0) - (analytics.summary.card_expenses || 0)).toLocaleString()}</div>
          </div>
          <CreditCard size={32} className="opacity-20 text-blue-700" />
        </div>
        <div className="p-6 border border-[var(--line)] bg-white rounded-2xl shadow-sm flex items-center justify-between border-l-4 border-l-amber-500">
          <div>
            <div className="text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-1">Por Cobrar (Fiado)</div>
            <div className="text-3xl font-mono font-bold text-amber-700">${(analytics.summary.total_receivables || 0).toLocaleString()}</div>
          </div>
          <FileMinus size={32} className="opacity-20 text-amber-700" />
        </div>
        
        {analytics.summary.total_expenses > 0 && (
          <div className="col-span-3 p-6 border border-[var(--line)] bg-red-50 rounded-2xl shadow-sm flex items-center justify-between border-l-4 border-l-red-500">
            <div>
              <div className="text-[10px] font-bold uppercase text-red-500 tracking-widest mb-1">Descuentos por Gastos Registrados</div>
              <div className="text-2xl font-mono font-bold text-red-700">
                Total Restado: ${analytics.summary.total_expenses?.toLocaleString()} 
                <span className="text-sm ml-4 opacity-70">(Efectivo: ${analytics.summary.cash_expenses?.toLocaleString() || 0} | Tarjeta: ${analytics.summary.card_expenses?.toLocaleString() || 0})</span>
              </div>
            </div>
            <Receipt size={32} className="opacity-20 text-red-700" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="p-8 border border-[var(--line)] bg-white rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold uppercase mb-8 text-gray-500 tracking-wider">
            Ranking de Salidas {metric === 'monto' ? '(Recaudación)' : '(Volumen)'}
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.topProducts}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" fontSize={10} tick={{ fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} tick={{ fill: '#6B7280' }} axisLine={false} tickLine={false} tickFormatter={(val) => metric === 'monto' ? `$${val.toLocaleString()}` : val.toLocaleString()} />
                <Tooltip
                  formatter={(value: number) => [metric === 'monto' ? `$${value.toLocaleString()}` : value.toLocaleString(), metric === 'monto' ? 'Recaudación' : 'Cantidad']}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#111827', fontSize: '12px', fontWeight: '600' }}
                />
                <Bar dataKey={metric === 'monto' ? 'revenue' : 'volume'} fill="var(--primary)" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey={metric === 'monto' ? 'revenue' : 'volume'} position="top" formatter={(val: number) => metric === 'monto' ? `$${val.toLocaleString()}` : val.toLocaleString()} style={{ fill: 'var(--primary)', fontSize: 10, fontWeight: 'bold' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-8 border border-[var(--line)] bg-white rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold uppercase mb-8 text-gray-500 tracking-wider">
            Dominio por Categoría {metric === 'monto' ? '(Recaudación)' : '(Volumen)'}
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.categoryAnalysis}
                  dataKey={metric === 'monto' ? 'revenue' : 'volume'}
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  label={({ type, value }) => metric === 'monto' ? `${type}: $${value.toLocaleString()}` : `${type}: ${value.toLocaleString()}`}
                >
                  {analytics.categoryAnalysis.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [metric === 'monto' ? `$${value.toLocaleString()}` : value.toLocaleString(), metric === 'monto' ? 'Recaudación' : 'Cantidad']}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="p-8 border border-[var(--line)] bg-white rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold uppercase mb-8 text-gray-500 tracking-wider">
            Inventario por Familia {metric === 'monto' ? '(Valor Monetario)' : '(Existencias)'}
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.inventoryByFamily} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" fontSize={10} tick={{ fill: '#6B7280' }} axisLine={false} tickLine={false} tickFormatter={(val) => metric === 'monto' ? `$${val.toLocaleString()}` : val.toLocaleString()} />
                <YAxis dataKey="type" type="category" fontSize={10} tick={{ fill: '#6B7280' }} axisLine={false} tickLine={false} width={100} />
                <Tooltip
                  formatter={(value: number) => [metric === 'monto' ? `$${value.toLocaleString()}` : value.toLocaleString(), metric === 'monto' ? 'Valor Inventario' : 'Cantidad']}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#111827', fontSize: '12px', fontWeight: '600' }}
                />
                <Bar dataKey={metric === 'monto' ? 'total_value' : 'total_stock'} fill="#FFC785" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey={metric === 'monto' ? 'total_value' : 'total_stock'} position="right" formatter={(val: number) => metric === 'monto' ? `$${val.toLocaleString()}` : val.toLocaleString()} style={{ fill: '#111827', fontSize: 10, fontWeight: 'bold' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-8 border border-[var(--line)] bg-white rounded-2xl shadow-sm">
           <h3 className="text-sm font-bold uppercase mb-2 text-gray-500 tracking-wider text-center">
            Punto de Equilibrio (Break-even)
          </h3>
          <p className="text-[10px] text-gray-400 text-center mb-8 italic uppercase">Meta para cubrir costos fijos (${(analytics.summary.total_fixed_costs || 1).toLocaleString()})</p>
          <div className="h-72 relative flex flex-col items-center justify-center">
            {(() => {
              const fixedCosts = analytics.summary.total_fixed_costs || 1;
              const marginDec = (margin / 100);
              const breakEven = marginDec > 0 ? fixedCosts / marginDec : 0;
              const maxVal = breakEven * 2 || currentRevenue * 2 || 100;
              
              // We use PieChart to simulate a Gauge
              const data = [
                { name: 'Progress', value: Math.min(currentRevenue, maxVal) },
                { name: 'Remaining', value: Math.max(0, maxVal - currentRevenue) }
              ];

              return (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data}
                        cx="50%"
                        cy="80%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        <Cell fill={currentRevenue >= breakEven ? '#10B981' : '#F59E0B'} />
                        <Cell fill="#F3F4F6" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Gauge Overlay Labels */}
                  <div className="absolute bottom-[20%] text-center">
                    <div className="text-[10px] font-bold text-gray-400 uppercase">Recaudación Actual</div>
                    <div className={cn("text-3xl font-bold font-mono", currentRevenue >= breakEven ? "text-green-600" : "text-amber-600")}>
                      ${currentRevenue.toLocaleString()}
                    </div>
                    <div className="w-full h-px bg-gray-100 my-2"></div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase">Punto de Equilibrio</div>
                    <div className="text-lg font-bold text-gray-700 font-mono">
                      ${Math.round(breakEven).toLocaleString()}
                    </div>
                  </div>

                  {/* Marker for 50% (Break-even point) */}
                  <div className="absolute top-[20%] left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div className="w-1 h-4 bg-[var(--ink)] mb-1"></div>
                    <span className="text-[9px] font-black uppercase text-[var(--ink)] bg-white px-1">Meta</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, trend }: any) {
  return (
    <div className="p-6 border border-[var(--line)] bg-white rounded-2xl shadow-sm">
      <div className="text-[10px] font-bold uppercase text-gray-400 mb-2 tracking-wider">{label}</div>
      <div className="flex items-end justify-between">
        <div className="text-3xl font-bold tracking-tight text-[var(--ink)]">{value}</div>
        {trend && (
          <div className="bg-green-100 p-1.5 rounded-lg text-green-600">
            <TrendingUp size={20} />
          </div>
        )}
      </div>
    </div>
  );
}



function EditProductModal({ product, onClose, onSuccess }: any) {
  const [formData, setFormData] = useState({
    name: product.name,
    type: product.type,
    sale_price: product.sale_price.toString(),
    cost: product.cost?.toString() || '0',
    total_stock: product.total_stock?.toString() || '0'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        sale_price: parseFloat(formData.sale_price),
        cost: parseFloat(formData.cost),
        new_stock: formData.total_stock
      })
    });

    if (res.ok) {
      toast.success('Producto actualizado');
      onSuccess();
    } else {
      toast.error('Error al actualizar');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`¿Desea archivar el producto ${product.name}? Dejará de estar disponible en el POS e Inventario, pero se mantendrá en el historial.`)) {
      return;
    }
    const res = await fetch(`/api/products/${product.id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      toast.success('Producto archivado correctamente');
      onSuccess();
    } else {
      const data = await res.json();
      toast.error(data.error || 'Error al archivar');
    }
  };

  const handleRestore = async () => {
    const res = await fetch(`/api/products/${product.id}/restore`, {
      method: 'POST'
    });
    if (res.ok) {
      toast.success('Producto restaurado correctamente');
      onSuccess();
    } else {
      const data = await res.json();
      toast.error(data.error || 'Error al restaurar');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white border border-[var(--line)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="p-6 border-b border-[var(--line)] flex justify-between items-center bg-[var(--primary)] text-white shrink-0">
          <h3 className="font-bold uppercase tracking-widest text-sm">Editar Producto</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">ID / Barcode</label>
            <input type="text" value={product.id} readOnly className="w-full bg-gray-50 border border-[var(--line)] p-2 font-mono text-sm text-gray-500 rounded-lg" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Nombre Producto</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                className="w-full bg-white border border-[var(--line)] p-2 text-sm rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Tipo / Categoría</label>
              <input
                type="text"
                required
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value.toUpperCase() })}
                className="w-full bg-white border border-[var(--line)] p-2 text-sm rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Precio Venta</label>
              <input
                type="number"
                required
                value={formData.sale_price}
                onChange={e => setFormData({ ...formData, sale_price: e.target.value })}
                className="w-full bg-white border border-[var(--line)] p-2 text-sm font-bold rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Costo Unitario</label>
              <input
                type="number"
                required
                value={formData.cost}
                onChange={e => setFormData({ ...formData, cost: e.target.value })}
                className="w-full bg-white border border-[var(--line)] p-2 text-sm font-bold rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Stock Actual (Lotes combinados)</label>
              <input
                type="number"
                required
                value={formData.total_stock}
                onChange={e => setFormData({ ...formData, total_stock: e.target.value })}
                className="w-full bg-white border border-[var(--line)] p-2 text-sm font-bold rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-[var(--primary)] text-white py-2.5 rounded-xl font-bold uppercase text-xs hover:bg-[var(--primary-dark)] shadow-md transition-all"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 border border-[var(--line)] py-2.5 rounded-xl font-bold uppercase text-xs hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
            {product.active === 1 ? (
              <button
                type="button"
                onClick={handleDelete}
                className="w-full flex items-center justify-center gap-2 text-red-500 border border-red-200 py-2.5 rounded-xl font-bold uppercase text-xs hover:bg-red-50 transition-colors bg-white mt-1"
              >
                <Trash2 size={16} /> Archivar Producto
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRestore}
                className="w-full flex items-center justify-center gap-2 text-green-600 border border-green-200 py-2.5 rounded-xl font-bold uppercase text-xs hover:bg-green-50 transition-colors bg-white mt-1"
              >
                <Check size={16} /> Restaurar Producto
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportModal({ onClose, onSuccess }: any) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadFormat = () => {
    const template = [
      {
        'ID_BARCODE': '12345678',
        'NOMBRE': 'PRODUCTO EJEMPLO',
        'CATEGORIA': 'BEBIDAS',
        'PRECIO_VENTA': 1500,
        'STOCK_INICIAL': 10,
        'COSTO_INICIAL': 800
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");
    XLSX.writeFile(workbook, "formato_importacion_fastpos.xlsx");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        // Map Excel headers to API format
        const products = jsonData.map(row => ({
          id: String(row.ID_BARCODE || ''),
          name: String(row.NOMBRE || ''),
          type: String(row.CATEGORIA || ''),
          sale_price: parseFloat(row.PRECIO_VENTA || 0),
          initial_stock: parseInt(row.STOCK_INICIAL || 0),
          cost: parseFloat(row.COSTO_INICIAL || 0)
        })).filter(p => p.id && p.name);

        const res = await fetch('/api/products/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products })
        });

        if (res.ok) {
          toast.success('Inventario importado correctamente');
          onSuccess();
        } else {
          toast.error('Error al importar');
        }
      } catch (err) {
        toast.error('Archivo Excel inválido');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white border border-[var(--line)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-[var(--line)] flex justify-between items-center bg-[var(--ink)] text-white">
          <h3 className="font-bold uppercase tracking-widest text-sm flex items-center gap-2">
            <FileUp size={18} /> Importar Inventario
          </h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="p-8 space-y-6">
          <div className="p-6 bg-blue-50 border border-blue-100 rounded-xl">
            <h4 className="font-bold text-blue-900 text-xs uppercase mb-2">Paso 1: Descargar Formato</h4>
            <p className="text-xs text-blue-700 mb-4">Descargue la plantilla de Excel para completar los datos de sus productos correctamente.</p>
            <button
              onClick={downloadFormat}
              className="w-full flex items-center justify-center gap-2 bg-white border border-blue-200 text-blue-700 py-3 rounded-lg font-bold uppercase text-[10px] hover:bg-blue-100 transition-all"
            >
              <FileSpreadsheet size={16} /> Descargar Plantilla .xlsx
            </button>
          </div>

          <div className="p-6 bg-gray-50 border border-gray-100 rounded-xl">
            <h4 className="font-bold text-gray-900 text-xs uppercase mb-2">Paso 2: Cargar Archivo</h4>
            <p className="text-xs text-gray-600 mb-4">Una vez completada la plantilla, súbala aquí para actualizar el inventario.</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-[var(--primary)] text-white py-3 rounded-lg font-bold uppercase text-[10px] hover:opacity-90 transition-all"
            >
              <Upload size={16} /> Seleccionar Archivo
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".xlsx, .xls"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpressModal({ initialId, onClose, onSuccess }: any) {
  const [formData, setFormData] = useState({
    id: initialId,
    name: '',
    type: '',
    sale_price: '',
    initial_stock: '',
    cost: '0'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          sale_price: parseFloat(formData.sale_price) || 0,
          initial_stock: parseInt(formData.initial_stock, 10) || 0,
          cost: parseFloat(formData.cost) || 0
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Producto guardado correctamente');
        onSuccess();
      } else {
        toast.error(data.error || 'Error al guardar producto');
      }
    } catch (error) {
      toast.error('Error de conexión con el servidor');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[var(--line)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-[var(--line)] flex justify-between items-center bg-[var(--primary)] text-white">
          <h3 className="font-bold uppercase tracking-widest text-sm">Creación Express</h3>
          <button onClick={onClose} className="hover:rotate-90 transition-transform"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Código / Barcode *</label>
            <input
              type="text"
              required
              value={formData.id}
              onChange={e => setFormData({ ...formData, id: e.target.value.toUpperCase().trim() })}
              readOnly={!!initialId}
              placeholder="ESCANEE O ESCRIBA CÓDIGO"
              className={cn(
                "w-full border border-[var(--line)] p-2 font-mono text-sm rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20",
                initialId ? "bg-gray-50 text-gray-500" : "bg-white"
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Nombre Producto *</label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Ej: COCA COLA ORIGINAL 2.5L"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                className="w-full bg-white border border-[var(--line)] p-2 text-sm rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
              />
              <p className="text-[9px] text-gray-400 mt-1 italic">Sugerencia: Nombre Marca Variedad Gramaje</p>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Tipo / Categoría *</label>
              <input
                type="text"
                required
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value.toUpperCase() })}
                className="w-full bg-white border border-[var(--line)] p-2 text-sm rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Precio Venta *</label>
              <input
                type="number"
                required
                value={formData.sale_price}
                onChange={e => setFormData({ ...formData, sale_price: e.target.value })}
                className="w-full bg-white border border-[var(--line)] p-2 text-sm font-bold rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Stock Inicial *</label>
              <input
                type="number"
                required
                value={formData.initial_stock}
                onChange={e => setFormData({ ...formData, initial_stock: e.target.value })}
                className="w-full bg-white border border-[var(--line)] p-2 text-sm font-bold rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Costo (Opcional)</label>
              <input
                type="number"
                value={formData.cost}
                onChange={e => setFormData({ ...formData, cost: e.target.value })}
                className="w-full bg-white border border-[var(--line)] p-2 text-sm font-bold rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="submit"
              className="flex-1 bg-[var(--primary)] text-white py-3 rounded-xl font-bold uppercase text-xs hover:bg-[var(--primary-dark)] shadow-lg shadow-blue-100 transition-all"
            >
              Confirmar y Vender [ENTER]
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 border border-[var(--line)] py-3 rounded-xl font-bold uppercase text-xs hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HistoryView({ onRefresh }: { onRefresh: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);

  const fetchHistory = async () => {
    const res = await fetch(`/api/history?startDate=${startDate}T00:00:00&endDate=${endDate}T23:59:59`);
    if (res.ok) {
      setItems(await res.json());
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [startDate, endDate]);

  const handleVoid = async (id: string, type: string) => {
    if (!window.confirm("¿Estás seguro de anular esta operación? Esta acción no se puede deshacer.")) return;

    const endpoint = type === 'sale' ? `/api/sales/void/${id}` : type === 'payment' ? `/api/receivables/pay/void/${id}` : `/api/expenses/void/${id}`;
    const res = await fetch(endpoint, { method: 'POST' });
    
    if (res.ok) {
      toast.success("Operación anulada con éxito");
      fetchHistory();
      onRefresh();
    } else {
      const error = await res.json();
      toast.error(error.error || "Error al anular operación");
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)]">Historial</h2>
          <p className="text-sm text-gray-500 mt-1">Registro de ventas, fiados y abonos.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 bg-white p-2.5 rounded-xl border border-[var(--line)] shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-gray-400 px-2">Desde</span>
              <input type="date" value={tempStartDate} onChange={e => setTempStartDate(e.target.value)} className="text-sm font-bold bg-transparent focus:outline-none" />
            </div>
            <div className="w-px h-6 bg-[var(--line)]"></div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-gray-400 px-2">Hasta</span>
              <input type="date" value={tempEndDate} onChange={e => setTempEndDate(e.target.value)} className="text-sm font-bold bg-transparent focus:outline-none" />
            </div>
          </div>
          <button
            onClick={() => {
              setStartDate(tempStartDate);
              setEndDate(tempEndDate);
            }}
            className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold uppercase tracking-wider text-xs px-6 py-3 rounded-xl transition-all shadow-md shadow-blue-100 h-[42px] flex items-center"
          >
            Filtrar
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {items.map(item => (
          <div key={item.type + item.id} className={cn("p-6 border rounded-2xl bg-white shadow-sm transition-all", item.status === 'voided' ? "opacity-50 border-red-200 bg-red-50" : "border-[var(--line)]")}>
            <div className="flex justify-between items-start mb-4 border-b border-[var(--line)] pb-4">
              <div>
                <div className="text-xs font-mono text-gray-400 mb-1">{item.type === 'expense' ? `Gasto #${item.id}` : item.id}</div>
                <div className="font-bold flex items-center gap-2 uppercase">
                  {new Date(item.created_at).toLocaleString()}
                  {item.method === 'cash' ? <Banknote size={14} className="text-green-600"/> : item.method === 'card' ? <CreditCard size={14} className="text-blue-600"/> : <FileText size={14} className="text-amber-600"/>}
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {item.type === 'sale' ? (item.method === 'cuenta_por_cobrar' ? 'Venta Fiada' : 'Venta') : item.type === 'payment' ? 'Abono Recibido' : 'Gasto Registrado'}
                  </span>
                  {item.customer_name && <span className="text-[10px] text-gray-500">CLIENTE: {item.customer_name}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className={cn("text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded inline-block", item.status === 'completed' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                  {item.status === 'completed' ? 'COMPLETADA' : 'ANULADA'}
                </div>
                <div className={cn("text-2xl font-bold mt-1", item.type === 'payment' ? "text-green-600" : item.type === 'expense' ? "text-red-600" : "text-[var(--ink)]")}>
                  {item.type === 'payment' ? '+' : item.type === 'expense' ? '-' : ''}${item.total_amount?.toLocaleString() || 0}
                </div>
              </div>
            </div>

            {(item.type === 'sale' || item.type === 'expense') && item.items && item.items.length > 0 && (
              <div className="space-y-2 mb-4">
                {item.items.map((prod: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <div>
                      {item.type === 'sale' && <span className="font-mono text-gray-400 mr-2">{prod.quantity}x</span>}
                      {prod.name}
                    </div>
                    <div className="font-mono">${(prod.quantity * prod.sale_price).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}

            {item.status === 'completed' && (
              <div className="flex justify-end pt-4 border-t border-[var(--line)]">
                <button 
                  onClick={() => handleVoid(item.id, item.type)}
                  className="px-4 py-2 bg-red-50 text-red-600 font-bold uppercase text-xs rounded hover:bg-red-600 hover:text-white transition-colors"
                >
                  Anular Operación
                </button>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center text-gray-400 py-12">No hay operaciones en este periodo</div>
        )}
      </div>
    </div>
  );
}

function ExpensesView({ onRefresh }: { onRefresh: () => void }) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [formData, setFormData] = useState({ description: '', amount: '', method: 'cash' });

  const fetchExpenses = async () => {
    const res = await fetch('/api/expenses');
    if (res.ok) {
      setExpenses(await res.json());
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) return;

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: formData.description,
        amount: parseFloat(formData.amount),
        method: formData.method
      })
    });

    if (res.ok) {
      toast.success("Gasto registrado");
      setFormData({ description: '', amount: '', method: 'cash' });
      fetchExpenses();
      onRefresh();
    } else {
      const err = await res.json();
      toast.error(err.error || "Error al registrar gasto");
    }
  };

  const handleVoidExpense = async (id: number) => {
    if (!window.confirm("¿Estás seguro de anular este gasto? Esta acción no se puede deshacer.")) return;
    const res = await fetch(`/api/expenses/void/${id}`, { method: 'POST' });
    if (res.ok) {
      toast.success("Gasto anulado correctamente");
      fetchExpenses();
      onRefresh();
    } else {
      const err = await res.json();
      toast.error(err.error || "Error al anular gasto");
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)]">Gastos de Caja</h2>
        <p className="text-sm text-gray-500 mt-1">Registra egresos y notas de cargo que se descontarán del balance.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-[var(--line)] shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Glosa / Descripción</label>
          <input
            type="text"
            required
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            placeholder="Ej. Compra insumos, Pago luz..."
            className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
          />
        </div>
        <div className="w-40">
          <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Monto ($)</label>
          <input
            type="number"
            required
            min="1"
            value={formData.amount}
            onChange={e => setFormData({ ...formData, amount: e.target.value })}
            className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm font-bold focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
          />
        </div>
        <div className="w-48">
          <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Medio Descontado</label>
          <select
            value={formData.method}
            onChange={e => setFormData({ ...formData, method: e.target.value })}
            className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 cursor-pointer"
          >
            <option value="cash">Caja Efectivo</option>
            <option value="card">Tarjeta / Banco</option>
          </select>
        </div>
        <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-wider text-xs px-6 py-3 rounded-xl transition-all h-[46px] shadow-lg shadow-red-200">
          Descontar
        </button>
      </form>

      <div className="border border-[var(--line)] bg-white rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-[1.5fr_3fr_1.5fr_1.5fr_100px] p-4 border-b border-[var(--line)] bg-gray-50/50 text-xs font-bold uppercase text-gray-500">
          <div>Fecha</div>
          <div>Glosa</div>
          <div>Medio de Pago</div>
          <div className="text-right">Monto</div>
          <div className="text-center">Acciones</div>
        </div>
        <div className="divide-y divide-[var(--line)] max-h-96 overflow-auto">
          {expenses.map((exp: any) => (
            <div key={exp.id} className={cn("grid grid-cols-[1.5fr_3fr_1.5fr_1.5fr_100px] p-4 text-sm items-center hover:bg-gray-50/50 transition-colors", exp.status === 'voided' && "opacity-50 bg-red-50/30 text-gray-400")}>
              <div className="text-gray-500 font-mono text-xs">{new Date(exp.created_at).toLocaleString()}</div>
              <div className={cn("font-bold", exp.status === 'voided' && "line-through")}>
                {exp.description}
                {exp.status === 'voided' && <span className="text-[9px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold uppercase ml-2">Anulado</span>}
              </div>
              <div>
                {exp.method === 'cash' ? (
                  <span className="flex items-center gap-1 text-green-700 text-xs font-bold"><Banknote size={12}/> EFECTIVO</span>
                ) : (
                  <span className="flex items-center gap-1 text-blue-700 text-xs font-bold"><CreditCard size={12}/> TARJETA</span>
                )}
              </div>
              <div className={cn("text-right font-mono font-bold", exp.status === 'voided' ? "text-gray-400 line-through" : "text-red-600")}>-${exp.amount.toLocaleString()}</div>
              <div className="text-center">
                {exp.status !== 'voided' && (
                  <button 
                    onClick={() => handleVoidExpense(exp.id)}
                    className="px-2 py-1 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 text-xs font-bold uppercase rounded transition-colors"
                  >
                    Anular
                  </button>
                )}
              </div>
            </div>
          ))}
          {expenses.length === 0 && (
            <div className="p-8 text-center text-gray-400 italic text-sm">No hay gastos registrados.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReceivablesView({ onRefresh }: { onRefresh: () => void }) {
  const [debtors, setDebtors] = useState<any[]>([]);
  const [selectedDebtor, setSelectedDebtor] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const fetchDebtors = async () => {
    const res = await fetch('/api/receivables');
    if (res.ok) setDebtors(await res.json());
  };

  useEffect(() => {
    fetchDebtors();
  }, []);

  const loadDebtorHistory = async (customer_id: string) => {
    const res = await fetch(`/api/receivables/${customer_id}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedDebtor(data.customer);
      setHistory(data.history);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(paymentAmount);
    if (!numAmount || numAmount <= 0) return;

    // Client-side validation: find current debt in the list
    const debtorInfo = debtors.find(d => d.id === selectedDebtor.id);
    const currentDebt = debtorInfo ? debtorInfo.total_debt : 0;

    if (numAmount > currentDebt) {
      toast.error(`El abono ($${numAmount.toLocaleString()}) no puede superar la deuda ($${currentDebt.toLocaleString()})`);
      return;
    }

    const res = await fetch(`/api/receivables/${selectedDebtor.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: numAmount, method: paymentMethod })
    });
    if (res.ok) {
      toast.success('Abono registrado');
      setPaymentAmount('');
      loadDebtorHistory(selectedDebtor.id);
      fetchDebtors();
      onRefresh();
    } else {
      const err = await res.json();
      toast.error(err.error || 'Error al registrar abono');
    }
  };

  return (
    <div className="flex h-full">
      {/* List of debtors */}
      <div className="w-1/3 border-r border-[var(--line)] bg-white p-6 flex flex-col">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--ink)] mb-1">Por Cobrar</h2>
        <p className="text-sm text-gray-500 mb-6">Listado de clientes con deudas.</p>
        
        <div className="space-y-3 flex-1 overflow-y-auto pr-2">
          {debtors.map(d => (
            <button 
              key={d.id} 
              onClick={() => loadDebtorHistory(d.id)}
              className={cn("w-full p-4 border rounded-xl text-left transition-all", selectedDebtor?.id === d.id ? "border-[var(--primary)] bg-blue-50 ring-2 ring-[var(--primary)]/20" : "border-[var(--line)] hover:border-gray-300")}
            >
              <div className="font-bold text-sm uppercase">{d.first_name} {d.last_name}</div>
              <div className="text-xs text-gray-500 mb-2">{d.rut || 'Sin RUT'}</div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Saldo Deudor</span>
                <span className="font-bold text-red-600 font-mono text-lg">${d.total_debt.toLocaleString()}</span>
              </div>
            </button>
          ))}
          {debtors.length === 0 && (
             <div className="text-center p-8 text-gray-400 italic text-sm border-2 border-dashed border-[var(--line)] rounded-xl">No hay deudas pendientes.</div>
          )}
        </div>
      </div>

      {/* Debtor details and payment */}
      <div className="flex-1 bg-gray-50 p-8 flex flex-col h-full overflow-hidden">
        {selectedDebtor ? (
          <>
            <div className="bg-white p-6 rounded-2xl border border-[var(--line)] shadow-sm mb-6 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-bold uppercase">{selectedDebtor.first_name} {selectedDebtor.last_name}</h3>
                <p className="text-sm text-gray-500">{selectedDebtor.rut}</p>
              </div>
              <form onSubmit={handlePayment} className="flex gap-3 items-end">
                <div>
                   <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Monto Abono</label>
                   <input type="number" required min="1" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-32 bg-gray-50 border border-[var(--line)] p-2 text-sm font-bold rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20" />
                </div>
                <div>
                   <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Medio</label>
                   <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-32 bg-gray-50 border border-[var(--line)] p-2 text-sm rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20">
                     <option value="cash">Efectivo</option>
                     <option value="card">Tarjeta</option>
                   </select>
                </div>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold uppercase text-xs px-4 py-2.5 rounded-lg transition-all h-[38px] flex items-center">
                  Registrar Abono
                </button>
              </form>
            </div>

            <div className="bg-white border border-[var(--line)] rounded-2xl flex-1 overflow-hidden flex flex-col shadow-sm">
               <div className="p-4 border-b border-[var(--line)] bg-[var(--ink)] text-[var(--bg)]">
                 <h4 className="font-bold uppercase text-sm tracking-widest">Historial de Movimientos</h4>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-2">
                 {history.map((item, i) => (
                   <div key={i} className={cn("p-4 border rounded-xl flex justify-between items-center", item.type === 'debt' ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50")}>
                     <div>
                       <div className={cn("text-xs font-bold uppercase mb-1", item.type === 'debt' ? "text-red-700" : "text-green-700")}>
                         {item.type === 'debt' ? `Venta Fiada (Ticket #${item.ticket_id})` : `Abono Realizado (${item.method === 'cash' ? 'Efectivo' : 'Tarjeta'})`}
                       </div>
                       <div className="text-xs text-gray-500 font-mono">{new Date(item.date).toLocaleString()}</div>
                     </div>
                     <div className={cn("font-bold font-mono text-lg", item.type === 'debt' ? "text-red-600" : "text-green-600")}>
                       {item.type === 'debt' ? '-' : '+'}${item.amount.toLocaleString()}
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 italic">
            <CreditCard size={48} className="mb-4 opacity-20" />
            <p>Seleccione un cliente para ver su historial y registrar abonos.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FixedCostsView() {
  const [fixedCosts, setFixedCosts] = useState<any[]>([]);
  const [formData, setFormData] = useState({ description: '', amount: '' });

  const fetchFixedCosts = async () => {
    const res = await fetch('/api/fixed-costs');
    if (res.ok) {
      setFixedCosts(await res.json());
    }
  };

  useEffect(() => {
    fetchFixedCosts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) return;

    const res = await fetch('/api/fixed-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: formData.description,
        amount: parseFloat(formData.amount)
      })
    });

    if (res.ok) {
      toast.success("Costo fijo registrado");
      setFormData({ description: '', amount: '' });
      fetchFixedCosts();
    } else {
      const err = await res.json();
      toast.error(err.error || "Error al registrar costo fijo");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Estás seguro de eliminar este costo fijo?")) return;
    const res = await fetch(`/api/fixed-costs/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success("Costo fijo eliminado");
      fetchFixedCosts();
    }
  };

  const totalFixedCosts = fixedCosts.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)]">Costos Fijos</h2>
          <p className="text-sm text-gray-500 mt-1">Gestión de gastos operativos recurrentes (Luz, Agua, Arriendo, etc).</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-[var(--line)] shadow-lg border-l-4 border-l-[var(--primary)]">
          <div className="text-[10px] font-bold uppercase text-gray-400 mb-1 tracking-widest">Total Costo Fijo Mensual</div>
          <div className="text-4xl font-mono font-bold text-[var(--primary)]">${totalFixedCosts.toLocaleString()}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-[var(--line)] shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[300px]">
          <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Glosa / Descripción</label>
          <input
            type="text"
            required
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            placeholder="Ej. Arriendo Local, Luz, Agua, Pago Banco..."
            className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
          />
        </div>
        <div className="w-48">
          <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Monto Mensual ($)</label>
          <input
            type="number"
            required
            min="1"
            value={formData.amount}
            onChange={e => setFormData({ ...formData, amount: e.target.value })}
            className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm font-bold focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
          />
        </div>
        <button type="submit" className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold uppercase tracking-wider text-xs px-8 py-3 rounded-xl transition-all h-[46px] shadow-lg shadow-blue-100 flex items-center gap-2">
          <Plus size={16} /> Agregar Costo
        </button>
      </form>

      <div className="border border-[var(--line)] bg-white rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-[1fr_3fr_1.5fr_100px] p-4 border-b border-[var(--line)] bg-gray-50/50 text-xs font-bold uppercase text-gray-500">
          <div>Fecha Registro</div>
          <div>Glosa / Descripción</div>
          <div className="text-right">Monto Mensual</div>
          <div className="text-center">Acciones</div>
        </div>
        <div className="divide-y divide-[var(--line)] max-h-96 overflow-auto">
          {fixedCosts.map((item: any) => (
            <div key={item.id} className="grid grid-cols-[1fr_3fr_1.5fr_100px] p-4 text-sm items-center hover:bg-gray-50/50 transition-colors">
              <div className="text-gray-500 font-mono text-xs">{new Date(item.created_at).toLocaleDateString()}</div>
              <div className="font-bold uppercase">{item.description}</div>
              <div className="text-right font-mono font-bold text-[var(--ink)]">${item.amount.toLocaleString()}</div>
              <div className="flex justify-center">
                <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {fixedCosts.length === 0 && (
            <div className="p-8 text-center text-gray-400 italic text-sm">No hay costos fijos registrados.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Entities View ---
function EntitiesView() {
  const [entities, setEntities] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'cliente' | 'proveedor' | 'all'>('cliente');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<any | null>(null);
  
  const [formData, setFormData] = useState({
    type: 'cliente',
    first_name: '',
    last_name: '',
    rut: '',
    address: '',
    contact: '',
    phone: '',
    email: ''
  });

  const fetchEntities = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        setEntities(await res.json());
      }
    } catch (e) {
      toast.error("Error al cargar entidades");
    }
  };

  useEffect(() => {
    fetchEntities();
  }, []);

  const openCreate = () => {
    setEditingEntity(null);
    setFormData({
      type: activeTab === 'all' ? 'cliente' : activeTab,
      first_name: '',
      last_name: '',
      rut: '',
      address: '',
      contact: '',
      phone: '',
      email: ''
    });
    setIsFormOpen(true);
  };

  const openEdit = (entity: any) => {
    setEditingEntity(entity);
    setFormData({
      type: entity.type || 'cliente',
      first_name: entity.first_name || '',
      last_name: entity.last_name || '',
      rut: entity.rut || '',
      address: entity.address || '',
      contact: entity.contact || '',
      phone: entity.phone || '',
      email: entity.email || ''
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Estás seguro de eliminar esta entidad?")) return;
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Entidad eliminada correctamente");
        fetchEntities();
      } else {
        const err = await res.json();
        toast.error(err.error || "Error al eliminar la entidad");
      }
    } catch (e) {
      toast.error("Error de conexión");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name || !formData.rut || !formData.address) {
      toast.error("Nombre, RUT y Dirección son obligatorios");
      return;
    }

    const payload = {
      ...formData,
      first_name: formData.first_name.trim().toUpperCase(),
      last_name: '', // We save a single Name, setting last_name to empty
      rut: formData.rut.trim(),
      address: formData.address.trim().toUpperCase(),
      contact: formData.contact.trim().toUpperCase(),
      phone: formData.phone.trim(),
      email: formData.email.trim()
    };

    const url = editingEntity ? `/api/customers/${editingEntity.id}` : '/api/customers';
    const method = editingEntity ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success(editingEntity ? "Entidad actualizada" : "Entidad creada con éxito");
        setIsFormOpen(false);
        fetchEntities();
      } else {
        const err = await res.json();
        toast.error(err.error || "Error al guardar entidad");
      }
    } catch (e) {
      toast.error("Error de servidor");
    }
  };

  const filteredEntities = entities.filter(ent => {
    // Type filter
    const entType = ent.type || 'cliente';
    if (activeTab === 'cliente' && entType !== 'cliente' && entType !== 'ambos') return false;
    if (activeTab === 'proveedor' && entType !== 'proveedor' && entType !== 'ambos') return false;
    
    // Search filter
    if (!searchTerm.trim()) return true;
    return matchCustomer(ent, searchTerm);
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 flex flex-col h-full overflow-y-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)]">Entidades</h2>
          <p className="text-sm text-gray-500 mt-1">Administra tus clientes y proveedores desde un solo lugar.</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-[var(--primary)] text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md shadow-blue-100"
        >
          <Plus size={16} /> Crear Entidad
        </button>
      </div>

      <div className="flex flex-wrap gap-4 justify-between items-center bg-gray-50 p-4 rounded-2xl border border-[var(--line)]">
        {/* Tabs */}
        <div className="flex bg-white p-1 rounded-xl border border-[var(--line)] shadow-sm">
          <button
            onClick={() => setActiveTab('cliente')}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-lg transition-all",
              activeTab === 'cliente' ? "bg-[var(--primary)] text-white shadow-sm" : "text-gray-500 hover:text-[var(--ink)]"
            )}
          >
            Clientes
          </button>
          <button
            onClick={() => setActiveTab('proveedor')}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-lg transition-all",
              activeTab === 'proveedor' ? "bg-purple-600 text-white shadow-sm" : "text-gray-500 hover:text-[var(--ink)]"
            )}
          >
            Proveedores
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-lg transition-all",
              activeTab === 'all' ? "bg-[var(--ink)] text-white shadow-sm" : "text-gray-500 hover:text-[var(--ink)]"
            )}
          >
            Todos
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, RUT, contacto..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-[var(--line)] py-2.5 pl-10 pr-4 text-xs rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
          />
        </div>
      </div>

      {/* Grid List */}
      <div className="bg-white border border-[var(--line)] rounded-2xl shadow-sm overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-[var(--line)] text-[10px] font-black uppercase text-gray-400">
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Nombre / Razón Social</th>
                <th className="px-6 py-4">RUT</th>
                <th className="px-6 py-4">Contacto</th>
                <th className="px-6 py-4">Teléfono / Email</th>
                <th className="px-6 py-4">Dirección</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredEntities.map(ent => (
                <tr key={ent.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 space-x-1">
                    {(ent.type === 'cliente' || ent.type === 'ambos') && (
                      <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-green-100 text-green-800">
                        Cliente
                      </span>
                    )}
                    {(ent.type === 'proveedor' || ent.type === 'ambos') && (
                      <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800">
                        Proveedor
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-bold text-[var(--ink)]">
                    {ent.first_name} {ent.last_name}
                  </td>
                  <td className="px-6 py-4 font-mono font-semibold text-gray-600">
                    {ent.rut || '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {ent.contact || '-'}
                  </td>
                  <td className="px-6 py-4 space-y-0.5">
                    <div className="font-semibold text-gray-700">{ent.phone || '-'}</div>
                    <div className="text-[10px] text-gray-400">{ent.email || '-'}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 max-w-[200px] truncate" title={ent.address}>
                    {ent.address || '-'}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => openEdit(ent)}
                      className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(ent.id)}
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredEntities.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">
                    No se encontraron entidades registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editor Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in">
          <div className="bg-white border border-[var(--line)] w-full max-w-lg shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[var(--line)] flex justify-between items-center bg-[var(--ink)] text-white">
              <h3 className="font-bold uppercase italic tracking-widest text-sm">
                {editingEntity ? 'Editar Entidad' : 'Nueva Entidad'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-left">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1.5">Tipo de Entidad *</label>
                <div className="flex gap-6 py-2 px-3 bg-gray-50 border border-[var(--line)] rounded-xl">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase cursor-pointer select-none text-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.type === 'cliente' || formData.type === 'ambos'}
                      onChange={e => {
                        const isProvider = formData.type === 'proveedor' || formData.type === 'ambos';
                        const isChecked = e.target.checked;
                        if (isChecked) {
                          setFormData({ ...formData, type: isProvider ? 'ambos' : 'cliente' });
                        } else {
                          if (isProvider) {
                            setFormData({ ...formData, type: 'proveedor' });
                          }
                        }
                      }}
                      className="w-4 h-4 rounded text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    Cliente
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold uppercase cursor-pointer select-none text-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.type === 'proveedor' || formData.type === 'ambos'}
                      onChange={e => {
                        const isCustomer = formData.type === 'cliente' || formData.type === 'ambos';
                        const isChecked = e.target.checked;
                        if (isChecked) {
                          setFormData({ ...formData, type: isCustomer ? 'ambos' : 'proveedor' });
                        } else {
                          if (isCustomer) {
                            setFormData({ ...formData, type: 'cliente' });
                          }
                        }
                      }}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                    />
                    Proveedor
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1.5">
                  Razón Social / Nombre {formData.type === 'ambos' ? 'Cliente/Proveedor' : (formData.type === 'cliente' ? 'Cliente' : 'Proveedor')} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Ej. Juan Pérez o Distribuidora S.A."
                  className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20 uppercase font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1.5">
                    RUT {formData.type === 'cliente' ? 'Cliente' : 'Proveedor'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.rut}
                    onChange={e => setFormData({ ...formData, rut: e.target.value })}
                    placeholder="Ej. 76.794.328-8"
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1.5">Persona de Contacto</label>
                  <input
                    type="text"
                    value={formData.contact}
                    onChange={e => setFormData({ ...formData, contact: e.target.value })}
                    placeholder="Ej. Administrador"
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1.5">
                  Dirección *
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Ej. Calle Prat 123, Santiago"
                  className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20 uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1.5">
                    Teléfono {formData.type === 'cliente' ? 'Cliente' : 'Proveedor'}
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Ej. +56912345678"
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1.5">
                    Email {formData.type === 'cliente' ? 'Cliente' : 'Proveedor'}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Ej. contacto@empresa.cl"
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 border border-[var(--line)] py-3 font-bold uppercase text-xs hover:bg-gray-50 transition-colors text-center rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[var(--primary)] text-white py-3 font-bold uppercase text-xs hover:opacity-90 transition-opacity text-center rounded-xl"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Configuration View ---
function ConfigurationView() {
  const [config, setConfig] = useState({
    company_name: '',
    company_rut: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_bank_details: '',
    company_logo: ''
  });
  const [loading, setLoading] = useState(true);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setConfig(prev => ({ ...prev, company_logo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/company-settings');
      if (res.ok) {
        const data = await res.json();
        setConfig(prev => ({ ...prev, ...data }));
      }
    } catch (error) {
      toast.error("Error al cargar la configuración");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/company-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        toast.success("Configuración guardada correctamente");
      } else {
        toast.error("Error al guardar la configuración");
      }
    } catch (error) {
      toast.error("Error de conexión");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 font-medium">Cargando configuración...</div>;
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)]">Configuración General</h2>
        <p className="text-sm text-gray-500 mt-1">Gestione la información de su empresa para la emisión de cotizaciones.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border border-[var(--line)] shadow-sm space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2">
            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Razón Social / Nombre Emisor</label>
            <input
              type="text"
              required
              value={config.company_name}
              onChange={e => setConfig({ ...config, company_name: e.target.value })}
              className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-semibold"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">RUT Emisor</label>
            <input
              type="text"
              required
              value={config.company_rut}
              onChange={e => setConfig({ ...config, company_rut: e.target.value })}
              className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-semibold"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Dirección</label>
            <input
              type="text"
              required
              value={config.company_address}
              onChange={e => setConfig({ ...config, company_address: e.target.value })}
              className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-semibold"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Teléfono</label>
            <input
              type="text"
              value={config.company_phone}
              onChange={e => setConfig({ ...config, company_phone: e.target.value })}
              className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-semibold"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Email de Contacto</label>
            <input
              type="email"
              value={config.company_email}
              onChange={e => setConfig({ ...config, company_email: e.target.value })}
              className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-semibold"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Datos Bancarios para Transferencia (Pie de Página)</label>
            <textarea
              required
              rows={3}
              value={config.company_bank_details}
              onChange={e => setConfig({ ...config, company_bank_details: e.target.value })}
              className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-medium"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Logo de la Empresa (Imagen para Cotización)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="w-full bg-gray-50 border border-[var(--line)] p-2 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 cursor-pointer"
            />
            {config.company_logo && (
              <div className="mt-3 flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-[var(--line)]">
                <img src={config.company_logo} alt="Vista previa del logo" className="h-16 w-auto border rounded bg-white p-1 object-contain" />
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, company_logo: '' })}
                  className="text-xs text-red-600 hover:text-red-800 font-bold uppercase"
                >
                  Eliminar Logo
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold uppercase tracking-wider text-xs px-8 py-3 rounded-xl transition-all shadow-md shadow-blue-100 flex items-center gap-2">
            <Check size={16} /> Guardar Configuración
          </button>
        </div>
      </form>
    </div>
  );
}

// --- Quotes View ---
function QuotesView({ products }: { products: Product[] }) {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<'list' | 'editor'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);

  // Autocomplete customer support
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1);

  // Editor states
  const [clientName, setClientName] = useState('');
  const [clientRut, setClientRut] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [condition, setCondition] = useState('Contado - CLP');
  const [validityDays, setValidityDays] = useState('30');
  const [glosa, setGlosa] = useState('');
  
  // POS Cart
  const [cart, setCart] = useState<any[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [selectedProductIndex, setSelectedProductIndex] = useState(-1);

  const fetchQuotes = async () => {
    try {
      const res = await fetch('/api/quotes');
      if (res.ok) {
        setQuotes(await res.json());
      }
    } catch (e) {
      toast.error("Error al cargar cotizaciones");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers?type=cliente');
      if (res.ok) {
        setCustomers(await res.json());
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchQuotes();
    fetchCustomers();
  }, []);

  const openCreator = () => {
    setEditingId(null);
    setClientName('');
    setClientRut('');
    setClientContact('');
    setClientPhone('');
    setClientEmail('');
    setCondition('Contado - CLP');
    setValidityDays('30');
    setGlosa('');
    setCart([]);
    setProductQuery('');
    setCustomerSearch('');
    setSelectedCustomerIndex(-1);
    setSelectedProductIndex(-1);
    setScreen('editor');
  };

  const openEditor = async (quoteId: number) => {
    try {
      const res = await fetch(`/api/quotes/${quoteId}`);
      if (res.ok) {
        const quote = await res.json();
        setEditingId(quote.id);
        setClientName(quote.client_name);
        setClientRut(quote.client_rut || '');
        setClientContact(quote.client_contact || '');
        setClientPhone(quote.client_phone || '');
        setClientEmail(quote.client_email || '');
        setCondition(quote.condition);
        setValidityDays(quote.validity_days.toString());
        setGlosa(quote.glosa || '');
        
        // Map quote items back to cart
        const mappedCart = quote.items.map((item: any) => {
          const product = products.find(p => p.id === item.product_id) || {
            id: item.product_id || '',
            name: item.name,
            type: '',
            sale_price: item.sale_price,
            active: 1
          } as Product;
          
          return {
            product,
            quantity: item.quantity,
            unit: item.unit,
            sale_price: item.sale_price // local custom price for quote
          };
        });
        setCart(mappedCart);
        setProductQuery('');
        setCustomerSearch('');
        setSelectedCustomerIndex(-1);
        setSelectedProductIndex(-1);
        setScreen('editor');
      } else {
        toast.error("Error al cargar detalles de cotización");
      }
    } catch (e) {
      toast.error("Error de red");
    }
  };

  const handleDelete = async (quoteId: number) => {
    if (!window.confirm("¿Está seguro de eliminar esta cotización? Esta acción es irreversible.")) return;
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Cotización eliminada");
        fetchQuotes();
      } else {
        toast.error("Error al eliminar cotización");
      }
    } catch (e) {
      toast.error("Error de conexión");
    }
  };

  // Autocomplete client selection
  const filteredCustomers = customerSearch.trim() ? customers.filter(c =>
    matchCustomer(c, customerSearch)
  ) : [];

  const selectCustomer = (c: any) => {
    setClientName(`${c.first_name} ${c.last_name}`.trim().toUpperCase());
    setClientRut(c.rut || '');
    setClientContact(c.contact || '');
    setClientPhone(c.phone || '');
    setClientEmail(c.email || '');
    setCustomerSearch(`${c.first_name} ${c.last_name}`.trim());
    setShowCustomerDropdown(false);
  };

  const handleCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCustomerIndex(prev => (prev < filteredCustomers.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCustomerIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setShowCustomerDropdown(false);
      setSelectedCustomerIndex(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedCustomerIndex >= 0 && selectedCustomerIndex < filteredCustomers.length) {
        selectCustomer(filteredCustomers[selectedCustomerIndex]);
      } else if (filteredCustomers.length > 0) {
        selectCustomer(filteredCustomers[0]);
      }
      setSelectedCustomerIndex(-1);
    }
  };

  // Cart operations
  const filteredProducts = productQuery.trim() ? products.filter(p =>
    matchProduct(p, productQuery)
  ).slice(0, 5) : [];

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, unit: 'UNID', sale_price: product.sale_price }];
    });
    setProductQuery('');
    setSelectedProductIndex(-1);
  };

  const handleProductKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedProductIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedProductIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setProductQuery('');
      setSelectedProductIndex(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedProductIndex >= 0 && selectedProductIndex < filteredProducts.length) {
        addToCart(filteredProducts[selectedProductIndex]);
      } else if (filteredProducts.length > 0) {
        addToCart(filteredProducts[0]);
      }
      setSelectedProductIndex(-1);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const currentQty = typeof item.quantity === 'number' ? item.quantity : 0;
        return { ...item, quantity: Math.max(1, currentQty + delta) };
      }
      return item;
    }));
  };

  const updateCartUnit = (productId: string, unit: string) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        return { ...item, unit: unit.toUpperCase() };
      }
      return item;
    }));
  };

  const updateCartPrice = (productId: string, price: string) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const parsed = parseFloat(price);
        return { ...item, sale_price: isNaN(parsed) ? 0 : parsed };
      }
      return item;
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName) {
      toast.error("Debe ingresar el nombre del cliente");
      return;
    }
    if (cart.length === 0) {
      toast.error("Debe agregar al menos un item");
      return;
    }

    const payload = {
      client_name: clientName,
      client_rut: clientRut,
      client_contact: clientContact,
      client_phone: clientPhone,
      client_email: clientEmail,
      condition,
      validity_days: parseInt(validityDays, 10) || 30,
      glosa,
      items: cart.map(item => ({
        product_id: item.product.id || null,
        name: item.product.name,
        quantity: item.quantity,
        unit: item.unit,
        sale_price: item.sale_price
      }))
    };

    try {
      const url = editingId ? `/api/quotes/${editingId}` : '/api/quotes';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(editingId ? "Cotización actualizada" : "Cotización creada");
        setScreen('list');
        fetchQuotes();
        // Auto trigger download for new quotes
        if (!editingId && data.id) {
          downloadQuotePDF(data.id);
        }
      } else {
        toast.error(data.error || "Error al guardar cotización");
      }
    } catch (error) {
      toast.error("Error de conexión");
    }
  };

  const downloadQuotePDF = async (quoteId: number) => {
    try {
      const res = await fetch(`/api/quotes/${quoteId}`);
      if (!res.ok) throw new Error("No se pudo cargar la cotización");
      const quote = await res.json();

      const configRes = await fetch('/api/company-settings');
      let issuer = {
        company_name: '',
        company_rut: '',
        company_address: '',
        company_phone: '',
        company_email: '',
        company_bank_details: '',
        company_logo: ''
      };
      if (configRes.ok) {
        const data = await configRes.json();
        issuer = { ...issuer, ...data };
      }

      // Calculate logo dimensions keeping aspect ratio (max 45w x 18h)
      let logoWidth = 35;
      let logoHeight = 15;
      if (issuer.company_logo) {
        try {
          const img = new Image();
          img.src = issuer.company_logo;
          await new Promise((resolve) => {
            img.onload = () => {
              const ratio = img.naturalWidth / img.naturalHeight;
              const maxW = 45;
              const maxH = 18;
              if (ratio > maxW / maxH) {
                logoWidth = maxW;
                logoHeight = maxW / ratio;
              } else {
                logoHeight = maxH;
                logoWidth = maxH * ratio;
              }
              resolve(null);
            };
            img.onerror = () => {
              resolve(null);
            };
          });
        } catch (e) {
          console.error("Error reading logo dimensions:", e);
        }
      }

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      // Draw custom logo if uploaded, otherwise fallback to issuing company name
      let detailsStartY = 24;
      if (issuer.company_logo) {
        try {
          doc.addImage(issuer.company_logo, 'PNG', 15, 11, logoWidth, logoHeight, undefined, 'FAST');
          const logoBottomY = 11 + logoHeight;
          detailsStartY = Math.max(30, logoBottomY + 3);
        } catch (err) {
          console.error("Error drawing company logo, falling back to company name:", err);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          doc.setTextColor(0, 94, 184); // Premium blue
          doc.text(issuer.company_name.toUpperCase(), 15, 18);
          detailsStartY = 24;
        }
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(0, 94, 184); // Premium blue
        doc.text(issuer.company_name.toUpperCase(), 15, 18);
        detailsStartY = 24;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      doc.text(issuer.company_address.toUpperCase(), 15, detailsStartY);

      let phoneEmailText = `TELÉFONO: ${issuer.company_phone}`;
      if (issuer.company_email) {
        phoneEmailText += `    |    EMAIL: ${issuer.company_email.toLowerCase()}`;
      }
      doc.text(phoneEmailText, 15, detailsStartY + 4);

      // Blue Box for COTIZACIÓN (Centering headers)
      doc.setDrawColor(0, 94, 184);
      doc.setLineWidth(0.6);
      
      const nameLines = doc.splitTextToSize(issuer.company_name.toUpperCase(), 64);
      const boxHeightTop = 23 + (nameLines.length * 3.5);
      doc.rect(130, 10, 70, boxHeightTop);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(0, 94, 184);
      doc.text("COTIZACIÓN", 165, 16, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      doc.text(`Folio Nº ${quote.id}`, 165, 21.5, { align: 'center' });
      doc.text(issuer.company_rut, 165, 26.5, { align: 'center' });
      
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      let currentBoxY = 31.5;
      nameLines.forEach((line: string) => {
        doc.text(line, 165, currentBoxY, { align: 'center' });
        currentBoxY += 3.5;
      });

      // Client Box (Prevent text overlaps)
      doc.setDrawColor(0, 94, 184);
      doc.setLineWidth(0.3);
      doc.setFillColor(255, 255, 255);
      
      const hasGlosa = !!quote.glosa;
      const boxHeight = hasGlosa ? 32 : 27.5;
      doc.rect(15, 45, 185, boxHeight);

      doc.setFillColor(240, 245, 255);
      doc.rect(15.1, 45.1, 184.8, 6.2, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(0, 94, 184);
      doc.text(`${quote.client_rut || 'SIN RUT'}    /    ${quote.client_name.toUpperCase()}`, 18, 49.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);

      // Left Column: Customer details
      doc.setFont("helvetica", "bold");
      doc.text("Contacto:", 17, 55);
      doc.setFont("helvetica", "normal");
      const contactVal = quote.client_contact || quote.client_name;
      doc.text(contactVal.substring(0, 45).toUpperCase(), 42, 55);
      
      doc.setFont("helvetica", "bold");
      doc.text("Teléfono:", 17, 59.5);
      doc.setFont("helvetica", "normal");
      doc.text(quote.client_phone || 'NO ESPECIFICADO', 42, 59.5);

      doc.setFont("helvetica", "bold");
      doc.text("Email:", 17, 64);
      doc.setFont("helvetica", "normal");
      doc.text(quote.client_email || 'NO ESPECIFICADO', 42, 64);

      doc.setFont("helvetica", "bold");
      doc.text("Dirección:", 17, 68.5);
      doc.setFont("helvetica", "normal");
      doc.text((quote.client_address || 'NO ESPECIFICADA').toUpperCase(), 42, 68.5);

      // Right Column: Quote commercial details
      doc.setFont("helvetica", "bold");
      doc.text("Condición:", 112, 55);
      doc.setFont("helvetica", "normal");
      doc.text(quote.condition.toUpperCase(), 138, 55);

      const issueDate = new Date(quote.created_at);
      const validityVal = parseInt(quote.validity_days, 10) || 30;
      const validDate = new Date(issueDate.getTime() + validityVal * 24 * 60 * 60 * 1000);
      const formatD = (d: Date) => d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });

      doc.setFont("helvetica", "bold");
      doc.text("Emisión:", 112, 59.5);
      doc.setFont("helvetica", "normal");
      doc.text(formatD(issueDate), 138, 59.5);

      doc.setFont("helvetica", "bold");
      doc.text("Valido hasta:", 112, 64);
      doc.setFont("helvetica", "normal");
      doc.text(formatD(validDate), 138, 64);

      if (hasGlosa) {
        doc.setFont("helvetica", "bold");
        doc.text("Glosa:", 17, 73);
        doc.setFont("helvetica", "normal");
        const glosaText = quote.glosa.substring(0, 80);
        doc.text(glosaText.toUpperCase(), 42, 73);
      }

      // Items Table
      const headers = [["Detalle", "Cant.", "Uni.", "Neto", "Total"]];
      let netSubtotal = 0;

      const tableRows = quote.items.map((item: any) => {
        const grossUnitPrice = item.sale_price;
        const netUnitPrice = grossUnitPrice / 1.19;
        const itemNetTotal = item.quantity * netUnitPrice;
        netSubtotal += itemNetTotal;

        const formatCurrency = (val: number) => {
          return val.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        };

        return [
          item.name.toUpperCase(),
          item.quantity.toString(),
          item.unit.toUpperCase(),
          formatCurrency(netUnitPrice),
          formatCurrency(itemNetTotal)
        ];
      });

      const formatCurrencyFull = (val: number) => {
        return Math.round(val).toLocaleString('es-CL') + " CLP";
      };

      const tax = netSubtotal * 0.19;
      const grossTotal = netSubtotal + tax;

      autoTable(doc, {
        head: headers,
        body: tableRows,
        startY: hasGlosa ? 81 : 76,
        margin: { left: 15, right: 15 },
        theme: 'grid',
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          valign: 'middle',
          lineColor: [180, 180, 180],
          lineWidth: 0.2
        },
        headStyles: {
          fillColor: [240, 245, 255],
          textColor: [0, 94, 184],
          fontStyle: 'bold',
          lineWidth: 0.2,
          lineColor: [0, 94, 184]
        },
        columnStyles: {
          0: { cellWidth: 'auto', fontStyle: 'bold' },
          1: { cellWidth: 15, halign: 'center' },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 25, halign: 'right' },
          4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
        },
        didDrawPage: (data) => {
          const finalY = data.cursor ? data.cursor.y : 150;
          let currentY = finalY + 5;
          if (currentY > 215) {
            doc.addPage();
            currentY = 20;
          }

          // Disclaimer (left)
          doc.setFont("helvetica", "italic");
          doc.setFontSize(6);
          doc.setTextColor(110, 110, 110);
          const disclaimer = "Se reserva el derecho de cambiar o modificar su lista de precios sin previo aviso, corregir irregularidades u otros generados por sus empleados. En caso de una variación muy alta del dólar, será necesario volver a recalcular los valores cotizados.";
          const disclaimerLines = doc.splitTextToSize(disclaimer, 110);
          doc.text(disclaimerLines, 15, currentY);

          // Totals block (right)
          doc.setDrawColor(0, 94, 184);
          doc.setLineWidth(0.2);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(0, 0, 0);

          doc.text("Neto:", 135, currentY + 3);
          doc.text(formatCurrencyFull(netSubtotal), 195, currentY + 3, { align: 'right' });
          doc.line(130, currentY + 4.5, 200, currentY + 4.5);

          doc.text("IVA(19%):", 135, currentY + 8);
          doc.text(formatCurrencyFull(tax), 195, currentY + 8, { align: 'right' });
          doc.line(130, currentY + 9.5, 200, currentY + 9.5);

          doc.text("Total:", 135, currentY + 13);
          doc.text(formatCurrencyFull(grossTotal), 195, currentY + 13, { align: 'right' });

          doc.rect(130, currentY, 70, 16);

          // Bank Details
          currentY += 20;
          doc.setDrawColor(200, 200, 200);
          
          const bankLines = doc.splitTextToSize(issuer.company_bank_details, 150);
          const bankBoxHeight = Math.max(14, (bankLines.length * 3.5) + 3);
          
          doc.rect(15, currentY, 185, bankBoxHeight);
          doc.setFillColor(245, 245, 245);
          doc.rect(15.1, currentY + 0.1, 23.8, bankBoxHeight - 0.2, 'F');
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(0, 0, 0);
          
          const labelOffsetY = (bankBoxHeight / 2) - 1.55;
          doc.text("Datos", 17, currentY + labelOffsetY);
          doc.text("Bancarios:", 17, currentY + labelOffsetY + 3.5);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.text(bankLines, 41, currentY + 4);
        }
      });

      const filename = `CT${quote.id}_${quote.client_name.replace(/\s+/g, '_').toUpperCase()}.pdf`;
      doc.save(filename);
      toast.success("PDF descargado correctamente");
    } catch (error: any) {
      toast.error(error.message || "Error al descargar PDF");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 font-medium">Cargando módulo de cotizaciones...</div>;
  }

  const calculateTotal = () => {
    return cart.reduce((acc, item) => acc + (item.sale_price * item.quantity), 0);
  };

  return (
    <div className="h-full flex flex-col">
      {screen === 'list' ? (
        <div className="p-8 max-w-5xl mx-auto space-y-8 w-full">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)]">Gestión de Cotizaciones</h2>
              <p className="text-sm text-gray-500 mt-1">Cree y administre presupuestos formales para sus clientes.</p>
            </div>
            <button
              onClick={openCreator}
              className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-blue-100 flex items-center gap-2"
            >
              <Plus size={16} /> Nueva Cotización
            </button>
          </div>

          <div className="border border-[var(--line)] bg-white rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-[80px_2.5fr_1.5fr_1.2fr_1.5fr] p-4 border-b border-[var(--line)] bg-gray-50/50 text-xs font-bold uppercase text-gray-500">
              <div>Folio</div>
              <div>Cliente</div>
              <div>Fecha</div>
              <div className="text-right">Total Neto</div>
              <div className="text-center">Acciones</div>
            </div>
            <div className="divide-y divide-[var(--line)] max-h-[500px] overflow-auto">
              {quotes.map((q: any) => {
                const netAmount = q.total_amount / 1.19;
                return (
                  <div key={q.id} className="grid grid-cols-[80px_2.5fr_1.5fr_1.2fr_1.5fr] p-4 text-sm items-center hover:bg-gray-50/50 transition-colors">
                    <div className="font-mono font-bold text-gray-400">#{q.id}</div>
                    <div className="font-bold uppercase truncate pr-4">{q.client_name}</div>
                    <div className="text-gray-500 font-mono text-xs">{new Date(q.created_at).toLocaleDateString()}</div>
                    <div className="text-right font-mono font-bold text-[var(--ink)]">${Math.round(netAmount).toLocaleString()}</div>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => downloadQuotePDF(q.id)}
                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
                        title="Descargar PDF"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => openEditor(q.id)}
                        className="p-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {quotes.length === 0 && (
                <div className="p-8 text-center text-gray-400 italic text-sm">No hay cotizaciones registradas.</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 h-full overflow-hidden">
          {/* Quote creator left: Customer details and header parameters */}
          <div className="w-2/5 border-r border-[var(--line)] bg-white p-6 overflow-y-auto flex flex-col space-y-6">
            <div>
              <h3 className="text-xl font-bold uppercase tracking-wide">{editingId ? `Editar Cotización #${editingId}` : 'Detalles de Cotización'}</h3>
              <p className="text-xs text-gray-400 mt-0.5">Defina el cliente y condiciones comerciales.</p>
            </div>

            {/* Customer Lookup Autocomplete */}
            <div className="relative">
              <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Buscar Cliente Registrado (Autocomplete)</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Escriba nombre o RUT..."
                  value={customerSearch}
                  onChange={e => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                    setSelectedCustomerIndex(-1);
                  }}
                  onKeyDown={handleCustomerKeyDown}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="w-full bg-gray-50 border border-[var(--line)] py-2 pl-9 pr-4 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                />
              </div>

              {showCustomerDropdown && customerSearch && (
                <div className="absolute top-full left-0 w-full bg-white border border-[var(--line)] rounded-xl shadow-2xl z-20 max-h-40 overflow-y-auto mt-1">
                  {filteredCustomers.map((c, index) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className={cn(
                        "w-full text-left p-2.5 text-xs hover:bg-gray-100 border-b last:border-0 border-gray-100 flex justify-between uppercase transition-colors",
                        index === selectedCustomerIndex ? "bg-blue-50 text-[var(--primary)] border-l-4 border-l-[var(--primary)]" : "bg-white text-gray-700"
                      )}
                    >
                      <span className="font-bold">{c.first_name} {c.last_name}</span>
                      <span className="text-gray-400 font-mono">{c.rut || 'SIN RUT'}</span>
                    </button>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <div className="p-2 text-center text-xs text-gray-400 italic">No se encontraron clientes</div>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={handleSave} className="space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Razón Social / Nombre Cliente *</label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={e => setClientName(e.target.value.toUpperCase())}
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20 uppercase font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">RUT Cliente</label>
                  <input
                    type="text"
                    value={clientRut}
                    onChange={e => setClientRut(e.target.value)}
                    placeholder="E.g. 78.065.264-0"
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Persona de Contacto</label>
                  <input
                    type="text"
                    value={clientContact}
                    onChange={e => setClientContact(e.target.value)}
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20 uppercase"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Teléfono Cliente</label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={e => setClientPhone(e.target.value)}
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Email Cliente</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={e => setClientEmail(e.target.value)}
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Condición Pago</label>
                  <input
                    type="text"
                    required
                    value={condition}
                    onChange={e => setCondition(e.target.value)}
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20 uppercase"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Días de Validez</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={validityDays}
                    onChange={e => setValidityDays(e.target.value)}
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Glosa / Observación (Opcional)</label>
                  <input
                    type="text"
                    value={glosa}
                    onChange={e => setGlosa(e.target.value)}
                    placeholder="Nota que aparecerá en el PDF..."
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setScreen('list')}
                  className="flex-1 border border-[var(--line)] py-3 rounded-xl font-bold uppercase text-xs hover:bg-gray-50 transition-colors text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[var(--primary)] text-white py-3 rounded-xl font-bold uppercase text-xs hover:bg-[var(--primary-dark)] shadow-md shadow-blue-100 transition-all text-center"
                >
                  {editingId ? 'Guardar Cambios' : 'Guardar y PDF'}
                </button>
              </div>
            </form>
          </div>

          {/* Quote creator right: Search & cart POS items */}
          <div className="flex-1 bg-gray-50 p-6 flex flex-col h-full overflow-hidden">
            <div className="mb-4">
              <h4 className="font-bold text-sm text-[var(--ink)] uppercase">Comanda de Cotización</h4>
              <p className="text-xs text-gray-500">Agregue productos del catálogo al presupuesto.</p>
            </div>

            {/* Product search input */}
            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={productQuery}
                onChange={e => {
                  setProductQuery(e.target.value);
                  setSelectedProductIndex(-1);
                }}
                onKeyDown={handleProductKeyDown}
                placeholder="BUSCAR O ESCANEAR PRODUCTO..."
                className="w-full bg-white border border-[var(--line)] py-3 pl-10 pr-4 text-xs font-semibold rounded-xl shadow-sm focus:outline-none focus:ring-2 ring-[var(--primary)]/20 transition-all uppercase"
              />
              
              {productQuery && filteredProducts.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-white border border-[var(--line)] border-t-0 shadow-2xl z-20 rounded-b-xl overflow-hidden">
                  {filteredProducts.map((p, index) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addToCart(p)}
                      className={cn(
                        "w-full flex items-center justify-between p-3.5 hover:bg-gray-100 transition-colors text-left border-b border-gray-100 last:border-0",
                        index === selectedProductIndex ? "bg-blue-50 text-[var(--primary)] border-l-4 border-l-[var(--primary)]" : "bg-white text-gray-700"
                      )}
                    >
                      <div>
                        <div className="font-bold uppercase text-xs">{p.name}</div>
                        <div className="text-[9px] font-mono opacity-50">SKU: {p.id} // STOCK: {p.total_stock}</div>
                      </div>
                      <div className="font-mono text-sm font-bold">${p.sale_price.toLocaleString()}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cart list */}
            <div className="flex-1 overflow-auto space-y-3 pr-1 bg-white border border-[var(--line)] rounded-2xl p-4">
              {cart.map((item, i) => {
                const subtotal = item.sale_price * item.quantity;
                return (
                  <div key={item.product.id || i} className="p-3 border border-[var(--line)] rounded-xl flex items-center justify-between gap-4 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold uppercase text-xs truncate">{item.product.name}</div>
                      <div className="text-[9px] font-mono text-gray-400 mt-0.5">SKU: {item.product.id || 'N/A'}</div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1.5 shrink-0 bg-white border border-gray-200 rounded-lg p-1">
                      <button onClick={() => updateCartQty(item.product.id, -1)} className="p-1 hover:bg-gray-100 rounded text-gray-500"><Minus size={12} /></button>
                      <span className="font-mono text-xs font-bold w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateCartQty(item.product.id, 1)} className="p-1 hover:bg-gray-100 rounded text-gray-500"><Plus size={12} /></button>
                    </div>

                    {/* Unit type input */}
                    <div className="w-16 shrink-0">
                      <input
                        type="text"
                        value={item.unit}
                        onChange={e => updateCartUnit(item.product.id, e.target.value)}
                        placeholder="UNID"
                        className="w-full text-center bg-white border border-gray-200 py-1 text-xs rounded-lg font-bold uppercase focus:outline-none"
                      />
                    </div>

                    {/* Unit price input */}
                    <div className="w-24 shrink-0 flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
                      <span className="text-gray-400 text-xs font-bold">$</span>
                      <input
                        type="number"
                        value={item.sale_price}
                        onChange={e => updateCartPrice(item.product.id, e.target.value)}
                        className="w-full font-mono text-xs font-bold focus:outline-none"
                      />
                    </div>

                    {/* Line total */}
                    <div className="w-20 text-right font-mono text-xs font-bold text-[var(--primary)] shrink-0">
                      ${subtotal.toLocaleString()}
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
              {cart.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 italic text-xs py-12">
                  <ShoppingCart size={32} className="opacity-20 mb-2" />
                  <span>No hay productos en esta cotización</span>
                </div>
              )}
            </div>

            {/* Summary total footer */}
            <div className="mt-4 p-4 bg-white border border-[var(--line)] rounded-2xl flex justify-between items-center shrink-0 shadow-sm">
              <div>
                <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Total Cotizado (Neto + IVA)</span>
                <div className="text-xs text-gray-500 font-medium">Neto: ${Math.round(calculateTotal() / 1.19).toLocaleString()} // IVA: ${Math.round((calculateTotal() / 1.19) * 0.19).toLocaleString()}</div>
              </div>
              <div className="text-2xl font-mono font-bold text-[var(--primary)]">
                ${calculateTotal().toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
