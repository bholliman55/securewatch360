import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabase } from "../services/supabaseClient";
import { apiJson } from "../lib/apiFetch";
import type { TenantOption } from "./TenantContext";

type MeResponse = {
  ok: boolean;
  user: { id: string; email: string } | null;
  tenants: TenantOption[];
  error?: string;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  tenants: TenantOption[];
  meLoading: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const DEFAULT_DEMO_TENANT_ID = "8c2b980c-9fc8-4b71-9b5f-2e90a5c3a001";

function buildDemoUser(): User {
  return {
    id: "local-demo-user",
    aud: "authenticated",
    role: "authenticated",
    email: "demo@securewatch360.local",
    email_confirmed_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: { full_name: "Demo User" },
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as User;
}

function buildDemoTenant(): TenantOption {
  const tenantId = import.meta.env.VITE_TEST_TENANT_ID || DEFAULT_DEMO_TENANT_ID;
  return {
    id: tenantId,
    name: "Demo Tenant",
    role: "owner",
  };
}

function isLocalDemoMode(): boolean {
  const configured = import.meta.env.VITE_DEMO_MODE;
  if (configured === "1" || configured === "true") return true;
  if (configured === "0" || configured === "false") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

async function fetchMe(): Promise<TenantOption[]> {
  try {
    const data = await apiJson<MeResponse>("/api/me");
    if (!data.ok || !data.tenants) return [];
    return data.tenants;
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [meLoading, setMeLoading] = useState(false);

  const refreshTenants = useCallback(async () => {
    setMeLoading(true);
    try {
      const t = await fetchMe();
      setTenants(t);
    } finally {
      setMeLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }: { data: { session: Session | null } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await refreshTenants();
      } else {
        if (isLocalDemoMode()) {
          setUser(buildDemoUser());
          setTenants([buildDemoTenant()]);
        } else {
          setTenants([]);
        }
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, s: Session | null) => {
      void (async () => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          await refreshTenants();
        } else {
          if (isLocalDemoMode()) {
            setUser(buildDemoUser());
            setTenants([buildDemoTenant()]);
          } else {
            setTenants([]);
          }
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, [refreshTenants]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!error) {
        await refreshTenants();
      }
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setTenants([]);
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const value: AuthContextType = {
    user,
    session,
    tenants,
    meLoading,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
