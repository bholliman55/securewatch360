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
    if (loading || tenants.length === 0) {
      return;
    }
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const storedValid = stored && tenants.some((t) => t.id === stored);
    if (storedValid) {
      setSelectedTenantIdState(stored);
      return;
    }
    setSelectedTenantIdState(tenants[0].id);
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
