import React, { useState, useEffect } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  ArrowRight, 
  X, 
  Banknote, 
  CreditCard, 
  FileMinus, 
  AlertTriangle,
  Package
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { Product } from './Types';

interface SalesViewProps {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onSale: (items: { product_id: string; quantity: number }[], method: string, customer_id?: string) => Promise<boolean>;
  products: Product[];
  onProductNotFound: (query: string) => void;
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

interface PaymentModalProps {
  total: number;
  onClose: () => void;
  onConfirm: (method: string, customer_id?: string) => void;
}

function PaymentModal({ total, onClose, onConfirm }: PaymentModalProps) {
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
      body: JSON.stringify({ ...newCustomer, type: 'cliente' })
    });
    if (res.ok) {
      const data = await res.json();
      const newC = { ...newCustomer, id: data.id, type: 'cliente' };
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

export function SalesView({ searchInputRef, onSale, products, onProductNotFound }: SalesViewProps) {
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
            ref={searchInputRef as any}
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
