import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

// --- Search Normalization Utilities ---
const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
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

export function EntitiesView() {
  const [entities, setEntities] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'cliente' | 'proveedor' | 'all'>('cliente');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<any | null>(null);
  
  const [formData, setFormData] = useState({
    type: 'cliente',
    first_name: '',
    last_name: '',
    rut: '',
    address: '',
    contact: '',
    phone: '',
    email: ''
  });

  const fetchEntities = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        setEntities(await res.json());
      }
    } catch (e) {
      toast.error("Error al cargar entidades");
    }
  };

  useEffect(() => {
    fetchEntities();
  }, []);

  const openCreate = () => {
    setEditingEntity(null);
    setFormData({
      type: activeTab === 'all' ? 'cliente' : activeTab,
      first_name: '',
      last_name: '',
      rut: '',
      address: '',
      contact: '',
      phone: '',
      email: ''
    });
    setIsFormOpen(true);
  };

  const openEdit = (entity: any) => {
    setEditingEntity(entity);
    setFormData({
      type: entity.type || 'cliente',
      first_name: entity.first_name || '',
      last_name: entity.last_name || '',
      rut: entity.rut || '',
      address: entity.address || '',
      contact: entity.contact || '',
      phone: entity.phone || '',
      email: entity.email || ''
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Estás seguro de eliminar esta entidad?")) return;
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Entidad eliminada correctamente");
        fetchEntities();
      } else {
        const err = await res.json();
        toast.error(err.error || "Error al eliminar la entidad");
      }
    } catch (e) {
      toast.error("Error de conexión");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name || !formData.rut || !formData.address) {
      toast.error("Nombre, RUT y Dirección son obligatorios");
      return;
    }

    const payload = {
      ...formData,
      first_name: formData.first_name.trim().toUpperCase(),
      last_name: '', // We save a single Name, setting last_name to empty
      rut: formData.rut.trim(),
      address: formData.address.trim().toUpperCase(),
      contact: formData.contact.trim().toUpperCase(),
      phone: formData.phone.trim(),
      email: formData.email.trim()
    };

    const url = editingEntity ? `/api/customers/${editingEntity.id}` : '/api/customers';
    const method = editingEntity ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success(editingEntity ? "Entidad actualizada" : "Entidad creada con éxito");
        setIsFormOpen(false);
        fetchEntities();
      } else {
        const err = await res.json();
        toast.error(err.error || "Error al guardar entidad");
      }
    } catch (e) {
      toast.error("Error de servidor");
    }
  };

  const filteredEntities = entities.filter(ent => {
    // Type filter
    const entType = ent.type || 'cliente';
    if (activeTab === 'cliente' && entType !== 'cliente' && entType !== 'ambos') return false;
    if (activeTab === 'proveedor' && entType !== 'proveedor' && entType !== 'ambos') return false;
    
    // Search filter
    if (!searchTerm.trim()) return true;
    return matchCustomer(ent, searchTerm);
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 flex flex-col h-full overflow-y-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)]">Entidades</h2>
          <p className="text-sm text-gray-500 mt-1">Administra tus clientes y proveedores desde un solo lugar.</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-[var(--primary)] text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md shadow-blue-100"
        >
          <Plus size={16} /> Crear Entidad
        </button>
      </div>

      <div className="flex flex-wrap gap-4 justify-between items-center bg-gray-50 p-4 rounded-2xl border border-[var(--line)]">
        {/* Tabs */}
        <div className="flex bg-white p-1 rounded-xl border border-[var(--line)] shadow-sm">
          <button
            onClick={() => setActiveTab('cliente')}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-lg transition-all",
              activeTab === 'cliente' ? "bg-[var(--primary)] text-white shadow-sm" : "text-gray-500 hover:text-[var(--ink)]"
            )}
          >
            Clientes
          </button>
          <button
            onClick={() => setActiveTab('proveedor')}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-lg transition-all",
              activeTab === 'proveedor' ? "bg-purple-600 text-white shadow-sm" : "text-gray-500 hover:text-[var(--ink)]"
            )}
          >
            Proveedores
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-lg transition-all",
              activeTab === 'all' ? "bg-[var(--ink)] text-white shadow-sm" : "text-gray-500 hover:text-[var(--ink)]"
            )}
          >
            Todos
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, RUT, contacto..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-[var(--line)] py-2.5 pl-10 pr-4 text-xs rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
          />
        </div>
      </div>

      {/* Grid List */}
      <div className="bg-white border border-[var(--line)] rounded-2xl shadow-sm overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-[var(--line)] text-[10px] font-black uppercase text-gray-400">
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Nombre / Razón Social</th>
                <th className="px-6 py-4">RUT</th>
                <th className="px-6 py-4">Contacto</th>
                <th className="px-6 py-4">Teléfono / Email</th>
                <th className="px-6 py-4">Dirección</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredEntities.map(ent => (
                <tr key={ent.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 space-x-1">
                    {(ent.type === 'cliente' || ent.type === 'ambos') && (
                      <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-green-100 text-green-800">
                        Cliente
                      </span>
                    )}
                    {(ent.type === 'proveedor' || ent.type === 'ambos') && (
                      <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800">
                        Proveedor
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-bold text-[var(--ink)]">
                    {ent.first_name} {ent.last_name}
                  </td>
                  <td className="px-6 py-4 font-mono font-semibold text-gray-600">
                    {ent.rut || '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {ent.contact || '-'}
                  </td>
                  <td className="px-6 py-4 space-y-0.5">
                    <div className="font-semibold text-gray-700">{ent.phone || '-'}</div>
                    <div className="text-[10px] text-gray-400">{ent.email || '-'}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 max-w-[200px] truncate" title={ent.address}>
                    {ent.address || '-'}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => openEdit(ent)}
                      className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(ent.id)}
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredEntities.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">
                    No se encontraron entidades registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editor Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in">
          <div className="bg-white border border-[var(--line)] w-full max-w-lg shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[var(--line)] flex justify-between items-center bg-[var(--ink)] text-white">
              <h3 className="font-bold uppercase italic tracking-widest text-sm">
                {editingEntity ? 'Editar Entidad' : 'Nueva Entidad'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-left">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1.5">Tipo de Entidad *</label>
                <div className="flex gap-6 py-2 px-3 bg-gray-50 border border-[var(--line)] rounded-xl">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase cursor-pointer select-none text-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.type === 'cliente' || formData.type === 'ambos'}
                      onChange={e => {
                        const isProvider = formData.type === 'proveedor' || formData.type === 'ambos';
                        const isChecked = e.target.checked;
                        if (isChecked) {
                          setFormData({ ...formData, type: isProvider ? 'ambos' : 'cliente' });
                        } else {
                          if (isProvider) {
                            setFormData({ ...formData, type: 'proveedor' });
                          }
                        }
                      }}
                      className="w-4 h-4 rounded text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    Cliente
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold uppercase cursor-pointer select-none text-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.type === 'proveedor' || formData.type === 'ambos'}
                      onChange={e => {
                        const isCustomer = formData.type === 'cliente' || formData.type === 'ambos';
                        const isChecked = e.target.checked;
                        if (isChecked) {
                          setFormData({ ...formData, type: isCustomer ? 'ambos' : 'proveedor' });
                        } else {
                          if (isCustomer) {
                            setFormData({ ...formData, type: 'cliente' });
                          }
                        }
                      }}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                    />
                    Proveedor
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1.5">
                  Razón Social / Nombre {formData.type === 'ambos' ? 'Cliente/Proveedor' : (formData.type === 'cliente' ? 'Cliente' : 'Proveedor')} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Ej. Juan Pérez o Distribuidora S.A."
                  className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20 uppercase font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1.5">
                    RUT {formData.type === 'cliente' ? 'Cliente' : 'Proveedor'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.rut}
                    onChange={e => setFormData({ ...formData, rut: e.target.value })}
                    placeholder="Ej. 76.794.328-8"
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1.5">Persona de Contacto</label>
                  <input
                    type="text"
                    value={formData.contact}
                    onChange={e => setFormData({ ...formData, contact: e.target.value })}
                    placeholder="Ej. Administrador"
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1.5">
                  Dirección *
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Ej. Calle Prat 123, Santiago"
                  className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20 uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1.5">
                    Teléfono {formData.type === 'cliente' ? 'Cliente' : 'Proveedor'}
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Ej. +56912345678"
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1.5">
                    Email {formData.type === 'cliente' ? 'Cliente' : 'Proveedor'}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Ej. contacto@empresa.cl"
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 border border-[var(--line)] py-3 font-bold uppercase text-xs hover:bg-gray-50 transition-colors text-center rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[var(--primary)] text-white py-3 font-bold uppercase text-xs hover:opacity-90 transition-opacity text-center rounded-xl"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
