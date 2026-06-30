import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  Package,
  BarChart3,
  History,
  CreditCard,
  Users,
  Receipt,
  Lock,
  FileText,
  Settings,
  AlertTriangle
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { cn } from './lib/utils';

// --- Shared Types ---
import { Product, Analytics } from './components/Types';

// --- Views & Components ---
import { LoginView } from './components/LoginView';
import { SalesView } from './components/SalesView';
import { InventoryView } from './components/InventoryView';
import { AnalyticsView } from './components/AnalyticsView';
import { HistoryView } from './components/HistoryView';
import { ReceivablesView } from './components/ReceivablesView';
import { ExpensesView } from './components/ExpensesView';
import { FixedCostsView } from './components/FixedCostsView';
import { QuotesView } from './components/QuotesView';
import { ConfigurationView } from './components/ConfigurationView';
import { EntitiesView } from './components/EntitiesView';
import { ExpressModal } from './components/ExpressModal';

interface SidebarItemProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}

const SidebarItem = ({ icon: Icon, label, active, onClick }: SidebarItemProps) => (
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
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
    if (!isAuthenticated) return;
    try {
      const res = await fetch(`/api/products?includeInactive=${includeInactive}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAnalytics = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch(`/api/analytics?startDate=${startDate}T00:00:00&endDate=${endDate}T23:59:59`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error(err);
    }
  };

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data && data.authenticated) {
        setIsAuthenticated(true);
        setUserPermissions(data.permissions || []);
      } else {
        setIsAuthenticated(false);
        setUserPermissions([]);
      }
    } catch {
      setIsAuthenticated(false);
      setUserPermissions([]);
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        setIsAuthenticated(false);
        setUserPermissions([]);
        toast.success('Sesión cerrada correctamente');
      } else {
        toast.error('Error al cerrar sesión');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        const urlStr = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
        if (!urlStr.includes('/api/auth/login') && !urlStr.includes('/api/auth/session')) {
          setIsAuthenticated(false);
          setUserPermissions([]);
        }
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProducts(showArchived);
    }
  }, [showArchived, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAnalytics();
    }
  }, [startDate, endDate, isAuthenticated]);

  useEffect(() => {
    if (view === 'analytics' && isAuthenticated) {
      fetchAnalytics();
    }
  }, [view, isAuthenticated]);

  // Automatic routing for users lacking 'sales' access or custom views
  useEffect(() => {
    if (isAuthenticated && userPermissions.length > 0) {
      const allPossibleViews = ['sales', 'inventory', 'analytics', 'history', 'receivables', 'entities', 'expenses', 'fixed_costs', 'quotes', 'configuration'];
      const allowedViews = allPossibleViews.filter(v => userPermissions.includes(v));
      if (allowedViews.length > 0 && !allowedViews.includes(view)) {
        setView(allowedViews[0] as any);
      }
    }
  }, [isAuthenticated, userPermissions, view]);

  useEffect(() => {
    if (view === 'sales' && !isExpressModalOpen && isAuthenticated) {
      searchInputRef.current?.focus();
    }
  }, [view, isExpressModalOpen, isAuthenticated]);

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

  const hasPermission = (permission: string) => userPermissions.includes(permission);

  if (isAuthenticated === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950">
        <Toaster position="top-right" theme="light" />
        <div className="text-sm font-semibold text-slate-400 animate-pulse uppercase tracking-widest">Cargando aplicación...</div>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <>
        <Toaster position="top-right" theme="light" />
        <LoginView onLoginSuccess={(permissions) => {
          setIsAuthenticated(true);
          setUserPermissions(permissions);
        }} />
      </>
    );
  }

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
          {hasPermission('sales') && (
            <SidebarItem
              icon={ShoppingCart}
              label="Terminal POS"
              active={view === 'sales'}
              onClick={() => setView('sales')}
            />
          )}
          {hasPermission('inventory') && (
            <SidebarItem
              icon={Package}
              label="Inventario"
              active={view === 'inventory'}
              onClick={() => setView('inventory')}
            />
          )}
          {hasPermission('analytics') && (
            <SidebarItem
              icon={BarChart3}
              label="Reportes"
              active={view === 'analytics'}
              onClick={() => setView('analytics')}
            />
          )}
          {hasPermission('history') && (
            <SidebarItem
              icon={History}
              label="Historial"
              active={view === 'history'}
              onClick={() => setView('history')}
            />
          )}
          {hasPermission('receivables') && (
            <SidebarItem
              icon={CreditCard}
              label="Cuentas por Cobrar"
              active={view === 'receivables'}
              onClick={() => setView('receivables')}
            />
          )}
          {hasPermission('entities') && (
            <SidebarItem
              icon={Users}
              label="Entidades"
              active={view === 'entities'}
              onClick={() => setView('entities')}
            />
          )}
          {hasPermission('expenses') && (
            <SidebarItem
              icon={Receipt}
              label="Gastos de Caja"
              active={view === 'expenses'}
              onClick={() => setView('expenses')}
            />
          )}
          {hasPermission('fixed_costs') && (
            <SidebarItem
              icon={Lock}
              label="Costos Fijos"
              active={view === 'fixed_costs'}
              onClick={() => setView('fixed_costs')}
            />
          )}
          {hasPermission('quotes') && (
            <SidebarItem
              icon={FileText}
              label="Cotizaciones"
              active={view === 'quotes'}
              onClick={() => setView('quotes')}
            />
          )}
          {hasPermission('configuration') && (
            <SidebarItem
              icon={Settings}
              label="Configuración"
              active={view === 'configuration'}
              onClick={() => setView('configuration')}
            />
          )}
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
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors uppercase tracking-wider mt-2"
          >
            <Lock size={14} />
            Cerrar Sesión
          </button>
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
