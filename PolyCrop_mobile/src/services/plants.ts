import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

export type Side = "A" | "B";

function cleanRFID(rfid: string) {
  return rfid.trim().toUpperCase();
}

export async function updatePlant(
  tunnelId: string,
  plantId: string,
  patch: { plantName?: string; rfidA?: string | null; rfidB?: string | null }
) {
  const ref = doc(db, "tunnels", tunnelId, "plants", plantId);
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
}

/**
 * Bind an RFID tag to plant Side A or B
 * Writes:
 *  - tunnels/{tunnelId}/plants/{plantId}.rfidA or rfidB
 *  - tunnels/{tunnelId}/rfidMap/{RFID} = {plantId, side}
 */
export async function bindRFIDToPlantSide(
  tunnelId: string,
  plantId: string,
  rfid: string,
  side: Side
) {
  const clean = cleanRFID(rfid);
  if (!clean) throw new Error("RFID is empty");

  // prevent duplicates across plants by checking rfidMap/{rfid}
  const mapRef = doc(db, "tunnels", tunnelId, "rfidMap", clean);
  const existing = await getDoc(mapRef);

  if (existing.exists()) {
    const data: any = existing.data();
    if (data.plantId && data.plantId !== plantId) {
      throw new Error(`RFID ${clean} is already assigned to another plant (${data.plantId}).`);
    }
  }

  // update plant field
  await updatePlant(tunnelId, plantId, side === "A" ? { rfidA: clean } : { rfidB: clean });

  // write mapping doc for robot
  await setDoc(
    mapRef,
    { plantId, side, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function unbindRFIDSide(
  tunnelId: string,
  plantId: string,
  rfid: string,
  side: Side
) {
  const clean = cleanRFID(rfid);
  if (!clean) return;

  // clear plant field
  await updatePlant(tunnelId, plantId, side === "A" ? { rfidA: null } : { rfidB: null });

  // delete mapping doc
  const mapRef = doc(db, "tunnels", tunnelId, "rfidMap", clean);
  await deleteDoc(mapRef);
}
