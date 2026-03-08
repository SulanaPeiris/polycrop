import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../firebase/firebase";

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
  positionLabel?: string | null; // A/B/C
  stopIndex?: number | null;
  rounds?: number | null;
  direction?: string | null; // FWD/BWD
}) {
  if (!INFER_URL) throw new Error("Missing EXPO_PUBLIC_INFER_URL in .env");

  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const tunnelId = params.tunnelId ?? null;
  const plantId = params.plantId ?? null;

  // 1) Upload ORIGINAL image to Firebase Storage
  const blob = await uriToBlob(params.photoUri);

  const basePath =
    tunnelId && plantId
      ? `tunnels/${tunnelId}/plants/${plantId}/captures`
      : `users/${user.uid}/captures`;

  const fileKey = params.requestId ? params.requestId : String(Date.now());
  const storagePath = `${basePath}/${fileKey}.jpg`;

  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  const imageUrl = await getDownloadURL(storageRef);

  // 2) Create Firestore doc FIRST
  const capRef = await addDoc(collection(db, "captures"), {
    ownerId: user.uid,
    status: "UPLOADED",
    imageUrl,
    storagePath,

    annotatedUrl: null,
    annotatedStoragePath: null,
    outputs: null,

    meta: {
      tunnelId,
      plantId,
      robotId: params.robotId ?? null,
      requestId: params.requestId ?? null,
      rfid: params.rfid ?? null,
      side: params.side ?? null,
      positionLabel: params.positionLabel ?? null,
      stopIndex: params.stopIndex ?? null,
      rounds: params.rounds ?? null,
      direction: params.direction ?? null,
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
        status: "UPLOADED",
        meta: {
          robotId: params.robotId ?? null,
          requestId: params.requestId ?? null,
          rfid: params.rfid ?? null,
          side: params.side ?? null,
          positionLabel: params.positionLabel ?? null,
          stopIndex: params.stopIndex ?? null,
          rounds: params.rounds ?? null,
          direction: params.direction ?? null,
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
    return { captureId, imageUrl, storagePath, ...payload };
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
