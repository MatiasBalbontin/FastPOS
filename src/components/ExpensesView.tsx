import React, { useState, useEffect } from 'react';
import { Banknote, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { cn, parseDbDate } from '../lib/utils';

interface ExpensesViewProps {
  onRefresh: () => void;
}

export function ExpensesView({ onRefresh }: ExpensesViewProps) {
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
              <div className="text-gray-500 font-mono text-xs">{parseDbDate(exp.created_at).toLocaleString()}</div>
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
