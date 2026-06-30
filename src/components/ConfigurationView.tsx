import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';

export function ConfigurationView() {
  const [config, setConfig] = useState({
    company_name: '',
    company_rut: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_bank_details: '',
    company_logo: ''
  });
  const [loading, setLoading] = useState(true);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setConfig(prev => ({ ...prev, company_logo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/company-settings');
      if (res.ok) {
        const data = await res.json();
        setConfig(prev => ({ ...prev, ...data }));
      }
    } catch (error) {
      toast.error("Error al cargar la configuración");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/company-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        toast.success("Configuración guardada correctamente");
      } else {
        toast.error("Error al guardar la configuración");
      }
    } catch (error) {
      toast.error("Error de conexión");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 font-medium">Cargando configuración...</div>;
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)]">Configuración General</h2>
        <p className="text-sm text-gray-500 mt-1">Gestione la información de su empresa para la emisión de cotizaciones.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border border-[var(--line)] shadow-sm space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2">
            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Razón Social / Nombre Emisor</label>
            <input
              type="text"
              required
              value={config.company_name}
              onChange={e => setConfig({ ...config, company_name: e.target.value })}
              className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-semibold"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">RUT Emisor</label>
            <input
              type="text"
              required
              value={config.company_rut}
              onChange={e => setConfig({ ...config, company_rut: e.target.value })}
              className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-semibold"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Dirección</label>
            <input
              type="text"
              required
              value={config.company_address}
              onChange={e => setConfig({ ...config, company_address: e.target.value })}
              className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-semibold"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Teléfono</label>
            <input
              type="text"
              value={config.company_phone}
              onChange={e => setConfig({ ...config, company_phone: e.target.value })}
              className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-semibold"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Email de Contacto</label>
            <input
              type="email"
              value={config.company_email}
              onChange={e => setConfig({ ...config, company_email: e.target.value })}
              className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-semibold"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Datos Bancarios para Transferencia (Pie de Página)</label>
            <textarea
              required
              rows={3}
              value={config.company_bank_details}
              onChange={e => setConfig({ ...config, company_bank_details: e.target.value })}
              className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-medium"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Logo de la Empresa (Imagen para Cotización)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="w-full bg-gray-50 border border-[var(--line)] p-2 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 cursor-pointer"
            />
            {config.company_logo && (
              <div className="mt-3 flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-[var(--line)]">
                <img src={config.company_logo} alt="Vista previa del logo" className="h-16 w-auto border rounded bg-white p-1 object-contain" />
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, company_logo: '' })}
                  className="text-xs text-red-600 hover:text-red-800 font-bold uppercase"
                >
                  Eliminar Logo
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold uppercase tracking-wider text-xs px-8 py-3 rounded-xl transition-all shadow-md shadow-blue-100 flex items-center gap-2">
            <Check size={16} /> Guardar Configuración
          </button>
        </div>
      </form>
    </div>
  );
}
