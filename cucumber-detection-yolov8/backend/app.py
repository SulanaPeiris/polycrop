from fastapi import FastAPI, UploadFile, File
from ultralytics import YOLO
import numpy as np
import cv2, os

app = FastAPI()
model = YOLO("../models/best.pt")

@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    img_bytes = await file.read()
    arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    result = model(img, conf=0.25)[0]

    # Save annotated image
    os.makedirs("../sample_outputs", exist_ok=True)
    annotated = result.plot()  # numpy array with boxes drawn
    out_path = "../sample_outputs/predicted.jpg"
    cv2.imwrite(out_path, annotated)

    detections = []
    for b in result.boxes:
        x1, y1, x2, y2 = b.xyxy[0].tolist()
        detections.append({
            "class": "cucumber",
            "confidence": float(b.conf[0]),
            "bbox": [x1, y1, x2, y2]
        })

    return {"count": len(detections), "detections": detections, "saved_image": out_path}
