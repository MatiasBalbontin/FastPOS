import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

interface AuthContextType {
  session: any | null;
  user: any | null;
  tenantId: string | null;
  role: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  tenantId: null,
  role: null,
  loading: true,
  signOut: async () => { }
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Definimos handleSession antes del useEffect para evitar ReferenceErrors
  const handleSession = async (currentSession: any) => {
    // Actualizamos los estados básicos de auth para que la App sepa quién es el usuario
    setSession(currentSession);
    setUser(currentSession?.user || null);

    if (currentSession?.user) {
      // Fetch tenant and role mapping from tenant_users
      const { data, error } = await supabase
        .from('tenant_users')
        .select('tenant_id, roles(name)')
        .eq('user_id', currentSession.user.id)
        .single();

      if (data && !error) {
        setTenantId(data.tenant_id);
        let roleName = data.roles ? (Array.isArray(data.roles) ? data.roles[0]?.name : (data.roles as any).name) : null;

        // Auto-fix: Si el usuario existe pero no tiene rol, asignamos ADMIN por defecto
        if (!roleName) {
          console.log("Existing user has no role. Assigning ADMIN automatically.");
          let { data: adminRole } = await supabase.from('roles').select('id, name').ilike('name', 'ADMIN').maybeSingle();

          if (!adminRole) {
            const { data: newRole } = await supabase.from('roles').insert({ name: 'ADMIN' }).select('id, name').single();
            adminRole = newRole;
          }

          if (adminRole) {
            await supabase.from('tenant_users').update({ role_id: adminRole.id }).eq('user_id', currentSession.user.id);
            roleName = adminRole.name;
          }
        }

        setRole(roleName ? roleName.toUpperCase() : null);
        api.setTenantId(data.tenant_id); // Inyectamos el tenant_id a la configuración de la API
      } else {
        // Lógica para nuevos registros o invitaciones
        console.log("No tenant_user found for", currentSession.user.id);

        // 1. Verificar si tiene una invitación pendiente
        const { data: invite, error: inviteErr } = await supabase.from('invites').select('*').eq('email', currentSession.user.email).maybeSingle();

        if (invite) {
          console.log("Invite found:", invite);
          const { error: joinErr } = await supabase.from('tenant_users').insert({
            tenant_id: invite.tenant_id,
            user_id: currentSession.user.id,
            role_id: invite.role_id
          });

          await supabase.from('invites').delete().eq('id', invite.id);

          // Refetch del mapeo recién creado
          const { data: newTenantUser } = await supabase.from('tenant_users').select('tenant_id, roles(name)').eq('user_id', currentSession.user.id).single();
          if (newTenantUser) {
            setTenantId(newTenantUser.tenant_id);
            setRole(newTenantUser.roles ? (Array.isArray(newTenantUser.roles) ? newTenantUser.roles[0]?.name : (newTenantUser.roles as any).name) : null);
            api.setTenantId(newTenantUser.tenant_id);
          }
        } else {
          // 2. Crear nueva empresa (Tenant) si no hay invitación
          console.log("No invite found. Creating new tenant...");
          const { data: newTenant, error: tenantErr } = await supabase.from('tenants').insert({ name: 'Mi Empresa' }).select().single();

          let { data: adminRole } = await supabase.from('roles').select('id, name').ilike('name', 'ADMIN').maybeSingle();

          if (!adminRole) {
            const { data: newRole } = await supabase.from('roles').insert({ name: 'ADMIN' }).select('id, name').single();
            adminRole = newRole;
          }

          if (newTenant && adminRole) {
            await supabase.from('tenant_users').insert({
              tenant_id: newTenant.id,
              user_id: currentSession.user.id,
              role_id: adminRole.id
            });

            setTenantId(newTenant.id);
            setRole('ADMIN');
            api.setTenantId(newTenant.id);
          }
        }
      }
    } else {
      // Limpieza de estados si no hay sesión activa (Logout)
      setSession(null);
      setUser(null);
      setTenantId(null);
      setRole(null);
      api.setTenantId(null);
    }

    setLoading(false); // Finalizamos el estado de carga para mostrar la App
  };

  useEffect(() => {
    // Carga inicial de la sesión
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await handleSession(session);
    };

    fetchSession();

    // Escucha cambios de autenticación en tiempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, tenantId, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};