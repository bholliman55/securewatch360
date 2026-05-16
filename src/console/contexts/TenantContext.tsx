'use client';

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

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

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
  const validTenants = tenants.filter((tenant) => isUuid(tenant.id));
  if (validTenants.length === 0) return null;
  const preferred = [...validTenants].sort((a, b) => {
    const rankDiff = roleRank(b.role) - roleRank(a.role);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  })[0];
  return preferred?.id ?? null;
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
    const validTenants = tenants.filter((tenant) => isUuid(tenant.id));
    if (validTenants.length === 0) {
      setSelectedTenantIdState(null);
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
      return;
    }
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const storedValid = isUuid(stored) && validTenants.some((t) => t.id === stored);
    if (storedValid) {
      setSelectedTenantIdState(stored);
      return;
    }
    const preferredTenantId = getPreferredTenantId(validTenants);
    setSelectedTenantIdState(preferredTenantId);
    if (preferredTenantId && typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, preferredTenantId);
    }
  }, [loading, tenants]);

  const setSelectedTenantId = (id: string | null) => {
    const nextId = isUuid(id) ? id : null;
    setSelectedTenantIdState(nextId);
    if (nextId && typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, nextId);
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
