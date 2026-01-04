from fastapi import FastAPI, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from PIL import Image
import io
import os
import time
from pathlib import Path
import cv2
import torch

from app.model_loader import load_faster_rcnn
from app.utils import pil_to_tensor, draw_boxes_opencv


app = FastAPI(title="Cucumber Flower Detection API (Faster R-CNN)")

# -------------------------
# Paths (ABSOLUTE + stable)
# -------------------------
BASE_DIR = Path(__file__).resolve().parents[1]     # project root (cucumber-api/)
MODEL_PATH = BASE_DIR / "models" / "fasterrcnn_roboflow.pth"
OUTPUT_DIR = BASE_DIR / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# -------------------------
# Load model once
# -------------------------
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = load_faster_rcnn(str(MODEL_PATH), DEVICE)

@app.get("/")
def root():
    return {
        "status": "ok",
        "device": str(DEVICE),
        "model_path": str(MODEL_PATH),
        "outputs_dir": str(OUTPUT_DIR)
    }

@app.post("/detect")
async def detect(
    file: UploadFile = File(...),
    conf: float = Query(0.9, ge=0.0, le=1.0),
    return_image: bool = Query(False, description="If true, returns annotated image instead of JSON"),
    save_image: bool = Query(True, description="If true, saves annotated image to /outputs")
):
    # 1) Read image
    img_bytes = await file.read()
    pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

    # 2) Inference
    tensor = pil_to_tensor(pil_img).to(DEVICE)

    with torch.no_grad():
        pred = model([tensor])[0]

    boxes = pred["boxes"].detach().cpu().tolist()
    scores = pred["scores"].detach().cpu().tolist()

    detections = []
    for box, score in zip(boxes, scores):
        if score < conf:
            continue
        x1, y1, x2, y2 = box
        detections.append({
            "class": "Cucumber Flower",
            "confidence": float(score),
            "bbox": [float(x1), float(y1), float(x2), float(y2)]
        })

    # 3) Always create annotated image (so we can save it even if return_image=False)
    annotated_bgr = draw_boxes_opencv(pil_img, detections)

    # 4) Save annotated image if requested (ALWAYS, not only when return_image=True)
    saved_filename = None
    saved_path = None

    if save_image:
        ts = int(time.time() * 1000)
        saved_filename = f"pred_{ts}.jpg"
        saved_path = str(OUTPUT_DIR / saved_filename)

        ok = cv2.imwrite(saved_path, annotated_bgr)
        if not ok:
            return {"error": "cv2.imwrite failed", "saved_path": saved_path}

        print("✅ Saved output image to:", saved_path)

    # 5) If return_image=true, stream the annotated image back
    if return_image:
        ok, buffer = cv2.imencode(".jpg", annotated_bgr)
        if not ok:
            return {"error": "Failed to encode annotated image"}

        return StreamingResponse(
            io.BytesIO(buffer.tobytes()),
            media_type="image/jpeg",
            headers={
                "X-Saved-Filename": saved_filename or "",
                "X-Saved-Path": saved_path or ""
            }
        )

    # 6) Otherwise return JSON (and include where it saved)
    return {
        "count": len(detections),
        "detections": detections,
        "saved_filename": saved_filename,
        "saved_path": saved_path
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
