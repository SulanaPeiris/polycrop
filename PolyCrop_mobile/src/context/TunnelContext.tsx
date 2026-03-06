import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import {
  addDoc,
  collection,
  doc,
  updateDoc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { useAuth } from "./AuthContext";

export type TunnelStatus = "GOOD" | "NEED_ATTENTION";

export interface Tunnel {
  id: string;
  name: string;
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
  addTunnel: (tunnel: Omit<Tunnel, "id" | "status">) => Promise<string>;
  setTunnelStatus: (tunnelId: string, status: TunnelStatus) => Promise<void>;
}

const TunnelContext = createContext<TunnelContextType | undefined>(undefined);

async function createPlantsForTunnel(tunnelId: string, rows?: number, columns?: number) {
  if (!rows || !columns) return;

  // Firestore batch limit is 500 ops; keep it safe.
  let batch = writeBatch(db);
  let ops = 0;

  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= columns; c++) {
      const plantUid = `P-R${String(r).padStart(2, "0")}-C${String(c).padStart(2, "0")}`;
      const plantId = `r${r}_c${c}`;
      const plantRef = doc(db, "tunnels", tunnelId, "plants", plantId);

      batch.set(plantRef, {
        plantUid,
        plantName: `Plant ${plantUid}`,
        row: r,
        column: c,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      ops++;
      if (ops === 450) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }
  }

  if (ops > 0) await batch.commit();
}

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

    // ✅ only where() (no composite index needed)
    const q = query(collection(db, "tunnels"), where("ownerId", "==", user.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const itemsWithTime = snap.docs.map((d) => {
          const data = d.data() as any;
          const createdAtMs =
            typeof data?.createdAt?.toMillis === "function" ? data.createdAt.toMillis() : 0;

          return {
            id: d.id,
            name: data.name,
            status: (data.status ?? "GOOD") as TunnelStatus,
            cropType: data.cropType ?? undefined,
            rows: typeof data.rows === "number" ? data.rows : undefined,
            columns: typeof data.columns === "number" ? data.columns : undefined,
            size: data.size ?? undefined,
            sensorCount: typeof data.sensorCount === "number" ? data.sensorCount : undefined,
            robotId: data.robotId ?? undefined,
            fertigationUnitId: data.fertigationUnitId ?? undefined,
            sensors: data.sensors ?? undefined,
            __createdAtMs: createdAtMs,
          };
        });

        itemsWithTime.sort((a: any, b: any) => (b.__createdAtMs ?? 0) - (a.__createdAtMs ?? 0));
        const items: Tunnel[] = itemsWithTime.map(({ __createdAtMs, ...rest }: any) => rest);

        setTunnels(items);

        setSelectedTunnelId((prev) => {
          if (prev && items.some((t) => t.id === prev)) return prev;
          return items[0]?.id ?? "";
        });

        setIsTunnelsLoading(false);
      },
      () => setIsTunnelsLoading(false)
    );

    return () => unsub();
  }, [user]);

  const selectedTunnel = useMemo(
    () => tunnels.find((t) => t.id === selectedTunnelId),
    [tunnels, selectedTunnelId]
  );

  const addTunnel = async (tunnel: Omit<Tunnel, "id" | "status">) => {
    if (!user) throw new Error("You must be logged in to create a tunnel.");

    const ref = await addDoc(collection(db, "tunnels"), {
      ownerId: user.uid,
      name: tunnel.name,
      status: "GOOD", // ✅ default
      cropType: tunnel.cropType ?? "",
      rows: tunnel.rows ?? null,
      columns: tunnel.columns ?? null,
      size: tunnel.size ?? null,
      sensorCount: tunnel.sensorCount ?? null,
      robotId: tunnel.robotId ?? null,
      fertigationUnitId: tunnel.fertigationUnitId ?? null,
      sensors: tunnel.sensors ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await createPlantsForTunnel(ref.id, tunnel.rows, tunnel.columns);

    setSelectedTunnelId(ref.id);
    return ref.id;
  };

  const setTunnelStatus = async (tunnelId: string, status: TunnelStatus) => {
    if (!user) throw new Error("You must be logged in.");
    const ref = doc(db, "tunnels", tunnelId);
    await updateDoc(ref, { status, updatedAt: serverTimestamp() });
  };

  return (
    <TunnelContext.Provider
      value={{
        tunnels,
        selectedTunnelId,
        setSelectedTunnelId,
        selectedTunnel,
        isTunnelsLoading,
        addTunnel,
        setTunnelStatus,
      }}
    >
      {children}
    </TunnelContext.Provider>
  );
}

export function useTunnel() {
  const context = useContext(TunnelContext);
  if (!context) throw new Error("useTunnel must be used within TunnelProvider");
  return context;
}