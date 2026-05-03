# disease_detection.py

from typing import Dict, List, Any

import cv2
import numpy as np

from detection_utils import clamp_box


CONF_DISEASE = 0.25
DISEASE_ALPHA = 0.45

DISEASE_SPRAY_THRESHOLD_PERCENT = 1.0

PUMP_DURATION_MS_BY_LEVEL = {
    "LOW": 2000,
    "MEDIUM": 3000,
    "HIGH": 5000,
}

DISEASE_COLORS_BGR = {
    "downy_mildew": (0, 255, 255),
    "powdery_mildew": (255, 0, 255),
    "water_stress": (0, 165, 255),
}


def normalize_disease_name(name: str) -> str:
    """
    Normalize model class names so pump logic works even if labels contain
    spaces/capital letters.
    """
    return str(name or "").strip().lower().replace(" ", "_").replace("-", "_")


def get_severity_level(percent: float) -> str:
    p = float(percent or 0.0)

    if p >= 25.0:
        return "HIGH"

    if p >= 10.0:
        return "MEDIUM"

    if p >= DISEASE_SPRAY_THRESHOLD_PERCENT:
        return "LOW"

    return "NONE"


def get_pump_duration_ms(percent: float) -> int:
    level = get_severity_level(percent)
    return PUMP_DURATION_MS_BY_LEVEL.get(level, 0)


def build_disease_action(per_leaf: List[dict]) -> dict:
    """
    Convert disease severity into robot action.

    Rules:
      downy_mildew   -> Pump 1
      powdery_mildew -> Pump 2
      water_stress   -> mobile alert only
    """
    disease_stats: Dict[str, dict] = {}

    for leaf in per_leaf:
        sev_map = leaf.get("severityByDiseasePercent") or {}

        for raw_name, raw_percent in sev_map.items():
            name = normalize_disease_name(raw_name)
            percent = float(raw_percent or 0.0)

            if name not in disease_stats:
                disease_stats[name] = {
                    "detected": True,
                    "affectedLeaves": 0,
                    "totalSeverityPercent": 0.0,
                    "maxSeverityPercent": 0.0,
                    "avgSeverityPercent": 0.0,
                    "severityLevel": "NONE",
                }

            disease_stats[name]["affectedLeaves"] += 1
            disease_stats[name]["totalSeverityPercent"] += percent
            disease_stats[name]["maxSeverityPercent"] = max(
                disease_stats[name]["maxSeverityPercent"],
                percent,
            )

    for name, stat in disease_stats.items():
        affected = max(1, int(stat.get("affectedLeaves", 1)))
        avg = float(stat.get("totalSeverityPercent", 0.0)) / affected
        max_sev = float(stat.get("maxSeverityPercent", 0.0))

        stat["totalSeverityPercent"] = round(
            float(stat.get("totalSeverityPercent", 0.0)),
            2,
        )
        stat["avgSeverityPercent"] = round(avg, 2)
        stat["maxSeverityPercent"] = round(max_sev, 2)
        stat["severityLevel"] = get_severity_level(max_sev)

    downy = disease_stats.get("downy_mildew")
    powdery = disease_stats.get("powdery_mildew")
    water = disease_stats.get("water_stress")

    downy_sev = float(downy.get("maxSeverityPercent", 0.0)) if downy else 0.0
    powdery_sev = float(powdery.get("maxSeverityPercent", 0.0)) if powdery else 0.0
    water_sev = float(water.get("maxSeverityPercent", 0.0)) if water else 0.0

    pump1_ms = (
        get_pump_duration_ms(downy_sev)
        if downy_sev >= DISEASE_SPRAY_THRESHOLD_PERCENT
        else 0
    )
    pump2_ms = (
        get_pump_duration_ms(powdery_sev)
        if powdery_sev >= DISEASE_SPRAY_THRESHOLD_PERCENT
        else 0
    )
    water_stress_alert = water_sev >= DISEASE_SPRAY_THRESHOLD_PERCENT

    if pump1_ms > 0 and pump2_ms > 0:
        decision = "PUMP1_PUMP2"
        action_label = (
            "Downy mildew and powdery mildew detected. "
            "Pump 1 and Pump 2 required."
        )

    elif pump1_ms > 0:
        decision = "PUMP1"
        action_label = "Downy mildew detected. Pump 1 required."

    elif pump2_ms > 0:
        decision = "PUMP2"
        action_label = "Powdery mildew detected. Pump 2 required."

    elif water_stress_alert:
        decision = "ALERT_ONLY"
        action_label = "Water stress detected. User alert required. No spray pump."

    else:
        decision = "NO_SPRAY"
        action_label = "No treatment required."

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


def run_disease_on_leaf_crops(model, pil_img, leaf_dets: List[dict], conf=CONF_DISEASE):
    w, h = pil_img.size
    overlay = np.zeros((h, w, 3), dtype=np.uint8)

    disease_names = model.model.names if hasattr(model, "model") else model.names

    diseases_found = set()
    per_leaf = []

    for i, d in enumerate(leaf_dets):
        x1, y1, x2, y2 = clamp_box(d["box"], w, h)

        leaf_w = max(1, x2 - x1)
        leaf_h = max(1, y2 - y1)
        leaf_area = float(leaf_w * leaf_h)

        crop = pil_img.crop((x1, y1, x2, y2))
        r = model.predict(crop, conf=conf, verbose=False)[0]

        leaf_disease_area_by_name: Dict[str, float] = {}
        leaf_diseases = set()

        if r.masks is not None and r.boxes is not None and len(r.masks.data) > 0:
            masks = r.masks.data.cpu().numpy()
            cls_ids = r.boxes.cls.cpu().numpy().astype(int)

            for j in range(len(masks)):
                name = _get_model_class_name(disease_names, int(cls_ids[j]))

                m = masks[j] > 0.5
                area_px = float(m.sum())

                if area_px < 10:
                    continue

                leaf_disease_area_by_name[name] = (
                    leaf_disease_area_by_name.get(name, 0.0) + area_px
                )
                leaf_diseases.add(name)
                diseases_found.add(name)

                m_resized = cv2.resize(
                    m.astype(np.uint8),
                    (leaf_w, leaf_h),
                    interpolation=cv2.INTER_NEAREST,
                ).astype(bool)

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