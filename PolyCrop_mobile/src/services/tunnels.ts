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
import { bindRobotToTunnel } from "./robots";

export type TunnelStatus = "GOOD" | "NEED_ATTENTION";

export type Tunnel = {
  id: string;
  ownerId: string;

  name: string; // ✅ use "name" everywhere
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
  const tunnelRef = await addDoc(collection(db, "tunnels"), {
    ...input,
    status: input.status ?? "GOOD",
    setupCompleted: input.setupCompleted ?? false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // ✅ bind robot -> tunnel (so robot can read assignedTunnelId)
  if (input.robotId && input.robotId.trim().length > 0) {
    await bindRobotToTunnel(input.robotId.trim(), tunnelRef.id);
  }

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
        rfidTag: null,
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
  // ✅ no orderBy to avoid composite index requirement
  const q = query(collection(db, "tunnels"), where("ownerId", "==", ownerId));
  const snap = await getDocs(q);

  const items = snap.docs.map((d) => {
    const data: any = d.data();
    const createdAtMs = typeof data?.createdAt?.toMillis === "function" ? data.createdAt.toMillis() : 0;
    return { id: d.id, ...data, __createdAtMs: createdAtMs };
  });

  items.sort((a: any, b: any) => (b.__createdAtMs ?? 0) - (a.__createdAtMs ?? 0));
  return items.map(({ __createdAtMs, ...rest }: any) => rest) as Tunnel[];
}

export async function updateTunnel(
  tunnelId: string,
  patch: Partial<Omit<Tunnel, "id" | "ownerId">>
) {
  await updateDoc(doc(db, "tunnels", tunnelId), { ...patch, updatedAt: serverTimestamp() });
}

/**
 * ✅ Deletes plants subcollection first (real delete).
 */
export async function deleteTunnelCascade(tunnelId: string) {
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

  await deleteDoc(doc(db, "tunnels", tunnelId));
}