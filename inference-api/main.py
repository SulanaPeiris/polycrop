from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import io
import urllib.parse
import uuid

import numpy as np
import cv2
from PIL import Image, ImageOps
from ultralytics import YOLO

import firebase_admin
from firebase_admin import credentials, firestore, storage

# ====== CONFIG ======
BUCKET_NAME = "polycrop.firebasestorage.app"

# ✅ per-model confidence thresholds (change as you want)
CONF_CUCUMBER = 0.35
CONF_LEAF = 0.25
CONF_FLOWER = 0.30

# ====== Firebase Admin init (guard for reload) ======
if not firebase_admin._apps:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred, {"storageBucket": BUCKET_NAME})

db = firestore.client()
bucket = storage.bucket()

app = FastAPI(title="PolyCrop Processor (YOLO + Annotated Upload)")

# ====== Load YOLO models ======
yolo_cucumber = YOLO("weights/best.pt")
yolo_leaf = YOLO("weights/cucumber_leaf_detection.pt")
yolo_flower = YOLO("weights/cucumber_flower_detection.pt")

class ProcessRequest(BaseModel):
    captureId: str

def run_yolo(model: YOLO, pil_img: Image.Image, conf=0.25):
    results = model.predict(pil_img, conf=conf, verbose=False)
    r0 = results[0]
    dets = []
    if r0.boxes is None:
        return dets

    boxes = r0.boxes.xyxy.cpu().numpy()
    scores = r0.boxes.conf.cpu().numpy()

    for (x1, y1, x2, y2), s in zip(boxes, scores):
        dets.append({
            "box": [float(x1), float(y1), float(x2), float(y2)],
            "conf": float(s),
        })
    return dets

def draw_boxes(pil_img: Image.Image, cuc, leaf, flower):
    img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    def draw(label, dets, color):
        for d in dets:
            x1, y1, x2, y2 = map(int, d["box"])
            conf = d.get("conf", 0)
            cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
            cv2.putText(
                img,
                f"{label} {conf:.2f}",
                (x1, max(18, y1 - 6)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                color,
                2,
            )

    draw("Cucumber", cuc, (0, 255, 0))
    draw("Leaf", leaf, (255, 255, 0))
    draw("Flower", flower, (255, 0, 255))

    ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to encode annotated image")
    return buf.tobytes()

def upload_with_permanent_url(path: str, jpg_bytes: bytes):
    token = str(uuid.uuid4())
    blob = bucket.blob(path)
    blob.metadata = {"firebaseStorageDownloadTokens": token}
    blob.upload_from_string(jpg_bytes, content_type="image/jpeg")

    encoded = urllib.parse.quote(path, safe="")
    url = f"https://firebasestorage.googleapis.com/v0/b/{BUCKET_NAME}/o/{encoded}?alt=media&token={token}"
    return path, url

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/process")
def process(req: ProcessRequest):
    cap_ref = db.collection("captures").document(req.captureId)
    snap = cap_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Capture not found")

    cap = snap.to_dict()
    storage_path = cap.get("storagePath")
    if not storage_path:
        raise HTTPException(status_code=400, detail="Capture missing storagePath")

    # 1) Download image bytes from Storage
    src_blob = bucket.blob(storage_path)
    img_bytes = src_blob.download_as_bytes()

    # ✅ Fix EXIF rotation and FORCE portrait if needed
    pil = Image.open(io.BytesIO(img_bytes))
    pil = ImageOps.exif_transpose(pil).convert("RGB")
    w, h = pil.size

    # ✅ enforce portrait always (so it never ends up landscape in Storage)
    if w > h:
        pil = pil.rotate(90, expand=True)  # rotate to portrait
        w, h = pil.size

    # 2) Run YOLO models with different confidences
    cuc = run_yolo(yolo_cucumber, pil, conf=CONF_CUCUMBER)
    leaf = run_yolo(yolo_leaf, pil, conf=CONF_LEAF)
    flower = run_yolo(yolo_flower, pil, conf=CONF_FLOWER)

    outputs = {
        "image": {"width": w, "height": h},
        "yolo": {"cucumber": cuc, "leaf": leaf, "flower": flower},
        "disease": [],
        "summary": {
            "diseases": [],
            "sprayRecommended": False,
            "counts": {"cucumber": len(cuc), "leaf": len(leaf), "flower": len(flower)},
        },
        "meta": cap.get("meta", {}),
        "thresholds": {
            "cucumber": CONF_CUCUMBER,
            "leaf": CONF_LEAF,
            "flower": CONF_FLOWER,
        }
    }

    # 3) Draw boxes and upload annotated image
    annotated_bytes = draw_boxes(pil, cuc, leaf, flower)
    annotated_path = storage_path.replace("/captures/", "/captures_annotated/")
    annotated_storage_path, annotated_url = upload_with_permanent_url(annotated_path, annotated_bytes)

    # 4) Update Firestore doc
    cap_ref.update({
        "status": "DONE",
        "outputs": outputs,
        "annotatedStoragePath": annotated_storage_path,
        "annotatedUrl": annotated_url,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })

    return {
        "captureId": req.captureId,
        "annotatedUrl": annotated_url,
        "annotatedStoragePath": annotated_storage_path,
        "outputs": outputs,
    }