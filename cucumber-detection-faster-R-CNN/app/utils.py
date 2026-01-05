from PIL import Image
import numpy as np
import cv2
import torchvision


def pil_to_tensor(img: Image.Image):
    # Faster R-CNN expects tensor [C,H,W] in [0,1]
    img = img.convert("RGB")
    return torchvision.transforms.functional.to_tensor(img)


def draw_boxes_opencv(pil_img: Image.Image, detections: list):
    """
    detections: [{bbox:[x1,y1,x2,y2], confidence:float}, ...]
    returns: annotated image as BGR numpy array
    """
    img_rgb = np.array(pil_img.convert("RGB"))
    img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)

    for det in detections:
        x1, y1, x2, y2 = map(int, det["bbox"])
        conf = float(det["confidence"])

        cv2.rectangle(img_bgr, (x1, y1), (x2, y2), (0, 255, 0), 2)
        label = f"cucumber {conf:.2f}"
        cv2.putText(
            img_bgr,
            label,
            (x1, max(0, y1 - 10)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 0),
            2
        )

    return img_bgr
