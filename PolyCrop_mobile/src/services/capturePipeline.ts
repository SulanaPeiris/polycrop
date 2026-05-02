import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../firebase/firebase";

const INFER_URL = process.env.EXPO_PUBLIC_INFER_URL;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 60000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

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

async function waitUltrasonicDistanceCm(requestId?: string | null, timeoutMs = 900): Promise<number | null> {
  // 1) Prefer a per-request doc if you later create it:
  // ultrasonicReadingsByRequest/{requestId} { distanceCm }
  const start = Date.now();

  if (requestId) {
    while (Date.now() - start < timeoutMs) {
      try {
        const snap = await getDoc(doc(db, "ultrasonicReadingsByRequest", requestId));
        if (snap.exists()) {
          const d: any = snap.data();
          if (typeof d?.distanceCm === "number") return d.distanceCm;
        }
      } catch {
        // ignore
      }
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  // 2) Fallback to latest always-updated doc:
  // ultrasonicReadings/reading_latest { distanceCm }
  try {
    const latest = await getDoc(doc(db, "ultrasonicReadings", "reading_latest"));
    if (latest.exists()) {
      const d: any = latest.data();
      if (typeof d?.distanceCm === "number") return d.distanceCm;
    }
  } catch {
    // ignore
  }

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

  console.log("[capturePipeline] start", { inferUrl: INFER_URL, tunnelId: params.tunnelId ?? null, plantId: params.plantId ?? null, user: user?.uid });

  const tunnelId = params.tunnelId ?? null;
  const plantId = params.plantId ?? null;

  // ✅ Ensure requestId exists (important for linking sensor readings)
  const requestId = (params.requestId ?? makeRequestId()).toString();
  console.log("[capturePipeline] requestId", requestId);

  // ✅ Read ultrasonic distance at capture time
  const distanceCm = await waitUltrasonicDistanceCm(requestId);
  console.log("[capturePipeline] distanceCm", distanceCm);

  // 1) Upload ORIGINAL image to Firebase Storage
  const blob = await uriToBlob(params.photoUri);

  const basePath =
    tunnelId && plantId
      ? `tunnels/${tunnelId}/plants/${plantId}/captures`
      : `users/${user.uid}/captures`;

  // file key: use requestId for traceability
  const storagePath = `${basePath}/${requestId}.jpg`;
  const storageRef = ref(storage, storagePath);

  console.log("[capturePipeline] uploading to storagePath", storagePath);
  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  const imageUrl = await getDownloadURL(storageRef);
  console.log("[capturePipeline] uploaded imageUrl", imageUrl);

  // 2) Create Firestore capture doc FIRST
  const capRef = await addDoc(collection(db, "captures"), {
    ownerId: user.uid,
    status: "UPLOADED",
    imageUrl,
    storagePath,

    // optional convenience field (still keep it in meta too)
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

      // ✅ main.py reads this
      distanceCm: distanceCm ?? null,
    },

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const captureId = capRef.id;
  console.log("[capturePipeline] created capture doc", captureId);

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

    console.log("[capturePipeline] calling backend process", `${INFER_URL}/process`, { captureId });
    const processUrl = `${INFER_URL}/process`;
    console.log("[capturePipeline] backend process request", { processUrl, captureId });
    const res = await fetchWithTimeout(processUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captureId }),
    }, 60000);

    if (!res.ok) {
      const text = await res.text();
      console.log("[capturePipeline] backend error response", res.status, text);
      throw new Error(text || "Processing failed");
    }

    const payload = await res.json();
    console.log("[capturePipeline] backend payload", payload);
    return { captureId, imageUrl, storagePath, requestId, distanceCm, ...payload };
  } catch (e: any) {
    console.log("[capturePipeline] processing failed", e?.message ?? e);
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