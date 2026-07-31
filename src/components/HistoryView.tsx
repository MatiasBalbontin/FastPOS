import React, { useState, useEffect } from 'react';
import { Banknote, CreditCard, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn, parseDbDate } from '../lib/utils';
import * as XLSX from 'xlsx';

interface HistoryViewProps {
  onRefresh: () => void;
}

export function HistoryView({ onRefresh }: HistoryViewProps) {
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

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/history/export?startDate=${startDate}T00:00:00&endDate=${endDate}T23:59:59`);
      if (!res.ok) throw new Error();
      const { sales, payments, expenses } = await res.json();

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sales), "Ventas");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(payments), "Abonos");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(expenses), "Gastos");
      XLSX.writeFile(workbook, `fastpos_historial_${startDate}_a_${endDate}.xlsx`);

      toast.success(`Exportación generada para el rango ${startDate} a ${endDate}. Incluye anulados con su estado para que puedas filtrar y cuadrar tú mismo en Excel.`);
    } catch {
      toast.error("Error al exportar el historial");
    } finally {
      setExporting(false);
    }
  };

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
          <button
            onClick={handleExport}
            disabled={exporting}
            title="Exporta ventas, abonos y gastos del rango de fechas filtrado (incluyendo anulados) a un archivo Excel para cuadrar manualmente"
            className="bg-white border border-[var(--line)] hover:bg-gray-50 text-[var(--ink)] font-bold uppercase tracking-wider text-xs px-5 py-3 rounded-xl transition-all shadow-sm h-[42px] flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={14} />
            {exporting ? 'Generando...' : 'Exportar a Excel'}
          </button>
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
                  {parseDbDate(item.created_at).toLocaleString()}
                  {item.method === 'cash' ? <Banknote size={14} className="text-green-600"/> : item.method === 'card' ? <CreditCard size={14} className="text-blue-600"/> : <FileText size={14} className="text-amber-600"/>}
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {item.type === 'sale' ? (item.method === 'cuenta_por_cobrar' ? 'Venta Fiada' : 'Venta') : item.type === 'payment' ? 'Abono Recibido' : 'Gasto Registrado'}
                  </span>
                  {item.customer_name && <span className="text-[10px] text-gray-500">CLIENTE: {item.customer_name}</span>}
                  {item.sales_dates && (
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-black tracking-wide">
                      Ventas: {item.sales_dates}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className={cn("text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded inline-block", item.status === 'completed' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                  {item.status === 'completed' ? 'COMPLETADA' : 'ANULADA'}
                </div>
                <div className={cn("text-2xl font-bold mt-1", item.type === 'payment' ? "text-green-600" : item.type === 'expense' ? "text-red-600" : "text-[var(--ink)]")}>
                  {item.type === 'payment' ? '+' : item.type === 'expense' ? '-' : ''}${item.total_amount?.toLocaleString() || 0}
                </div>
                {item.type === 'sale' && item.total_amount > 0 && (() => {
                  const netAmount = item.total_amount / 1.19;
                  const netCost = (item.total_cost || 0) / 1.19;
                  const netMargin = netAmount > 0 ? ((netAmount - netCost) / netAmount) * 100 : 0;
                  return (
                    <div className="text-[10px] font-bold uppercase text-gray-400 mt-1">
                      Margen: <span className={netMargin >= 0 ? "text-green-600" : "text-red-600"}>{Math.round(netMargin)}%</span>
                    </div>
                  );
                })()}
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
