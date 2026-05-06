import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

interface AuthContextType {
  session: any | null;
  user: any | null;
  idEmpresa: string | null;
  role: string | null;
  estadoSuscripcion: string | null;
  pinSeguridad: string;
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
  const [pinSeguridad, setPinSeguridad] = useState<string>('6767');
  const [loading, setLoading] = useState(true);

  const handleSession = async (currentSession: any) => {
    console.log("AuthContext: handleSession started for user:", currentSession?.user?.id);
    try {
      if (!currentSession) {
        console.log("AuthContext: No session found");
        setSession(null);
        setUser(null);
        setIdEmpresa(null);
        setRole(null);
        setEstadoSuscripcion(null);
        api.setIdEmpresa(null);
        return;
      }

      setUser(currentSession.user);

      // Fetch tenant and role mapping from usuarios_empresa
      console.log("AuthContext: Fetching user-company mapping...");
      const { data, error } = await supabase
        .from('usuarios_empresa')
        .select('id_empresa, roles(name)')
        .eq('id_usuario', currentSession.user.id)
        .maybeSingle();

      if (data && !error) {
        console.log("AuthContext: Mapping found:", data);
        setIdEmpresa(data.id_empresa);
        let roleName = data.roles ? (Array.isArray(data.roles) ? data.roles[0]?.name : (data.roles as any).name) : null;

        if (!roleName) {
          console.log("AuthContext: No role found, assigning ADMIN...");
          const { data: r } = await supabase.from('roles').select('id').ilike('name', 'ADMIN').maybeSingle();
          if (r) await supabase.from('usuarios_empresa').update({ role_id: r.id }).eq('id_usuario', currentSession.user.id);
          roleName = 'ADMIN';
        }

        setRole(roleName.toUpperCase());
        api.setIdEmpresa(data.id_empresa);

        const { data: e } = await supabase.from('empresas').select('estado_suscripcion, pin_seguridad').eq('id', data.id_empresa).maybeSingle();
        if (e) {
          setEstadoSuscripcion(e.estado_suscripcion);
          if (e.pin_seguridad) setPinSeguridad(e.pin_seguridad);
        }
      } else {
        console.log("AuthContext: No mapping found. Checking invites or creating company...");
        const { data: invite } = await supabase.from('invites').select('*').eq('email', currentSession.user.email).maybeSingle();

        if (invite) {
          console.log("AuthContext: Invite found, joining...");
          await supabase.from('usuarios_empresa').insert({ id_empresa: invite.id_empresa, id_usuario: currentSession.user.id, role_id: invite.role_id });
          await supabase.from('invites').delete().eq('id', invite.id);
          // Refresh data
          const { data: joined } = await supabase.from('usuarios_empresa').select('id_empresa, roles(name)').eq('id_usuario', currentSession.user.id).single();
          if (joined) {
            setIdEmpresa(joined.id_empresa);
            setRole((joined.roles as any)?.name?.toUpperCase() || 'ADMIN');
            api.setIdEmpresa(joined.id_empresa);
          }
        } else {
          console.log("AuthContext: Creating new company...");
          const { data: newE } = await supabase.from('empresas').insert({ name: 'Mi Empresa', estado_suscripcion: 'activo' }).select().single();
          const { data: adm } = await supabase.from('roles').select('id').ilike('name', 'ADMIN').maybeSingle();
          
          if (newE && adm) {
            await supabase.from('usuarios_empresa').insert({ id_empresa: newE.id, id_usuario: currentSession.user.id, role_id: adm.id });
            setIdEmpresa(newE.id);
            setRole('ADMIN');
            setEstadoSuscripcion('activo');
            api.setIdEmpresa(newE.id);
          }
        }
      }
      setSession(currentSession);
    } catch (err) {
      console.error("AuthContext: CRITICAL ERROR", err);
    } finally {
      console.log("AuthContext: Loading finished.");
      setLoading(false);
    }
  };

  useEffect(() => {
    // Interruptor de seguridad: Si en 6 segundos no hay respuesta de Supabase, forzamos el cierre del loader
    const securityTimeout = setTimeout(() => {
      if (loading) {
        console.error("AuthContext: Supabase timeout (6s). Forzando carga.");
        setLoading(false);
      }
    }, 6000);

    // Si no hay URL de Supabase válida, no intentamos conectar
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url || url.includes('placeholder') || !key || key.includes('placeholder')) {
      console.warn("AuthContext: Credenciales faltantes o placeholder. Abortando conexión.");
      setLoading(false);
      return;
    }

    // OPTIMIZACIÓN: Si no hay rastro de sesión en localStorage, no esperamos tanto
    const hasLocalSession = !!localStorage.getItem('sb-' + import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token');
    
    const securityTimeout = setTimeout(() => {
      if (loading) {
        console.log("AuthContext: Security timeout reached (3s)");
        setLoading(false);
      }
    }, hasLocalSession ? 3000 : 1000); // 1s si es usuario nuevo, 3s si podría tener sesión

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
      clearTimeout(securityTimeout);
    }).catch(err => {
      console.error("AuthContext: Error getting session", err);
      setLoading(false);
      clearTimeout(securityTimeout);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await handleSession(session);
      clearTimeout(securityTimeout);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(securityTimeout);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, idEmpresa, role, estadoSuscripcion, pinSeguridad, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};