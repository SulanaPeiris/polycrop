import io
import os
from typing import List, Dict, Any

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse
from ultralytics import YOLO

# ----------------------------
# CONFIG
# ----------------------------
MODEL_PATH = r"C:\Users\dinil\OneDrive\Documents\Github\polycrop\cucumber_flower_detection\ml_models\cucumber_flower_detection.pt"
CONF_THRESHOLD = 0.25

# ----------------------------
# LOAD MODEL ON STARTUP
# ----------------------------
app = FastAPI(title="YOLO Prediction API")

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"Model file not found at: {MODEL_PATH}")

model = YOLO(MODEL_PATH)
names = model.names  # class id -> name


# ----------------------------
# HELPERS
# ----------------------------
def read_imagefile_to_bgr(image_bytes: bytes) -> np.ndarray:
    """Read uploaded image bytes -> OpenCV BGR image"""
    img_array = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image file.")
    return img


def draw_detections(image_bgr: np.ndarray, detections: List[Dict[str, Any]]) -> np.ndarray:
    """Draw bounding boxes + labels on the image"""
    img = image_bgr.copy()

    for det in detections:
        x1, y1, x2, y2 = det["box"]
        conf = det["confidence"]
        cls_name = det["class_name"]

        # rectangle
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)

        # label text
        label = f"{cls_name} {conf:.2f}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)

        # filled label bg
        cv2.rectangle(img, (x1, y1 - th - 8), (x1 + tw + 6, y1), (0, 255, 0), -1)
        cv2.putText(img, label, (x1 + 3, y1 - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    return img


def bgr_to_jpeg_bytes(image_bgr: np.ndarray) -> bytes:
    """Convert OpenCV BGR -> JPEG bytes"""
    ok, buf = cv2.imencode(".jpg", image_bgr)
    if not ok:
        raise ValueError("Could not encode image.")
    return buf.tobytes()


# ----------------------------
# ROUTES
# ----------------------------
@app.get("/")
def home():
    return {"status": "ok", "message": "Go to /docs to test the API"}


@app.post("/predict-json")
async def predict_json(file: UploadFile = File(...)):
    """
    Upload ONE image and get detections as JSON.
    """
    image_bytes = await file.read()
    img_bgr = read_imagefile_to_bgr(image_bytes)

    results = model.predict(img_bgr, conf=CONF_THRESHOLD, verbose=False)
    r = results[0]

    detections = []
    if r.boxes is not None and len(r.boxes) > 0:
        boxes = r.boxes.xyxy.cpu().numpy().astype(int)
        confs = r.boxes.conf.cpu().numpy()
        clss = r.boxes.cls.cpu().numpy().astype(int)

        for box, conf, cls_id in zip(boxes, confs, clss):
            x1, y1, x2, y2 = box.tolist()
            detections.append({
                "class_id": int(cls_id),
                "class_name": names[int(cls_id)],
                "confidence": float(conf),
                "box": [int(x1), int(y1), int(x2), int(y2)]
            })

    return JSONResponse({"detections": detections})


@app.post("/predict-image")
async def predict_image(file: UploadFile = File(...)):
    """
    Upload ONE image and get back the predicted image (with boxes + confidence).
    """
    image_bytes = await file.read()
    img_bgr = read_imagefile_to_bgr(image_bytes)

    results = model.predict(img_bgr, conf=CONF_THRESHOLD, verbose=False)
    r = results[0]

    detections = []
    if r.boxes is not None and len(r.boxes) > 0:
        boxes = r.boxes.xyxy.cpu().numpy().astype(int)
        confs = r.boxes.conf.cpu().numpy()
        clss = r.boxes.cls.cpu().numpy().astype(int)

        for box, conf, cls_id in zip(boxes, confs, clss):
            x1, y1, x2, y2 = box.tolist()
            detections.append({
                "class_id": int(cls_id),
                "class_name": names[int(cls_id)],
                "confidence": float(conf),
                "box": [int(x1), int(y1), int(x2), int(y2)]
            })

    # draw boxes
    annotated = draw_detections(img_bgr, detections)

    # return as image
    jpeg_bytes = bgr_to_jpeg_bytes(annotated)
    return StreamingResponse(io.BytesIO(jpeg_bytes), media_type="image/jpeg")