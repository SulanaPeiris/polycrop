import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { get, ref as rtdbRef } from "firebase/database";
import * as ImageManipulator from "expo-image-manipulator";

import { auth, db, storage, rtdb } from "../firebase/firebase";

const INFER_URL = process.env.EXPO_PUBLIC_INFER_URL;

function uriToBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error("Failed to read file"));
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
}

function makeRequestId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// ✅ Resize/compress BEFORE upload (768px JPEG 0.7)
async function compressForUpload(uri: string): Promise<string> {
  // resize to width=768 (keeps aspect ratio)
  const out = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 768 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  // optional: force portrait if needed
  if (out.width > out.height) {
    const rotated = await ImageManipulator.manipulateAsync(
      out.uri,
      [{ rotate: -90 }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    return rotated.uri;
  }

  return out.uri;
}

// ✅ read robot requestId from RTDB (so phone + backend + robot match)
async function readRobotRequestIdFromRTDB(robotId: string): Promise<string | null> {
  try {
    const snap = await get(rtdbRef(rtdb, `robots/${robotId}/status/captureRequestId`));
    if (snap.exists()) return String(snap.val());
    return null;
  } catch (e: any) {
    console.log("RTDB requestId read failed:", e?.message);
    return null;
  }
}

async function waitUltrasonicDistanceCm(requestId?: string | null, timeoutMs = 900): Promise<number | null> {
  const start = Date.now();

  if (requestId) {
    while (Date.now() - start < timeoutMs) {
      try {
        const snap = await getDoc(doc(db, "ultrasonicReadingsByRequest", requestId));
        if (snap.exists()) {
          const d: any = snap.data();
          if (typeof d?.distanceCm === "number") return d.distanceCm;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  try {
    const latest = await getDoc(doc(db, "ultrasonicReadings", "reading_latest"));
    if (latest.exists()) {
      const d: any = latest.data();
      if (typeof d?.distanceCm === "number") return d.distanceCm;
    }
  } catch {}

  return null;
}

/**
 * Upload photo -> create /captures/{captureId} -> call backend -> backend updates outputs.
 * Also mirrors capture under: /tunnels/{tunnelId}/plants/{plantId}/captures/{captureId} when tunnelId+plantId provided.
 */
export async function captureUploadAndProcess(params: {
  photoUri: string;

  tunnelId?: string | null;
  plantId?: string | null;

  robotId?: string | null;
  requestId?: string | null;

  rfid?: string | null;
  side?: string | null; // "A" | "B"
  positionLabel?: string | null; // A/B/C or MANUAL
  stopIndex?: number | null;
  rounds?: number | null;
  direction?: string | null; // FWD/BWD
}) {
  if (!INFER_URL) throw new Error("Missing EXPO_PUBLIC_INFER_URL in .env");

  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const tunnelId = params.tunnelId ?? null;
  const plantId = params.plantId ?? null;

  // ✅ requestId priority:
  // 1) use params.requestId if passed (robot provided)
  // 2) else if robotId exists, read from RTDB status
  // 3) else generate new
  let requestId = params.requestId ?? null;

  if (!requestId && params.robotId) {
    const fromRTDB = await readRobotRequestIdFromRTDB(params.robotId);
    if (fromRTDB) requestId = fromRTDB;
  }

  if (!requestId) requestId = makeRequestId();
  requestId = requestId.toString();

  // ✅ read ultrasonic using requestId (optional)
  const distanceCm = await waitUltrasonicDistanceCm(requestId);

  // ✅ compress BEFORE upload
  const compressedUri = await compressForUpload(params.photoUri);
  const blob = await uriToBlob(compressedUri);

  const basePath =
    tunnelId && plantId
      ? `tunnels/${tunnelId}/plants/${plantId}/captures`
      : `users/${user.uid}/captures`;

  // file name uses requestId for traceability
  const storagePath = `${basePath}/${requestId}.jpg`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  const imageUrl = await getDownloadURL(storageRef);

  // 2) Create Firestore capture doc FIRST
  const capRef = await addDoc(collection(db, "captures"), {
    ownerId: user.uid,
    status: "UPLOADED",
    imageUrl,
    storagePath,

    distanceCm: distanceCm ?? null,

    annotatedUrl: null,
    annotatedStoragePath: null,
    outputs: null,

    meta: {
      tunnelId,
      plantId,

      robotId: params.robotId ?? null,
      requestId,

      rfid: params.rfid ?? null,
      side: params.side ?? null,
      positionLabel: params.positionLabel ?? null,
      stopIndex: params.stopIndex ?? null,
      rounds: params.rounds ?? null,
      direction: params.direction ?? null,

      distanceCm: distanceCm ?? null,
    },

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const captureId = capRef.id;

  // mirror under plant
  if (tunnelId && plantId) {
    await setDoc(
      doc(db, "tunnels", tunnelId, "plants", plantId, "captures", captureId),
      {
        captureId,
        imageUrl,
        storagePath,
        status: "UPLOADED",

        distanceCm: distanceCm ?? null,

        meta: {
          robotId: params.robotId ?? null,
          requestId,

          rfid: params.rfid ?? null,
          side: params.side ?? null,
          positionLabel: params.positionLabel ?? null,
          stopIndex: params.stopIndex ?? null,
          rounds: params.rounds ?? null,
          direction: params.direction ?? null,

          distanceCm: distanceCm ?? null,
        },

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  // 3) Ask backend to process THIS captureId
  try {
    await updateDoc(doc(db, "captures", captureId), {
      status: "PROCESSING",
      updatedAt: serverTimestamp(),
    });

    if (tunnelId && plantId) {
      await updateDoc(doc(db, "tunnels", tunnelId, "plants", plantId, "captures", captureId), {
        status: "PROCESSING",
        updatedAt: serverTimestamp(),
      });
    }

    const res = await fetch(`${INFER_URL}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captureId }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Processing failed");
    }

    const payload = await res.json();
    return { captureId, imageUrl, storagePath, requestId, distanceCm, ...payload };
  } catch (e: any) {
    await updateDoc(doc(db, "captures", captureId), {
      status: "FAILED",
      error: e?.message ?? "Unknown error",
      updatedAt: serverTimestamp(),
    });

    if (tunnelId && plantId) {
      await updateDoc(doc(db, "tunnels", tunnelId, "plants", plantId, "captures", captureId), {
        status: "FAILED",
        error: e?.message ?? "Unknown error",
        updatedAt: serverTimestamp(),
      });
    }

    throw e;
  }
}