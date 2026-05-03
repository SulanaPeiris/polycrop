# ripe_detection.py

from typing import Optional, List

from detection_utils import safe_float, clamp_box


DEFAULT_BASE_DISTANCE_CM = 80.0

RIPE_MIN_LENGTH_CM = 15.0
RIPE_MAX_LENGTH_CM = 16.0
RIPE_MIN_DIAMETER_CM = 2.5
RIPE_MAX_DIAMETER_CM = 3.0


def load_camera_calibration(db, tunnel_id: Optional[str], meta: dict) -> dict:
    """
    Get camera calibration from capture meta OR tunnel doc.

    Expected shape:
      { baseDistanceCm: number, cmPerPxAtBaseDistance: number }
    """
    calib = (meta.get("cameraCalib") or {}) if isinstance(meta, dict) else {}

    if tunnel_id:
        try:
            t_snap = db.collection("tunnels").document(tunnel_id).get()
            if t_snap.exists:
                t = t_snap.to_dict() or {}
                t_calib = t.get("cameraCalib") or t.get("cameraCalibration") or {}

                if isinstance(t_calib, dict):
                    for k, v in t_calib.items():
                        calib.setdefault(k, v)

        except Exception:
            pass

    base_distance = safe_float(calib.get("baseDistanceCm"))
    cm_per_px = safe_float(calib.get("cmPerPxAtBaseDistance"))

    return {
        "baseDistanceCm": base_distance
        if base_distance is not None
        else DEFAULT_BASE_DISTANCE_CM,
        "cmPerPxAtBaseDistance": cm_per_px,
    }


def compute_cucumber_size_and_ripeness(
    cuc_dets: List[dict],
    img_w: int,
    img_h: int,
    distance_cm: Optional[float],
    calib: dict,
) -> dict:
    """
    Estimate size for every detected cucumber.

    A cucumber is ripe when:
    length = 15–16 cm
    diameter = 2.5–3.0 cm
    """
    if not cuc_dets:
        return {
            "available": False,
            "reason": "no_cucumber_detected",
            "distanceCm": distance_cm,
            "cucumbers": [],
            "ripeCount": 0,
            "hasRipe": False,
            "ripe": False,
        }

    cm_per_px_base = safe_float(calib.get("cmPerPxAtBaseDistance"))
    base_distance = float(calib.get("baseDistanceCm") or DEFAULT_BASE_DISTANCE_CM)

    result = {
        "available": True,
        "distanceCm": distance_cm,
        "calibration": {
            "baseDistanceCm": base_distance,
            "cmPerPxAtBaseDistance": cm_per_px_base,
        },
        "rules": {
            "minLengthCm": RIPE_MIN_LENGTH_CM,
            "maxLengthCm": RIPE_MAX_LENGTH_CM,
            "minDiameterCm": RIPE_MIN_DIAMETER_CM,
            "maxDiameterCm": RIPE_MAX_DIAMETER_CM,
        },
        "cucumbers": [],
        "ripeCount": 0,
        "hasRipe": False,
        "ripe": False,
    }

    if distance_cm is None:
        result["reason"] = "missing_distanceCm"

    if cm_per_px_base is None:
        result["reason"] = "missing_camera_calibration"

    cm_per_px = None

    if distance_cm is not None and cm_per_px_base is not None:
        cm_per_px = cm_per_px_base * (float(distance_cm) / base_distance)

    for index, det in enumerate(cuc_dets):
        x1, y1, x2, y2 = clamp_box(det["box"], img_w, img_h)

        px_w = max(1, x2 - x1)
        px_h = max(1, y2 - y1)

        length_px = float(max(px_w, px_h))
        diameter_px = float(min(px_w, px_h))

        cucumber_obj = {
            "index": index,
            "box": [int(x1), int(y1), int(x2), int(y2)],
            "conf": float(det.get("conf", 0.0) or 0.0),
            "pixel": {
                "lengthPx": length_px,
                "diameterPx": diameter_px,
                "bboxW": int(px_w),
                "bboxH": int(px_h),
            },
            "cm": None,
            "ripe": None,
        }

        if cm_per_px is not None:
            length_cm = length_px * cm_per_px
            diameter_cm = diameter_px * cm_per_px

            is_ripe = (
                RIPE_MIN_LENGTH_CM <= length_cm <= RIPE_MAX_LENGTH_CM
                and RIPE_MIN_DIAMETER_CM <= diameter_cm <= RIPE_MAX_DIAMETER_CM
            )

            cucumber_obj["cm"] = {
                "cmPerPx": round(cm_per_px, 6),
                "lengthCm": round(length_cm, 2),
                "diameterCm": round(diameter_cm, 2),
            }

            cucumber_obj["ripe"] = bool(is_ripe)

            if is_ripe:
                result["ripeCount"] += 1

        result["cucumbers"].append(cucumber_obj)

    result["hasRipe"] = result["ripeCount"] > 0
    result["ripe"] = result["hasRipe"]

    return result