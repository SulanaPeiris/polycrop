# detection_utils.py

import urllib.parse
import uuid
from typing import Optional, List, Dict, Any

import cv2
import numpy as np
from PIL import Image


def safe_float(x) -> Optional[float]:
    try:
        if x is None:
            return None
        return float(x)
    except Exception:
        return None


def run_yolo_boxes(model, pil_img: Image.Image, conf=0.25):
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


def upload_with_permanent_url(bucket, bucket_name: str, path: str, jpg_bytes: bytes):
    token = str(uuid.uuid4())

    blob = bucket.blob(path)
    blob.metadata = {"firebaseStorageDownloadTokens": token}
    blob.upload_from_string(jpg_bytes, content_type="image/jpeg")

    encoded = urllib.parse.quote(path, safe="")
    url = (
        f"https://firebasestorage.googleapis.com/v0/b/"
        f"{bucket_name}/o/{encoded}?alt=media&token={token}"
    )

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

    cv2.putText(
        img_bgr,
        "Disease Legend",
        (x0 + 10, y0 + 20),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (255, 255, 255),
        2,
    )

    y = y0 + title_h

    for item in legend_items:
        name = item["name"]
        color = item["color_bgr"]

        cv2.rectangle(img_bgr, (x0 + 10, y), (x0 + 30, y + 18), color, -1)
        cv2.rectangle(img_bgr, (x0 + 10, y), (x0 + 30, y + 18), (255, 255, 255), 1)

        cv2.putText(
            img_bgr,
            name.replace("_", " "),
            (x0 + 40, y + 14),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2,
        )

        y += row_h