import React, { useState, useEffect } from 'react';
import { Settings, Users, UserPlus, Trash2, Loader2, Building, Shield, Check, X, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export const SettingsView = () => {
  const { idEmpresa, role } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Settings
  const [tenantName, setTenantName] = useState('');
  const [pinSeguridad, setPinSeguridad] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Invite form
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [roles, setRoles] = useState<any[]>([]);
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    if (idEmpresa) {
      fetchSettings();
      fetchRoles();
      fetchUsersAndInvites();
    }
  }, [idEmpresa]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('empresas').select('name, pin_seguridad').eq('id', idEmpresa).single();
    if (data) {
      setTenantName(data.name);
      setPinSeguridad(data.pin_seguridad || '6767');
    }
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
    const { data: usersData } = await supabase
      .from('usuarios_empresa')
      .select('id, id_usuario, roles(name, id)')
      .eq('id_empresa', idEmpresa);

    setUsers(usersData || []);

    const { data: invitesData } = await supabase
      .from('invites')
      .select('*, roles(name)')
      .eq('id_empresa', idEmpresa);
    
    setInvites(invitesData || []);
    setLoading(false);
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role?.toUpperCase() !== 'ADMIN') return;
    setIsSavingSettings(true);
    const { error } = await supabase.from('empresas').update({ 
      name: tenantName,
      pin_seguridad: pinSeguridad
    }).eq('id', idEmpresa);

    if (error) toast.error('Error al actualizar configuración');
    else toast.success('Configuración guardada correctamente');
    setIsSavingSettings(false);
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role?.toUpperCase() !== 'ADMIN') return;
    setIsInviting(true);
    
    const { error } = await supabase.from('invites').insert({
      id_empresa: idEmpresa,
      email: email.toLowerCase(),
      role_id: selectedRole
    });

    if (error) {
      toast.error('Error al invitar: ' + error.message);
    } else {
      toast.success('Invitación enviada');
      setEmail('');
      fetchUsersAndInvites();
    }
    setIsInviting(false);
  };

  const handleRemoveUser = async (id: string) => {
    if (role?.toUpperCase() !== 'ADMIN') return;
    if (!confirm('¿Quitar acceso a este usuario?')) return;
    
    const { error } = await supabase.from('usuarios_empresa').delete().eq('id', id);
    if (error) toast.error('Error al remover usuario');
    else {
      toast.success('Usuario removido');
      fetchUsersAndInvites();
    }
  };

  if (role?.toUpperCase() !== 'ADMIN') {
    return (
      <div className="flex-1 p-8 text-center text-gray-500">
        No tienes permisos administrativos para ver esta sección.
      </div>
    );
  }

  return (
    <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
          <Settings className="text-blue-600" size={32} />
          Panel de Configuración
        </h2>
        <p className="text-slate-500 mt-1 text-sm uppercase tracking-widest font-medium">Gestión de Empresa, Usuarios y Seguridad</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl">
        
        {/* COLUMNA IZQUIERDA: PERFIL Y SEGURIDAD */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <Building size={14} /> Información de Empresa
            </h3>
            <form onSubmit={handleUpdateSettings} className="space-y-6">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-2">Nombre del Comercio</label>
                <input 
                  type="text" 
                  value={tenantName}
                  onChange={e => setTenantName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm focus:ring-2 ring-blue-500/20 outline-none font-bold"
                  placeholder="Ej. Mi Tienda FastPOS"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-2 flex items-center gap-1">
                  <Shield size={10} className="text-amber-500" /> PIN de Seguridad Maestro
                </label>
                <input 
                  type="text" 
                  maxLength={4}
                  value={pinSeguridad}
                  onChange={e => setPinSeguridad(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-amber-50 border border-amber-200 p-3 rounded-xl text-xl font-mono text-center tracking-[1em] focus:ring-2 ring-amber-500/20 outline-none text-amber-900 font-bold"
                  placeholder="6767"
                />
                <p className="text-[9px] text-slate-400 mt-2 italic">Este PIN se usará para autorizar eliminaciones y ediciones críticas.</p>
              </div>

              <button 
                disabled={isSavingSettings}
                className="w-full bg-blue-600 text-white text-xs font-bold uppercase py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
              >
                {isSavingSettings ? 'Procesando...' : 'Guardar Cambios'}
              </button>
            </form>
          </section>

          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <UserPlus size={14} /> Añadir Usuario
            </h3>
            <form onSubmit={handleInviteUser} className="space-y-4">
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none"
                placeholder="correo@ejemplo.com"
                required
              />
              <select 
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none font-bold"
              >
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name.toUpperCase()}</option>
                ))}
              </select>
              <button 
                disabled={isInviting}
                className="w-full bg-slate-900 text-white text-xs font-bold uppercase py-3 rounded-xl hover:bg-slate-800 transition-all"
              >
                Enviar Invitación
              </button>
            </form>
          </section>
        </div>

        {/* COLUMNA DERECHA: TABLA DE USUARIOS Y PERMISOS */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Users size={16} /> Gestión de Personal y Permisos
              </h3>
            </div>

            <div className="flex-1 overflow-x-auto p-6">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100">
                    <th className="text-left pb-4 font-bold">Usuario / Email</th>
                    <th className="text-center pb-4">Rol</th>
                    <th className="text-center pb-4">Inventario</th>
                    <th className="text-center pb-4">Ventas</th>
                    <th className="text-center pb-4">Ajustes</th>
                    <th className="text-right pb-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-blue-500" /></td></tr>
                  ) : (
                    <>
                      {/* USUARIOS ACTIVOS */}
                      {users.map(u => {
                        const roleName = (Array.isArray(u.roles) ? u.roles[0]?.name : u.roles?.name)?.toUpperCase();
                        const isAdmin = roleName === 'ADMIN';
                        return (
                          <tr key={u.id} className="group hover:bg-blue-50/30 transition-colors">
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                  {u.id_usuario.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-sm text-slate-700 font-mono text-[10px] truncate max-w-[150px]">{u.id_usuario}</div>
                                  <div className="text-[9px] text-green-600 font-bold uppercase flex items-center gap-1">
                                    <div className="w-1 h-1 bg-green-500 rounded-full"></div> Activo
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 text-center">
                              <span className={`text-[9px] font-bold px-2 py-1 rounded-lg ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                                {roleName}
                              </span>
                            </td>
                            <td className="py-4 text-center">
                              <Check size={16} className={isAdmin ? "mx-auto text-green-500" : "mx-auto text-slate-300"} />
                            </td>
                            <td className="py-4 text-center">
                              <Check size={16} className="mx-auto text-green-500" />
                            </td>
                            <td className="py-4 text-center">
                              {isAdmin ? <Check size={16} className="mx-auto text-green-500" /> : <X size={14} className="mx-auto text-slate-300" />}
                            </td>
                            <td className="py-4 text-right">
                              {!isAdmin && (
                                <button 
                                  onClick={() => handleRemoveUser(u.id)}
                                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {/* INVITACIONES PENDIENTES */}
                      {invites.map(inv => (
                        <tr key={inv.id} className="bg-amber-50/20 italic">
                          <td className="py-4">
                            <div className="flex items-center gap-3 opacity-60">
                              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center"><Mail size={14}/></div>
                              <div>
                                <div className="text-sm font-bold text-slate-600">{inv.email}</div>
                                <div className="text-[9px] text-amber-600 font-bold uppercase">Pendiente de registro</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 text-center opacity-60">
                            <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-amber-100 text-amber-700 uppercase">
                              {inv.roles?.name}
                            </span>
                          </td>
                          <td colSpan={3} className="text-center text-[10px] text-amber-600 font-bold opacity-40">SIN ACCESO AÚN</td>
                          <td className="py-4 text-right">
                            <button className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
