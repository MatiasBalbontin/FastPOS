import React, { useState, useEffect } from 'react';
import { 
  Banknote, 
  CreditCard, 
  FileMinus, 
  Receipt, 
  TrendingUp 
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
import { cn } from '../lib/utils';
import { Analytics } from './Types';

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
  const [metric, setMetric] = useState<'monto' | 'cantidad'>('monto');
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);

  useEffect(() => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
  }, [startDate, endDate]);

  if (!analytics) return null;

  const COLORS = ['#005EB8', '#FFC785', '#10B981', '#F59E0B', '#6366F1'];

  const currentRevenue = analytics.summary.collected_revenue || 0;
  const currentCost = analytics.summary.collected_cost || 0;
  const currentProfit = currentRevenue - currentCost;
  const margin = currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0;

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)]">Reportes y Análisis</h2>
          <p className="text-sm text-gray-500 mt-1">Visualización de rendimiento y rentabilidad.</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold uppercase text-[var(--primary)] mb-1">Visualizar Gráficos por</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as any)}
              className="bg-white border border-[var(--primary)] text-[var(--primary)] font-bold text-xs p-2 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all hover:bg-blue-50"
            >
              <option value="monto">Monto ($)</option>
              <option value="cantidad">Cantidad Unit. (#)</option>
            </select>
          </div>
          
          <div className="flex gap-4 items-center bg-white p-3 rounded-xl border border-[var(--line)] shadow-sm">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold uppercase text-gray-400 mb-1">Desde</label>
              <input
                type="date"
                value={tempStartDate}
                onChange={(e) => setTempStartDate(e.target.value)}
                className="text-xs font-semibold focus:outline-none"
              />
            </div>
            <div className="w-px h-8 bg-[var(--line)]" />
            <div className="flex flex-col">
              <label className="text-[10px] font-bold uppercase text-gray-400 mb-1">Hasta</label>
              <input
                type="date"
                value={tempEndDate}
                onChange={(e) => setTempEndDate(e.target.value)}
                className="text-xs font-semibold focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={() => {
              setStartDate(tempStartDate);
              setEndDate(tempEndDate);
            }}
            className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold uppercase tracking-wider text-xs px-6 py-3 rounded-xl transition-all shadow-md shadow-blue-100 h-[46px] flex items-center"
          >
            Filtrar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        <StatCard label="Ingresos Cobrados" value={`$${currentRevenue.toLocaleString()}`} />
        <StatCard label="Costo (Efectivo/Tj)" value={`$${currentCost.toLocaleString()}`} />
        <StatCard label="Utilidad Real (FIFO)" value={`$${currentProfit.toLocaleString()}`} trend />
        <StatCard 
          label="Margen de Utilidad" 
          value={`${margin.toFixed(2)}%`} 
          highlight={margin > 20}
        />
        <StatCard label="Valor Inventario" value={`$${analytics.summary.total_inventory_value?.toLocaleString() || 0}`} />
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

        <div className="p-8 border border-[var(--line)] bg-white rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold uppercase mb-8 text-gray-500 tracking-wider">
            Dominio por Categoría {metric === 'monto' ? '(Recaudación)' : '(Volumen)'}
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.categoryAnalysis}
                  dataKey={metric === 'monto' ? 'revenue' : 'volume'}
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  label={({ type, value }: any) => metric === 'monto' ? `${type}: $${value.toLocaleString()}` : `${type}: ${value.toLocaleString()}`}
                >
                  {analytics.categoryAnalysis.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [metric === 'monto' ? `$${value.toLocaleString()}` : value.toLocaleString(), metric === 'monto' ? 'Recaudación' : 'Cantidad']}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="p-8 border border-[var(--line)] bg-white rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold uppercase mb-8 text-gray-500 tracking-wider">
            Inventario por Familia {metric === 'monto' ? '(Valor Monetario)' : '(Existencias)'}
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.inventoryByFamily} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" fontSize={10} tick={{ fill: '#6B7280' }} axisLine={false} tickLine={false} tickFormatter={(val) => metric === 'monto' ? `$${val.toLocaleString()}` : val.toLocaleString()} />
                <YAxis dataKey="type" type="category" fontSize={10} tick={{ fill: '#6B7280' }} axisLine={false} tickLine={false} width={100} />
                <Tooltip
                  formatter={(value: any) => [metric === 'monto' ? `$${value.toLocaleString()}` : value.toLocaleString(), metric === 'monto' ? 'Valor Inventario' : 'Cantidad']}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#111827', fontSize: '12px', fontWeight: '600' }}
                />
                <Bar dataKey={metric === 'monto' ? 'total_value' : 'total_stock'} fill="#FFC785" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey={metric === 'monto' ? 'total_value' : 'total_stock'} position="right" formatter={(val: any) => metric === 'monto' ? `$${val.toLocaleString()}` : val.toLocaleString()} style={{ fill: '#111827', fontSize: 10, fontWeight: 'bold' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-8 border border-[var(--line)] bg-white rounded-2xl shadow-sm">
           <h3 className="text-sm font-bold uppercase mb-2 text-gray-500 tracking-wider text-center">
            Punto de Equilibrio (Break-even)
          </h3>
          <p className="text-[10px] text-gray-400 text-center mb-8 italic uppercase">Meta para cubrir costos fijos (${(analytics.summary.total_fixed_costs || 1).toLocaleString()})</p>
          <div className="h-72 relative flex flex-col items-center justify-center">
            {(() => {
              const fixedCosts = analytics.summary.total_fixed_costs || 1;
              const marginDec = (margin / 100);
              const breakEven = marginDec > 0 ? fixedCosts / marginDec : 0;
              const maxVal = breakEven * 2 || currentRevenue * 2 || 100;
              
              const data = [
                { name: 'Progress', value: Math.min(currentRevenue, maxVal) },
                { name: 'Remaining', value: Math.max(0, maxVal - currentRevenue) }
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
                  
                  {/* Gauge Overlay Labels */}
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

                  {/* Marker for meta */}
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
  );
}
