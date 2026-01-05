## Cucumber Leaf Detection API

FastAPI wrapper around an Ultralytics YOLO model for cucumber leaf detection. Upload an image, get JSON detections or an annotated image back.

### What's included
- `app/main.py` FastAPI app that loads `model/cucumber_leaf_detection.pt`
- Endpoints for JSON detections and annotated image streaming
- Example model weights (place at `model/cucumber_leaf_detection.pt`)

### Quickstart
1) Python 3.10+ recommended. Create and activate an environment (example):
	- `python -m venv .venv`
	- Windows: `.venv\Scripts\activate`

2) Install dependencies:
	- `pip install -r requirements.txt`

3) Point `MODEL_PATH` in `app/main.py` to your weight file if you move it.

4) Run the API:
	- `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`

5) Open Swagger UI: http://127.0.0.1:8000/docs

### Endpoints
- GET `/` — health check
- POST `/predict-json` — form-data `file` (image); returns detections with `class_id`, `class_name`, `confidence`, `box` `[x1, y1, x2, y2]`
- POST `/predict-image` — form-data `file` (image); returns annotated JPEG

### Example requests
JSON detections:
```bash
curl -X POST "http://127.0.0.1:8000/predict-json" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@path/to/image.jpg"
```

Annotated image saved to disk:
```bash
curl -X POST "http://127.0.0.1:8000/predict-image" \
  -H "accept: image/jpeg" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@path/to/image.jpg" \
  --output annotated.jpg
```

### Configuration notes
- Confidence threshold is set in `app/main.py` via `CONF_THRESHOLD` (default 0.25).
- Model path defaults to `model/cucumber_leaf_detection.pt`; change `MODEL_PATH` if you relocate the weights.
- Running on GPU requires a CUDA-enabled PyTorch install; adjust your environment as needed.

### Repo structure
- `app/` — FastAPI app entrypoint
- `model/` — YOLO weights
- `outputs/` — optional outputs or artifacts
- `requirements.txt` — Python dependencies
