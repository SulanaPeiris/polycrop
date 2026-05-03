# main.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import io
from typing import Optional

import numpy as np
import cv2
from PIL import Image, ImageOps
from ultralytics import YOLO

import firebase_admin
from firebase_admin import credentials, firestore, storage
from pathlib import Path

from detection_utils import (
    safe_float,
    upload_with_permanent_url,
    draw_detection_boxes,
    add_legend,
)

from cucumber_detection import (
    CONF_CUCUMBER,
    detect_cucumbers,
    draw_cucumber_measurement_labels,
)

from leaf_detection import (
    CONF_LEAF,
    detect_leaves,
)

from flower_detection import (
    CONF_FLOWER,
    detect_flowers,
)

from ripe_detection import (
    load_camera_calibration,
    compute_cucumber_size_and_ripeness,
)

from disease_detection import (
    CONF_DISEASE,
    DISEASE_ALPHA,
    DISEASE_SPRAY_THRESHOLD_PERCENT,
    DISEASE_COLORS_BGR,
    run_disease_on_leaf_crops,
    build_disease_action,
)


# ====== CONFIG ======
BUCKET_NAME = "polycrop.firebasestorage.app"


# ====== Firebase Admin init ======
if not firebase_admin._apps:
    sa_path = Path(__file__).parent / "serviceAccountKey.json"

    if sa_path.exists():
        cred = credentials.Certificate(str(sa_path))
        firebase_admin.initialize_app(cred, {"storageBucket": BUCKET_NAME})
    else:
        firebase_admin.initialize_app(options={"storageBucket": BUCKET_NAME})


db = firestore.client()
bucket = storage.bucket()


app = FastAPI(title="PolyCrop Processor (YOLO + Disease Seg + Annotated Upload)")


# ====== Load YOLO models ======
yolo_cucumber = YOLO("weights/best.pt")
yolo_leaf = YOLO("weights/cucumber_leaf_detection.pt")
yolo_flower = YOLO("weights/cucumber_flower_detection.pt")
yolo_disease = YOLO("weights/disease_detection_v2.pt")


class ProcessRequest(BaseModel):
    captureId: str


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/process")
def process(req: ProcessRequest):
    cap_ref = db.collection("captures").document(req.captureId)

    try:
        print("[process] reading capture", req.captureId)
        snap = cap_ref.get(timeout=10)

    except Exception as e:
        print("[process] firestore read failed", repr(e))
        raise HTTPException(status_code=500, detail=f"Failed to read capture: {e}")

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

    distance_cm: Optional[float] = safe_float(meta.get("distanceCm"))

    try:
        src_blob = bucket.blob(storage_path)
        img_bytes = src_blob.download_as_bytes()

    except Exception as e:
        print("[process] storage download failed", repr(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to download capture image: {e}",
        )

    pil = Image.open(io.BytesIO(img_bytes))
    pil = ImageOps.exif_transpose(pil).convert("RGB")

    w, h = pil.size

    if w > h:
        pil = pil.rotate(90, expand=True)
        w, h = pil.size

    # ====== Separate detections ======
    cuc = detect_cucumbers(yolo_cucumber, pil, conf=CONF_CUCUMBER)
    leaf = detect_leaves(yolo_leaf, pil, conf=CONF_LEAF)
    flower = detect_flowers(yolo_flower, pil, conf=CONF_FLOWER)

    # ====== Ripe detection / cucumber measurement ======
    camera_calib = load_camera_calibration(db, tunnel_id, meta)

    ripeness = compute_cucumber_size_and_ripeness(
        cuc,
        w,
        h,
        distance_cm,
        camera_calib,
    )

    # ====== Disease detection on leaf crops ======
    per_leaf, disease_overlay, diseases_found = run_disease_on_leaf_crops(
        yolo_disease,
        pil,
        leaf,
        conf=CONF_DISEASE,
    )

    # ====== Annotated image generation ======
    img_bgr = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)

    blended = img_bgr.copy()

    if disease_overlay is not None:
        mask_any = disease_overlay.sum(axis=2) > 0

        if mask_any.any():
            blended_full = cv2.addWeighted(
                img_bgr,
                1.0 - DISEASE_ALPHA,
                disease_overlay,
                DISEASE_ALPHA,
                0,
            )
            blended[mask_any] = blended_full[mask_any]

    draw_detection_boxes(blended, cuc, (0, 255, 0))
    draw_detection_boxes(blended, leaf, (255, 255, 0))
    draw_detection_boxes(blended, flower, (255, 0, 255))

    draw_cucumber_measurement_labels(
        blended,
        ripeness.get("cucumbers", []),
    )

    legend_items = []
    disease_names_sorted = sorted(list(diseases_found))

    for name in disease_names_sorted:
        legend_items.append({
            "name": name,
            "color_bgr": DISEASE_COLORS_BGR.get(name, (0, 255, 0)),
        })

    add_legend(blended, legend_items)

    ok, buf = cv2.imencode(
        ".jpg",
        blended,
        [int(cv2.IMWRITE_JPEG_QUALITY), 90],
    )

    if not ok:
        raise HTTPException(status_code=500, detail="Failed to encode annotated image")

    annotated_bytes = buf.tobytes()

    annotated_path = storage_path.replace("/captures/", "/captures_annotated/")

    annotated_storage_path, annotated_url = upload_with_permanent_url(
        bucket,
        BUCKET_NAME,
        annotated_path,
        annotated_bytes,
    )

    # ====== Disease action / pump decision ======
    disease_action = build_disease_action(per_leaf)

    spray_recommended = disease_action["sprayRecommended"]
    decision = disease_action["captureDecision"]
    spray_duration_ms = disease_action["sprayDurationMs"]
    spray_pump1_ms = disease_action["pump1DurationMs"]
    spray_pump2_ms = disease_action["pump2DurationMs"]
    water_stress_alert = disease_action["waterStressAlert"]
    disease_severity = disease_action["diseaseSeverity"]
    action_label = disease_action["actionLabel"]

    # ====== Ripe cucumber summary from all detected cucumbers ======
    all_cucumbers = (
        ripeness.get("cucumbers", [])
        if isinstance(ripeness.get("cucumbers", []), list)
        else []
    )

    ripe_cucumbers = [c for c in all_cucumbers if c.get("ripe") is True]
    ripe_count = len(ripe_cucumbers)
    has_ripe = ripe_count > 0

    display_cucumber = (
        ripe_cucumbers[0]
        if ripe_cucumbers
        else (all_cucumbers[0] if all_cucumbers else None)
    )

    cm_obj = (
        display_cucumber.get("cm")
        if display_cucumber and isinstance(display_cucumber.get("cm"), dict)
        else None
    )

    cucumber_len_cm = cm_obj.get("lengthCm") if cm_obj else None
    cucumber_diam_cm = cm_obj.get("diameterCm") if cm_obj else None

    outputs = {
        "image": {
            "width": w,
            "height": h,
        },
        "yolo": {
            "cucumber": cuc,
            "leaf": leaf,
            "flower": flower,
        },
        "ripeness": ripeness,
        "disease": {
            "perLeaf": per_leaf,
            "legend": [
                {
                    "name": it["name"],
                    "colorBGR": list(it["color_bgr"]),
                }
                for it in legend_items
            ],
            "threshold": CONF_DISEASE,
        },
        "summary": {
            "diseases": disease_names_sorted,
            "sprayRecommended": spray_recommended,
            "spraySeverityThresholdPercent": DISEASE_SPRAY_THRESHOLD_PERCENT,
            "counts": {
                "cucumber": len(cuc),
                "leaf": len(leaf),
                "flower": len(flower),
            },
            "decision": decision,
            "captureDecision": decision,
            "sprayDurationMs": spray_duration_ms,
            "pump1DurationMs": spray_pump1_ms,
            "pump2DurationMs": spray_pump2_ms,
            "waterStressAlert": water_stress_alert,
            "diseaseSeverity": disease_severity,
            "actionLabel": action_label,
            "distanceCm": distance_cm,
            "ripe": has_ripe,
            "ripeCucumberCount": ripe_count,
            "ripeCucumbers": ripe_cucumbers,
            "allCucumbers": all_cucumbers,
            "cucumberMeasurements": all_cucumbers,
            "cucumberLengthCm": cucumber_len_cm,
            "cucumberDiameterCm": cucumber_diam_cm,
        },
        "meta": meta,
        "thresholds": {
            "cucumber": CONF_CUCUMBER,
            "leaf": CONF_LEAF,
            "flower": CONF_FLOWER,
            "disease": CONF_DISEASE,
        },
    }

    cap_ref.update({
        "status": "DONE",
        "outputs": outputs,
        "annotatedStoragePath": annotated_storage_path,
        "annotatedUrl": annotated_url,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })

    # ====== Mirror into plant ======
    if tunnel_id and plant_id:
        plant_ref = (
            db.collection("tunnels")
            .document(tunnel_id)
            .collection("plants")
            .document(plant_id)
        )

        plant_ref.set({
            "lastScanAt": firestore.SERVER_TIMESTAMP,
            "lastCaptureId": req.captureId,
            "lastAnnotatedUrl": annotated_url,
            "diseaseDetected": bool(disease_names_sorted),
            "lastDiseases": disease_names_sorted,
            "lastCounts": outputs["summary"]["counts"],
            "lastSprayRecommended": spray_recommended,
            "lastCaptureDecision": decision,
            "lastPump1DurationMs": spray_pump1_ms,
            "lastPump2DurationMs": spray_pump2_ms,
            "lastWaterStressAlert": water_stress_alert,
            "lastDiseaseSeverity": disease_severity,
            "lastActionLabel": action_label,
            "lastDistanceCm": distance_cm,
            "lastCucumberLengthCm": cucumber_len_cm,
            "lastCucumberDiameterCm": cucumber_diam_cm,
            "lastRipe": has_ripe,
            "lastRipeCucumberCount": ripe_count,
            "lastRipeCucumbers": ripe_cucumbers,
            "lastAllCucumbers": all_cucumbers,
            "lastCucumberMeasurements": all_cucumbers,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)

        plant_cap_ref = plant_ref.collection("captures").document(req.captureId)

        plant_cap_ref.set({
            "captureId": req.captureId,
            "status": "DONE",
            "imageUrl": cap.get("imageUrl"),
            "annotatedUrl": annotated_url,
            "outputs": outputs,
            "captureDecision": decision,
            "pump1DurationMs": spray_pump1_ms,
            "pump2DurationMs": spray_pump2_ms,
            "waterStressAlert": water_stress_alert,
            "diseaseSeverity": disease_severity,
            "actionLabel": action_label,
            "distanceCm": distance_cm,
            "ripe": has_ripe,
            "ripeCucumberCount": ripe_count,
            "ripeCucumbers": ripe_cucumbers,
            "allCucumbers": all_cucumbers,
            "cucumberMeasurements": all_cucumbers,
            "cucumberLengthCm": cucumber_len_cm,
            "cucumberDiameterCm": cucumber_diam_cm,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)

    # ====== Create water stress alert for mobile app ======
    owner_id = cap.get("ownerId")

    if owner_id and tunnel_id and plant_id and water_stress_alert:
        alert_ref = db.collection("alerts").document(f"{req.captureId}_water_stress")

        alert_ref.set({
            "ownerId": owner_id,
            "tunnelId": tunnel_id,
            "plantId": plant_id,
            "captureId": req.captureId,
            "type": "WATER_STRESS",
            "severity": "WARNING",
            "title": "Water Stress Detected",
            "description": (
                f"Water stress detected in plant {plant_id}. "
                "Please inspect irrigation or moisture condition."
            ),
            "diseaseSeverity": disease_severity.get("water_stress"),
            "read": False,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)

    # ====== Robot decision ======
    if robot_id and request_id:
        robot_ref = db.collection("robots").document(robot_id)

        robot_ref.set({
            "robotId": robot_id,
            "captureStatus": "DECIDED",
            "captureRequestId": request_id,
            "captureDecision": decision,
            "sprayDurationMs": spray_duration_ms,
            "sprayPump1Ms": spray_pump1_ms,
            "sprayPump2Ms": spray_pump2_ms,
            "waterStressAlert": water_stress_alert,
            "diseaseSeverity": disease_severity,
            "actionLabel": action_label,
            "distanceCm": distance_cm,
            "ripe": has_ripe,
            "ripeCucumberCount": ripe_count,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)

    return {
        "captureId": req.captureId,
        "annotatedUrl": annotated_url,
        "annotatedStoragePath": annotated_storage_path,
        "outputs": outputs,
        "decision": decision,
        "captureDecision": decision,
        "sprayDurationMs": spray_duration_ms,
        "sprayPump1Ms": spray_pump1_ms,
        "sprayPump2Ms": spray_pump2_ms,
        "waterStressAlert": water_stress_alert,
        "diseaseSeverity": disease_severity,
        "actionLabel": action_label,
    }