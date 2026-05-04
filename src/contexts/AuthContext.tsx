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
        console.log("No tenant_user found for", currentSession.user.id);
        
        // 1. Check invites
        const { data: invite, error: inviteErr } = await supabase.from('invites').select('*').eq('email', currentSession.user.email).maybeSingle();
        if (inviteErr) console.error("Error checking invites:", inviteErr);
        
        if (invite) {
          console.log("Invite found:", invite);
          // Join existing tenant
          const { error: joinErr } = await supabase.from('tenant_users').insert({
            tenant_id: invite.tenant_id,
            user_id: currentSession.user.id,
            role_id: invite.role_id
          });
          if (joinErr) console.error("Error joining tenant:", joinErr);
          
          await supabase.from('invites').delete().eq('id', invite.id);
          
          // Re-fetch mapping
          const { data: newTenantUser } = await supabase.from('tenant_users').select('tenant_id, roles(name)').eq('user_id', currentSession.user.id).single();
          if (newTenantUser) {
            setTenantId(newTenantUser.tenant_id);
            setRole(newTenantUser.roles ? (Array.isArray(newTenantUser.roles) ? newTenantUser.roles[0]?.name : (newTenantUser.roles as any).name) : null);
            api.setTenantId(newTenantUser.tenant_id);
          }
        } else {
          console.log("No invite found. Creating new tenant...");
          // 2. Create new tenant (Owner)
          const { data: newTenant, error: tenantErr } = await supabase.from('tenants').insert({ name: 'Mi Empresa' }).select().single();
          if (tenantErr) console.error("Error creating tenant:", tenantErr);
          
          // Try to get ADMIN role case insensitively
          let { data: adminRole } = await supabase.from('roles').select('id, name').ilike('name', 'ADMIN').maybeSingle();
          
          if (!adminRole) {
            // Role doesn't exist, try to create it
            console.log("ADMIN role not found, creating it...");
            const { data: newRole } = await supabase.from('roles').insert({ name: 'ADMIN' }).select('id, name').single();
            adminRole = newRole;
          }
          
          console.log("New Tenant:", newTenant, "Admin Role:", adminRole);
          
          if (newTenant && adminRole) {
            const { error: insertUserErr } = await supabase.from('tenant_users').insert({
              tenant_id: newTenant.id,
              user_id: currentSession.user.id,
              role_id: adminRole.id
            });
            if (insertUserErr) console.error("Error linking user to tenant:", insertUserErr);
            
            setTenantId(newTenant.id);
            // Ensure we use 'ADMIN' uppercase for frontend checks
            setRole('ADMIN');
            api.setTenantId(newTenant.id);
          } else {
            console.error("Failed to create tenant or find admin role. Tenant or Role is null.");
            // Set defaults to avoid app crash, but without privileges
            setTenantId(null);
            setRole(null);
            api.setTenantId(null);
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
