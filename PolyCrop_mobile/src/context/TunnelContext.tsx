import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "./AuthContext";
import { createTunnelWithPlants, Tunnel as TunnelDoc, TunnelStatus } from "../services/tunnels";

export type Tunnel = TunnelDoc;

type CreateTunnelForm = {
  name: string;
  cropType: string;
  rows: number;
  columns: number;
  size?: string;
  sensorCount?: number;
  robotId?: string;
  fertigationUnitId?: string;
};

type TunnelContextType = {
  tunnels: Tunnel[];
  isTunnelsLoading: boolean;

  selectedTunnelId: string;
  setSelectedTunnelId: (id: string) => void;
  selectedTunnel: Tunnel | null;

  createTunnel: (input: CreateTunnelForm) => Promise<string>;
};

const TunnelContext = createContext<TunnelContextType | undefined>(undefined);

function normalizeStatus(s: any): TunnelStatus {
  return s === "NEED_ATTENTION" ? "NEED_ATTENTION" : "GOOD";
}

export function TunnelProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [selectedTunnelId, setSelectedTunnelId] = useState<string>("");
  const [isTunnelsLoading, setIsTunnelsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTunnels([]);
      setSelectedTunnelId("");
      setIsTunnelsLoading(false);
      return;
    }

    setIsTunnelsLoading(true);

    // ✅ no orderBy => no composite index required
    const qy = query(collection(db, "tunnels"), where("ownerId", "==", user.uid));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data: any = d.data();
          const name = data.name ?? data.tunnelName ?? "Tunnel";
          const status = normalizeStatus(data.status);

          return {
            id: d.id,
            ownerId: data.ownerId,
            name,
            tunnelName: data.tunnelName ?? name,
            cropType: data.cropType ?? "",
            size: data.size ?? undefined,
            rows: data.rows ?? 0,
            columns: data.columns ?? 0,
            sensorCount: data.sensorCount ?? undefined,
            robotId: data.robotId ?? undefined,
            fertigationUnitId: data.fertigationUnitId ?? undefined,
            status,
            setupCompleted: !!data.setupCompleted,
          } as Tunnel;
        });

        // client-side sort by createdAt desc if available
        list.sort((a: any, b: any) => {
          const as = (a as any).createdAt?.seconds ?? 0;
          const bs = (b as any).createdAt?.seconds ?? 0;
          return bs - as;
        });

        setTunnels(list);

        // choose default selected tunnel
        if (!selectedTunnelId && list.length > 0) {
          setSelectedTunnelId(list[0].id);
        } else if (selectedTunnelId && !list.some((t) => t.id === selectedTunnelId)) {
          setSelectedTunnelId(list[0]?.id ?? "");
        }

        setIsTunnelsLoading(false);
      },
      (err) => {
        console.log("tunnels snapshot error:", err?.code, err?.message);
        setIsTunnelsLoading(false);
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const selectedTunnel = useMemo(() => {
    return tunnels.find((t) => t.id === selectedTunnelId) ?? null;
  }, [tunnels, selectedTunnelId]);

  const createTunnel = async (input: CreateTunnelForm) => {
    if (!user) throw new Error("Not logged in");

    const tunnelId = await createTunnelWithPlants({
      ownerId: user.uid,
      name: input.name.trim(),
      tunnelName: input.name.trim(),
      cropType: input.cropType.trim(),
      size: input.size?.trim() || undefined,
      rows: input.rows,
      columns: input.columns,
      sensorCount: input.sensorCount,
      robotId: input.robotId?.trim() || undefined,
      fertigationUnitId: input.fertigationUnitId?.trim() || undefined,
      status: "GOOD",
      setupCompleted: false,
    });

    // after create, auto select
    setSelectedTunnelId(tunnelId);
    return tunnelId;
  };

  const value = useMemo(
    () => ({
      tunnels,
      isTunnelsLoading,
      selectedTunnelId,
      setSelectedTunnelId,
      selectedTunnel,
      createTunnel,
    }),
    [tunnels, isTunnelsLoading, selectedTunnelId, selectedTunnel]
  );

  return <TunnelContext.Provider value={value}>{children}</TunnelContext.Provider>;
}

export function useTunnel() {
  const ctx = useContext(TunnelContext);
  if (!ctx) throw new Error("useTunnel must be used within TunnelProvider");
  return ctx;
}
