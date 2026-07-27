import React, { useState, useEffect } from 'react';
import { 
  Banknote, 
  CreditCard, 
  FileMinus, 
  Receipt, 
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
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
import { cn, parseDbDate } from '../lib/utils';
import { Analytics } from './Types';
import { toast } from 'sonner';

interface StatCardProps {
  label: string;
  value: string;
  trend?: boolean;
  highlight?: boolean;
}

function StatCard({ label, value, trend }: StatCardProps) {
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

interface AnalyticsViewProps {
  analytics: Analytics | null;
  startDate: string;
  setStartDate: (d: string) => void;
  endDate: string;
  setEndDate: (d: string) => void;
}

export function AnalyticsView({ analytics, startDate, setStartDate, endDate, setEndDate }: AnalyticsViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'shifts'>('overview');
  const [metric, setMetric] = useState<'monto' | 'cantidad'>('monto');
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);

  // Shifts state
  const [shifts, setShifts] = useState<any[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);

  const fetchShifts = async () => {
    setLoadingShifts(true);
    try {
      const res = await fetch('/api/cash-shifts');
      if (res.ok) {
        setShifts(await res.json());
      }
    } catch {
      toast.error("Error al cargar histórico de cajas");
    } finally {
      setLoadingShifts(false);
    }
  };

  useEffect(() => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
  }, [startDate, endDate]);

  useEffect(() => {
    if (activeTab === 'shifts') {
      fetchShifts();
    }
  }, [activeTab]);

  if (!analytics) return null;

  const COLORS = ['#005EB8', '#FFC785', '#10B981', '#F59E0B', '#6366F1'];

  // "Ventas Netas" drives the break-even chart below, same as before the redesign.
  const currentRevenue = analytics.summary.net_sales_revenue || 0;
  const grossRevenue = analytics.summary.gross_sales_revenue || 0;
  const ivaDebito = analytics.summary.iva_debito || 0;
  const netProfit = analytics.summary.net_profit || 0;
  const netMargin = analytics.summary.net_margin || 0;

  // Helper to format shift duration
  const getDurationText = (opening: string, closing: string | null) => {
    const end = closing ? parseDbDate(closing).getTime() : new Date().getTime();
    const start = parseDbDate(opening).getTime();
    const diffMs = end - start;
    const totalMinutes = Math.floor(diffMs / 60000);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)]">Reportes y Análisis</h2>
          <p className="text-sm text-gray-500 mt-1">Visualización de rendimiento y arqueos de caja.</p>
        </div>

        {/* Tab Selection buttons */}
        <div className="flex border border-[var(--line)] bg-white rounded-xl p-1 shadow-sm h-[46px] items-center">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
              activeTab === 'overview'
                ? 'bg-[var(--primary)] text-white shadow-md'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Rendimiento
          </button>
          <button
            onClick={() => setActiveTab('shifts')}
            className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'shifts'
                ? 'bg-[var(--primary)] text-white shadow-md'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Cierres de Caja
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-[var(--line)] shadow-sm">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-gray-400">Filtro de Gráficos</span>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as any)}
                className="bg-gray-50 border border-[var(--line)] text-xs font-bold p-2 mt-1 rounded-lg focus:outline-none"
              >
                <option value="monto">Visualizar Montos ($)</option>
                <option value="cantidad">Visualizar Cantidades (#)</option>
              </select>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex gap-4 items-center bg-gray-50 p-2.5 rounded-xl border border-[var(--line)]">
                <div className="flex flex-col">
                  <label className="text-[9px] font-bold uppercase text-gray-400 mb-0.5">Desde</label>
                  <input
                    type="date"
                    value={tempStartDate}
                    onChange={(e) => setTempStartDate(e.target.value)}
                    className="text-xs font-semibold focus:outline-none bg-transparent"
                  />
                </div>
                <div className="w-px h-6 bg-[var(--line)]" />
                <div className="flex flex-col">
                  <label className="text-[9px] font-bold uppercase text-gray-400 mb-0.5">Hasta</label>
                  <input
                    type="date"
                    value={tempEndDate}
                    onChange={(e) => setTempEndDate(e.target.value)}
                    className="text-xs font-semibold focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  setStartDate(tempStartDate);
                  setEndDate(tempEndDate);
                }}
                className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold uppercase tracking-wider text-xs px-6 py-3 rounded-xl transition-all shadow-md h-[46px] flex items-center"
              >
                Filtrar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-6">
            <StatCard label="Ventas Totales Brutas" value={`$${grossRevenue.toLocaleString()}`} />
            <StatCard label="IVA Débito" value={`$${ivaDebito.toLocaleString()}`} />
            <StatCard label="Ventas Netas" value={`$${currentRevenue.toLocaleString()}`} />
            <StatCard label="Utilidad Real (Neta)" value={`$${netProfit.toLocaleString()}`} trend />
          </div>

          <div className="grid grid-cols-3 gap-6">
            <StatCard
              label="Margen de Utilidad (Neto)"
              value={`${netMargin.toFixed(2)}%`}
              highlight={netMargin > 20}
            />
            <StatCard label="Valor Inventario (Precio Venta)" value={`$${analytics.summary.total_inventory_value_sale?.toLocaleString() || 0}`} />
            <StatCard label="Valor Inventario (Precio Costo)" value={`$${analytics.summary.total_inventory_value?.toLocaleString() || 0}`} />
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
                      formatter={(value: any) => [metric === 'monto' ? `$${value.toLocaleString()}` : value.toLocaleString(), metric === 'monto' ? 'Recaudación' : 'Cantidad']}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#111827', fontSize: '12px', fontWeight: '600' }}
                    />
                    <Bar dataKey={metric === 'monto' ? 'revenue' : 'volume'} fill="var(--primary)" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey={metric === 'monto' ? 'revenue' : 'volume'} position="top" formatter={(val: any) => metric === 'monto' ? `$${val.toLocaleString()}` : val.toLocaleString()} style={{ fill: 'var(--primary)', fontSize: 10, fontWeight: 'bold' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-8 border border-[var(--line)] bg-white rounded-2xl shadow-sm flex flex-col items-center justify-center relative">
              <h3 className="text-sm font-bold uppercase mb-8 text-gray-500 tracking-wider self-start">
                Avance de Recaudación (Meta de Equilibrio)
              </h3>
              
              <div className="w-full flex-1 flex items-center justify-center relative min-h-[220px]">
                {!analytics.summary.total_fixed_costs ? (
                  <div className="text-center text-sm text-gray-400 italic px-8">
                    Configura tus Costos Fijos para ver tu punto de equilibrio.
                  </div>
                ) : netMargin <= 0 ? (
                  <div className="text-center text-sm text-gray-400 italic px-8">
                    El margen de utilidad neto del período es cero o negativo, por lo que no existe una meta de ventas que cubra los costos fijos.
                  </div>
                ) : (() => {
                  // Meta de ventas (netas) para cubrir los costos fijos: Costos Fijos / Margen de Utilidad.
                  const breakEven = analytics.summary.total_fixed_costs / (netMargin / 100);
                  const data = [
                    { name: 'Recaudado', value: currentRevenue },
                    { name: 'Restante', value: Math.max(0, breakEven - currentRevenue) }
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
      )}

      {activeTab === 'shifts' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Turnos y Arqueos Registrados</h3>
            <button
              onClick={fetchShifts}
              className="px-4 py-2 border border-[var(--line)] bg-white rounded-xl text-xs font-bold hover:bg-gray-50 uppercase"
            >
              Actualizar
            </button>
          </div>

          {loadingShifts ? (
            <div className="bg-white border border-[var(--line)] rounded-2xl p-12 text-center text-gray-400 font-medium">
              Cargando historial de turnos...
            </div>
          ) : (
            <div className="bg-white border border-[var(--line)] rounded-2xl overflow-hidden shadow-sm">
              <div className="grid grid-cols-[1fr_2fr_1.2fr_1.5fr_1.5fr_1.2fr] bg-gray-50 p-4 border-b border-[var(--line)] text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <div>Operador</div>
                <div>Horario del Turno</div>
                <div>Fondo Inicial</div>
                <div>Efectivo (Exp. vs Dec.)</div>
                <div>Tarjeta (Exp. vs Dec.)</div>
                <div className="text-center">Estado Auditoría</div>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {shifts.map((s: any) => {
                  // Rounded to the nearest peso before comparing: these are sums of
                  // floating-point REAL columns, so raw subtraction can leave a
                  // fractional-cent residue that would falsely flag a balanced
                  // shift as "Descuadrado".
                  const cashDiff = s.status === 'closed' ? Math.round(s.closing_amount_cash - s.expected_amount_cash) : 0;
                  const cardDiff = s.status === 'closed' ? Math.round(s.closing_amount_card - s.expected_amount_card) : 0;
                  const isBalanced = cashDiff === 0 && cardDiff === 0;

                  return (
                    <div key={s.id} className="grid grid-cols-[1fr_2fr_1.2fr_1.5fr_1.5fr_1.2fr] p-4 text-sm items-center hover:bg-gray-50/40">
                      <div className="font-bold text-[var(--ink)] uppercase">
                        {s.operator_name}
                      </div>
                      
                      <div className="text-xs text-gray-500 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] bg-green-100 text-green-800 font-bold px-1.5 py-0.2 rounded uppercase">Inicio</span>
                          <span>{parseDbDate(s.opening_time).toLocaleString()}</span>
                        </div>
                        {s.closing_time ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] bg-red-100 text-red-800 font-bold px-1.5 py-0.2 rounded uppercase">Fin</span>
                            <span>{parseDbDate(s.closing_time).toLocaleString()} ({getDurationText(s.opening_time, s.closing_time)})</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-blue-600 font-bold animate-pulse">
                            <Clock size={12} />
                            <span>En Curso ({getDurationText(s.opening_time, null)})</span>
                          </div>
                        )}
                      </div>

                      <div className="font-mono font-bold text-gray-600">
                        ${s.opening_amount.toLocaleString()}
                      </div>

                      <div>
                        {s.status === 'closed' ? (
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500">Exp: <span className="font-mono font-bold">${s.expected_amount_cash.toLocaleString()}</span></div>
                            <div className="text-xs text-gray-800 font-semibold">Dec: <span className="font-mono font-bold">${s.closing_amount_cash.toLocaleString()}</span></div>
                            {cashDiff !== 0 && (
                              <div className={cn("text-[10px] font-bold font-mono", cashDiff > 0 ? "text-blue-600" : "text-red-600")}>
                                {cashDiff > 0 ? `Sobrante: +$${cashDiff.toLocaleString()}` : `Faltante: -$${Math.abs(cashDiff).toLocaleString()}`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Caja abierta</span>
                        )}
                      </div>

                      <div>
                        {s.status === 'closed' ? (
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500">Exp: <span className="font-mono font-bold">${s.expected_amount_card.toLocaleString()}</span></div>
                            <div className="text-xs text-gray-800 font-semibold">Dec: <span className="font-mono font-bold">${s.closing_amount_card.toLocaleString()}</span></div>
                            {cardDiff !== 0 && (
                              <div className={cn("text-[10px] font-bold font-mono", cardDiff > 0 ? "text-blue-600" : "text-red-600")}>
                                {cardDiff > 0 ? `Sobrante: +$${cardDiff.toLocaleString()}` : `Faltante: -$${Math.abs(cardDiff).toLocaleString()}`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Caja abierta</span>
                        )}
                      </div>

                      <div className="flex justify-center">
                        {s.status === 'open' ? (
                          <span className="bg-blue-50 border border-blue-200 text-blue-700 text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <Clock size={10} /> En Curso
                          </span>
                        ) : isBalanced ? (
                          <span className="bg-green-50 border border-green-200 text-green-700 text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 size={10} /> Cuadrado
                          </span>
                        ) : (
                          <span className="bg-red-50 border border-red-200 text-red-700 text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1" title="Incongruencia: Los montos no coinciden">
                            <AlertCircle size={10} /> Descuadrado
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {shifts.length === 0 && (
                  <div className="text-center p-12 text-gray-400 italic text-sm">No hay registros de caja anteriores.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
