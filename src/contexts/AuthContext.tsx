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
        // No tenant_user found. It's a new sign up.
        // 1. Check invites
        const { data: invite } = await supabase.from('invites').select('*').eq('email', currentSession.user.email).maybeSingle();
        
        if (invite) {
          // Join existing tenant
          await supabase.from('tenant_users').insert({
            tenant_id: invite.tenant_id,
            user_id: currentSession.user.id,
            role_id: invite.role_id
          });
          await supabase.from('invites').delete().eq('id', invite.id);
          
          // Re-fetch mapping
          const { data: newTenantUser } = await supabase.from('tenant_users').select('tenant_id, roles(name)').eq('user_id', currentSession.user.id).single();
          if (newTenantUser) {
            setTenantId(newTenantUser.tenant_id);
            setRole(newTenantUser.roles ? (Array.isArray(newTenantUser.roles) ? newTenantUser.roles[0]?.name : (newTenantUser.roles as any).name) : null);
            api.setTenantId(newTenantUser.tenant_id);
          }
        } else {
          // 2. Create new tenant (Owner)
          const { data: newTenant } = await supabase.from('tenants').insert({ name: 'Mi Empresa' }).select().single();
          const { data: adminRole } = await supabase.from('roles').select('id, name').eq('name', 'ADMIN').single();
          
          if (newTenant && adminRole) {
            await supabase.from('tenant_users').insert({
              tenant_id: newTenant.id,
              user_id: currentSession.user.id,
              role_id: adminRole.id
            });
            
            setTenantId(newTenant.id);
            setRole(adminRole.name);
            api.setTenantId(newTenant.id);
          }
        }
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
