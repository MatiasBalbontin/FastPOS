import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { parseDbDate } from '../lib/utils';

export function FixedCostsView() {
  const [fixedCosts, setFixedCosts] = useState<any[]>([]);
  const [formData, setFormData] = useState({ description: '', amount: '' });
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({ description: '', amount: '' });

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

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setEditFormData({ description: item.description, amount: String(item.amount) });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editFormData.description || !editFormData.amount) return;

    const res = await fetch(`/api/fixed-costs/${editingItem.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: editFormData.description,
        amount: parseFloat(editFormData.amount)
      })
    });

    if (res.ok) {
      toast.success("Costo fijo actualizado");
      setEditingItem(null);
      fetchFixedCosts();
    } else {
      const err = await res.json();
      toast.error(err.error || "Error al actualizar costo fijo");
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
              <div className="text-gray-500 font-mono text-xs">{parseDbDate(item.created_at).toLocaleDateString()}</div>
              <div className="font-bold uppercase">{item.description}</div>
              <div className="text-right font-mono font-bold text-[var(--ink)]">${item.amount.toLocaleString()}</div>
              <div className="flex justify-center gap-1">
                <button onClick={() => handleOpenEdit(item)} className="p-2 text-gray-400 hover:text-[var(--primary)] transition-colors" title="Editar">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors" title="Eliminar">
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

      {editingItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => setEditingItem(null)}>
          <div className="bg-white border border-[var(--line)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[var(--line)] bg-[var(--primary)] text-white flex justify-between items-center">
              <h3 className="font-bold uppercase tracking-widest text-sm">Editar Costo Fijo</h3>
              <button onClick={() => setEditingItem(null)} className="text-white hover:opacity-75 font-semibold">✕</button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-5">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Glosa / Descripción</label>
                <input
                  type="text"
                  required
                  value={editFormData.description}
                  onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Monto Mensual ($)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={editFormData.amount}
                  onChange={e => setEditFormData({ ...editFormData, amount: e.target.value })}
                  className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm font-bold focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="submit" className="flex-1 bg-[var(--primary)] text-white py-3 rounded-xl font-bold uppercase text-xs hover:bg-[var(--primary-dark)] transition-all">
                  Guardar Cambios
                </button>
                <button type="button" onClick={() => setEditingItem(null)} className="px-6 border border-[var(--line)] py-3 rounded-xl font-bold uppercase text-xs hover:bg-gray-50 transition-all">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
