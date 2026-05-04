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
  signOut: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleSession = async (currentSession: any) => {
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
        const roleName = data.roles ? (Array.isArray(data.roles) ? data.roles[0]?.name : (data.roles as any).name) : null;
        setRole(roleName);
        api.setTenantId(data.tenant_id); // Inject to API
      } else {
        console.error("Error fetching tenant_user mapping:", error);
        setTenantId(null);
        setRole(null);
        api.setTenantId(null);
      }
    } else {
      setTenantId(null);
      setRole(null);
      api.setTenantId(null);
    }
    
    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, tenantId, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
