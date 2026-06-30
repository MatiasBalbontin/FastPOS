import React, { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface ExpressModalProps {
  initialId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ExpressModal({ initialId, onClose, onSuccess }: ExpressModalProps) {
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
