import React, { useState, useEffect } from 'react';
import { CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { cn, parseDbDate } from '../lib/utils';

interface ReceivablesViewProps {
  onRefresh: () => void;
}

export function ReceivablesView({ onRefresh }: ReceivablesViewProps) {
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
                       <div className="text-xs text-gray-500 font-mono">{parseDbDate(item.date).toLocaleString()}</div>
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
