import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export const UsersView = () => {
  const { tenantId, role } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New user form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [roles, setRoles] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchRoles();
    fetchUsers();
  }, [tenantId]);

  const fetchRoles = async () => {
    const { data } = await supabase.from('roles').select('*');
    if (data) {
      setRoles(data);
      if (data.length > 0) setSelectedRole(data[0].id);
    }
  };

  const fetchUsers = async () => {
    if (!tenantId) return;
    setLoading(true);
    // Fetch users mapped to this tenant
    const { data, error } = await supabase
      .from('tenant_users')
      .select('id, user_id, roles(name, id)')
      .eq('tenant_id', tenantId);

    if (error) {
      toast.error('Error cargando usuarios');
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'ADMIN') {
      toast.error('Solo los administradores pueden crear usuarios');
      return;
    }
    
    setIsCreating(true);
    try {
      // 1. Create user in Supabase Auth
      // Note: In a real production environment, you might use Supabase Admin API 
      // or inviteUserByEmail so the user can set their own password.
      // For this MVP, we create them directly using signUp.
      // Important: signUp will log the current user OUT if we don't handle it server-side, 
      // but if Supabase is set to not auto-confirm, it might be fine.
      // A better approach for multi-tenant is an RPC function. 
      // We will assume the RPC or Edge Function is better, but since we can't create one easily:
      toast.info("Para invitar usuarios debes usar la consola de Supabase Auth por ahora, o crear un Edge Function.");
      
    } catch (e: any) {
      toast.error('Error al crear usuario: ' + e.message);
    }
    setIsCreating(false);
  };

  const handleRemoveUser = async (id: string) => {
    if (role !== 'ADMIN') return;
    if (!confirm('¿Quitar acceso a este usuario?')) return;
    
    const { error } = await supabase.from('tenant_users').delete().eq('id', id);
    if (error) toast.error('Error al remover usuario');
    else {
      toast.success('Usuario removido');
      fetchUsers();
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
    <div className="p-8 h-full flex flex-col">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--primary)] flex items-center gap-2">
            <Users />
            Gestión de Usuarios
          </h2>
          <p className="text-sm text-gray-500 mt-1">Administra los accesos y roles de tu personal.</p>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Users List */}
        <div className="flex-1 bg-white border border-[var(--line)] rounded-2xl flex flex-col shadow-sm">
          <div className="p-4 border-b border-[var(--line)] bg-slate-50 font-bold uppercase text-xs tracking-wider text-slate-500">
            Usuarios Activos
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-500" /></div>
            ) : users.length === 0 ? (
              <div className="text-center p-8 text-gray-400">No hay usuarios registrados</div>
            ) : (
              users.map(u => (
                <div key={u.id} className="p-4 border border-[var(--line)] rounded-xl flex justify-between items-center hover:border-blue-200 transition-colors">
                  <div>
                    <div className="font-bold">{u.user_id}</div>
                    <div className="text-xs text-gray-500 mt-1 uppercase font-bold tracking-wider px-2 py-1 bg-slate-100 rounded-full inline-block">
                      {Array.isArray(u.roles) ? u.roles[0]?.name : u.roles?.name}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRemoveUser(u.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Quitar acceso"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Invite Form */}
        <div className="w-80 shrink-0">
          <form onSubmit={handleCreateUser} className="bg-white p-6 border border-[var(--line)] rounded-2xl shadow-sm">
            <h3 className="font-bold mb-4 uppercase tracking-wider text-sm flex items-center gap-2">
              <UserPlus size={16} />
              Agregar Acceso
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Email o ID de Usuario</label>
                <input 
                  type="text" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-[var(--line)] p-2 text-sm rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  placeholder="usuario@ejemplo.com"
                  disabled
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

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800">
                <b>Nota:</b> En esta versión SaaS de demostración, la invitación de usuarios debe realizarse directamente desde la consola de Supabase Auth para mantener la seguridad. Una vez registrado, podrás enlazarlo a tu comercio (tenant) aquí.
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
