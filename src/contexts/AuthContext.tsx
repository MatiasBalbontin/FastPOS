import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

interface AuthContextType {
  session: any | null;
  user: any | null;
  idEmpresa: string | null;
  role: string | null;
  estadoSuscripcion: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  idEmpresa: null,
  role: null,
  estadoSuscripcion: null,
  loading: true,
  signOut: async () => { }
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [idEmpresa, setIdEmpresa] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [estadoSuscripcion, setEstadoSuscripcion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handleSession = async (currentSession: any) => {
    setUser(currentSession?.user || null);

    if (currentSession?.user) {
      // Fetch tenant and role mapping from usuarios_empresa
      const { data, error } = await supabase
        .from('usuarios_empresa')
        .select('id_empresa, roles(name)')
        .eq('id_usuario', currentSession.user.id)
        .single();

      if (data && !error) {
        setIdEmpresa(data.id_empresa);
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
            await supabase.from('usuarios_empresa').update({ role_id: adminRole.id }).eq('id_usuario', currentSession.user.id);
            roleName = adminRole.name;
          }
        }

        setRole(roleName ? roleName.toUpperCase() : null);
        api.setIdEmpresa(data.id_empresa);

        // Fetch subscription status
        const { data: empresaData } = await supabase
          .from('empresas')
          .select('estado_suscripcion')
          .eq('id', data.id_empresa)
          .single();
        
        if (empresaData) {
          setEstadoSuscripcion(empresaData.estado_suscripcion);
        }

      } else {
        console.log("No usuarios_empresa found for", currentSession.user.id);

        // 1. Verificar si tiene una invitación pendiente
        const { data: invite, error: inviteErr } = await supabase.from('invites').select('*').eq('email', currentSession.user.email).maybeSingle();

        if (invite) {
          console.log("Invite found:", invite);
          const { error: joinErr } = await supabase.from('usuarios_empresa').insert({
            id_empresa: invite.id_empresa,
            id_usuario: currentSession.user.id,
            role_id: invite.role_id
          });

          await supabase.from('invites').delete().eq('id', invite.id);

          const { data: newUsuarioEmpresa } = await supabase.from('usuarios_empresa').select('id_empresa, roles(name)').eq('id_usuario', currentSession.user.id).single();
          if (newUsuarioEmpresa) {
            setIdEmpresa(newUsuarioEmpresa.id_empresa);
            setRole(newUsuarioEmpresa.roles ? (Array.isArray(newUsuarioEmpresa.roles) ? newUsuarioEmpresa.roles[0]?.name : (newUsuarioEmpresa.roles as any).name) : null);
            api.setIdEmpresa(newUsuarioEmpresa.id_empresa);

            const { data: empresaData } = await supabase.from('empresas').select('estado_suscripcion').eq('id', newUsuarioEmpresa.id_empresa).single();
            setEstadoSuscripcion(empresaData?.estado_suscripcion || 'pendiente_pago');
          }
        } else {
          // 2. Crear nueva empresa si no hay invitación
          console.log("No invite found. Creating new empresa...");
          const { data: newEmpresa, error: tenantErr } = await supabase.from('empresas').insert({ 
            name: 'Mi Empresa',
            estado_suscripcion: 'pendiente_pago' 
          }).select().single();

          let { data: adminRole } = await supabase.from('roles').select('id, name').ilike('name', 'ADMIN').maybeSingle();

          if (!adminRole) {
            const { data: newRole } = await supabase.from('roles').insert({ name: 'ADMIN' }).select('id, name').single();
            adminRole = newRole;
          }

          if (newEmpresa && adminRole) {
            await supabase.from('usuarios_empresa').insert({
              id_empresa: newEmpresa.id,
              id_usuario: currentSession.user.id,
              role_id: adminRole.id
            });

            setIdEmpresa(newEmpresa.id);
            setRole('ADMIN');
            setEstadoSuscripcion(newEmpresa.estado_suscripcion);
            api.setIdEmpresa(newEmpresa.id);
          }
        }
      }
    } else {
      setSession(null);
      setUser(null);
      setIdEmpresa(null);
      setRole(null);
      setEstadoSuscripcion(null);
      api.setIdEmpresa(null);
    }

    setSession(currentSession);
    setLoading(false);
  };

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await handleSession(session);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, idEmpresa, role, estadoSuscripcion, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};