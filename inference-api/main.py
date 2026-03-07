from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import io
import urllib.parse
import uuid
from typing import Dict, List, Any, Optional

import numpy as np
import cv2
from PIL import Image, ImageOps
from ultralytics import YOLO

import firebase_admin
from firebase_admin import credentials, firestore, storage

# ====== CONFIG ======
BUCKET_NAME = "polycrop.firebasestorage.app"

# Per-model thresholds
CONF_CUCUMBER = 0.35
CONF_LEAF = 0.25
CONF_FLOWER = 0.30
CONF_DISEASE = 0.25  # disease seg model

# Overlay alpha (0..1)
DISEASE_ALPHA = 0.45

# Disease class colors (BGR for OpenCV)
DISEASE_COLORS_BGR = {
    "downy_mildew": (0, 255, 255),
    "powdery_mildew": (255, 0, 255),
    "water_stress": (0, 165, 255),
}

# ====== Firebase Admin init ======
if not firebase_admin._apps:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred, {"storageBucket": BUCKET_NAME})

db = firestore.client()
bucket = storage.bucket()

app = FastAPI(title="PolyCrop Processor (YOLO + Disease Seg + Robot Decision)")


# ====== Load YOLO models ======
yolo_cucumber = YOLO("weights/best.pt")
yolo_leaf = YOLO("weights/cucumber_leaf_detection.pt")
yolo_flower = YOLO("weights/cucumber_flower_detection.pt")
yolo_disease = YOLO("weights/disease_detection_v2.pt")  # YOLOv8-seg


class ProcessRequest(BaseModel):
    captureId: str


def run_yolo_boxes(model: YOLO, pil_img: Image.Image, conf=0.25):
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


def clamp_box(box, w, h):
    x1, y1, x2, y2 = box
    x1 = max(0, min(int(x1), w - 1))
    y1 = max(0, min(int(y1), h - 1))
    x2 = max(0, min(int(x2), w))
    y2 = max(0, min(int(y2), h))
    if x2 <= x1:
        x2 = min(w, x1 + 1)
    if y2 <= y1:
        y2 = min(h, y1 + 1)
    return x1, y1, x2, y2


def upload_with_permanent_url(path: str, jpg_bytes: bytes):
    token = str(uuid.uuid4())
    blob = bucket.blob(path)
    blob.metadata = {"firebaseStorageDownloadTokens": token}
    blob.upload_from_string(jpg_bytes, content_type="image/jpeg")

    encoded = urllib.parse.quote(path, safe="")
    url = f"https://firebasestorage.googleapis.com/v0/b/{BUCKET_NAME}/o/{encoded}?alt=media&token={token}"
    return path, url


def draw_detection_boxes(img_bgr, dets, color_bgr, thickness=2):
    for d in dets:
        x1, y1, x2, y2 = map(int, d["box"])
        cv2.rectangle(img_bgr, (x1, y1), (x2, y2), color_bgr, thickness)


def add_legend(img_bgr, legend_items: List[Dict[str, Any]]):
    if not legend_items:
        return

    pad = 12
    box_w = 260
    row_h = 26
    title_h = 28
    box_h = title_h + row_h * len(legend_items) + pad

    x0, y0 = 16, 16
    x1, y1 = x0 + box_w, y0 + box_h

    cv2.rectangle(img_bgr, (x0, y0), (x1, y1), (0, 0, 0), -1)
    cv2.rectangle(img_bgr, (x0, y0), (x1, y1), (255, 255, 255), 1)

    cv2.putText(img_bgr, "Disease Legend", (x0 + 10, y0 + 20),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

    y = y0 + title_h
    for item in legend_items:
        name = item["name"]
        color = item["color_bgr"]

        cv2.rectangle(img_bgr, (x0 + 10, y), (x0 + 30, y + 18), color, -1)
        cv2.rectangle(img_bgr, (x0 + 10, y), (x0 + 30, y + 18), (255, 255, 255), 1)

        cv2.putText(img_bgr, name.replace("_", " "), (x0 + 40, y + 14),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
        y += row_h


def run_disease_on_leaf_crops(pil_img: Image.Image, leaf_dets: List[dict], conf=0.25):
    w, h = pil_img.size
    overlay = np.zeros((h, w, 3), dtype=np.uint8)

    disease_names = yolo_disease.model.names if hasattr(yolo_disease, "model") else yolo_disease.names

    diseases_found = set()
    per_leaf = []

    for i, d in enumerate(leaf_dets):
        x1, y1, x2, y2 = clamp_box(d["box"], w, h)
        leaf_w = max(1, x2 - x1)
        leaf_h = max(1, y2 - y1)
        leaf_area = float(leaf_w * leaf_h)

        crop = pil_img.crop((x1, y1, x2, y2))

        r = yolo_disease.predict(crop, conf=conf, verbose=False)[0]

        leaf_disease_area_by_name: Dict[str, float] = {}
        leaf_diseases = set()

        if r.masks is not None and r.boxes is not None and len(r.masks.data) > 0:
            masks = r.masks.data.cpu().numpy()
            cls_ids = r.boxes.cls.cpu().numpy().astype(int)

            for j in range(len(masks)):
                name = disease_names.get(int(cls_ids[j]), f"class_{int(cls_ids[j])}")
                m = masks[j] > 0.5
                area_px = float(m.sum())
                if area_px < 10:
                    continue

                leaf_disease_area_by_name[name] = leaf_disease_area_by_name.get(name, 0.0) + area_px
                leaf_diseases.add(name)
                diseases_found.add(name)

                m_resized = cv2.resize(m.astype(np.uint8), (leaf_w, leaf_h), interpolation=cv2.INTER_NEAREST).astype(bool)

                color = DISEASE_COLORS_BGR.get(name, (0, 255, 0))
                region = overlay[y1:y2, x1:x2]
                region[m_resized] = color
                overlay[y1:y2, x1:x2] = region

        severity_by_name = {}
        total_disease_px = 0.0
        for name, area_px in leaf_disease_area_by_name.items():
            sev = (area_px / leaf_area) * 100.0
            severity_by_name[name] = round(sev, 2)
            total_disease_px += area_px

        total_sev = round((total_disease_px / leaf_area) * 100.0, 2)

        per_leaf.append({
            "leafIndex": i,
            "box": [x1, y1, x2, y2],
            "leafAreaPx": int(leaf_area),
            "diseases": sorted(list(leaf_diseases)),
            "severityByDiseasePercent": severity_by_name,
            "totalSeverityPercent": total_sev,
        })

    return per_leaf, overlay, diseases_found


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/process")
def process(req: ProcessRequest):
    cap_ref = db.collection("captures").document(req.captureId)
    snap = cap_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Capture not found")

    cap = snap.to_dict() or {}
    storage_path = cap.get("storagePath")
    if not storage_path:
        raise HTTPException(status_code=400, detail="Capture missing storagePath")

    meta = cap.get("meta") or {}
    tunnel_id: Optional[str] = meta.get("tunnelId")
    plant_id: Optional[str] = meta.get("plantId")
    robot_id: Optional[str] = meta.get("robotId")
    request_id: Optional[str] = meta.get("requestId")

    # 1) Download original image bytes from Storage
    src_blob = bucket.blob(storage_path)
    img_bytes = src_blob.download_as_bytes()

    pil = Image.open(io.BytesIO(img_bytes))
    pil = ImageOps.exif_transpose(pil).convert("RGB")
    w, h = pil.size
    if w > h:
        pil = pil.rotate(90, expand=True)
        w, h = pil.size

    # 2) Run object detectors
    cuc = run_yolo_boxes(yolo_cucumber, pil, conf=CONF_CUCUMBER)
    leaf = run_yolo_boxes(yolo_leaf, pil, conf=CONF_LEAF)
    flower = run_yolo_boxes(yolo_flower, pil, conf=CONF_FLOWER)

    # 3) Disease segmentation
    per_leaf, disease_overlay, diseases_found = run_disease_on_leaf_crops(pil, leaf, conf=CONF_DISEASE)

    # 4) Compose annotated image
    img_bgr = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)

    # ✅ SAFE BLEND (no crash when mask is empty)
    blended = img_bgr.copy()
    if disease_overlay is not None:
        mask_any = disease_overlay.sum(axis=2) > 0
        if mask_any.any():
            blended_full = cv2.addWeighted(
                img_bgr, 1.0 - DISEASE_ALPHA,
                disease_overlay, DISEASE_ALPHA,
                0
            )
            blended[mask_any] = blended_full[mask_any]

    draw_detection_boxes(blended, cuc, (0, 255, 0))
    draw_detection_boxes(blended, leaf, (255, 255, 0))
    draw_detection_boxes(blended, flower, (255, 0, 255))

    legend_items = []
    disease_names_sorted = sorted(list(diseases_found))
    for name in disease_names_sorted:
        legend_items.append({
            "name": name,
            "color_bgr": DISEASE_COLORS_BGR.get(name, (0, 255, 0))
        })
    add_legend(blended, legend_items)

    ok, buf = cv2.imencode(".jpg", blended, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to encode annotated image")
    annotated_bytes = buf.tobytes()

    annotated_path = storage_path.replace("/captures/", "/captures_annotated/")
    annotated_storage_path, annotated_url = upload_with_permanent_url(annotated_path, annotated_bytes)

    # 5) Build outputs + spray decision
    SPRAY_SEVERITY_THRESHOLD = 3.0
    spray_recommended = any((x.get("totalSeverityPercent", 0.0) >= SPRAY_SEVERITY_THRESHOLD) for x in per_leaf)

    decision = "SPRAY" if spray_recommended else "NO_SPRAY"
    spray_duration_ms = 3000 if spray_recommended else 0  # tune

    outputs = {
        "image": {"width": w, "height": h},
        "yolo": {"cucumber": cuc, "leaf": leaf, "flower": flower},
        "disease": {
            "perLeaf": per_leaf,
            "legend": [{ "name": it["name"], "colorBGR": list(it["color_bgr"]) } for it in legend_items],
            "threshold": CONF_DISEASE
        },
        "summary": {
            "diseases": disease_names_sorted,
            "sprayRecommended": spray_recommended,
            "spraySeverityThresholdPercent": SPRAY_SEVERITY_THRESHOLD,
            "counts": {"cucumber": len(cuc), "leaf": len(leaf), "flower": len(flower)},
            "decision": decision,
            "sprayDurationMs": spray_duration_ms,
        },
        "meta": meta,
        "thresholds": {
            "cucumber": CONF_CUCUMBER,
            "leaf": CONF_LEAF,
            "flower": CONF_FLOWER,
            "disease": CONF_DISEASE,
        }
    }

    # 6) Update Firestore capture doc
    cap_ref.update({
        "status": "DONE",
        "outputs": outputs,
        "annotatedStoragePath": annotated_storage_path,
        "annotatedUrl": annotated_url,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })

    # 7) Mirror into plant + update plant summary
    if tunnel_id and plant_id:
        plant_ref = db.collection("tunnels").document(tunnel_id).collection("plants").document(plant_id)
        plant_ref.set({
            "lastScanAt": firestore.SERVER_TIMESTAMP,
            "lastCaptureId": req.captureId,
            "lastAnnotatedUrl": annotated_url,
            "diseaseDetected": spray_recommended,  # ✅ better signal
            "lastDiseases": disease_names_sorted,
            "lastCounts": outputs["summary"]["counts"],
            "lastSprayRecommended": spray_recommended,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)

        # mirror capture under plant subcollection (if exists, merge)
        plant_cap_ref = plant_ref.collection("captures").document(req.captureId)
        plant_cap_ref.set({
            "captureId": req.captureId,
            "status": "DONE",
            "imageUrl": cap.get("imageUrl"),
            "annotatedUrl": annotated_url,
            "outputs": outputs,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)

    # 8) Update robot decision so ESP32 can continue
    if robot_id and request_id:
        robot_ref = db.collection("robots").document(robot_id)

        robot_ref.set({
            "robotId": robot_id,
            "captureStatus": "DECIDED",
            "captureRequestId": request_id,
            "captureDecision": decision,
            "sprayDurationMs": spray_duration_ms,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)

    return {
        "captureId": req.captureId,
        "annotatedUrl": annotated_url,
        "annotatedStoragePath": annotated_storage_path,
        "outputs": outputs,
        "decision": decision,
        "sprayDurationMs": spray_duration_ms,
    }