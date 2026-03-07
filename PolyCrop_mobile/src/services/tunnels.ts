import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

export type TunnelStatus = "GOOD" | "NEED_ATTENTION";

export type Tunnel = {
  id: string;
  ownerId: string;

  // We store both for backward compatibility
  name: string;
  tunnelName?: string;

  cropType: string;
  size?: string;

  rows: number;
  columns: number;

  sensorCount?: number;
  robotId?: string;
  fertigationUnitId?: string;

  status: TunnelStatus;
  setupCompleted: boolean;
};

export type CreateTunnelInput = Omit<Tunnel, "id">;

export async function createTunnelWithPlants(input: CreateTunnelInput) {
  const tunnelName = (input.name || input.tunnelName || "").trim();

  const tunnelRef = await addDoc(collection(db, "tunnels"), {
    ownerId: input.ownerId,
    name: tunnelName,
    tunnelName, // keep legacy field

    cropType: input.cropType,
    size: input.size ?? null,

    rows: input.rows,
    columns: input.columns,

    sensorCount: input.sensorCount ?? null,
    robotId: input.robotId ?? null,
    fertigationUnitId: input.fertigationUnitId ?? null,

    status: (input.status ?? "GOOD") as TunnelStatus,
    setupCompleted: !!input.setupCompleted,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // create plants grid
  let batch = writeBatch(db);
  let ops = 0;

  for (let r = 1; r <= input.rows; r++) {
    for (let c = 1; c <= input.columns; c++) {
      const plantUid = `P-R${String(r).padStart(2, "0")}-C${String(c).padStart(2, "0")}`;
      const plantId = `r${r}_c${c}`;
      const plantRef = doc(db, "tunnels", tunnelRef.id, "plants", plantId);

      batch.set(plantRef, {
        plantUid,
        plantName: `Plant ${plantUid}`,
        row: r,
        column: c,

        // ✅ two RFIDs per plant
        rfidA: null,
        rfidB: null,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      ops++;
      if (ops >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }
  }

  if (ops > 0) await batch.commit();
  return tunnelRef.id;
}

export async function getMyTunnels(ownerId: string) {
  // ✅ no orderBy => no composite index needed
  const q = query(collection(db, "tunnels"), where("ownerId", "==", ownerId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Tunnel[];
}

export async function updateTunnel(
  tunnelId: string,
  patch: Partial<Omit<Tunnel, "id" | "ownerId">>
) {
  // keep both name + tunnelName in sync if provided
  const next: any = { ...patch, updatedAt: serverTimestamp() };

  if (typeof (patch as any).name === "string") {
    next.tunnelName = (patch as any).name;
  }
  if (typeof (patch as any).tunnelName === "string") {
    next.name = (patch as any).tunnelName;
  }

  await updateDoc(doc(db, "tunnels", tunnelId), next);
}

/**
 * Deletes plants subcollection first.
 * Note: Firestore cannot delete nested subcollections automatically.
 */
export async function deleteTunnelCascade(tunnelId: string) {
  // delete plants in batches
  const plantsSnap = await getDocs(collection(db, "tunnels", tunnelId, "plants"));
  let batch = writeBatch(db);
  let ops = 0;

  for (const d of plantsSnap.docs) {
    batch.delete(d.ref);
    ops++;
    if (ops >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  // delete rfidMap docs
  const rfidSnap = await getDocs(collection(db, "tunnels", tunnelId, "rfidMap"));
  batch = writeBatch(db);
  ops = 0;
  for (const d of rfidSnap.docs) {
    batch.delete(d.ref);
    ops++;
    if (ops >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  // delete scanEvents docs (optional but clean)
  const scanSnap = await getDocs(collection(db, "tunnels", tunnelId, "scanEvents"));
  batch = writeBatch(db);
  ops = 0;
  for (const d of scanSnap.docs) {
    batch.delete(d.ref);
    ops++;
    if (ops >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  // delete tunnel doc
  await deleteDoc(doc(db, "tunnels", tunnelId));
}
