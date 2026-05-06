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
    console.log("🔍 [DIAGNÓSTICO] handleSession iniciado con:", currentSession ? "Sesión presente" : "Sin sesión");
    try {
      if (!currentSession) {
        console.warn("⚠️ [DIAGNÓSTICO] No hay sesión activa. Limpiando estado.");
        setSession(null);
        setUser(null);
        setIdEmpresa(null);
        setRole(null);
        setEstadoSuscripcion(null);
        api.setIdEmpresa(null);
        return;
      }

      // Validar sesión real
      console.log("📡 [DIAGNÓSTICO] Verificando validez del usuario con Supabase...");
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error("❌ [DIAGNÓSTICO] Error al validar usuario:", userError?.message || "Usuario no encontrado");
        setSession(null);
        return;
      }

      console.log("✅ [DIAGNÓSTICO] Usuario validado:", user.email);
      setUser(user);
      setSession(currentSession);

      // Buscar mapeo de empresa
      console.log("🏢 [DIAGNÓSTICO] Buscando empresa vinculada para:", user.id);
      const { data: mapping, error: mapError } = await supabase
        .from('usuarios_empresa')
        .select('id_empresa, roles(name), empresas(estado_suscripcion, pin_seguridad)')
        .eq('id_usuario', user.id)
        .maybeSingle();

      if (mapError) {
        console.error("❌ [DIAGNÓSTICO] Error al buscar empresa:", mapError.message);
      }

      if (mapping) {
        console.log("🎉 [DIAGNÓSTICO] Empresa encontrada:", mapping.id_empresa);
        setIdEmpresa(mapping.id_empresa);
        setRole((mapping.roles as any)?.name?.toUpperCase() || 'USER');
        setEstadoSuscripcion(mapping.empresas?.estado_suscripcion || 'activo');
        setPinSeguridad(mapping.empresas?.pin_seguridad || '6767');
        api.setIdEmpresa(mapping.id_empresa);
      } else {
        console.warn("ℹ️ [DIAGNÓSTICO] El usuario no tiene empresa vinculada todavía.");
        setIdEmpresa(null);
        api.setIdEmpresa(null);
      }
    } catch (err: any) {
      console.error("🔥 [DIAGNÓSTICO] Error crítico en AuthContext:", err.message);
      setSession(null);
    } finally {
      console.log("🏁 [DIAGNÓSTICO] handleSession finalizado.");
      setLoading(false);
    }
  };

  useEffect(() => {
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