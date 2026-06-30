import React, { useState } from 'react';
import { 
  Download, 
  Upload, 
  Plus, 
  EyeOff, 
  Eye, 
  Search, 
  AlertTriangle, 
  Edit2, 
  Trash2, 
  Check, 
  X 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Product } from './Types';
import { ImportModal } from './ImportModal';

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

interface EditProductModalProps {
  product: Product;
  onClose: () => void;
  onSuccess: () => void;
}

function EditProductModal({ product, onClose, onSuccess }: EditProductModalProps) {
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

interface InventoryViewProps {
  products: Product[];
  onRefresh: () => void;
  onAddProduct: () => void;
  lowStockThreshold: number;
  setLowStockThreshold: (threshold: number) => void;
  showArchived: boolean;
  setShowArchived: (show: boolean) => void;
}

export function InventoryView({ 
  products, 
  onRefresh, 
  onAddProduct, 
  lowStockThreshold, 
  setLowStockThreshold, 
  showArchived, 
  setShowArchived 
}: InventoryViewProps) {
  const [search, setSearch] = useState('');
  const [showCosts, setShowCosts] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const filtered = products.filter((p: any) => {
    if (!search.trim()) return true;
    return matchProduct(p, search);
  });

  const exactMatch = products.find((p: any) => p.id === search);

  const handleEditClick = (product: Product) => {
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
