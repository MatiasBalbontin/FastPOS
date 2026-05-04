import React, { useState, useEffect } from 'react';
import { Settings, Users, UserPlus, Trash2, Loader2, Building, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export const SettingsView = () => {
  const { tenantId, role } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Settings
  const [tenantName, setTenantName] = useState('Mi Empresa');
  const [isSavingTenant, setIsSavingTenant] = useState(false);

  // Invite form
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [roles, setRoles] = useState<any[]>([]);
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchTenant();
      fetchRoles();
      fetchUsersAndInvites();
    }
  }, [tenantId]);

  const fetchTenant = async () => {
    const { data } = await supabase.from('tenants').select('name').eq('id', tenantId).single();
    if (data) setTenantName(data.name);
  };

  const fetchRoles = async () => {
    const { data } = await supabase.from('roles').select('*');
    if (data) {
      setRoles(data);
      if (data.length > 0) setSelectedRole(data[0].id);
    }
  };

  const fetchUsersAndInvites = async () => {
    setLoading(true);
    // Fetch active users
    const { data: usersData } = await supabase
      .from('tenant_users')
      .select('id, user_id, roles(name, id)')
      .eq('tenant_id', tenantId);

    // Fetch auth emails if possible (requires RPC usually, but we display user_id or handle it).
    // In Supabase, the client can't fetch other users' emails from auth.users.
    // For MVP, we'll just display their user_id.
    setUsers(usersData || []);

    // Fetch pending invites
    const { data: invitesData } = await supabase
      .from('invites')
      .select('*, roles(name)')
      .eq('tenant_id', tenantId);
    
    setInvites(invitesData || []);
    setLoading(false);
  };

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'ADMIN') return;
    setIsSavingTenant(true);
    const { error } = await supabase.from('tenants').update({ name: tenantName }).eq('id', tenantId);
    if (error) toast.error('Error al actualizar nombre');
    else toast.success('Nombre actualizado');
    setIsSavingTenant(false);
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'ADMIN') return;
    setIsInviting(true);
    
    // Create invite
    const { error } = await supabase.from('invites').insert({
      tenant_id: tenantId,
      email: email.toLowerCase(),
      role_id: selectedRole
    });

    if (error) {
      toast.error('Error al invitar: ' + error.message);
    } else {
      toast.success('Invitación creada');
      setEmail('');
      fetchUsersAndInvites();
    }
    setIsInviting(false);
  };

  const handleRemoveUser = async (id: string) => {
    if (role !== 'ADMIN') return;
    if (!confirm('¿Quitar acceso a este usuario?')) return;
    
    const { error } = await supabase.from('tenant_users').delete().eq('id', id);
    if (error) toast.error('Error al remover usuario');
    else {
      toast.success('Usuario removido');
      fetchUsersAndInvites();
    }
  };

  const handleCancelInvite = async (id: string) => {
    if (role !== 'ADMIN') return;
    const { error } = await supabase.from('invites').delete().eq('id', id);
    if (error) toast.error('Error al cancelar invitación');
    else {
      toast.success('Invitación cancelada');
      fetchUsersAndInvites();
    }
  };

  if (role !== 'ADMIN') {
    return (
      <div className="flex-1 p-8 text-center text-gray-500">
        No tienes permisos para ver esta sección.
      </div>
    );
  }

  return (
    <div className="p-8 h-full flex flex-col overflow-y-auto">
      <div className="mb-6 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--primary)] flex items-center gap-2">
            <Settings />
            Ajustes de Empresa
          </h2>
          <p className="text-sm text-gray-500 mt-1">Configura tu comercio y administra tu equipo.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl">
        {/* General Settings */}
        <div className="md:col-span-1 space-y-6">
          <form onSubmit={handleUpdateTenant} className="bg-white p-6 border border-[var(--line)] rounded-2xl shadow-sm">
            <h3 className="font-bold mb-4 uppercase tracking-wider text-sm flex items-center gap-2 text-slate-700">
              <Building size={16} />
              Perfil de Empresa
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Nombre Comercial</label>
                <input 
                  type="text" 
                  value={tenantName}
                  onChange={e => setTenantName(e.target.value)}
                  className="w-full bg-gray-50 border border-[var(--line)] p-2 text-sm rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  required
                />
              </div>
              <button 
                disabled={isSavingTenant}
                className="w-full bg-[var(--primary)] text-white text-xs font-bold uppercase py-2.5 rounded-lg hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50"
              >
                {isSavingTenant ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>

          <form onSubmit={handleInviteUser} className="bg-white p-6 border border-[var(--line)] rounded-2xl shadow-sm">
            <h3 className="font-bold mb-4 uppercase tracking-wider text-sm flex items-center gap-2 text-slate-700">
              <UserPlus size={16} />
              Invitar Empleado
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Correo Electrónico</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-[var(--line)] p-2 text-sm rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  placeholder="empleado@gmail.com"
                  required
                />
              </div>
              
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Rol Asignado</label>
                <select 
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value)}
                  className="w-full bg-gray-50 border border-[var(--line)] p-2 text-sm rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 leading-relaxed">
                Al invitar, dile a tu empleado que entre a la web y <b>se registre</b> con ese mismo correo. El sistema lo unirá a tu empresa automáticamente.
              </div>

              <button 
                disabled={isInviting || !email}
                className="w-full bg-slate-800 text-white text-xs font-bold uppercase py-2.5 rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50"
              >
                {isInviting ? 'Invitando...' : 'Añadir a la lista'}
              </button>
            </div>
          </form>
        </div>

        {/* Users & Invites List */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-[var(--line)] rounded-2xl flex flex-col shadow-sm h-full max-h-[600px]">
            <div className="p-4 border-b border-[var(--line)] bg-slate-50 font-bold uppercase text-xs tracking-wider text-slate-500 flex gap-2 items-center">
              <Users size={16}/> Empleados y Accesos
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-500" /></div>
              ) : (
                <>
                  {/* PENDING INVITES */}
                  {invites.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b pb-1 mb-2">Invitaciones Pendientes</h4>
                      {invites.map(inv => (
                        <div key={inv.id} className="p-3 border border-amber-200 bg-amber-50/50 rounded-xl flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <Mail className="text-amber-400" size={16} />
                            <div>
                              <div className="font-bold text-sm text-slate-700">{inv.email}</div>
                              <div className="text-[10px] text-amber-600 uppercase font-bold tracking-wider mt-0.5">
                                ESPERANDO REGISTRO - ROL: {inv.roles?.name}
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleCancelInvite(inv.id)}
                            className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                            title="Cancelar Invitación"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ACTIVE USERS */}
                  <div className="space-y-2 pt-2">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b pb-1 mb-2">Usuarios Activos</h4>
                    {users.length === 0 ? (
                      <div className="text-center p-4 text-gray-400 text-sm">No hay usuarios registrados</div>
                    ) : (
                      users.map(u => (
                        <div key={u.id} className="p-3 border border-[var(--line)] rounded-xl flex justify-between items-center hover:border-blue-200 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                              {u.user_id.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-slate-700 font-mono text-[10px]">{u.user_id}</div>
                              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-0.5 px-2 py-0.5 bg-slate-100 rounded-full inline-block">
                                ROL: {Array.isArray(u.roles) ? u.roles[0]?.name : u.roles?.name}
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleRemoveUser(u.id)}
                            className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                            title="Quitar acceso"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
