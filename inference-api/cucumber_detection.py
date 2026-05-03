# cucumber_detection.py

from typing import List, Optional

import cv2

from detection_utils import run_yolo_boxes, clamp_box


CONF_CUCUMBER = 0.35

def detect_cucumbers(model, pil_img, conf=CONF_CUCUMBER):
    return run_yolo_boxes(model, pil_img, conf=conf)


def pick_primary_det(dets: List[dict]) -> Optional[dict]:

    if not dets:
        return None

    def score(d: dict) -> float:
        x1, y1, x2, y2 = d.get("box", [0, 0, 0, 0])
        area = max(0.0, (x2 - x1)) * max(0.0, (y2 - y1))
        conf = float(d.get("conf", 0.0) or 0.0)
        return area * (0.5 + conf)

    return max(dets, key=score)


def draw_cucumber_measurement_labels(img_bgr, cucumbers: List[dict]):

    if not cucumbers:
        return

    img_h, img_w = img_bgr.shape[:2]

    for cucumber in cucumbers:
        try:
            box = cucumber.get("box") or []
            if len(box) != 4:
                continue

            x1, y1, x2, y2 = clamp_box(box, img_w, img_h)

            index = int(cucumber.get("index", 0)) + 1
            cm_obj = cucumber.get("cm") if isinstance(cucumber.get("cm"), dict) else None
            pixel_obj = cucumber.get("pixel") if isinstance(cucumber.get("pixel"), dict) else {}
            is_ripe = cucumber.get("ripe") is True

            if cm_obj:
                length_cm = cm_obj.get("lengthCm")
                diameter_cm = cm_obj.get("diameterCm")
                label = (
                    f"C{index}: {length_cm}cm x {diameter_cm}cm "
                    f"{'RIPE' if is_ripe else 'UNRIPE'}"
                )
            else:
                length_px = int(float(pixel_obj.get("lengthPx", 0) or 0))
                diameter_px = int(float(pixel_obj.get("diameterPx", 0) or 0))
                label = f"C{index}: {length_px}px x {diameter_px}px"

            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.55
            thickness = 2

            (text_w, text_h), baseline = cv2.getTextSize(
                label,
                font,
                font_scale,
                thickness,
            )

            label_x = max(4, min(x1, img_w - text_w - 12))
            label_y = max(text_h + 8, y1 - 8)

            bg_color = (0, 140, 255) if is_ripe else (0, 120, 0)

            cv2.rectangle(
                img_bgr,
                (label_x - 4, label_y - text_h - 6),
                (label_x + text_w + 6, label_y + baseline + 4),
                bg_color,
                -1,
            )

            cv2.putText(
                img_bgr,
                label,
                (label_x, label_y),
                font,
                font_scale,
                (255, 255, 255),
                thickness,
                cv2.LINE_AA,
            )

        except Exception:
            continue