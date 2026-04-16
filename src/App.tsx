import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
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
  FileUp
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
}

interface Analytics {
  topProducts: { name: string; total_sold: number }[];
  categoryAnalysis: { type: string; total_sold: number }[];
  summary: { total_revenue: number; total_cost: number; total_profit: number };
  inventoryByFamily: { type: string; total_stock: number }[];
}

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
  const [view, setView] = useState<'sales' | 'inventory' | 'analytics'>('sales');
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isExpressModalOpen, setIsExpressModalOpen] = useState(false);
  const [scannedId, setScannedId] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(5);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    setProducts(data);
  };

  const fetchAnalytics = async () => {
    const res = await fetch(`/api/analytics?startDate=${startDate}T00:00:00&endDate=${endDate}T23:59:59`);
    const data = await res.json();
    setAnalytics(data);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [startDate, endDate]);

  useEffect(() => {
    // Auto-focus search input
    if (view === 'sales' && !isExpressModalOpen) {
      searchInputRef.current?.focus();
    }
  }, [view, isExpressModalOpen]);

  const handleSale = async (items: { product_id: string; quantity: number }[]) => {
    const res = await fetch('/api/sales/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
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
              setScannedId(id);
              setIsExpressModalOpen(true);
            }}
          />
        )}
        {view === 'inventory' && (
          <InventoryView
            products={products}
            onRefresh={fetchProducts}
            lowStockThreshold={lowStockThreshold}
            setLowStockThreshold={setLowStockThreshold}
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
      </main>

      {/* Express Creation Modal */}
      {isExpressModalOpen && (
        <ExpressModal
          initialId={scannedId}
          onClose={() => setIsExpressModalOpen(false)}
          onSuccess={() => {
            setIsExpressModalOpen(false);
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

  const filtered = products.filter((p: any) =>
    p.id.toUpperCase().includes(query.toUpperCase()) ||
    p.name.toUpperCase().includes(query.toUpperCase())
  ).slice(0, 5);

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
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const total = cart.reduce((acc, item) => acc + (item.product.sale_price * item.quantity), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query) {
      const exactMatch = products.find((p: any) => p.id === query.toUpperCase());
      if (exactMatch) {
        addToCart(exactMatch);
      } else {
        onProductNotFound(query.toUpperCase());
      }
    }
  };

  const handleFinishSale = async () => {
    const items = cart.map(item => ({ product_id: item.product.id, quantity: item.quantity }));
    const success = await onSale(items);
    if (success) {
      setCart([]);
      setIsPaymentModalOpen(false);
    }
  };

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
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            placeholder="ESCANEAR O BUSCAR PRODUCTO..."
            className="w-full bg-white border border-[var(--line)] py-4 pl-12 pr-4 text-lg font-medium rounded-xl shadow-sm focus:outline-none focus:ring-2 ring-[var(--primary)]/20 transition-all"
            autoFocus
          />

          {query && filtered.length > 0 && (
            <div className="absolute top-full left-0 w-full bg-white border border-[var(--line)] border-t-0 shadow-2xl z-10">
              {filtered.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="w-full flex items-center justify-between p-4 hover:bg-[var(--ink)] hover:text-[var(--bg)] transition-colors group border-b border-[var(--line)] last:border-0"
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
                  <div className="flex items-center border border-[var(--line)] bg-white">
                    <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 hover:bg-gray-100 border-r border-[var(--line)]"><Minus size={12} /></button>
                    <span className="px-3 font-mono text-xs">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 hover:bg-gray-100 border-l border-[var(--line)]"><Plus size={12} /></button>
                  </div>
                  <div className="font-mono text-sm font-bold">
                    ${(item.product.sale_price * item.quantity).toLocaleString()}
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
  const [method, setMethod] = useState<'cash' | 'card' | null>(null);
  const [received, setReceived] = useState('');
  const [confirmCard, setConfirmCard] = useState(false);

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
            <div className="grid grid-cols-2 gap-6">
              <button
                onClick={() => setMethod('cash')}
                className="flex flex-col items-center gap-4 p-8 border-2 border-[var(--line)] hover:bg-[var(--ink)] hover:text-[var(--bg)] transition-all group"
              >
                <Banknote size={48} className="opacity-40 group-hover:opacity-100" />
                <span className="font-bold uppercase text-sm tracking-widest">Efectivo</span>
              </button>
              <button
                onClick={() => setMethod('card')}
                className="flex flex-col items-center gap-4 p-8 border-2 border-[var(--line)] hover:bg-[var(--ink)] hover:text-[var(--bg)] transition-all group"
              >
                <CreditCard size={48} className="opacity-40 group-hover:opacity-100" />
                <span className="font-bold uppercase text-sm tracking-widest">Tarjeta</span>
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
                  onClick={onConfirm}
                  className="flex-[2] bg-[var(--ink)] text-[var(--bg)] py-4 font-bold uppercase text-xs hover:opacity-90 transition-opacity disabled:opacity-30"
                >
                  Confirmar Venta
                </button>
              </div>
            </div>
          ) : (
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
                      onClick={onConfirm}
                      className="flex-[2] bg-green-600 text-white py-4 font-bold uppercase text-xs hover:opacity-90 transition-opacity"
                    >
                      Confirmar y Rebajar Stock
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InventoryView({ products, onRefresh, lowStockThreshold, setLowStockThreshold }: any) {
  const [search, setSearch] = useState('');
  const [showCosts, setShowCosts] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showPinModal, setShowPinModal] = useState<any>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const filtered = products.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  const exactMatch = products.find((p: any) => p.id === search);

  const handleEditClick = (product: any) => {
    setShowPinModal(product);
  };

  const handlePinSuccess = (product: any) => {
    setShowPinModal(null);
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

      return {
        'ID_BARCODE': p.id,
        'NOMBRE': p.name,
        'CATEGORIA': p.type,
        'PRECIO_VENTA': p.sale_price,
        'STOCK_ACTUAL': totalStock,
        'COSTO_REF': oldestBatch ? oldestBatch.cost : 0
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
          <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)]">Inventario Maestro</h2>
          <p className="text-sm text-gray-500 mt-1">Control total de existencias y lotes FIFO.</p>
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
        <div className="grid grid-cols-[1.2fr_2.5fr_1.2fr_0.8fr_1fr_1fr_1fr_80px] col-header">
          <div className="truncate">ID_BARCODE</div>
          <div className="truncate">NOMBRE_PRODUCTO</div>
          <div className="truncate">CATEGORÍA</div>
          <div className="text-right truncate">STOCK</div>
          <div className="text-right flex items-center justify-end gap-2 truncate">
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
                "grid grid-cols-[1.2fr_2.5fr_1.2fr_0.8fr_1fr_1fr_1fr_80px] data-row text-sm items-center",
                isLowStock && "bg-red-50/50",
                exactMatch?.id === p.id && "bg-green-50"
              )}>
                <div className="text-[10px] font-mono text-gray-400 truncate pr-2">{p.id}</div>
                <div className="font-bold uppercase truncate flex items-center gap-2 text-[var(--ink)]">
                  {p.name}
                  {isLowStock && <AlertTriangle size={12} className="text-red-600 flex-shrink-0" />}
                </div>
                <div className="text-xs text-gray-500 truncate">{p.type}</div>
                <div className="text-right font-bold">{p.total_stock}</div>
                <div className="text-right font-mono text-gray-600">
                  {showCosts ? `$${(p.cost || 0).toLocaleString()}` : '••••••'}
                </div>
                <div className="text-right font-bold text-[var(--primary)]">${p.sale_price.toLocaleString()}</div>
                <div className="flex justify-center items-center gap-2">
                  {isLowStock && (
                    <span className="bg-red-100 text-red-700 text-[9px] px-2 py-0.5 font-bold uppercase rounded border border-red-200">STOCK_BAJO</span>
                  )}
                  {p.has_zero_cost ? (
                    <span className="bg-amber-100 text-amber-700 text-[9px] px-2 py-0.5 font-bold uppercase rounded border border-amber-200">Pendiente_Costo</span>
                  ) : (
                    !isLowStock && <span className="bg-green-100 text-green-700 text-[9px] px-2 py-0.5 font-bold uppercase rounded border border-green-200">OK</span>
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

      {showPinModal && (
        <PinModal
          onSuccess={() => handlePinSuccess(showPinModal)}
          onClose={() => setShowPinModal(null)}
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
  if (!analytics) return null;

  const COLORS = ['#005EB8', '#FFC785', '#10B981', '#F59E0B', '#6366F1'];

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)]">Reportes y Análisis</h2>
          <p className="text-sm text-gray-500 mt-1">Visualización de rendimiento y rentabilidad.</p>
        </div>
        <div className="flex gap-4 items-center bg-white p-3 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold uppercase text-gray-400 mb-1">Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs font-semibold focus:outline-none"
            />
          </div>
          <div className="w-px h-8 bg-[var(--line)]" />
          <div className="flex flex-col">
            <label className="text-[10px] font-bold uppercase text-gray-400 mb-1">Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs font-semibold focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <StatCard label="Ingresos Totales" value={`$${analytics.summary.total_revenue?.toLocaleString() || 0}`} />
        <StatCard label="Costo de Ventas" value={`$${analytics.summary.total_cost?.toLocaleString() || 0}`} />
        <StatCard label="Utilidad Real (FIFO)" value={`$${analytics.summary.total_profit?.toLocaleString() || 0}`} trend />
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="p-8 border border-[var(--line)] bg-white rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold uppercase mb-8 text-gray-500 tracking-wider">Ranking de Salidas (Volumen)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.topProducts}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" fontSize={10} tick={{ fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} tick={{ fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#111827', fontSize: '12px', fontWeight: '600' }}
                />
                <Bar dataKey="total_sold" fill="var(--primary)" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="total_sold" position="top" style={{ fill: 'var(--primary)', fontSize: 10, fontWeight: 'bold' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-8 border border-[var(--line)] bg-white rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold uppercase mb-8 text-gray-500 tracking-wider">Dominio por Categoría</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.categoryAnalysis}
                  dataKey="total_sold"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  label={({ type, total_sold }) => `${type}: ${total_sold}`}
                >
                  {analytics.categoryAnalysis.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="p-8 border border-[var(--line)] bg-white rounded-2xl shadow-sm">
        <h3 className="text-sm font-bold uppercase mb-8 text-gray-500 tracking-wider">Inventario por Familia (Existencias)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.inventoryByFamily} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" fontSize={10} tick={{ fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="type" type="category" fontSize={10} tick={{ fill: '#6B7280' }} axisLine={false} tickLine={false} width={100} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ color: '#111827', fontSize: '12px', fontWeight: '600' }}
              />
              <Bar dataKey="total_stock" fill="#FFC785" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="total_stock" position="right" style={{ fill: '#111827', fontSize: 10, fontWeight: 'bold' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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

function PinModal({ onSuccess, onClose }: any) {
  const [pin, setPin] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '6767') {
      onSuccess();
    } else {
      toast.error('PIN Incorrecto');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white border border-[var(--line)] w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-[var(--line)] flex justify-between items-center bg-[var(--ink)] text-white">
          <h3 className="font-bold uppercase tracking-widest text-xs flex items-center gap-2">
            <Lock size={14} /> Acceso Restringido
          </h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-4">Ingrese PIN de 4 dígitos para editar</p>
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              maxLength={4}
              autoFocus
              className="w-32 text-center text-3xl tracking-[0.5em] font-bold border-b-2 border-[var(--primary)] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-[var(--primary)] text-white py-3 rounded-xl font-bold uppercase text-xs hover:bg-[var(--primary-dark)] transition-all"
          >
            Verificar PIN
          </button>
        </form>
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

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white border border-[var(--line)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-[var(--line)] flex justify-between items-center bg-[var(--primary)] text-white">
          <h3 className="font-bold uppercase tracking-widest text-sm">Editar Producto</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">ID / Barcode</label>
            <input type="text" value={product.id} readOnly className="w-full bg-gray-50 border border-[var(--line)] p-2 font-mono text-sm text-gray-500 rounded-lg" />
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Nombre Producto</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                className="w-full bg-white border border-[var(--line)] p-2 text-sm rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
              />
            </div>
            <div>
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
            <div>
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

          <div className="pt-4 flex gap-4">
            <button
              type="submit"
              className="flex-1 bg-[var(--primary)] text-white py-3 rounded-xl font-bold uppercase text-xs hover:bg-[var(--primary-dark)] shadow-lg shadow-blue-100 transition-all"
            >
              Guardar Cambios
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
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        sale_price: parseFloat(formData.sale_price),
        initial_stock: parseInt(formData.initial_stock),
        cost: parseFloat(formData.cost)
      })
    });

    if (res.ok) {
      toast.success('Producto creado');
      onSuccess();
    } else {
      toast.error('Error al crear producto');
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
            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Código Detectado</label>
            <input
              type="text"
              value={formData.id}
              readOnly
              className="w-full bg-gray-50 border border-[var(--line)] p-2 font-mono text-sm text-gray-500 rounded-lg"
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
