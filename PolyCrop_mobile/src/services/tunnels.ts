import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
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

  tunnelName: string;
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
  const q = query(
    collection(db, "tunnels"),
    where("ownerId", "==", ownerId),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Tunnel[];
}

export async function updateTunnel(
  tunnelId: string,
  patch: Partial<Omit<Tunnel, "id" | "ownerId">>
) {
  await updateDoc(doc(db, "tunnels", tunnelId), { ...patch, updatedAt: serverTimestamp() });
}

/**
 * ✅ Deletes plants subcollection first (so it’s a real delete).
 * NOTE: This can take time for very large tunnels.
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

  // delete tunnel doc
  await deleteDoc(doc(db, "tunnels", tunnelId));
}