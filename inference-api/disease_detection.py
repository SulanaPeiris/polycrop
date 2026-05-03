from typing import Dict, List

import cv2
import numpy as np

from detection_utils import clamp_box


CONF_DISEASE = 0.25
DISEASE_ALPHA = 0.45

# Kept for old mobile-app / Firestore output compatibility only.
# Pump decision does NOT depend on severity anymore.
DISEASE_SPRAY_THRESHOLD_PERCENT = 1.0

# Fixed spray time when a disease is detected.
# Change this value if you want the pump to run longer/shorter.
DETECTED_DISEASE_PUMP_DURATION_MS = 3000

PUMP_DURATION_MS_BY_LEVEL = {
    "LOW": 2000,
    "MEDIUM": 3000,
    "HIGH": 5000,
}

DISEASE_COLORS_BGR = {
    "downy_mildew": (0, 255, 255),
    "powdery_mildew": (255, 0, 255),
    "water_stress": (0, 165, 255),
    "unknown_disease": (0, 0, 255),
}

# Labels that must NOT start the sprayer.
NON_SPRAY_LABELS = {
    "",
    "healthy",
    "normal",
    "background",
    "bg",
    "leaf",
    "leaves",
    "cucumber",
    "fruit",
    "flower",
    "plant",
    "no_disease",
    "none",
}


def normalize_disease_name(name: str) -> str:
    """
    Normalize model class names so pump logic works even if labels contain
    spaces/capital letters.
    """
    return (
        str(name or "")
        .strip()
        .lower()
        .replace(" ", "_")
        .replace("-", "_")
        .replace("/", "_")
    )


def canonical_disease_name(name: str) -> str:
    """
    Convert model labels into names used by robot logic.

    This is intentionally flexible because YOLO class names may be:
      "downy", "Downy Mildew", "downy_mildew", "DM"
      "powdery", "Powdery Mildew", "powdery_mildew", "PM"
      "water stress", "water_stress"
    """
    n = normalize_disease_name(name)

    if n in NON_SPRAY_LABELS:
        return n

    # Downy mildew aliases
    if (
        "downy" in n
        or n in {"dm", "downy_mildew", "downymildew"}
        or "downy_mildew" in n
        or "downymildew" in n
    ):
        return "downy_mildew"

    # Powdery mildew aliases
    if (
        "powdery" in n
        or n in {"pm", "powdery_mildew", "powderymildew"}
        or "powdery_mildew" in n
        or "powderymildew" in n
    ):
        return "powdery_mildew"

    # Water stress aliases
    if (
        ("water" in n and "stress" in n)
        or "waterstress" in n
        or "water_stress" in n
    ):
        return "water_stress"

    # Any other non-healthy model disease label must still cause spraying.
    # It will use Pump 1 as the safe default because the robot must not return NO_SPRAY
    # when the disease model has detected a disease class.
    return n


def is_non_spray_label(name: str) -> bool:
    return normalize_disease_name(name) in NON_SPRAY_LABELS


def is_spray_disease(name: str) -> bool:
    """
    True means this label must make at least one spray pump turn ON.
    Water stress is alert-only, not spray.
    """
    n = canonical_disease_name(name)
    return bool(n and n != "water_stress" and not is_non_spray_label(n))


def get_severity_level(percent: float) -> str:
    """
    Kept only for displaying old severity fields in Firestore/mobile app.
    Pump decision no longer depends on this value.
    """
    p = float(percent or 0.0)

    if p >= 25.0:
        return "HIGH"

    if p >= 10.0:
        return "MEDIUM"

    if p > 0.0:
        return "LOW"

    return "NONE"


def get_pump_duration_ms(percent: float) -> int:
    """
    Old helper kept for compatibility. Not used by build_disease_action().
    """
    level = get_severity_level(percent)
    return PUMP_DURATION_MS_BY_LEVEL.get(level, 0)


def _ensure_disease_stat(disease_stats: Dict[str, dict], name: str):
    if name not in disease_stats:
        disease_stats[name] = {
            "detected": True,
            "affectedLeaves": 0,
            "totalSeverityPercent": 0.0,
            "maxSeverityPercent": 0.0,
            "avgSeverityPercent": 0.0,
            # Display only. Pump decision ignores severity.
            "severityLevel": "DETECTED",
        }


def build_disease_action(per_leaf: List[dict]) -> dict:
    """
    Convert detected disease names into robot action.

    Important rule:
      - Do NOT check severity percentage for pump decision.
      - If one disease spot/class is detected anywhere, spray must turn ON.

    Pump mapping:
      downy_mildew            -> Pump 1
      powdery_mildew          -> Pump 2
      unknown disease label   -> Pump 1, so decision never stays NO_SPRAY
      water_stress            -> mobile alert only
    """
    disease_stats: Dict[str, dict] = {}

    for leaf in per_leaf:
        detected_names = set()

        # Main detection source: disease class labels detected on this leaf/full image.
        for raw_name in leaf.get("diseases") or []:
            name = canonical_disease_name(raw_name)
            if name and not is_non_spray_label(name):
                detected_names.add(name)

        # Compatibility source: older outputs may only have severity map keys.
        raw_sev_map = leaf.get("severityByDiseasePercent") or {}
        sev_map = {}

        for raw_name, raw_percent in raw_sev_map.items():
            name = canonical_disease_name(raw_name)
            if name and not is_non_spray_label(name):
                detected_names.add(name)
                sev_map[name] = float(raw_percent or 0.0)

        for name in detected_names:
            _ensure_disease_stat(disease_stats, name)
            disease_stats[name]["affectedLeaves"] += 1

            # Saved only for UI/reference. It does NOT control pump decision.
            percent = float(sev_map.get(name, 0.0) or 0.0)
            disease_stats[name]["totalSeverityPercent"] += percent
            disease_stats[name]["maxSeverityPercent"] = max(
                disease_stats[name]["maxSeverityPercent"],
                percent,
            )

    for name, stat in disease_stats.items():
        affected = max(1, int(stat.get("affectedLeaves", 1)))
        total = float(stat.get("totalSeverityPercent", 0.0))
        max_sev = float(stat.get("maxSeverityPercent", 0.0))
        avg = total / affected

        stat["totalSeverityPercent"] = round(total, 2)
        stat["avgSeverityPercent"] = round(avg, 2)
        stat["maxSeverityPercent"] = round(max_sev, 2)
        stat["severityLevel"] = get_severity_level(max_sev) if max_sev > 0 else "DETECTED"

    # Disease existence alone controls pumps.
    downy_detected = bool(disease_stats.get("downy_mildew", {}).get("detected"))
    powdery_detected = bool(disease_stats.get("powdery_mildew", {}).get("detected"))
    water_stress_alert = bool(disease_stats.get("water_stress", {}).get("detected"))

    # Any real disease class other than water stress must spray.
    # If the label is not downy/powdery, use Pump 1 as a default instead of NO_SPRAY.
    other_spray_diseases = sorted(
        [
            name
            for name in disease_stats.keys()
            if is_spray_disease(name)
            and name not in {"downy_mildew", "powdery_mildew"}
        ]
    )
    unknown_spray_detected = len(other_spray_diseases) > 0

    pump1_ms = DETECTED_DISEASE_PUMP_DURATION_MS if (downy_detected or unknown_spray_detected) else 0
    pump2_ms = DETECTED_DISEASE_PUMP_DURATION_MS if powdery_detected else 0

    if pump1_ms > 0 and pump2_ms > 0:
        decision = "PUMP1_PUMP2"
        action_label = "Disease detected. Pump 1 and Pump 2 required."

    elif pump1_ms > 0:
        decision = "PUMP1"
        if downy_detected:
            action_label = "Downy mildew detected. Pump 1 required."
        else:
            action_label = (
                "Disease detected. Pump 1 required. "
                f"Detected class: {', '.join(other_spray_diseases)}."
            )

    elif pump2_ms > 0:
        decision = "PUMP2"
        action_label = "Powdery mildew detected. Pump 2 required."

    elif water_stress_alert:
        decision = "ALERT_ONLY"
        action_label = "Water stress detected. User alert required. No spray pump."

    else:
        decision = "NO_SPRAY"
        action_label = "No treatment required."

    if water_stress_alert and decision not in ["ALERT_ONLY", "NO_SPRAY"]:
        action_label += " Water stress also detected. User alert required."

    return {
        "captureDecision": decision,
        "sprayRecommended": bool(pump1_ms > 0 or pump2_ms > 0),
        "sprayDurationMs": int(max(pump1_ms, pump2_ms)),
        "pump1DurationMs": int(pump1_ms),
        "pump2DurationMs": int(pump2_ms),
        "waterStressAlert": bool(water_stress_alert),
        "diseaseSeverity": disease_stats,
        "actionLabel": action_label,
    }


def _get_model_class_name(names_obj, class_id: int) -> str:
    if hasattr(names_obj, "get"):
        return names_obj.get(int(class_id), f"class_{int(class_id)}")

    try:
        return names_obj[int(class_id)]
    except Exception:
        return f"class_{int(class_id)}"


def _add_detected_disease(
    leaf_disease_area_by_name: Dict[str, float],
    leaf_diseases: set,
    diseases_found: set,
    name: str,
    area_px: float,
):
    """
    Register disease immediately when YOLO detects it.
    Even one tiny detected spot/class must be enough for spray logic.
    """
    name = canonical_disease_name(name)

    if not name or is_non_spray_label(name):
        return

    # Use at least 1 pixel so tiny detections do not become 0% / ignored.
    safe_area_px = max(float(area_px or 0.0), 1.0)

    leaf_disease_area_by_name[name] = (
        leaf_disease_area_by_name.get(name, 0.0) + safe_area_px
    )
    leaf_diseases.add(name)
    diseases_found.add(name)


def _make_full_image_leaf(w: int, h: int) -> dict:
    return {
        "box": [0.0, 0.0, float(w), float(h)],
        "conf": 1.0,
        "source": "full_image_fallback",
    }


def run_disease_on_leaf_crops(model, pil_img, leaf_dets: List[dict], conf=CONF_DISEASE):
    w, h = pil_img.size
    overlay = np.zeros((h, w, 3), dtype=np.uint8)

    disease_names = model.model.names if hasattr(model, "model") else model.names

    diseases_found = set()
    per_leaf = []

    # IMPORTANT:
    # Earlier, disease detection ran only inside detected leaf boxes.
    # If the leaf detector missed the leaf, per_leaf stayed empty and the robot got NO_SPRAY.
    # This fallback makes the disease model run on the whole capture when no leaves are detected.
    regions = list(leaf_dets or [])
    if not regions:
        regions = [_make_full_image_leaf(w, h)]

    for i, d in enumerate(regions):
        x1, y1, x2, y2 = clamp_box(d["box"], w, h)

        leaf_w = max(1, x2 - x1)
        leaf_h = max(1, y2 - y1)
        leaf_area = float(leaf_w * leaf_h)

        crop = pil_img.crop((x1, y1, x2, y2))
        r = model.predict(crop, conf=conf, verbose=False)[0]

        leaf_disease_area_by_name: Dict[str, float] = {}
        leaf_diseases = set()

        has_boxes = r.boxes is not None and len(r.boxes) > 0
        has_masks = r.masks is not None and len(r.masks.data) > 0

        if has_boxes:
            cls_ids = r.boxes.cls.cpu().numpy().astype(int)

            # Segmentation model path: use masks when available.
            if has_masks:
                masks = r.masks.data.cpu().numpy()

                for j, class_id in enumerate(cls_ids):
                    raw_name = _get_model_class_name(disease_names, int(class_id))
                    name = canonical_disease_name(raw_name)

                    # If a mask exists for this detection, use it.
                    # If not, still register the class because the model detected it.
                    if j < len(masks):
                        m = masks[j] > 0.5
                        area_px = float(m.sum())

                        _add_detected_disease(
                            leaf_disease_area_by_name,
                            leaf_diseases,
                            diseases_found,
                            name,
                            area_px,
                        )

                        # Draw overlay only where mask pixels exist.
                        if m.any() and not is_non_spray_label(name):
                            m_resized = cv2.resize(
                                m.astype(np.uint8),
                                (leaf_w, leaf_h),
                                interpolation=cv2.INTER_NEAREST,
                            ).astype(bool)

                            color = DISEASE_COLORS_BGR.get(name, (0, 0, 255))
                            region = overlay[y1:y2, x1:x2]
                            region[m_resized] = color
                            overlay[y1:y2, x1:x2] = region
                    else:
                        _add_detected_disease(
                            leaf_disease_area_by_name,
                            leaf_diseases,
                            diseases_found,
                            name,
                            1.0,
                        )

            # Detection model fallback: if there are boxes but no masks,
            # still trigger spray from detected disease class.
            else:
                boxes = r.boxes.xyxy.cpu().numpy()

                for box, class_id in zip(boxes, cls_ids):
                    raw_name = _get_model_class_name(disease_names, int(class_id))
                    name = canonical_disease_name(raw_name)

                    bx1, by1, bx2, by2 = box
                    box_area = max(float((bx2 - bx1) * (by2 - by1)), 1.0)

                    _add_detected_disease(
                        leaf_disease_area_by_name,
                        leaf_diseases,
                        diseases_found,
                        name,
                        box_area,
                    )

                    # Optional fallback overlay rectangle for non-segmentation detections.
                    ox1 = x1 + max(0, min(int(bx1), leaf_w - 1))
                    oy1 = y1 + max(0, min(int(by1), leaf_h - 1))
                    ox2 = x1 + max(0, min(int(bx2), leaf_w))
                    oy2 = y1 + max(0, min(int(by2), leaf_h))

                    if ox2 > ox1 and oy2 > oy1 and not is_non_spray_label(name):
                        color = DISEASE_COLORS_BGR.get(name, (0, 0, 255))
                        overlay[oy1:oy2, ox1:ox2] = color

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
            "source": d.get("source", "leaf_crop"),
        })

    return per_leaf, overlay, diseases_found
