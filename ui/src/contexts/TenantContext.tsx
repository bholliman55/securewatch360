import { createContext, useContext, useState, ReactNode, useEffect } from "react";

export type TenantOption = {
  id: string;
  name: string;
  role: string;
};

interface TenantContextType {
  selectedTenantId: string | null;
  setSelectedTenantId: (id: string | null) => void;
  tenants: TenantOption[];
  loading: boolean;
  selectedTenantName: string | null;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const STORAGE_KEY = "sw360.selectedTenantId";
const DEFAULT_TEST_TENANT_ID = "8c2b980c-9fc8-4b71-9b5f-2e90a5c3a001";

function roleRank(role: string): number {
  switch (role) {
    case "owner":
      return 4;
    case "admin":
      return 3;
    case "analyst":
      return 2;
    case "viewer":
      return 1;
    default:
      return 0;
  }
}

export function getPreferredTenantId(tenants: TenantOption[]): string | null {
  if (tenants.length === 0) return null;
  const preferred = [...tenants].sort((a, b) => {
    const rankDiff = roleRank(b.role) - roleRank(a.role);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  })[0];
  return preferred?.id ?? null;
}

function getFallbackTenantId(): string {
  return import.meta.env.VITE_TEST_TENANT_ID || DEFAULT_TEST_TENANT_ID;
}

export function TenantProvider({
  children,
  tenants,
  loading,
}: {
  children: ReactNode;
  tenants: TenantOption[];
  loading: boolean;
}) {
  const [selectedTenantId, setSelectedTenantIdState] = useState<string | null>(null);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (tenants.length === 0) {
      setSelectedTenantIdState(getFallbackTenantId());
      return;
    }
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const storedValid = stored && tenants.some((t) => t.id === stored);
    if (storedValid) {
      setSelectedTenantIdState(stored);
      return;
    }
    const preferredTenantId = getPreferredTenantId(tenants);
    setSelectedTenantIdState(preferredTenantId);
    if (preferredTenantId && typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, preferredTenantId);
    }
  }, [loading, tenants]);

  const setSelectedTenantId = (id: string | null) => {
    setSelectedTenantIdState(id);
    if (id && typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
  };

  const selectedTenantName = selectedTenantId
    ? tenants.find((t) => t.id === selectedTenantId)?.name ?? null
    : null;

  return (
    <TenantContext.Provider
      value={{
        selectedTenantId,
        setSelectedTenantId,
        tenants,
        loading,
        selectedTenantName,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}
