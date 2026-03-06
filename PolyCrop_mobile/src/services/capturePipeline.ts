import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
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

export async function captureUploadAndProcess(params: {
  photoUri: string; // already normalized (vertical correct)
  tunnelId?: string | null;
  plantId?: string | null;
  position?: number | null;
  step?: number | null;
}) {
  if (!INFER_URL) throw new Error("Missing EXPO_PUBLIC_INFER_URL in .env");

  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  // 1) Upload ORIGINAL image to Firebase Storage
  const blob = await uriToBlob(params.photoUri);
  const storagePath = `users/${user.uid}/captures/${Date.now()}.jpg`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  const imageUrl = await getDownloadURL(storageRef);

  // 2) Create Firestore doc FIRST (so scans page has a record immediately)
  const capRef = await addDoc(collection(db, "captures"), {
    ownerId: user.uid,
    status: "UPLOADED",
    imageUrl,
    storagePath,

    // backend will fill these
    annotatedUrl: null,
    annotatedStoragePath: null,
    outputs: null,

    meta: {
      tunnelId: params.tunnelId ?? null,
      plantId: params.plantId ?? null,
      position: params.position ?? null,
      step: params.step ?? null,
    },

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const captureId = capRef.id;

  // 3) Ask backend to process THIS captureId
  try {
    await updateDoc(doc(db, "captures", captureId), {
      status: "PROCESSING",
      updatedAt: serverTimestamp(),
    });

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
    // payload: { captureId, annotatedUrl, outputs, ... }
    return { captureId, imageUrl, storagePath, ...payload };
  } catch (e: any) {
    await updateDoc(doc(db, "captures", captureId), {
      status: "FAILED",
      error: e?.message ?? "Unknown error",
      updatedAt: serverTimestamp(),
    });
    throw e;
  }
}