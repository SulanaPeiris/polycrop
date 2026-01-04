from PIL import Image
import numpy as np
import cv2
import torchvision


def pil_to_tensor(img: Image.Image):
    img = img.convert("RGB")
    return torchvision.transforms.functional.to_tensor(img)


def draw_boxes_opencv(
    pil_img: Image.Image,
    detections: list,
    box_thickness: int = 5,
    text_scale: float = 2.5,
    text_thickness: int = 7,
    pad: int = 8
):
    img_rgb = np.array(pil_img.convert("RGB"))
    img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)

    for det in detections:
        x1, y1, x2, y2 = map(int, det["bbox"])
        conf = float(det["confidence"])
        cls = det.get("class", "Cucumber Leaf")

        label = f"{cls} {conf*100:.1f}%"

        cv2.rectangle(img_bgr, (x1, y1), (x2, y2), (0, 255, 0), box_thickness)

        (tw, th), baseline = cv2.getTextSize(
            label, cv2.FONT_HERSHEY_SIMPLEX, text_scale, text_thickness
        )

        text_x = x1
        text_y = y1 - 10
        if text_y - th - pad < 0:
            text_y = y1 + th + pad + 5

        bg_x1 = text_x
        bg_y1 = text_y - th - pad
        bg_x2 = text_x + tw + pad * 2
        bg_y2 = text_y + baseline + pad

        cv2.rectangle(img_bgr, (bg_x1, bg_y1), (bg_x2, bg_y2), (0, 255, 0), -1)

        cv2.putText(
            img_bgr,
            label,
            (text_x + pad, text_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            text_scale,
            (0, 0, 0),
            text_thickness,
            cv2.LINE_AA
        )

    return img_bgr
