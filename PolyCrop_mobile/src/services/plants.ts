import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

/**
 * Update plant fields (name / rfidTag)
 */
export async function updatePlant(
  tunnelId: string,
  plantId: string,
  patch: { plantName?: string; rfidTag?: string | null }
) {
  const ref = doc(db, "tunnels", tunnelId, "plants", plantId);
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
}

/**
 * ✅ Bind RFID to a plant
 * 1) set plants/{plantId}.rfidTag
 * 2) set rfidMap/{rfid} -> { plantId }
 */
export async function bindRFIDToPlant(tunnelId: string, plantId: string, rfid: string) {
  const clean = rfid.trim().toUpperCase();
  if (!clean) throw new Error("RFID is empty");

  // update plant
  await updatePlant(tunnelId, plantId, { rfidTag: clean });

  // create mapping doc used by robot
  const mapRef = doc(db, "tunnels", tunnelId, "rfidMap", clean);
  await setDoc(
    mapRef,
    {
      plantId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * ✅ Unbind RFID from plant
 */
export async function unbindRFID(tunnelId: string, plantId: string, rfid: string) {
  const clean = rfid.trim().toUpperCase();
  if (!clean) return;

  await updatePlant(tunnelId, plantId, { rfidTag: null });

  const mapRef = doc(db, "tunnels", tunnelId, "rfidMap", clean);
  await deleteDoc(mapRef);
}