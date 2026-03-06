import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

export async function updatePlant(
  tunnelId: string,
  plantId: string,
  patch: { plantName?: string; rfidTag?: string | null }
) {
  const ref = doc(db, "tunnels", tunnelId, "plants", plantId);
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
}