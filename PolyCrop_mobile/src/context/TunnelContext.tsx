import React, { createContext, useContext, useMemo, useState } from "react";

export type Tunnel = {
  id: string;
  name: string;
  location?: string;
  status?: "GOOD" | "WARN" | "CRITICAL";
};

type TunnelContextValue = {
  tunnels: Tunnel[];
  selectedTunnel: Tunnel;
  selectedTunnelId: string;
  setSelectedTunnelId: (id: string) => void;
};

const TunnelContext = createContext<TunnelContextValue | null>(null);

// Temporary dummy tunnels (later replace from API)
const DUMMY_TUNNELS: Tunnel[] = [
  { id: "t1", name: "Tunnel 01", location: "Farm - A", status: "GOOD" },
  { id: "t2", name: "Tunnel 02", location: "Farm - A", status: "WARN" },
  { id: "t3", name: "Tunnel 03", location: "Farm - B", status: "CRITICAL" },
];

export function TunnelProvider({ children }: { children: React.ReactNode }) {
  // ✅ Default selection = first tunnel
  const [selectedTunnelId, setSelectedTunnelId] = useState<string>(DUMMY_TUNNELS[0]?.id);

  const selectedTunnel = useMemo(() => {
    return DUMMY_TUNNELS.find((t) => t.id === selectedTunnelId) ?? DUMMY_TUNNELS[0];
  }, [selectedTunnelId]);

  const value: TunnelContextValue = {
    tunnels: DUMMY_TUNNELS,
    selectedTunnel,
    selectedTunnelId,
    setSelectedTunnelId,
  };

  return <TunnelContext.Provider value={value}>{children}</TunnelContext.Provider>;
}

export function useTunnel() {
  const ctx = useContext(TunnelContext);
  if (!ctx) throw new Error("useTunnel must be used inside TunnelProvider");
  return ctx;
}
