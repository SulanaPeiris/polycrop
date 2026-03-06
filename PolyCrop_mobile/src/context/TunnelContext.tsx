import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "./AuthContext";

export type TunnelStatus = "GOOD" | "NEED_ATTENTION";

export interface Tunnel {
  id: string;
  name: string;              // ✅ UI uses this
  tunnelName?: string;       // ✅ legacy support
  status: TunnelStatus;

  cropType?: string;
  rows?: number;
  columns?: number;
  size?: string;
  sensorCount?: number;
  robotId?: string;
  fertigationUnitId?: string;
  sensors?: {
    temp?: number;
    humidity?: number;
    soil?: number;
  };
}

interface TunnelContextType {
  tunnels: Tunnel[];
  selectedTunnelId: string;
  setSelectedTunnelId: (id: string) => void;
  selectedTunnel: Tunnel | undefined;
  isTunnelsLoading: boolean;
}

const TunnelContext = createContext<TunnelContextType | undefined>(undefined);

export function TunnelProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [selectedTunnelId, setSelectedTunnelId] = useState<string>("");
  const [isTunnelsLoading, setIsTunnelsLoading] = useState(true);

  useEffect(() => {
    setTunnels([]);
    setSelectedTunnelId("");

    if (!user) {
      setIsTunnelsLoading(false);
      return;
    }

    setIsTunnelsLoading(true);

    const q = query(collection(db, "tunnels"), where("ownerId", "==", user.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => {
          const data: any = d.data();

          const name = data.name ?? data.tunnelName ?? "Unnamed Tunnel";

          // if older data had WARN/ERROR, map to NEED_ATTENTION
          const rawStatus = (data.status ?? "GOOD").toString();
          const status: TunnelStatus = rawStatus === "GOOD" ? "GOOD" : "NEED_ATTENTION";

          return {
            id: d.id,
            name,
            tunnelName: data.tunnelName ?? undefined,
            status,
            cropType: data.cropType ?? undefined,
            rows: typeof data.rows === "number" ? data.rows : undefined,
            columns: typeof data.columns === "number" ? data.columns : undefined,
            size: data.size ?? undefined,
            sensorCount: typeof data.sensorCount === "number" ? data.sensorCount : undefined,
            robotId: data.robotId ?? undefined,
            fertigationUnitId: data.fertigationUnitId ?? undefined,
            sensors: data.sensors ?? undefined,
          } as Tunnel;
        });

        setTunnels(items);

        // ✅ keep selection valid; otherwise pick first tunnel
        setSelectedTunnelId((prev) => {
          if (prev && items.some((t) => t.id === prev)) return prev;
          return items[0]?.id ?? "";
        });

        setIsTunnelsLoading(false);
      },
      (err) => {
        console.log("tunnels listener error:", err);
        setIsTunnelsLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const selectedTunnel = useMemo(
    () => tunnels.find((t) => t.id === selectedTunnelId),
    [tunnels, selectedTunnelId]
  );

  return (
    <TunnelContext.Provider
      value={{
        tunnels,
        selectedTunnelId,
        setSelectedTunnelId,
        selectedTunnel,
        isTunnelsLoading,
      }}
    >
      {children}
    </TunnelContext.Provider>
  );
}

export function useTunnel() {
  const ctx = useContext(TunnelContext);
  if (!ctx) throw new Error("useTunnel must be used within TunnelProvider");
  return ctx;
}